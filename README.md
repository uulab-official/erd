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

Phase 1~4 우선순위는 [ARCHITECTURE.md#mvp-우선순위](ARCHITECTURE.md#mvp-우선순위) 참고.
