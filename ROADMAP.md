# Roadmap

Phase 구분은 [ARCHITECTURE.md#mvp-우선순위](ARCHITECTURE.md#mvp-우선순위)를 따른다. 이 문서는 실제 구현 진행 상황을 추적하는 살아있는 체크리스트다 — 항목이 완료되면 체크하고 관련 PR/커밋을 남긴다.

## Phase 1 — MVP

- [x] 모노레포 하네스 (pnpm + Turborepo + TS/ESLint/Prettier/Vitest + CI) — [초기 커밋](https://github.com/uulab-official/erd/commit/a010688)
- [x] Entity/Attribute/Relationship Operation (Create/Delete/Rename/Move, Undo/Redo, Transaction 캐스케이드 삭제) — [PR #1](https://github.com/uulab-official/erd/pull/1)
- [x] Appwrite Auth (로그인/회원가입/로그아웃) + Model 영속화 — [PR #2](https://github.com/uulab-official/erd/pull/2)
- [x] AppwriteAdapter (Collection/Attribute/Index/Relationship 매핑, Migration Plan, Rollback) — [PR #3](https://github.com/uulab-official/erd/pull/3)
- [x] React Flow 기반 ERD 캔버스 + 로그인 게이트 + Validation/Deploy Plan 패널 — [PR #4](https://github.com/uulab-official/erd/pull/4)
- [x] Export: SVG / PNG / PDF / Markdown / JSON — [PR #5](https://github.com/uulab-official/erd/pull/5)
- [ ] Appwrite Import (실제 Collection → Model 역방향 가져오기 UI. Adapter의 `fromNativeSchema`는 구현되어 있으나 apps/web에 아직 연결 안 됨)
- [ ] Appwrite Deploy 실행 (현재는 Plan 미리보기만 UI에 있음 — `apply()`는 서버사이드 `AppwriteAdminAPI` 구현체가 필요, Appwrite Function으로 별도 구현 예정)
- [ ] "프로젝트" 개념 (현재는 단일 Model만 로드/저장. Project → 여러 Model, Dashboard, 즐겨찾기/최근 프로젝트 목록 필요)

## Phase 2

- [ ] Diff Engine UI 연동 (엔진 자체는 `packages/diff-engine`에 구현됨 — Compare 화면, Baseline 스냅샷 관리 필요)
- [ ] Version (v1 → v2 → v3, Diff, Compare, Restore)
- [ ] Undo/Redo 히스토리 패널 (엔진의 `OperationHistory`는 구현됨 — History Panel UI로 노출 필요)
- [ ] Dictionary (기업 표준 용어 관리, 자동 추천)
- [ ] Domain (Email/Phone/Money/... 타입 그룹, 변경 시 연결된 Attribute 일괄 갱신)
- [ ] Naming Rules (Camel/Snake/Pascal, Prefix/Suffix, 예약어, 약어)
- [ ] Validation 규칙 확장 (현재 `validateModel`은 PK 없음/중복 컬럼/Relationship attribute 개수 불일치/고아 Entity만 검사 — 순환 참조, 중복 Index, 예약어 사용 추가 필요)

## Phase 3

- [ ] AI ERD 생성/수정 (`AIProvider` 플러그인 인터페이스는 `packages/sdk`에 정의됨 — 실제 Provider 구현 필요)
- [ ] ORM Generator (Prisma/Drizzle/TypeORM/JPA/Hibernate/Entity Framework)
- [ ] SQL Generator (PostgreSQL/MySQL/SQLite Adapter — `SqlDialect` 공통 헬퍼 설계는 [docs/adapters.md](docs/adapters.md)에 있음)
- [ ] OpenAPI/Swagger/GraphQL SDL Generator
- [ ] 실시간 협업 (Appwrite Realtime — Cursor/Selection/Lock/Presence)
- [ ] 댓글
- [ ] Git 스타일 Branch/Merge/Conflict (`docs/operations.md`에 설계는 있음 — Operation 로그 기반 3-way merge 구현 필요)

## Phase 4

- [ ] PostgreSQL/MySQL Reverse Engineering (Adapter의 `fromNativeSchema` + DB introspection)
- [ ] GitHub 연동
- [ ] CI/CD Deploy
- [ ] Migration Manager
- [ ] 플러그인 시스템 (서드파티 `plugin.json` 매니페스트 동적 로드 — [docs/plugins.md](docs/plugins.md) "등록 시점" 참고)
- [ ] Marketplace

## 진행 중 알아두면 좋은 것

- `packages/*`의 엔진 코드(Operation, Adapter, Exporter)는 대부분 UI보다 앞서 구현되어 있다. 새 화면을 만들 때 먼저 해당 엔진에 필요한 기능이 이미 있는지 확인할 것 — 예를 들어 Diff Engine, OperationHistory, fromNativeSchema는 이미 존재하고 UI 연결만 필요하다.
- Appwrite `apply()`(실제 배포 실행)는 의도적으로 브라우저에서 직접 호출하지 않는다 — API 키가 필요한 관리자 작업이라 서버(Appwrite Function)에서 실행해야 한다. 이 함수를 만드는 것이 Phase 1 잔여 항목의 선결 조건이다.
