# Roadmap

Phase 구분은 [ARCHITECTURE.md#mvp-우선순위](ARCHITECTURE.md#mvp-우선순위)를 따른다. 이 문서는 실제 구현 진행 상황을 추적하는 살아있는 체크리스트다 — 항목이 완료되면 체크하고 관련 PR/커밋을 남긴다.

## Phase 1 — MVP

- [x] 모노레포 하네스 (pnpm + Turborepo + TS/ESLint/Prettier/Vitest + CI) — [초기 커밋](https://github.com/uulab-official/erd/commit/a010688)
- [x] Entity/Attribute/Relationship Operation (Create/Delete/Rename/Move, Undo/Redo, Transaction 캐스케이드 삭제) — [PR #1](https://github.com/uulab-official/erd/pull/1)
- [x] Appwrite Auth (로그인/회원가입/로그아웃) + Model 영속화 — [PR #2](https://github.com/uulab-official/erd/pull/2)
- [x] AppwriteAdapter (Collection/Attribute/Index/Relationship 매핑, Migration Plan, Rollback) — [PR #3](https://github.com/uulab-official/erd/pull/3)
- [x] React Flow 기반 ERD 캔버스 + 로그인 게이트 + Validation/Deploy Plan 패널 — [PR #4](https://github.com/uulab-official/erd/pull/4)
- [x] Export: SVG / PNG / PDF / Markdown / JSON — [PR #5](https://github.com/uulab-official/erd/pull/5)
- [x] Appwrite Import — `appwrite.json`(Appwrite CLI export) 파일을 파싱해 Model로 가져오기, `$id` 암묵적 PK 합성 — [PR #9](https://github.com/uulab-official/erd/pull/9)
- [ ] Appwrite 실시간(live) Collection Import — 위는 정적 `appwrite.json` 파일 기반이고, Databases API로 실제 배포된 Collection을 직접 읽어오는 것은 여전히 서버사이드 admin 연결이 필요함 (아래 "진행 중 알아두면 좋은 것" 참고)
- [ ] Appwrite Deploy 실행 (현재는 Plan 미리보기만 UI에 있음 — `apply()`는 서버사이드 `AppwriteAdminAPI` 구현체가 필요, Appwrite Function으로 별도 구현 예정)
- [ ] "프로젝트" 개념 (현재는 단일 Model만 로드/저장. Project → 여러 Model, Dashboard, 즐겨찾기/최근 프로젝트 목록 필요)

## Phase 2

- [x] Diff Engine UI 연동 — BottomPanel Diff 탭, Deploy Plan을 `savedModel` 기준 증분 계획으로 변경 — [PR #8](https://github.com/uulab-official/erd/pull/8)
- [ ] Version (v1 → v2 → v3, Diff, Compare, Restore) — Diff 탭은 "마지막 저장 vs 현재"만 비교. 여러 버전을 저장/전환/복원하는 개념은 아직 없음
- [x] Undo/Redo 히스토리 패널 — `OperationHistory.entries()`/`jumpToIndex()` + BottomPanel History 탭 — [PR #9](https://github.com/uulab-official/erd/pull/9)
- [ ] Dictionary (기업 표준 용어 관리, 자동 추천)
- [ ] Domain (Email/Phone/Money/... 타입 그룹, 변경 시 연결된 Attribute 일괄 갱신)
- [ ] Naming Rules (Camel/Snake/Pascal, Prefix/Suffix, 예약어, 약어) — `validateModel`의 예약어 검사는 built-in 기본 목록만 사용 중, `NamingRuleSet.reservedWords` 연동 필요
- [x] Validation 규칙 확장 — 순환 식별관계, 중복 Index, 예약어 사용 — [PR #7](https://github.com/uulab-official/erd/pull/7)

## Phase 3

- [ ] AI ERD 생성/수정 (`AIProvider` 플러그인 인터페이스는 `packages/sdk`에 정의됨 — 실제 Provider 구현 필요)
- [ ] ORM Generator (Prisma/Drizzle/TypeORM/JPA/Hibernate/Entity Framework)
- [x] SQL Generator/Adapter — PostgreSQL/MySQL/SQLite 3개 dialect 전부 구현 (`SqlDialect` 공통 팩토리, DDL Export, Deploy Plan) — [PR #10](https://github.com/uulab-official/erd/pull/10), [PR #11](https://github.com/uulab-official/erd/pull/11). SQLite는 `ALTER TABLE`로 FK를 추가할 수 없어 `CREATE TABLE`에 인라인으로 넣는다(`supportsAlterForeignKey: false`) — 이미 배포된 테이블에 FK를 새로 추가/삭제하는 경우는 SQL 없이 "테이블 재생성 필요" 경고만 낸다.
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

- `packages/*`의 엔진 코드(Operation, Adapter, Exporter)는 대부분 UI보다 앞서 구현되어 있다. 새 화면을 만들 때 먼저 해당 엔진에 필요한 기능이 이미 있는지 확인할 것.
- Appwrite `apply()`(실제 배포 실행)와 실시간 Collection 목록 조회는 의도적으로 브라우저에서 직접 호출하지 않는다 — API 키가 필요한 관리자 작업이라 서버(Appwrite Function, `node-appwrite`)에서 실행해야 한다. 이 함수를 만드는 것이 Phase 1 잔여 항목("실시간 Collection Import", "Deploy 실행")의 선결 조건이다. 정적 `appwrite.json` 기반 Import는 이 제약 없이 이미 동작한다.
- Appwrite Import는 컬렉션마다 암묵적 `$id` 기반 PK 속성을 합성한다(`packages/deploy-engine`의 `fromNativeSchema`) — Appwrite의 Attributes API/`appwrite.json`은 시스템 필드인 `$id`를 커스텀 attribute 목록에 포함하지 않기 때문. 이미 `id`라는 이름의 커스텀 attribute가 있으면 합성하지 않는다(이름 충돌 방지).
- `createPostgreSQLAdapter`의 `apply()`도 Appwrite와 동일한 이유로 브라우저에서 직접 실행하지 않는다 — 실제 Postgres 연결(`pg` 등)이 필요한 서버사이드 `SqlExecutor` 구현체를 주입받는 구조다. 현재 apps/web에는 SQL Export만 연결되어 있고 Deploy Plan/apply UI는 Appwrite 전용이다.
