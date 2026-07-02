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
- [x] Appwrite 실시간(live) Collection Import — `functions/deploy-appwrite`에 `{ action: "list" }` 요청을 추가, 실제 배포된 Collection(속성/인덱스 포함, 25개 단위 커서 페이지네이션)을 읽어 `appwrite.json`과 동일한 wire 포맷으로 반환하고 기존 `parseAppwriteJson`/`fromNativeSchema`를 그대로 재사용. Toolbar의 "Import Live" 버튼(`canDeploy`가 true일 때만 노출, 같은 Function id 재사용) — [PR #15](https://github.com/uulab-official/erd/pull/15)
- [x] Appwrite Deploy 실행 — `functions/deploy-appwrite`(Appwrite Function, `node-appwrite`)가 `AppwriteAdminAPI`를 실제 구현. `apps/web`은 `Functions.createExecution()`으로 트리거만 하고, 실제 Databases 관리자 호출은 전부 Function 안에서 실행됨(동적 `APPWRITE_FUNCTION_API_KEY` 사용) — [PR #14](https://github.com/uulab-official/erd/pull/14)
- [x] "프로젝트" 개념 (다중 Model + Dashboard + 즐겨찾기/최근 목록) — `ModelStore`에 `list()`/`remove()` 추가, `apps/web`의 `Dashboard` 컴포넌트가 랜딩 화면이 되어 Model 생성/열기/삭제, Toolbar의 "← Models" 버튼으로 되돌아옴. "최근"은 Appwrite `listDocuments`의 `$updatedAt` 내림차순(서버 데이터)으로, "즐겨찾기"는 로컬 `localStorage`(기기별 UI 취향, 서버 스키마 변경 불필요)로 구현 — [PR #16](https://github.com/uulab-official/erd/pull/16). `Project`(dictionary/domains/namingRules/subjectAreas를 포함하는 전체 컨테이너, `packages/schema-engine`의 `Project` 타입)는 여전히 미구현 — 그건 Phase 2의 Dictionary/Domain/Naming Rules가 각각 구현된 뒤에야 의미가 있는 상위 컨테이너라 이번 스코프에서는 제외.

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
- [x] ORM Generator — Prisma(`schema.prisma` 생성: 1:1/1:N `@relation`, M:N implicit array, `@id`/`@unique`/`@default`) — [PR #12](https://github.com/uulab-official/erd/pull/12). Drizzle/TypeORM/JPA/Hibernate/Entity Framework는 아직
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
- Appwrite `apply()`(실제 배포 실행)와 실시간 Collection 목록 조회는 의도적으로 브라우저에서 직접 호출하지 않는다 — API 키가 필요한 관리자 작업이라 서버(Appwrite Function, `node-appwrite`)에서 실행해야 한다. 정적 `appwrite.json` 기반 Import는 이 제약 없이 이미 동작한다.
- `apply`와 `list`(실시간 Import)는 **같은** `functions/deploy-appwrite` Function을 `action` 필드로 분기해서 쓴다 — `apply`가 이미 write 스코프를 요구하므로 `list`의 read-only 호출을 별도 Function으로 분리해도 권한 범위가 줄지 않고, 배포 보일러플레이트만 두 배가 된다. `list`는 Databases API의 원본 `$id`/`attributes`/`indexes`를 그대로 반환하고(`src/listSchema.ts`), attribute 형태 변환은 하지 않는다 — 호출자(`packages/api`의 `invokeListAppwriteSchema`)가 기존 `parseAppwriteJson`을 그대로 재사용해서 파싱 로직 중복을 피한다.
- Appwrite Import는 컬렉션마다 암묵적 `$id` 기반 PK 속성을 합성한다(`packages/deploy-engine`의 `fromNativeSchema`) — Appwrite의 Attributes API/`appwrite.json`은 시스템 필드인 `$id`를 커스텀 attribute 목록에 포함하지 않기 때문. 이미 `id`라는 이름의 커스텀 attribute가 있으면 합성하지 않는다(이름 충돌 방지).
- `createPostgreSQLAdapter`의 `apply()`도 Appwrite와 동일한 이유로 브라우저에서 직접 실행하지 않는다 — 실제 Postgres 연결(`pg` 등)이 필요한 서버사이드 `SqlExecutor` 구현체를 주입받는 구조다. 현재 apps/web에는 SQL Export만 연결되어 있고 Deploy Plan/apply UI는 Appwrite 전용이다.
- `functions/deploy-appwrite`는 pnpm workspace 멤버가 **아니다** — Appwrite 빌드 컨테이너가 이 폴더만 떼어내 `npm install`을 돌리기 때문에 `workspace:*` 의존성을 해석할 수 없다. `src/types.ts`에 `packages/sdk`/`packages/deploy-engine`의 관련 타입을 손으로 복사해 동기화한다 (주석에 명시).
- 이 Function은 정적 API 키가 아니라 Appwrite가 실행마다 주입하는 동적 `APPWRITE_FUNCTION_API_KEY`를 사용한다 (Function의 Execute/Scopes 설정에 따라 스코프가 제한됨). 대화 중 공유된 정적 API 키는 `apps/web/.env.local`의 `APPWRITE_API_KEY`에 보관용으로만 있고 어떤 코드도 읽지 않는다 — 채팅에 노출된 적이 있다면 Console에서 재발급 권장.
- `modelsTableId` 컬렉션에 `name`(string) attribute를 추가해두면 Dashboard의 `list()`가 각 Model의 전체 `data` JSON을 파싱하지 않고도 이름을 보여줄 수 있다 — 필수는 아니다(그 attribute가 없는 기존 row는 `data`를 파싱해 이름을 채우는 fallback이 `packages/api`의 `createAppwriteModelStore`에 있음), 있으면 더 가볍다.
- Model 목록에 사용자별 소유권/권한 분리(현재는 프로젝트 내 모든 Model이 공유되어 보임)는 아직 없다 — 이 앱의 다른 어떤 기능(Import/Deploy 등)도 아직 사용자별로 스코프되어 있지 않아서, 이번 Dashboard도 기존 보안 모델을 그대로 따른다. 실제 멀티테넌시가 필요해지면 Appwrite의 document-level permission(`Permission.read(Role.user(...))`)을 도입해야 한다.
