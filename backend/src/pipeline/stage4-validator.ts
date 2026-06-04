import { callLLM, safeParseJSON } from "../utils/llm.js";
import { FullSchemaOutput, type FullSchema } from "../schemas/index.js";

export interface ValidationIssue {
  layer: "ui" | "api" | "db" | "auth" | "businessLogic" | "cross-layer";
  severity: "error" | "warning";
  code: string;
  message: string;
  path: string;
  suggestedFix?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  repairedSchema?: FullSchema;
  repairAttempts: number;
}

// ── Core Validators ──────────────────────────────────────────────

function validateCrossLayerConsistency(schema: FullSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const dbTableNames = new Set(schema.db.tables.map(t => t.name));
  const apiEndpointPaths = new Set(schema.api.endpoints.map(e => e.path));
  const authRoleNames = new Set(schema.auth.roles.map(r => r.name));
  const dbColumnsByTable: Record<string, Set<string>> = {};

  for (const table of schema.db.tables) {
    dbColumnsByTable[table.name] = new Set(table.columns.map(c => c.name));
  }

  // 1. API endpoint dbTable must exist in db.tables
  for (const ep of schema.api.endpoints) {
    if (!dbTableNames.has(ep.dbTable)) {
      issues.push({
        layer: "cross-layer",
        severity: "error",
        code: "API_TABLE_MISSING",
        message: `API endpoint "${ep.path}" references dbTable "${ep.dbTable}" which does not exist in db.tables`,
        path: `api.endpoints[${ep.id}].dbTable`,
        suggestedFix: `Add table "${ep.dbTable}" to db.tables or correct the dbTable reference`
      });
    }

    // 2. requestBody fields must match db columns
    if (ep.requestBody && dbColumnsByTable[ep.dbTable]) {
      for (const field of Object.keys(ep.requestBody)) {
        if (!dbColumnsByTable[ep.dbTable].has(field) && field !== "password") {
          issues.push({
            layer: "cross-layer",
            severity: "error",
            code: "API_FIELD_NO_DB_COLUMN",
            message: `API endpoint "${ep.path}" requestBody field "${field}" not found in table "${ep.dbTable}"`,
            path: `api.endpoints[${ep.id}].requestBody.${field}`,
            suggestedFix: `Add column "${field}" to table "${ep.dbTable}" or remove from requestBody`
          });
        }
      }
    }

    // 3. requiredRoles must exist in auth.roles
    for (const role of ep.requiredRoles) {
      if (!authRoleNames.has(role)) {
        issues.push({
          layer: "cross-layer",
          severity: "error",
          code: "ROLE_NOT_DEFINED",
          message: `API endpoint "${ep.path}" requires role "${role}" which is not defined in auth.roles`,
          path: `api.endpoints[${ep.id}].requiredRoles`,
          suggestedFix: `Add role "${role}" to auth.roles`
        });
      }
    }
  }

  // 4. UI component apiField must map to an API endpoint response field
  const apiResponseFields: Record<string, Set<string>> = {};
  for (const ep of schema.api.endpoints) {
    apiResponseFields[ep.path] = new Set(Object.keys(ep.response.shape));
  }

  for (const page of schema.ui.pages) {
    // 5. page accessRoles must exist in auth.roles
    for (const role of page.accessRoles) {
      if (!authRoleNames.has(role) && role !== "public") {
        issues.push({
          layer: "cross-layer",
          severity: "error",
          code: "PAGE_ROLE_NOT_DEFINED",
          message: `Page "${page.route}" requires role "${role}" not defined in auth.roles`,
          path: `ui.pages[${page.id}].accessRoles`,
          suggestedFix: `Add role "${role}" to auth.roles or fix the page access control`
        });
      }
    }

    for (const comp of page.components) {
      if (comp.dataSource && !apiEndpointPaths.has(comp.dataSource)) {
        issues.push({
          layer: "cross-layer",
          severity: "warning",
          code: "COMPONENT_DATASOURCE_MISSING",
          message: `Component "${comp.id}" dataSource "${comp.dataSource}" does not match any API endpoint`,
          path: `ui.pages[${page.id}].components[${comp.id}].dataSource`,
          suggestedFix: `Correct dataSource to an existing endpoint path`
        });
      }
    }
  }

  // 6. DB foreign keys must reference real tables
  for (const table of schema.db.tables) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        const refTable = col.foreignKey.split(".")[0];
        if (!dbTableNames.has(refTable)) {
          issues.push({
            layer: "cross-layer",
            severity: "error",
            code: "FOREIGN_KEY_MISSING_TABLE",
            message: `Table "${table.name}" column "${col.name}" foreign key references missing table "${refTable}"`,
            path: `db.tables[${table.name}].columns[${col.name}].foreignKey`,
            suggestedFix: `Add table "${refTable}" or fix the foreign key reference`
          });
        }
      }
    }
  }

  // 7. Business logic affectedEntities must match db tables
  for (const rule of schema.businessLogic.rules) {
    for (const entity of rule.affectedEntities) {
      if (!dbTableNames.has(entity)) {
        issues.push({
          layer: "cross-layer",
          severity: "warning",
          code: "BUSINESS_RULE_ENTITY_MISSING",
          message: `Business rule "${rule.name}" references entity "${entity}" not in db.tables`,
          path: `businessLogic.rules[${rule.id}].affectedEntities`,
          suggestedFix: `Change affectedEntities to use exact table names from db.tables`
        });
      }
    }
  }

  // 8. Check every table has a primary key
  for (const table of schema.db.tables) {
    const hasPK = table.columns.some(c => c.primaryKey);
    if (!hasPK) {
      issues.push({
        layer: "db",
        severity: "error",
        code: "TABLE_NO_PRIMARY_KEY",
        message: `Table "${table.name}" has no primary key column`,
        path: `db.tables[${table.name}]`,
        suggestedFix: `Add an "id" column with primaryKey: true`
      });
    }
  }

  return issues;
}

