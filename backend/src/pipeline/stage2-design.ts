import { callLLM, safeParseJSON } from "../utils/llm.js";
import { SystemDesignSchema, type Intent, type SystemDesign } from "../schemas/index.js";

const SYSTEM = `You are the System Design stage of an app compiler pipeline.
You receive a structured intent object and produce a full system design.
Rules:
- Every entity from intent MUST map to exactly one dbTable
- Every page MUST have at least one API endpoint that serves its data
- API endpoint paths must use RESTful conventions (/api/v1/resource/:id)
- requestBody fields must match dbTable column names exactly
- responseShape must list actual field names from the dbTable
- Every role from intent must appear in at least one endpoint's requiredRoles
- Business rules must reference real entities by exact name
- Return ONLY valid JSON. No prose.`;

const USER_TEMPLATE = (intent: Intent) => `
Design the full system architecture for this app:

${JSON.stringify(intent, null, 2)}

Return JSON with this exact shape:
{
  "pages": [{ "name": string, "route": string, "accessRoles": string[], "components": string[], "dataNeeds": string[] }],
  "apiEndpoints": [{ "method": "GET"|"POST"|"PUT"|"PATCH"|"DELETE", "path": string, "description": string, "requestBody"?: Record<string,string>, "responseShape": Record<string,string>, "requiredRoles": string[], "entity": string }],
  "dbTables": [{ "name": string, "entity": string, "columns": [{ "name": string, "type": string, "nullable": boolean, "primaryKey"?: boolean, "foreignKey"?: string, "unique"?: boolean, "default"?: string }], "indexes": string[] }],
  "authFlow": { "strategy": string, "tokenType": string, "sessionDuration": string, "refreshStrategy": string },
  "businessRules": [{ "name": string, "description": string, "appliesTo": string, "condition": string, "action": string }]
}`;

export async function designSystem(intent: Intent): Promise<SystemDesign> {
  const raw = await callLLM(SYSTEM, USER_TEMPLATE(intent), 0.2, 4000);
  const parsed = safeParseJSON(raw);
  return SystemDesignSchema.parse(parsed);
}
