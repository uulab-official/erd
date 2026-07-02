# CLAUDE.md

ModelForge에서 작업하는 Claude Code를 위한 가이드입니다. 프로젝트 전체 비전은 [ARCHITECTURE.md](ARCHITECTURE.md), 기여 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 이 문서는 둘의 요약이 아니라 **에이전트가 코드를 건드리기 전에 알아야 할 실무 정보**입니다.

## 먼저 읽을 것

작업 대상에 따라 반드시 먼저 확인하세요:

| 건드리는 대상                                           | 먼저 읽기                                      |
| ------------------------------------------------------- | ---------------------------------------------- |
| `packages/schema-engine` (데이터 모델)                  | [docs/schema-engine.md](docs/schema-engine.md) |
| `packages/erd-engine` (CRUD/Undo/Redo)                  | [docs/operations.md](docs/operations.md)       |
| `packages/deploy-engine` (Adapter)                      | [docs/adapters.md](docs/adapters.md)           |
| Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine | [docs/plugins.md](docs/plugins.md)             |

## 4가지 설계 원칙 (모든 PR이 지켜야 함)

1. **Canvas ↔ 데이터 모델 완전 분리** — React Flow(`packages/canvas`)는 UI일 뿐이다. 실제 상태는 `packages/schema-engine`의 `Model`이 유일한 진실 소스다.
2. **모든 변경은 Operation 기반** — 모델을 바꾸는 코드는 예외 없이 `packages/erd-engine`의 Operation(`CreateEntity`, `RenameAttribute`, ...)을 통해야 한다. 직접 `Model` 객체를 mutate하지 않는다. 새 Operation을 추가하면 `docs/operations.md`도 갱신한다.
3. **DB별 Adapter 구조** — 플랫폼(Appwrite/PostgreSQL/...) 관련 로직은 `DatabaseAdapter` 구현체 안에만 둔다. Schema/Diff/Deploy Engine의 나머지 코드는 특정 Adapter를 알아서는 안 된다.
4. **플러그인 아키텍처** — Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine은 `PluginRegistry`에 등록해서 쓴다. 코어에 `if (format === "png")` 같은 분기를 하드코딩하지 않는다.

## 명령어

```bash
pnpm install
pnpm dev             # apps/web 개발 서버

pnpm build           # 전체 빌드 (turbo)
pnpm typecheck       # 전체 타입 체크
pnpm lint            # 전체 ESLint
pnpm test            # 전체 Vitest
pnpm format          # Prettier 적용 (커밋 전 pre-commit hook이 자동 실행)
```

특정 패키지만 대상으로 하려면 `pnpm --filter @modelforge/<name> <script>` (예: `pnpm --filter @modelforge/erd-engine test`). 반복 작업 중에는 이게 훨씬 빠르다.

**PR을 올리기 전에 반드시 위 4개(`typecheck`/`lint`/`test`/`build`) 전체를 워크스페이스 루트에서 실행**해서 통과를 확인한다. CI(`.github/workflows/ci.yml`)가 동일한 체크를 실행하므로 로컬에서 먼저 잡는 게 빠르다.

## 패키지 지도

`packages/schema-engine`가 의존성 그래프의 뿌리다. 새 코드가 어디로 가야 할지 확신이 안 서면 이 표와 [README.md](README.md)를 참고:

```
schema-engine  → 아무것도 의존하지 않음 (Model/Entity/Attribute/... 타입 + validateModel)
sdk            → schema-engine (Operation/Adapter/Plugin 공개 인터페이스, 순수 타입)
erd-engine     → schema-engine, sdk (Entity/Attribute/Relationship Operation, History)
layout-engine  → schema-engine, sdk (자동 배치 알고리즘)
diff-engine    → schema-engine, sdk (모델 간 구조적 diff)
deploy-engine  → schema-engine, sdk (AdapterRegistry, AppwriteAdapter)
generator      → schema-engine, sdk (CodeGenerator + 순수 Exporter: svg/markdown/json)
parser         → schema-engine, sdk (DBML/Mermaid 등 텍스트 Importer)
ui             → 없음 (공유 컴포넌트, React peer dep)
canvas         → schema-engine, sdk, ui, reactflow (React Flow 래퍼)
api            → schema-engine, sdk, appwrite (Auth/ModelStore)
apps/web       → 위 전부 (Zustand 스토어로 erd-engine/api를 연결)
```

브라우저 DOM/Canvas API가 필요한 로직(PNG 래스터화 등)은 `packages/*`가 아니라 `apps/web`에 둔다 — 패키지는 항상 Node에서도 테스트 가능해야 한다. `packages/generator`의 `svgExporter`/`markdownExporter`/`jsonExporter`가 이 원칙의 예시이고, PNG/PDF는 `apps/web/src/lib/exporters.ts`에 있다.

## 브랜치 / PR 워크플로

- `main`은 보호 브랜치. 기능 단위로 `feature/<name>` 브랜치를 만들고 PR을 올린다.
- **여러 기능이 서로 의존할 때는 스택**한다 — 아직 머지되지 않은 `feature/A` 위에 `feature/B`를 브랜치해서 이어간다. PR의 base branch를 `main`이 아니라 `feature/A`로 지정한다. `feature/A`가 머지되면 `feature/B`의 base를 GitHub에서 `main`으로 갱신한다.
- 커밋 메시지는 무엇을·왜 바꿨는지 설명하고 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`을 포함한다 (Claude Code 기본 동작).
- PR 본문에 `## Test plan`을 포함하고, 로컬에서 확인한 항목을 체크리스트로 적는다. 가능하면 브라우저에서 실제로 동작을 확인한 내용도 남긴다 (스크린샷/스냅샷 불필요, 무엇을 클릭해서 무엇을 확인했는지 문장으로).
- **PR 머지는 사용자가 직접 한다** — 자체 작성 PR을 CI 통과만으로 자동 머지하지 않는다.

## 테스트 방침

- `packages/*`의 순수 로직(Operation apply/inverse, Adapter 변환, Exporter 렌더링)은 전부 Vitest 단위 테스트로 커버한다. 브라우저 없이 돌아가야 한다.
- DOM/네트워크가 필요한 코드(`apps/web`의 PNG/PDF 래스터화, Appwrite 실제 API 호출)는 목(mock)으로 감싸 로직만 테스트하거나, 이 저장소에 연결된 Playwright MCP로 실제 브라우저에서 스모크 테스트한다.
- 테스트 픽스처에서 `Attribute.id`를 여러 Entity에서 재사용하지 않는다 — 실제로는 ULID로 전역 유일해야 하고, 재사용하면 FK/PK 판별 로직의 버그를 가리는 거짓 통과가 나올 수 있다 (`packages/deploy-engine`의 `toNativeSchema` 테스트에서 실제로 겪은 문제).
