# CODEX.md

ModelForge에서 작업하는 OpenAI Codex CLI를 위한 가이드입니다. Claude Code용 [CLAUDE.md](CLAUDE.md)와 내용은 동일하되, 별도 에이전트가 이 파일만 읽고도 작업할 수 있도록 독립적으로 작성했습니다. 프로젝트 비전은 [ARCHITECTURE.md](ARCHITECTURE.md), 기여 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

## 먼저 읽을 것

| 건드리는 대상                                           | 먼저 읽기                                      |
| ------------------------------------------------------- | ---------------------------------------------- |
| `packages/schema-engine` (데이터 모델)                  | [docs/schema-engine.md](docs/schema-engine.md) |
| `packages/erd-engine` (CRUD/Undo/Redo)                  | [docs/operations.md](docs/operations.md)       |
| `packages/deploy-engine` (Adapter)                      | [docs/adapters.md](docs/adapters.md)           |
| Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine | [docs/plugins.md](docs/plugins.md)             |

## 4가지 설계 원칙 (모든 변경이 지켜야 함)

1. **Canvas ↔ 데이터 모델 완전 분리** — `packages/canvas`(React Flow)는 UI일 뿐이다. 유일한 진실 소스는 `packages/schema-engine`의 `Model`이다.
2. **모든 변경은 Operation 기반** — 모델을 바꾸는 코드는 `packages/erd-engine`의 Operation을 통해야 한다. `Model`을 직접 mutate하지 않는다. 새 Operation 추가 시 `docs/operations.md`도 함께 갱신한다.
3. **DB별 Adapter 구조** — 플랫폼 종속 로직(Appwrite/PostgreSQL/...)은 `DatabaseAdapter` 구현체 밖으로 새어나가지 않게 한다.
4. **플러그인 아키텍처** — Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine은 `PluginRegistry`에 등록한다. 코어에 포맷 분기를 하드코딩하지 않는다.

## 명령어

```bash
pnpm install
pnpm dev             # apps/web 개발 서버

pnpm build           # 전체 빌드 (turbo)
pnpm typecheck       # 전체 타입 체크
pnpm lint            # 전체 ESLint
pnpm test            # 전체 Vitest
pnpm format          # Prettier 적용
```

특정 패키지: `pnpm --filter @modelforge/<name> <script>`.

**변경을 제출하기 전에 워크스페이스 루트에서 `pnpm build && pnpm typecheck && pnpm lint && pnpm test`를 전부 통과시킨다.** `.github/workflows/ci.yml`이 동일한 체크를 실행한다.

## 패키지 지도

```
schema-engine  → 의존성 없음 (Model/Entity/Attribute 타입 + validateModel)
sdk            → schema-engine (Operation/Adapter/Plugin 공개 인터페이스)
erd-engine     → schema-engine, sdk (Entity/Attribute/Relationship Operation + History)
layout-engine  → schema-engine, sdk (자동 배치)
diff-engine    → schema-engine, sdk (구조적 diff)
deploy-engine  → schema-engine, sdk (AdapterRegistry, AppwriteAdapter)
generator      → schema-engine, sdk (CodeGenerator + 순수 Exporter: svg/markdown/json)
parser         → schema-engine, sdk (DBML/Mermaid Importer)
ui             → 없음 (공유 컴포넌트)
canvas         → schema-engine, sdk, ui, reactflow
api            → schema-engine, sdk, appwrite (Auth/ModelStore)
apps/web       → 위 전부 (Zustand 스토어로 연결)
```

브라우저 DOM/Canvas가 필요한 로직은 `packages/*`가 아니라 `apps/web`에 둔다 — 패키지는 항상 Node에서 테스트 가능해야 한다.

## 브랜치 / PR 워크플로

- `main`은 보호 브랜치. `feature/<name>` 브랜치 → PR.
- 서로 의존하는 여러 기능은 **스택**한다: 미머지 `feature/A` 위에 `feature/B`를 브랜치하고, PR의 base를 `main`이 아닌 `feature/A`로 지정한다.
- PR 본문에 로컬에서 확인한 항목을 `## Test plan` 체크리스트로 남긴다.
- **PR 머지는 사용자가 직접 한다.**

## 테스트 방침

- `packages/*`의 순수 로직은 전부 Vitest로 커버하고, 브라우저 없이 돌아가야 한다.
- 테스트 픽스처에서 `Attribute.id`를 여러 Entity에 걸쳐 재사용하지 않는다 — 실전에서는 ULID로 전역 유일해야 하며, 재사용 시 FK/PK 판별 로직의 버그를 가리는 거짓 통과가 날 수 있다.
