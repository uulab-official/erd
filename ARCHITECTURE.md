# ModelForge

> Design. Validate. Deploy.
> The Modern Database Modeling IDE.

이 문서는 AI 코딩 에이전트가 프로젝트의 전체 방향과 아키텍처를 이해하기 위한 마스터 설계서(Architecture Blueprint)입니다.

## Vision

ModelForge는 웹 기반 데이터 모델링 플랫폼입니다. 기존 ERwin, ER/Studio, Visual Paradigm처럼 데이터 모델을 설계할 수 있으며, 추가로 다음을 제공합니다.

- Git 스타일 버전관리
- AI 모델링
- Appwrite Deploy
- SQL / ORM / API Generate
- 실시간 협업

**중요**: "ERD 그리는 서비스"가 아니라 **Figma + ERwin + Git + Appwrite + Prisma + AI**를 합친 **Database IDE**를 만든다.

## 목표 사용자

- **개인 개발자**: React / Flutter / Next / Spring / Nest / Laravel
- **스타트업**: 서비스 설계, DB 설계, 문서 자동화
- **기업**: ERwin 대체, 협업, 표준 용어 관리, DB 거버넌스

## 핵심 가치

```
기존: ERwin → DBA만 사용
우리: 웹 → 누구나 사용 → AI → Deploy → Git → Realtime
```

## 기술스택

### Monorepo

```
apps/
  web
packages/
  canvas
  erd-engine
  layout-engine
  schema-engine
  diff-engine
  deploy-engine
  generator
  parser
  ui
  api
  sdk
```

### Frontend

React, Vite, TypeScript, Tailwind, React Flow, Zustand, TanStack Query, Monaco Editor

### Backend

Appwrite (Auth, Databases, Storage, Realtime, Functions)

## 시스템 구조

```
Browser
  ↓
Canvas Engine
  ↓
ERD Engine
  ↓
Schema Engine
  ↓
Validation Engine
  ↓
Diff Engine
  ↓
Deploy Engine
  ↓
Appwrite SDK
  ↓
Appwrite
```

## 핵심 모듈

### Canvas Engine

노드 생성, 연결, 드래그, 멀티셀렉트, 줌, 팬, Undo/Redo, Clipboard, Snap, Guide, MiniMap

### Layout Engine

자동 정렬 — ELK.js, Dagre. 지원: Tree, Grid, Layer, Force, Orthogonal

### ERD Engine

모든 모델 관리 — Entity, Attribute, Relationship, Index, Enum, Domain, Sequence, View, Subject Area

### Schema Engine

```
ERD → JSON Schema → Deploy / Import / Export
```

### Validation Engine

실시간 검사 (예: PK 없음, 중복 컬럼, 순환 참조, 중복 Index, 예약어 사용, 고아 Entity) 및 자동 표시

### Diff Engine

```
현재 모델 ↔ 운영 DB 비교
결과: + Customer 생성 / - phone 삭제 / ~ email 길이 변경
```

### Deploy Engine

SQL 생성, Appwrite 생성, Migration 생성, Rollback 생성

## 화면 구성

### Dashboard

프로젝트 목록, 최근 프로젝트, 팀, 즐겨찾기, 템플릿

### Workspace

```
Project
├── Models
├── Dictionary
├── Domains
├── Naming Rules
├── Baselines
├── History
├── Deployments
├── API
└── Settings
```

### Canvas

무한 캔버스. Entity 생성, Relation 생성, Group, Frame, Color, Comment, Sticky, Image, Icon

### Properties

선택한 객체(Entity/컬럼) 편집 — 설명, 색상, 아이콘, 권한

### Bottom Panel

Validation, Console, History, Deploy, AI, Search

## 데이터 모델

### Entity

ID, 논리명, 물리명, Description, Color, Icon, Category, Owner, Version, Tag

### Attribute

Name, Logical Name, Type, Length, Scale, Nullable, PK, FK, Unique, Default, Domain, Comment

### Relationship

One To One, One To Many, Many To Many, Identifying, Non Identifying, Mandatory, Optional

