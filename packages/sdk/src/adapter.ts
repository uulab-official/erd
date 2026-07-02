// DatabaseAdapter contract. See /docs/adapters.md.
import type { AdapterKind, ColumnType, Model } from "@modelforge/schema-engine";

export interface MigrationStep {
  action:
    | "create-collection"
    | "create-table"
    | "add-attribute"
    | "drop-attribute"
    | "alter-attribute"
    | "create-index"
    | "drop-index"
    | "create-relationship";
  target: string;
  sql?: string;
  appwriteCall?: unknown;
  destructive: boolean;
  warning?: string;
}

export interface MigrationPlan {
  id: string;
  adapterKind: AdapterKind;
  steps: MigrationStep[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface AdapterCredentials {
  [key: string]: unknown;
}

export interface DeployResult {
  planId: string;
  appliedSteps: string[];
  failedStep?: { step: MigrationStep; error: string };
}

export interface DatabaseAdapter<TNativeSchema = unknown> {
  readonly kind: AdapterKind;
  toNativeSchema(model: Model): TNativeSchema;
  fromNativeSchema(native: TNativeSchema): Model;
  plan(current: Model, deployedSnapshot: Model | null): MigrationPlan;
  apply(plan: MigrationPlan, credentials: AdapterCredentials): Promise<DeployResult>;
  rollbackPlan(plan: MigrationPlan): MigrationPlan;
  mapType(type: ColumnType, length?: number, scale?: number): string;
  validate(model: Model): ValidationIssue[];
}

export interface AdapterRegistry {
  register(adapter: DatabaseAdapter): void;
  get(kind: AdapterKind): DatabaseAdapter;
  list(): AdapterKind[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<AdapterKind, DatabaseAdapter>();
  return {
    register(adapter) {
      adapters.set(adapter.kind, adapter);
    },
    get(kind) {
      const adapter = adapters.get(kind);
      if (!adapter) throw new Error(`No adapter registered for "${kind}"`);
      return adapter;
    },
    list() {
      return Array.from(adapters.keys());
    },
  };
}
