# Plugin Architecture

핵심 설계 원칙 #4: Exporter, Importer, Code Generator, AI Provider, Layout Engine은 코어에 하드코딩하지 않고 **플러그인**으로 등록한다. 초기에 이 구조를 잡아두면 신규 언어/포맷/AI 모델/레이아웃 알고리즘 추가가 코어 변경 없이 가능해진다.

모든 플러그인은 `packages/sdk`가 정의하는 타입만 의존하며, 서로를 직접 참조하지 않는다.

## PluginRegistry

```ts
interface PluginRegistry {
  exporters: Map<string, Exporter>;
  importers: Map<string, Importer>;
  generators: Map<string, CodeGenerator>;
  aiProviders: Map<string, AIProvider>;
  layoutEngines: Map<string, LayoutEngine>;

  register(plugin: Plugin): void;
}

type Plugin =
  | { type: "exporter"; impl: Exporter }
  | { type: "importer"; impl: Importer }
  | { type: "generator"; impl: CodeGenerator }
  | { type: "ai-provider"; impl: AIProvider }
  | { type: "layout-engine"; impl: LayoutEngine };
```

각 플러그인은 `id`(예: `"export.png"`, `"generator.prisma"`)와 `label`을 가지며 UI(Export 메뉴, Bottom Panel 등)는 레지스트리를 순회해 동적으로 목록을 렌더링한다.

## Exporter

```ts
interface Exporter {
  id: string; // "export.png" | "export.pdf" | "export.mermaid" | ...
  label: string;
  targetFormat: "png" | "svg" | "pdf" | "markdown" | "excel" | "json" | "sql" | "mermaid";
  export(model: Model, options?: unknown): Promise<Blob | string>;
}
```

## Importer

```ts
interface Importer {
  id: string; // "import.sql" | "import.dbml" | "import.appwrite" | ...
  label: string;
  sourceFormat:
    | "sql"
    | "dbml"
    | "mermaid"
    | "prisma"
    | "appwrite"
    | "postgresql"
    | "mysql"
    | "mssql"
    | "oracle";
  parse(input: string | Blob): Promise<Model>;
}
```

RDBMS/Appwrite Importer는 내부적으로 [adapters.md](adapters.md)의 `DatabaseAdapter.fromNativeSchema`를 호출하는 thin wrapper인 경우가 많다. DBML/Mermaid처럼 배포 대상이 아닌 순수 텍스트 포맷은 `packages/parser`에 독립 파서로 구현한다.

## CodeGenerator

```ts
interface CodeGenerator {
  id: string; // "generator.prisma" | "generator.typescript" | "generator.openapi" | ...
  label: string;
  category: "orm" | "language" | "api-doc";
  generate(model: Model, options?: unknown): Promise<GeneratedFile[]>;
}

interface GeneratedFile {
  path: string; // "schema.prisma", "src/entities/Customer.ts"
  content: string;
}
```

지원 대상 (레지스트리 등록 예정 목록, Phase별):

- **ORM**: Prisma, Drizzle, TypeORM, JPA, Hibernate, Entity Framework
- **언어**: TypeScript, Java, Kotlin, Dart, Go, Swift, Python, Rust
- **API 문서**: OpenAPI, Swagger, REST Docs, GraphQL SDL

## AIProvider

```ts
interface AIProvider {
  id: string; // "ai.anthropic" | "ai.openai" | ...
  label: string;

  // 자연어 -> 신규 모델 초안 (예: "쇼핑몰 만들어줘")
  generateModel(prompt: string, context?: { existingModel?: Model }): Promise<Operation[]>;

  // 자연어 -> 기존 모델에 대한 수정 지시 (예: "주문에 배송정보 추가")
  reviseModel(prompt: string, model: Model): Promise<Operation[]>;
}
```

AI Provider는 최종 모델을 직접 반환하지 않고 **[Operation 시퀀스](operations.md)**를 반환한다 — 이렇게 하면 AI가 만든 변경도 Undo/Redo, Diff, History에 자연스럽게 편입된다. 사용자는 적용 전에 Diff Preview로 검토할 수 있다.

## LayoutEngine

```ts
interface LayoutEngine {
  id: string; // "layout.elk-tree" | "layout.dagre-layer" | "layout.force" | ...
  label: string;
  algorithm: "tree" | "grid" | "layer" | "force" | "orthogonal";
  layout(model: Model): Promise<Record<string /* entityId */, { x: number; y: number }>>;
}
```

ELK.js와 Dagre는 각각 여러 알고리즘(tree/layer/orthogonal 등)을 제공하므로 하나의 라이브러리 통합이 여러 `LayoutEngine` 등록으로 이어질 수 있다.

## 등록 시점

- **내장 플러그인**: `apps/web` 부트스트랩 시 `packages/*`에서 기본 제공하는 Exporter/Importer/Generator를 등록.
- **서드파티/사용자 플러그인** (Phase 4 Marketplace): 별도 매니페스트(`plugin.json` — id, type, entry point)를 통해 런타임에 동적 로드. 이 문서의 인터페이스가 Marketplace 플러그인의 공개 계약이 된다.

관련 문서: [schema-engine.md](schema-engine.md) · [operations.md](operations.md) · [adapters.md](adapters.md)
