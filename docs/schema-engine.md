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
  // 아래 셋은 optional — 없으면 "이 Model엔 아직 governance 설정이 없다"는 뜻이고, 오래된
  // 저장 데이터(이 필드가 생기기 전에 저장된 Model)도 그대로 유효한 타입이 되게 한다.
  domains?: Domain[];
  dictionary?: DictionaryEntry[];
  namingRules?: NamingRuleSet;
}
```

`Domain`/`Dictionary`/`NamingRuleSet`은 `Project`가 아니라 `Model`에 붙는다 — `Project`는 아직 실제 영속화 계층이 없고(`apps/web`이 로드/저장하는 단위는 여전히 `Model` 하나), 여러 Model이 governance를 공유하는 시나리오가 필요해지기 전까지는 각 Model이 자기 것을 갖는 게 더 단순하다. `Project`가 실제로 구현되면 그때 Model→Project로 끌어올리는 리팩터를 고려한다.

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

도메인에 묶인 속성은 `AssignDomain` 시점에 `type`/`length`/`scale`이 Domain 값으로 동기화된다. `UpdateDomain`으로 Domain 자체를 바꾸면 `updateDomainCascade`가 그 Domain을 참조하는 모든 Attribute에 같은 값을 다시 동기화하는 `AssignDomain`을 연쇄로 적용한다 — 하나의 `Transaction`으로 원자적 Undo가 된다. 이후 누군가 `ChangeAttributeType`으로 직접 바꾸면 재동기화되지 않고 "domain-drift" 경고로만 표시된다 (`packages/erd-engine/src/operations/{attribute,governance,transaction}.ts` 참조: [operations.md](operations.md)).

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
- `physicalName`/Attribute `name`은 `NamingRuleSet.reservedWords`(설정돼 있다면, 기본 SQL 예약어 목록에 추가로)와 충돌하지 않아야 한다.
- `NamingRuleSet`이 설정돼 있으면 `physicalName`/Attribute `name`은 그 `case`(snake/camel/pascal/upper/lower)와 `entityPrefix`/`entitySuffix`/`attributePrefix`/`attributeSuffix`를 따라야 한다 — 경고(warning), 구조적 오류는 아니다.
- `NamingRuleSet.abbreviations`에 등록된 단어가 이름에 그대로 풀어써 있으면(예: "customer_identifier" — `identifier`→`id` 매핑이 있는데) 축약형 사용을 제안하는 경고를 낸다.
- `domainId`가 있는 Attribute는 그 Domain이 실제로 존재해야 하고(없으면 오류), `type`/`length`/`scale`이 Domain과 일치해야 한다(다르면 "domain-drift" 경고).
- 어떤 Relationship에도 연결되지 않은 Entity는 "고아 Entity" 경고 대상이다.

관련 문서: [operations.md](operations.md) · [adapters.md](adapters.md) · [plugins.md](plugins.md)
