# ModelForge

> Design. Validate. Deploy.
> The Modern Database Modeling IDE.

Figma + ERwin + Git + Appwrite + Prisma + AI를 합친 웹 기반 Database IDE.

- 전체 비전과 아키텍처: [ARCHITECTURE.md](ARCHITECTURE.md)
- 데이터 모델 스펙: [docs/schema-engine.md](docs/schema-engine.md)
- Operation(Command)/Undo·Redo/Git 버전관리: [docs/operations.md](docs/operations.md)
- DB Adapter 구조 (Appwrite/PostgreSQL/MySQL/...): [docs/adapters.md](docs/adapters.md)
- Exporter/Importer/CodeGenerator/AIProvider/LayoutEngine 플러그인: [docs/plugins.md](docs/plugins.md)

## 구조

```
apps/
  web            Vite + React + TS + Tailwind — 메인 앱
packages/
  schema-engine  핵심 데이터 모델 + Validation (단일 진실 소스)
  sdk            Operation / Adapter / Plugin 공개 인터페이스
  erd-engine     Entity/Attribute/Relationship CRUD
  layout-engine  자동 정렬 (ELK.js/Dagre 기반, 현재 Grid 구현체)
  diff-engine    모델 간 구조적 Diff
  deploy-engine  AdapterRegistry + Migration Plan/배포
  generator      ORM/언어/API 문서 Code Generator
  parser         DBML/Mermaid 등 텍스트 포맷 Importer
  canvas         React Flow 기반 ERD 캔버스
  ui             공유 디자인 시스템 컴포넌트
  api            Appwrite 연동 (Project/Model 영속화, Realtime)
```

## 시작하기

```bash
pnpm install
pnpm dev      # apps/web 개발 서버 (turbo run dev --parallel)
```

## 스크립트

```bash
pnpm build        # 전체 패키지/앱 빌드 (turbo)
pnpm typecheck     # 전체 타입 체크
pnpm lint          # 전체 ESLint
pnpm test          # 전체 Vitest
pnpm format        # Prettier 적용
```

각 명령은 [Turborepo](https://turbo.build)로 오케스트레이션되며, 패키지 간 의존성 순서와 캐시를 자동으로 처리한다.

## MVP 로드맵

Phase 1~4 우선순위와 실제 진행 상황은 [ROADMAP.md](ROADMAP.md) 참고.

## 기여하기

이슈와 PR 모두 환영합니다. 시작하기 전에 [CONTRIBUTING.md](CONTRIBUTING.md)를 읽어주세요 — 특히 이 프로젝트가 지키는 4가지 설계 원칙(Canvas/Model 분리, Operation 기반 변경, DB Adapter 구조, 플러그인 아키텍처)을 알아두면 리뷰가 훨씬 빨라집니다. AI 코딩 에이전트로 작업한다면 [CLAUDE.md](CLAUDE.md)/[CODEX.md](CODEX.md)도 참고하세요.

## 라이선스

[MIT](LICENSE)