### Domain

예: Email, Phone, Money, Address, Name, URL, Password, Status — 도메인 변경 시 연결된 모든 속성이 함께 변경됨

### Naming Rule

Camel / Snake / Pascal / UPPER / lower, Prefix, Suffix, Reserved Words, Abbreviation

### Dictionary

기업 표준 용어 관리 (예: Customer → customer → cust) 및 자동 추천

## AI

- 자연어 입력 → ERD 자동 생성 (예: "쇼핑몰 만들어줘" → User/Product/Order/Payment/Coupon/Review/Cart/Delivery)
- 자연어 수정 지시 → 기존 모델 자동 수정 (예: "주문에 배송정보 추가")

## 협업

Appwrite Realtime 기반 동시 편집, Cursor, Selection, Lock, Presence, Comment

### Git 스타일 버전관리

Commit, Branch (예: `feature/payment`), Merge, Conflict, Compare, Rollback

## Deploy

Plan 생성 (Create Collection / Create Index / Delete Attribute / Warning) → 승인 → Appwrite 생성

## Export

PNG, SVG, PDF, Markdown, Excel, JSON, Appwrite, SQL, Mermaid

## Code Generator

- 언어: TypeScript, Java, Kotlin, Dart, Go, Swift, Python, Rust
- ORM: Prisma, Drizzle, TypeORM, JPA, Hibernate, Entity Framework

## API Generator

OpenAPI, Swagger, REST Docs, GraphQL

## Import

Appwrite, Prisma, SQL, PostgreSQL, MySQL, SQLite, Oracle, MSSQL, Mermaid, DBML

## Version

v1 → v2 → v3, Diff, Compare, Restore

## 권한

Owner, Editor, Viewer, Commenter

## Appwrite 전용 기능

Database 선택 → Collection Import → ERD 생성 → 수정 → Deploy → Realtime

## MVP 우선순위

### Phase 1

- 로그인
- 프로젝트
- React Flow 기반 ERD
- Entity/Attribute/Relationship
- JSON 저장
- Appwrite Import
- Appwrite Deploy
- PNG/PDF Export

### Phase 2

- Diff Engine
- Version
- Undo/Redo
- Dictionary
- Domain
- Naming Rules
- Validation

### Phase 3

- AI ERD 생성
- ORM 생성
- SQL 생성
- OpenAPI 생성
- 협업
- 댓글
- Branch/Merge

### Phase 4

- PostgreSQL/MySQL Reverse Engineering
- GitHub 연동
- CI/CD Deploy
- Migration Manager
- 플러그인 시스템
- Marketplace

## 장기 비전

ModelForge는 "ERD를 그리는 웹사이트"가 아니라 **데이터 모델링을 위한 Figma**를 목표로 합니다.

```
아이디어
  ↓
AI가 ERD 초안 생성
  ↓
시각적 모델링
  ↓
검증(Validation)
  ↓
Diff / Migration Plan
  ↓
Appwrite 또는 RDBMS 배포
  ↓
ORM / DTO / API / 문서 자동 생성
  ↓
Git 기반 버전 관리 및 협업
```

## 구현 시 가장 중요한 설계 원칙

1. **Canvas와 데이터 모델을 완전히 분리**
   React Flow는 UI일 뿐이다. 실제 데이터는 독립적인 `Schema Engine`이 관리해야 한다.

2. **모든 변경은 Operation(Command) 기반으로 처리**
   `CreateEntity`, `RenameAttribute`, `DeleteRelationship`, `MoveNode` 등. 이를 기반으로 Undo/Redo, 히스토리, 협업, Diff를 모두 구현한다.

3. **DB별 Adapter 구조**
   `AppwriteAdapter`, `PostgreSQLAdapter`, `MySQLAdapter`, `PrismaAdapter`, `SQLiteAdapter`. 하나의 공통 스키마를 각 플랫폼으로 변환하는 구조를 채택한다.

4. **플러그인 아키텍처**
   Exporter, Importer, Code Generator, AI Provider, Layout Engine을 플러그인으로 분리한다.
