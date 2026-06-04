import { z } from "zod";

// ── Stage 1: Intent ────────────────────────────────────────────────
export const IntentSchema = z.object({
  appName: z.string(),
  appType: z.string(),
  summary: z.string(),
  entities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(["string", "number", "boolean", "date", "uuid", "enum", "text"]),
      required: z.boolean(),
      enumValues: z.array(z.string()).optional()
    }))
  })),
  roles: z.array(z.object({
    name: z.string(),
    permissions: z.array(z.string())
  })),
  features: z.array(z.string()),
  hasAuth: z.boolean(),
  hasPayments: z.boolean(),
  hasDashboard: z.boolean(),
  hasRBAC: z.boolean(),
  assumptions: z.array(z.string()),
  clarificationsNeeded: z.array(z.string())
});

// ── Stage 2: System Design ─────────────────────────────────────────
export const SystemDesignSchema = z.object({
  pages: z.array(z.object({
    name: z.string(),
    route: z.string(),
    accessRoles: z.array(z.string()),
    components: z.array(z.string()),
    dataNeeds: z.array(z.string())
  })),
  apiEndpoints: z.array(z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string(),
    description: z.string(),
    requestBody: z.record(z.string()).optional(),
    responseShape: z.record(z.string()),
    requiredRoles: z.array(z.string()),
    entity: z.string()
  })),
  dbTables: z.array(z.object({
    name: z.string(),
    entity: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
      primaryKey: z.boolean().optional(),
      foreignKey: z.string().optional(),
      unique: z.boolean().optional(),
      default: z.string().optional()
    })),
    indexes: z.array(z.string())
  })),
  authFlow: z.object({
    strategy: z.string(),
    tokenType: z.string(),
    sessionDuration: z.string(),
    refreshStrategy: z.string()
  }),
  businessRules: z.array(z.object({
    name: z.string(),
    description: z.string(),
    appliesTo: z.string(),
    condition: z.string(),
    action: z.string()
  }))
});

// ── Stage 3: Full Schema ──────────────────────────────────────────
export const UIComponentSchema = z.object({
  id: z.string(),
  type: z.enum(["form", "table", "card", "chart", "nav", "modal", "button", "input", "select", "dashboard-widget"]),
  label: z.string(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    label: z.string(),
    required: z.boolean().optional(),
    apiField: z.string(),
    validation: z.string().optional()
  })).optional(),
  actions: z.array(z.object({
    label: z.string(),
    type: z.enum(["submit", "navigate", "delete", "api-call"]),
    endpoint: z.string().optional(),
    method: z.string().optional()
  })).optional(),
  dataSource: z.string().optional()
});

export const FullSchemaOutput = z.object({
  meta: z.object({
    appName: z.string(),
    version: z.string(),
    generatedAt: z.string(),
    assumptions: z.array(z.string())
  }),
  ui: z.object({
    pages: z.array(z.object({
      id: z.string(),
      name: z.string(),
      route: z.string(),
      title: z.string(),
      accessRoles: z.array(z.string()),
      layout: z.enum(["single-column", "two-column", "dashboard", "auth"]),
      components: z.array(UIComponentSchema)
    }))
  }),
  api: z.object({
    baseUrl: z.string(),
    version: z.string(),
    auth: z.object({
      type: z.string(),
      headerName: z.string()
    }),
    endpoints: z.array(z.object({
      id: z.string(),
      method: z.string(),
      path: z.string(),
      description: z.string(),
      requestBody: z.record(z.object({
        type: z.string(),
        required: z.boolean(),
        validation: z.string().optional()
      })).optional(),
      response: z.object({
        status: z.number(),
        shape: z.record(z.string())
      }),
      requiredRoles: z.array(z.string()),
      dbTable: z.string()
    }))
  }),
  db: z.object({
    dialect: z.string(),
    tables: z.array(z.object({
      name: z.string(),
      columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        primaryKey: z.boolean().optional(),
        foreignKey: z.string().optional(),
        unique: z.boolean().optional(),
        default: z.string().optional()
      })),
      indexes: z.array(z.string()),
      relations: z.array(z.object({
        type: z.enum(["hasMany", "belongsTo", "hasOne"]),
        target: z.string(),
        foreignKey: z.string()
      }))
    }))
  }),
  auth: z.object({
    strategy: z.string(),
    roles: z.array(z.object({
      name: z.string(),
      inherits: z.string().optional(),
      permissions: z.array(z.string())
    })),
    rules: z.array(z.object({
      resource: z.string(),
      action: z.string(),
      allowedRoles: z.array(z.string()),
      condition: z.string().optional()
    }))
  }),
  businessLogic: z.object({
    rules: z.array(z.object({
      id: z.string(),
      name: z.string(),
      trigger: z.string(),
      condition: z.string(),
      action: z.string(),
      affectedEntities: z.array(z.string())
    }))
  })
});

export type Intent = z.infer<typeof IntentSchema>;
export type SystemDesign = z.infer<typeof SystemDesignSchema>;
export type FullSchema = z.infer<typeof FullSchemaOutput>;
