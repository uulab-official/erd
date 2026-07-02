// Owns the AdapterRegistry and turns Diff Engine output into MigrationPlans. See /docs/adapters.md.
export { createAdapterRegistry } from "@modelforge/sdk";
export type { DatabaseAdapter, MigrationPlan, MigrationStep, DeployResult } from "@modelforge/sdk";
export * from "./adapters/appwrite/index.js";
