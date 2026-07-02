import { Button } from "@modelforge/ui";
import { ErdCanvas } from "@modelforge/canvas";
import type { Model } from "@modelforge/schema-engine";

const sampleModel: Model = {
  id: "sample",
  name: "Sample",
  adapter: "postgresql",
  views: [],
  sequences: [],
  enums: [],
  entities: [
    {
      id: "customer",
      logicalName: "Customer",
      physicalName: "customer",
      tags: [],
      attributes: [],
      indexes: [],
      ui: { x: 0, y: 0 },
    },
    {
      id: "order",
      logicalName: "Order",
      physicalName: "order",
      tags: [],
      attributes: [],
      indexes: [],
      ui: { x: 280, y: 0 },
    },
  ],
  relationships: [
    {
      id: "r1",
      name: "places",
      sourceEntityId: "customer",
      targetEntityId: "order",
      cardinality: "one-to-many",
      kind: "non-identifying",
      optionality: "mandatory",
      sourceAttributeIds: [],
      targetAttributeIds: [],
    },
  ],
};

export function App() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <h1 className="text-lg font-semibold">ModelForge</h1>
        <Button variant="primary">Deploy</Button>
      </header>
      <main className="flex-1">
        <ErdCanvas model={sampleModel} />
      </main>
    </div>
  );
}