// ── Targeted Repair ──────────────────────────────────────────────

async function repairSchema(
  schema: FullSchema,
  issues: ValidationIssue[],
  attempt: number
): Promise<FullSchema> {
  const errorIssues = issues.filter(i => i.severity === "error");

  const REPAIR_SYSTEM = `You are the Repair Engine of an app compiler pipeline.
You receive a schema with specific validation errors and must fix ONLY those errors.
Rules:
- Fix ONLY the listed issues. Do not change anything else.
- Maintain all existing IDs, names, routes
- Ensure cross-layer consistency after your fix
- Return the complete corrected schema as valid JSON. No prose.`;

  const REPAIR_USER = `Fix these specific validation errors in the schema:

ERRORS TO FIX:
${errorIssues.map((i, idx) => `${idx + 1}. [${i.code}] ${i.message}
   Path: ${i.path}
   Fix: ${i.suggestedFix}`).join("\n\n")}

CURRENT SCHEMA:
${JSON.stringify(schema, null, 2)}

Return the complete fixed schema JSON.`;

  const raw = await callLLM(REPAIR_SYSTEM, REPAIR_USER, 0.1, 3000);
  const parsed = safeParseJSON(raw);
  return FullSchemaOutput.parse(parsed);
}

// ── Main Validator ───────────────────────────────────────────────

export async function validateAndRepair(
  schema: FullSchema,
  maxAttempts = 3
): Promise<ValidationResult> {
  let current = schema;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    const issues = validateCrossLayerConsistency(current);
    const errors = issues.filter(e => e.severity === "error");

    if (errors.length === 0) {
      return {
        valid: true,
        issues,
        repairedSchema: current,
        repairAttempts: attempts
      };
    }

    attempts++;
    try {
      current = await repairSchema(current, issues, attempts);
    } catch (err) {
      return {
        valid: false,
        issues,
        repairedSchema: current,
        repairAttempts: attempts
      };
    }
  }

  // Final check after max attempts
  const finalIssues = validateCrossLayerConsistency(current);
  return {
    valid: finalIssues.filter(i => i.severity === "error").length === 0,
    issues: finalIssues,
    repairedSchema: current,
    repairAttempts: attempts
  };
}
