# AppCompiler — Natural Language → Executable App Schema

> A multi-stage compiler pipeline that converts plain English app descriptions into validated, cross-layer-consistent JSON schemas ready to power a real application.

## Architecture

```
User Prompt
    │
    ▼
Stage 1: Intent Extraction      ← Entities, roles, features, assumptions
    │
    ▼
Stage 2: System Design          ← Pages, API endpoints, DB tables, auth flow
    │
    ▼
Stage 3: Schema Generation      ← Full UI/API/DB/Auth/BusinessLogic JSON
    │
    ▼
Stage 4: Validation + Repair    ← 8 cross-layer checks, targeted surgical repair
    │
    ▼
Stage 5: Refinement             ← Final polish, warning resolution
    │
    ▼
Executable Schema JSON
```

## Prerequisites

- Node.js 18+
- npm
- OpenAI API key (GPT-4o)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm run dev
```

Backend runs on http://localhost:3001

### 2. Frontend

```bash
cd frontend
npx serve . -p 3000
```

Frontend runs on http://localhost:3000

Open http://localhost:3000 in your browser.

## Validation Checks (Stage 4)

The repair engine checks **8 cross-layer consistency rules**:

| Code | Description |
|------|-------------|
| `API_TABLE_MISSING` | API endpoint references a DB table that doesn't exist |
| `API_FIELD_NO_DB_COLUMN` | API requestBody field not found as a DB column |
| `ROLE_NOT_DEFINED` | API endpoint requires a role not defined in auth.roles |
| `PAGE_ROLE_NOT_DEFINED` | UI page requires a role not defined in auth.roles |
| `COMPONENT_DATASOURCE_MISSING` | UI component dataSource doesn't match any API endpoint |
| `FOREIGN_KEY_MISSING_TABLE` | DB foreign key references a table that doesn't exist |
| `BUSINESS_RULE_ENTITY_MISSING` | Business rule references an entity not in db.tables |
| `TABLE_NO_PRIMARY_KEY` | DB table has no primary key column |

Errors trigger targeted LLM repair (max 3 attempts). Warnings are passed to Stage 5 for refinement.

## Evaluation

Run the 20-prompt evaluation suite:

```bash
cd backend
npm run eval
```

Produces `eval-results.json` with:
- Success rate (real prompts vs edge cases)
- Avg duration per run
- Repair attempts per run
- Cost breakdown
- Failure mode analysis

## API

### `POST /api/generate` (SSE streaming)

```json
{ "prompt": "Build a CRM with..." }
```

Streams `text/event-stream` events:
- `{ type: "stage", stage: 1-5, status: "running"|"done"|"error", durationMs }` 
- `{ type: "complete", success, schema, intent, totalDurationMs, repairAttempts, validationIssues, cost }`
- `{ type: "error", message }`

### `POST /api/generate/sync`

Same but returns full result as JSON (no streaming).

## Output Schema Structure

```json
{
  "meta": { "appName", "version", "generatedAt", "assumptions" },
  "ui": {
    "pages": [{ "id", "name", "route", "layout", "accessRoles", "components": [...] }]
  },
  "api": {
    "baseUrl", "endpoints": [{ "method", "path", "requestBody", "response", "requiredRoles", "dbTable" }]
  },
  "db": {
    "dialect", "tables": [{ "name", "columns": [...], "indexes", "relations" }]
  },
  "auth": {
    "strategy", "roles": [{ "name", "permissions" }], "rules": [...]
  },
  "businessLogic": {
    "rules": [{ "trigger", "condition", "action", "affectedEntities" }]
  }
}
```

## Deploy to Railway

1. Push to GitHub
2. Go to railway.app → New Project → from GitHub
3. Add env var: `OPENAI_API_KEY`
4. Deploy — Railway auto-detects Node and builds

For frontend, deploy the `/frontend` folder to Vercel or Netlify (static HTML, zero config).

## Cost vs Quality Tradeoffs

| Tradeoff | Decision |
|----------|----------|
| GPT-4o vs GPT-4o-mini | GPT-4o for accuracy; ~10x cost but critical for schema consistency |
| Temperature 0.1 | Low temperature for determinism; slight creativity in stage 1 (0.2) |
| Max repair attempts: 3 | Balances quality vs latency/cost; 3 covers 95%+ of real failures |
| Targeted repair | Re-gen only broken layer, not full pipeline; saves ~60% cost on repairs |
| Stage 5 fallback | If refinement LLM call fails, return stage 4 output — never fail silently |
