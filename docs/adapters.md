# Adapter Architecture

핵심 설계 원칙 #3: 하나의 공통 스키마([schema-engine.md](schema-engine.md))를 각 플랫폼으로 변환하는 **Adapter 구조**를 채택한다. Deploy Engine, Diff Engine, Code/API Generator는 모두 Adapter를 통해서만 특정 플랫폼과 상호작용하며, 플랫폼별 SDK/문법을 직접 알지 못한다.

## 인터페이스

```ts
interface DatabaseAdapter {
  readonly kind: AdapterKind; // 'appwrite' | 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'oracle'

  // 공통 스키마 -> 플랫폼 네이티브 정의
  toNativeSchema(model: Model): NativeSchema;

  // 플랫폼에서 역으로 읽어와 공통 스키마로 변환 (Reverse Engineering / Appwrite Collection Import)
  fromNativeSchema(native: NativeSchema): Model;

  // 실제 배포 대상과 현재 모델을 비교해 Migration Plan 생성 (Diff Engine 결과를 플랫폼 실행 계획으로 변환)
  plan(current: Model, deployedSnapshot: Model | null): MigrationPlan;

  // Plan을 실제로 실행 (Appwrite SDK 호출 / SQL 실행 등 유일한 부수효과 지점)
  apply(plan: MigrationPlan, credentials: AdapterCredentials): Promise<DeployResult>;

  // Plan의 역연산 생성 (Deploy Engine의 Rollback 기능)
  rollbackPlan(plan: MigrationPlan): MigrationPlan;

  // 타입 매핑: 공통 ColumnType <-> 플랫폼 타입
  mapType(type: ColumnType, length?: number, scale?: number): string;

  // 플랫폼 제약 검증 (예: Appwrite는 복합 PK 미지원, MySQL은 컬럼당 인덱스 개수 제한)
  validate(model: Model): ValidationIssue[];
}
```

```ts
interface MigrationPlan {
  id: string;
  adapterKind: AdapterKind;
  steps: MigrationStep[];
}

interface MigrationStep {
  action: 'create-collection' | 'create-table' | 'add-attribute' | 'drop-attribute'
        | 'alter-attribute' | 'create-index' | 'drop-index' | 'create-relationship' | ...;
  target: string;          // entity/attribute physicalName
  sql?: string;             // RDBMS adapter가 채움
  appwriteCall?: unknown;   // Appwrite adapter가 채움 (SDK 호출 파라미터)
  destructive: boolean;     // drop/alter-narrowing 등 — 승인 UI에서 강조
  warning?: string;
}

interface DeployResult {
  planId: string;
  appliedSteps: string[];
  failedStep?: { step: MigrationStep; error: string };
}
```

## 초기 구현 대상 (Phase 1~2)

| Adapter                          | 우선순위 | 비고                                                                                                                                                                                      |
| -------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppwriteAdapter`                | Phase 1  | Collection = Entity, Attribute = Appwrite Attribute, Index = Appwrite Index. 복합 PK 미지원 → 단일 `$id` 또는 unique index로 대체. Relationship은 Appwrite Relationship Attribute로 매핑. |
| `PostgreSQLAdapter`              | Phase 2  | SQL DDL 생성, `pg` 기반 introspection으로 Reverse Engineering.                                                                                                                            |
| `MySQLAdapter`                   | Phase 2  | PostgreSQL과 타입 매핑만 다름 — 공통 `SqlDialect` 헬퍼 공유.                                                                                                                              |
| `SQLiteAdapter`                  | Phase 2  | 로컬 프로토타이핑/Export 용도.                                                                                                                                                            |
| `PrismaAdapter`                  | Phase 3  | 배포 대상이 아니라 **Export 전용** — `schema.prisma` 생성. [plugins.md](plugins.md)의 CodeGenerator 플러그인으로도 노출.                                                                  |
| `MSSQLAdapter` / `OracleAdapter` | Phase 4  | 엔터프라이즈 대상.                                                                                                                                                                        |

## 공통 헬퍼: SqlDialect

RDBMS Adapter들은 `DatabaseAdapter`를 직접 구현하지 않고 공통 `SqlDialect`를 조합해서 구현한다 (중복 방지):

```ts
interface SqlDialect {
  quoteIdentifier(name: string): string;
  columnDDL(attr: Attribute): string;
  createTableDDL(entity: Entity): string;
  createIndexDDL(index: Index, entity: Entity): string;
  foreignKeyDDL(rel: Relationship): string;
}
```

`PostgreSQLAdapter`, `MySQLAdapter`, `SQLiteAdapter`는 각자의 `SqlDialect` 구현체를 주입받는 thin wrapper다.

**Auto-increment**: 단일 컬럼 integer/bigint PK이고 명시적 `default`가 없으면(`toNativeSchema.ts`) `SqlColumnDef.autoIncrement`가 켜진다. 세 dialect가 각각 다르게 렌더링한다 — PostgreSQL은 타입 자체를 `serial`/`bigserial`로 바꾸고(`AUTO_INCREMENT` 키워드가 없음), MySQL은 컬럼 정의 뒤에 ` AUTO_INCREMENT`를 붙이고, SQLite는 `AUTO_INCREMENT`가 별도 접미사가 아니라 `INTEGER PRIMARY KEY AUTOINCREMENT`라는 하나의 구문으로만 동작해서 그 컬럼을 테이블 제약의 별도 `PRIMARY KEY (...)` 줄이 아니라 컬럼 정의 자체에 인라인해야 한다(SQLite FK를 `CREATE TABLE`에 인라인하는 것과 같은 부류의 dialect별 특수 처리, `supportsAlterForeignKey`와 나란히 `SqlDialectOptions`에 `autoIncrementType`/`autoIncrementSuffix`/`inlinePrimaryKeyOnAutoIncrement` 훅으로 존재).

## AdapterRegistry

```ts
interface AdapterRegistry {
  register(adapter: DatabaseAdapter): void;
  get(kind: AdapterKind): DatabaseAdapter;
  list(): AdapterKind[];
}
```

`packages/deploy-engine`이 `AdapterRegistry`를 소유하며, `packages/*`의 나머지 코드는 구체적인 Adapter 클래스가 아니라 이 레지스트리를 통해서만 Adapter를 얻는다. 신규 Adapter 추가 시 Schema/Diff/Deploy Engine 코드 변경이 필요 없어야 한다 — 이것이 이 구조의 존재 이유다.

관련 문서: [schema-engine.md](schema-engine.md) · [operations.md](operations.md) · [plugins.md](plugins.md)
