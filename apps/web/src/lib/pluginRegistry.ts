import { createPluginRegistry } from "@modelforge/sdk";

// The single PluginRegistry instance apps/web registers every built-in Exporter/
// Importer/CodeGenerator/LayoutEngine into at module-load time (docs/plugins.md's "내장
// 플러그인" registration point) — lib/exporters.ts, lib/generators.ts, lib/layouts.ts,
// and lib/importText.ts each call `pluginRegistry.register(...)` for their plugins and
// re-export a plain array view (`[...pluginRegistry.exporters.values()]`) so Toolbar.tsx
// and friends don't need to change. AIProvider/third-party dynamic loading (Phase 4
// Marketplace) would register into this same instance rather than a separate one.
export const pluginRegistry = createPluginRegistry();
