# Operation (Command) Catalog

핵심 설계 원칙 #2: **모든 변경은 Operation 기반으로 처리한다.** Canvas나 AI, Import, Realtime 이벤트 등 모든 변경 경로는 예외 없이 Operation을 생성하고, Schema Engine은 Operation만을 통해 상태를 변경한다.

이 하나의 규칙으로 Undo/Redo, History, Diff Engine, 협업(Realtime 브로드캐스트), Git 스타일 버전관리가 전부 같은 메커니즘으로 구현된다.

## Operation 구조

```ts
interface Operation<TPayload = unknown> {
  id: string; // ULID
  type: string; // "CreateEntity", "RenameAttribute", ...
  modelId: string;
  payload: TPayload;
  inverse: Operation; // Undo를 위한 역연산. apply(op) 시점에 생성.
  actorId: string;
  timestamp: number;
  parentOperationId?: string; // 협업 시 OT/CRDT 순서 결정용
}

interface OperationResult {
  operation: Operation;
  patch: JsonPatch[]; // 실제 상태 변경 (RFC 6902 JSON Patch) — Realtime 브로드캐스트에 사용
}
```

모든 Operation은 `apply(model, payload) -> { model', inverse, patch }` 형태의 순수 함수로 구현한다. 부수효과(Appwrite 호출 등)는 Deploy Engine에서만 발생하며 Schema Engine 내부에는 없다.

## Operation 목록 (Phase 1 기준 최소 집합)

### Entity

- `CreateEntity`
- `DeleteEntity`
- `RenameEntity` (logicalName / physicalName)
- `MoveEntity` (ui.x, ui.y — Canvas 전용, Diff Engine은 구조적 diff에서 제외)
- `SetEntityMeta` (description, color, icon, category, owner, tags)

### Attribute

- `AddAttribute`
- `RemoveAttribute` — Relationship(`sourceAttributeIds`/`targetAttributeIds`) 또는 Index(`attributeIds`)가 아직 참조 중이면 에러를 던진다(`deleteEntity`/`deleteDomain` 등과 동일한 가드 패턴) — `removeAttributeCascade`(transaction.ts)로 그 Relationship/Index를 먼저 삭제해야 한다. Index는 부분 수정이 없다는 기존 규칙대로(위 Index 섹션 참고) 컬럼만 빼는 게 아니라 통째로 삭제된다.
- `RenameAttribute`
- `ChangeAttributeType` (type/length/scale)
- `SetAttributeFlags` (nullable/isPrimaryKey/isForeignKey/isUnique)
- `SetAttributeDefault`
- `SetAttributeComment` — 데이터 딕셔너리용 자유 텍스트 노트. `packages/generator`의 Markdown exporter가 표시하고, `packages/deploy-engine`의 SQL adapter가 실제 DDL(`COMMENT ON COLUMN`/MySQL 인라인 `COMMENT`)로 내보낸다(SQLite는 컬럼 코멘트 자체가 없어 조용히 생략).
- `AssignDomain` / `UnassignDomain` — 구현: `packages/erd-engine/src/operations/attribute.ts`. 둘 다 inverse를 항상 `UnassignDomain`(대상 Attribute의 정확한 이전 `domainId`/`type`/`length`/`scale`을 담은)으로 만든다 — inverse가 "그 Domain으로 다시 assign"이라면, Domain 자체가 그 사이에 바뀌거나 삭제된 케이스(예: `updateDomainCascade`/`deleteDomainCascade` 안에서 같은 Transaction으로 함께 undo될 때)에 Undo 시점의 Domain 상태를 잘못 읽어올 수 있기 때문.

### Relationship

- `CreateRelationship`
- `DeleteRelationship`
- `ChangeRelationshipCardinality`
- `ChangeRelationshipKind` (identifying / non-identifying)
- `SetRelationshipMeta` (name/optionality/onDelete/onUpdate — `SetEntityMeta`처럼 payload에 담긴 키만 바꾸고, inverse도 그 키들의 이전 값만 담는다)

### Index / Enum / Sequence / View

- `CreateIndex` / `DeleteIndex`
- `CreateEnum` / `UpdateEnumValues` / `DeleteEnum` — 구현: `packages/erd-engine/src/operations/enumType.ts`. Attribute가 아직 참조 중이면 `DeleteEnum`이 에러를 던진다 — `deleteEnumCascade`(transaction.ts)로 먼저 전부 해제해야 한다(`deleteDomainCascade`/`deleteSubjectAreaCascade`와 동일 패턴).
- `AssignEnumToAttribute` / `UnassignEnumFromAttribute` — 구현 완료. `Attribute.enumId`는 `domainId`와 같은 단일-소속 모양이고, assign은 `AssignDomain`처럼 Attribute의 `type`을 즉시 `"enum"`으로 동기화한다. 둘 다 inverse가 항상 "정확한 이전 `enumId`+`type`을 담은 `UnassignEnumFromAttribute`"다 — `priorDomainState`와 동일한 이유로, Enum 자체가 같은 Transaction 안에서 함께 undo될 때 re-derive하면 undo 시점의 잘못된 상태를 읽을 수 있기 때문.
- `CreateSequence` / `DeleteSequence`
- `CreateView` / `UpdateView` / `DeleteView`

### Domain / Naming / Dictionary

