import { callLLM, safeParseJSON } from "../utils/llm.js";
import { FullSchemaOutput, type Intent, type SystemDesign, type FullSchema } from "../schemas/index.js";

const SYSTEM = `You are the Schema Generation stage of an app compiler pipeline.
You receive intent + system design and produce the final executable app schema.
Critical rules:
- Every UI component field's "apiField" must exactly match a field in the corresponding API endpoint's requestBody or responseShape
- Every API endpoint's "dbTable" must exactly match a table name in db.tables
- Every API endpoint requestBody field must exactly match a column name in the referenced dbTable
- Auth rules "resource" must match an API endpoint path pattern
- Business logic "affectedEntities" must match db table names exactly
- Page "accessRoles" must be a subset of auth.roles names
- Generate stable unique IDs (snake_case) for pages, components, endpoints
- Return ONLY valid JSON. No prose. No markdown.`;

const USER_TEMPLATE = (intent: Intent, design: SystemDesign) => `
Generate the complete executable app schema.

INTENT SUMMARY:
- App: ${intent.appName} (${intent.appType})
- Entities: ${intent.entities.map(e => e.name).join(", ")}
- Roles: ${intent.roles.map(r => r.name).join(", ")}
- Features: ${intent.features.join(", ")}
- hasAuth: ${intent.hasAuth}, hasPayments: ${intent.hasPayments}, hasDashboard: ${intent.hasDashboard}
- Assumptions: ${intent.assumptions.join("; ")}

PAGES: ${design.pages.map(p => `${p.name}(${p.route})`).join(", ")}

API ENDPOINTS: ${design.apiEndpoints.map(e => `${e.method} ${e.path}`).join(", ")}

DB TABLES: ${design.dbTables.map(t => `${t.name}(${t.columns.map(c => c.name).join(",")})`).join("; ")}

AUTH: ${JSON.stringify(design.authFlow)}

BUSINESS RULES: ${design.businessRules.map(r => r.name).join(", ")}

Return JSON with this exact shape:
{
  "meta": { "appName": string, "version": "1.0.0", "generatedAt": string (ISO), "assumptions": string[] },
  "ui": {
    "pages": [{
      "id": string, "name": string, "route": string, "title": string,
      "accessRoles": string[], "layout": "single-column"|"two-column"|"dashboard"|"auth",
      "components": [{
        "id": string, "type": "form"|"table"|"card"|"chart"|"nav"|"modal"|"button"|"input"|"select"|"dashboard-widget",
        "label": string,
        "fields"?: [{ "name": string, "type": string, "label": string, "required"?: boolean, "apiField": string, "validation"?: string }],
        "actions"?: [{ "label": string, "type": "submit"|"navigate"|"delete"|"api-call", "endpoint"?: string, "method"?: string }],
        "dataSource"?: string
      }]
    }]
  },
  "api": {
    "baseUrl": "/api/v1", "version": "1.0.0",
    "auth": { "type": "Bearer", "headerName": "Authorization" },
    "endpoints": [{
      "id": string, "method": string, "path": string, "description": string,
      "requestBody"?: Record<string, { "type": string, "required": boolean, "validation"?: string }>,
      "response": { "status": number, "shape": Record<string, string> },
      "requiredRoles": string[], "dbTable": string
    }]
  },
  "db": {
    "dialect": "postgresql",
    "tables": [{
      "name": string,
      "columns": [{ "name": string, "type": string, "nullable": boolean, "primaryKey"?: boolean, "foreignKey"?: string, "unique"?: boolean, "default"?: string }],
      "indexes": string[],
      "relations": [{ "type": "hasMany"|"belongsTo"|"hasOne", "target": string, "foreignKey": string }]
    }]
  },
  "auth": {
    "strategy": string,
    "roles": [{ "name": string, "inherits"?: string, "permissions": string[] }],
    "rules": [{ "resource": string, "action": string, "allowedRoles": string[], "condition"?: string }]
  },
  "businessLogic": {
    "rules": [{ "id": string, "name": string, "trigger": string, "condition": string, "action": string, "affectedEntities": string[] }]
  }
}`;

export async function generateSchema(intent: Intent, design: SystemDesign): Promise<FullSchema> {
  const raw = await callLLM(SYSTEM, USER_TEMPLATE(intent, design), 0.1, 8000);
  const parsed = safeParseJSON(raw);
  return FullSchemaOutput.parse(parsed);
}
