# Contributing to ModelForge

ModelForge는 웹 기반 Database IDE입니다. 전체 비전과 아키텍처는 [ARCHITECTURE.md](ARCHITECTURE.md)와 [docs/](docs/)를 먼저 읽어주세요 — 특히 아래 4가지 설계 원칙은 모든 PR이 지켜야 합니다. AI 코딩 에이전트로 작업한다면 [CLAUDE.md](CLAUDE.md) 또는 [CODEX.md](CODEX.md)를 먼저 읽으세요 — 이 문서보다 더 실무적인 체크리스트가 있습니다. 현재 구현 진행 상황은 [ROADMAP.md](ROADMAP.md)에서 추적합니다.

1. **Canvas와 데이터 모델을 완전히 분리** — React Flow는 UI일 뿐이고, 실제 데이터는 `packages/schema-engine`이 관리합니다.
2. **모든 변경은 Operation(Command) 기반** — 새 기능이 모델을 변경한다면 반드시 [docs/operations.md](docs/operations.md)의 Operation 목록에 추가하고 그 계약을 따르세요.
3. **DB별 Adapter 구조** — 특정 플랫폼(Appwrite/PostgreSQL/...) 로직은 `DatabaseAdapter` 구현체 안에만 두세요. [docs/adapters.md](docs/adapters.md) 참고.
4. **플러그인 아키텍처** — Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine은 코어에 하드코딩하지 말고 레지스트리에 등록하세요. [docs/plugins.md](docs/plugins.md) 참고.

## 개발 환경

```bash
pnpm install
pnpm dev          # apps/web 개발 서버
```

## PR을 올리기 전에

```bash
pnpm format       # Prettier
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm test         # Vitest
pnpm build        # 전체 빌드
```

CI(`.github/workflows/ci.yml`)가 동일한 체크를 실행합니다. 로컬에서 전부 통과하는지 먼저 확인해주세요.

## 브랜치 / 커밋 규칙

- `main`은 보호 브랜치입니다. 기능 단위로 `feature/<short-name>` 브랜치를 만들고 PR로 머지하세요.
- 커밋 메시지는 무엇을 왜 바꿨는지 한두 문장으로 간결하게 작성하세요.
- 하나의 PR은 하나의 응집된 기능/수정 단위로 유지하세요 (예: "Entity CRUD Operation 구현", "Appwrite Import 어댑터 추가").
- 여러 기능이 서로 의존할 때는 스택하세요: 아직 머지되지 않은 `feature/A` 위에 `feature/B`를 브랜치하고, PR의 base branch를 `feature/A`로 지정합니다. `feature/A`가 머지되면 GitHub에서 `feature/B`의 base를 `main`으로 갱신하세요.
- `pre-commit` 훅(husky + lint-staged)이 staged 파일에 Prettier/ESLint를 자동 적용합니다. 훅이 파일을 수정하면 다시 `git add`가 필요할 수 있습니다.

## 패키지 구조

새 기능이 어느 패키지에 속하는지 확신이 안 서면 [README.md](README.md)의 패키지 표와 [ARCHITECTURE.md](ARCHITECTURE.md)의 핵심 모듈 설명을 참고하세요. 새 패키지가 필요하다고 판단되면 이슈로 먼저 논의해주세요.

## 이슈 / 버그 리포트

재현 절차, 기대 동작, 실제 동작을 포함해 [Issues](../../issues)에 남겨주세요. 어떤 패키지(`packages/*`)와 관련되는지 명시하면 도움이 됩니다.