- `CreateDomain` / `UpdateDomain` (→ 연결된 모든 Attribute에 파급)
- `DeleteDomain`
- `UpdateNamingRuleSet`
- `AddDictionaryEntry` / `UpdateDictionaryEntry` / `DeleteDictionaryEntry`

### Subject Area / Canvas 주석

- `CreateSubjectArea` / `UpdateSubjectArea` (name/color) / `DeleteSubjectArea` — 구현: `packages/erd-engine/src/operations/subjectArea.ts`. Entity가 아직 배정돼 있으면 `DeleteSubjectArea`가 에러를 던진다 — `deleteSubjectAreaCascade`(transaction.ts)로 먼저 전부 해제해야 한다(`deleteDomainCascade`와 동일 패턴).
- `AssignEntityToSubjectArea` / `UnassignEntityFromSubjectArea` — 구현 완료. Entity는 한 번에 최대 하나의 Subject Area에만 속하고(`Attribute.domainId`와 동일한 단일-소속 모델), `SubjectArea.entityIds`와 `Entity.subjectAreaId`는 이 두 Operation을 통해서만 함께 갱신되어 서로 어긋나지 않는다. `UnassignDomain`처럼 inverse가 항상 "정확한 이전 소속을 복원하는 Unassign"이다.
- `CreateMemo` / `UpdateMemoText` / `MoveMemo` / `DeleteMemo` — 구현: `packages/erd-engine/src/operations/memo.ts`. 어떤 Entity에도 속하지 않는 자유 텍스트 캔버스 메모(`Model.memos?`)로, "CreateSticky"에 해당한다. Cascade가 필요 없다 — 메모를 참조하는 다른 구조가 없어서 삭제해도 다른 Operation을 유발하지 않는다.
- `CreateGroup` / `CreateFrame` — 아직 미구현.

## Undo / Redo

- 각 Operation은 apply 시점에 `inverse` Operation을 함께 계산해 History Stack에 push.
- Undo = `inverse` 적용 후 Redo Stack에 원본 push.
- 복합 동작(예: Entity 삭제 시 연결된 Relationship도 함께 삭제)은 여러 Operation을 하나의 `Transaction`으로 묶어 원자적으로 Undo되게 한다.

```ts
interface Transaction {
  id: string;
  operations: Operation[];
  label: string; // "회원 Entity 삭제" — History Panel에 표시
}
```

## History → Git 스타일 버전관리

- `Commit` = Transaction들의 스냅샷 + 메시지. 내용은 Operation 로그 자체(재생 가능) + 최종 상태 스냅샷(빠른 로드용) 둘 다 저장.
- `Branch` = 특정 Commit을 가리키는 포인터. 새 Branch는 부모 Commit 상태를 복제해서 독립적으로 Operation을 누적.
- `Merge` = 두 Branch의 Operation 로그를 3-way merge. 같은 대상(entityId/attributeId)에 대한 동시 수정은 Conflict로 표시하고 사용자 해결 UI(Compare)로 넘긴다.
- `Rollback` = 특정 Commit 상태로 새 Commit을 생성 (히스토리를 지우지 않고 앞으로 되돌림).

**구현 현황**: 위는 Phase 3의 Branch/Merge까지 포함한 전체 설계다. 지금 실제로 있는 건 그보다 훨씬 단순한 부분집합 — `ModelVersion`(`packages/api`의 `ModelStore.saveVersion`/`listVersions`/`getVersion`/`deleteVersion`)이 하나의 Model에 라벨 붙은 전체 스냅샷을 순서대로 쌓는다. Operation 로그 재생이 아니라 **스냅샷만** 저장하고(`Commit`의 "최종 상태 스냅샷" 절반), Branch/Merge/Conflict는 없다 — 항상 하나의 선형 타임라인이다. `Restore`는 그 스냅샷으로 현재 Model을 통째로 교체하는 것뿐이고(`Rollback`과 유사하되 새 Commit을 만들지 않고 되돌린 상태 자체가 현재 상태가 됨), Compare는 `diffModels(snapshot, currentModel)`로 Diff Engine을 그대로 재사용한다 — `apps/web`의 BottomPanel "Versions" 탭 참고.

## Diff Engine과의 관계

Diff Engine은 두 모델 상태(현재 모델 vs 배포된 스냅샷, 또는 Branch A vs Branch B)를 비교해 **구조적 Operation 시퀀스**를 재구성한다. Canvas 전용 필드(`ui.*`)는 비교 대상에서 제외한다.

```
diff(modelA, modelB) -> Operation[]   // "이 Operation들을 적용하면 A가 B가 된다"
```

이 Operation 시퀀스가 그대로 Deploy Engine의 Migration Plan 입력이 된다.

## 협업(Realtime)과의 관계

- Appwrite Realtime을 통해 각 클라이언트는 로컬에서 생성한 Operation을 즉시 브로드캐스트한다.
- 서버(Appwrite Function)는 Operation을 순서대로 검증·적용하고 canonical `parentOperationId` 체인을 유지한다.
- 동시 편집 충돌(같은 Attribute를 동시에 rename)은 Last-Write-Wins가 아니라 `Merge` 로직과 동일한 Conflict 표시로 처리한다.

관련 문서: [schema-engine.md](schema-engine.md) · [adapters.md](adapters.md)
