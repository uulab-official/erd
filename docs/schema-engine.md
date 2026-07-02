# Schema Engine — Data Model Spec

`packages/schema-engine`가 소유하는 단일 진실 소스(Single Source of Truth). Canvas(React Flow)는 이 스키마를 렌더링만 하며, 절대 직접 소유하지 않는다.

## 설계 규칙

- 모든 타입은 JSON-serializable (Appwrite Document / Git diff / Realtime broadcast에 그대로 실린다).
- 모든 엔티티는 `id`(ULID), `createdAt`, `updatedAt`, `version`을 가진다.
- 좌표/색상 등 순수 UI 상태(`position`, `zIndex`, `collapsed`)는 스키마에 포함하되 `ui` 네임스페이스로 분리 — Diff Engine이 구조적 변경과 시각적 변경을 구분할 수 있어야 한다.

## 최상위 컨테이너

```ts
interface Project {
  id: string;
  name: string;
  models: Model[]; // 여러 스키마를 하나의 프로젝트에서 관리 (예: main DB + analytics DB)
  dictionary: DictionaryEntry[];
  domains: Domain[];
  namingRules: NamingRuleSet;
  subjectAreas: SubjectArea[];
}

interface Model {
  id: string;
  name: string;
  adapter: AdapterKind; // 'appwrite' | 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'oracle'
  entities: Entity[];
  relationships: Relationship[];
  views: View[];
  sequences: Sequence[];
  enums: EnumType[];
}
```

## Entity

```ts
interface Entity {
  id: string;
  logicalName: string; // "고객"
  physicalName: string; // "customer"
  description?: string;
  category?: string;
  owner?: string;
  tags: string[];
  color?: string;
  icon?: string;
  attributes: Attribute[];
  indexes: Index[];
  subjectAreaId?: string;
  ui: { x: number; y: number; width?: number; height?: number; collapsed?: boolean };
}
```

## Attribute

```ts
interface Attribute {
  id: string;
  name: string; // physical
  logicalName: string;
  type: ColumnType; // 'string' | 'integer' | 'bigint' | 'float' | 'boolean' | 'datetime' | 'json' | 'enum' | 'uuid' | ...
  length?: number;
  scale?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  default?: string | number | boolean | null;
  domainId?: string; // Domain에 묶이면 type/length/validation을 domain에서 상속
  comment?: string;
}
```

도메인에 묶인 속성은 `type`/`length`/`scale`이 로컬 오버라이드가 없는 한 항상 Domain에서 파생된다. Domain 변경 시 Schema Engine이 참조하는 모든 Attribute를 일괄 갱신한다 (`ApplyDomainOperation` 참조: [operations.md](operations.md)).

## Relationship

```ts
interface Relationship {
  id: string;
  name?: string;
  sourceEntityId: string;
  targetEntityId: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-many";
  kind: "identifying" | "non-identifying";
  optionality: "mandatory" | "optional";
  sourceAttributeIds: string[];
  targetAttributeIds: string[];
  onDelete?: "cascade" | "restrict" | "set-null" | "no-action";
  onUpdate?: "cascade" | "restrict" | "set-null" | "no-action";
}
```

## Index / Enum / Sequence / View

```ts
interface Index {
  id: string;
  name: string;
  attributeIds: string[];
  unique: boolean;
  type?: "btree" | "hash" | "gin" | "gist" | "fulltext";
}

interface EnumType {
  id: string;
  name: string;
  values: string[];
}

interface Sequence {
  id: string;
  name: string;
  start: number;
  increment: number;
}

interface View {
  id: string;
  name: string;
  sql?: string; // RDBMS
  definition?: unknown; // Appwrite 등 non-SQL 백엔드용 선언적 정의
}
```

## Domain

```ts
interface Domain {
  id: string;
  name: string; // "Email", "Money", "Status"
  type: ColumnType;
  length?: number;
  scale?: number;
  defaultValidation?: string; // regex / rule reference
  description?: string;
}
```

## Naming Rule / Dictionary

```ts
interface NamingRuleSet {
  case: "camel" | "snake" | "pascal" | "upper" | "lower";
  entityPrefix?: string;
  entitySuffix?: string;
  attributePrefix?: string;
  attributeSuffix?: string;
  reservedWords: string[];
  abbreviations: Record<string, string>; // "Customer" -> "cust"
}

interface DictionaryEntry {
  id: string;
  logicalTerm: string; // "고객"
  standardName: string; // "customer"
  abbreviation?: string; // "cust"
  domainId?: string;
}
```

## Subject Area

```ts
interface SubjectArea {
  id: string;
  name: string;
  entityIds: string[];
  color?: string;
}
```

## 불변식 (Validation Engine이 실시간으로 검사)

- 모든 Entity는 최소 1개의 `isPrimaryKey` Attribute를 가져야 한다.
- Attribute 이름은 Entity 내에서 유일해야 한다.
- Relationship이 참조하는 `sourceAttributeIds`/`targetAttributeIds` 개수는 동일해야 한다.
- Relationship 그래프에 순환 식별관계(identifying cycle)가 없어야 한다.
- `physicalName`은 활성 `NamingRuleSet.reservedWords`와 충돌하지 않아야 한다.
- 어떤 Relationship에도 연결되지 않은 Entity는 "고아 Entity" 경고 대상이다.

관련 문서: [operations.md](operations.md) · [adapters.md](adapters.md) · [plugins.md](plugins.md)
