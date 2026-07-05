# 프로덕션 배포 (Production Deployment)

`apps/web`는 정적 Vite 빌드이고, 백엔드(Auth/DB/Function)는 이미 Appwrite Cloud에 있다.
프로덕션 호스팅도 같은 Appwrite 프로젝트의 **Appwrite Sites**를 쓴다 — 별도 호스팅
계정/도메인 없이 하나의 프로젝트로 프론트+백엔드가 완결된다.

배포 파이프라인은 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)에 있다:
**`main`에 push(=PR 머지)될 때마다 자동으로 빌드해서 Appwrite Sites에 배포**한다.
즉, 머지가 곧 릴리스다.

## 1회성 설정 (사람이 직접, 총 ~5분)

에이전트가 대신 실행할 수 없는 단계들이다 — 라이브 Appwrite 프로젝트와 GitHub 저장소
시크릿을 건드리기 때문에 소유자가 직접 실행해야 한다.

### 1. Appwrite Site 생성

```bash
# apps/web/.env.local의 값으로 CLI 인증 (로컬에서 1회)
set -a && source apps/web/.env.local && set +a
appwrite client \
  --endpoint "$VITE_APPWRITE_ENDPOINT" \
  --project-id "$VITE_APPWRITE_PROJECT_ID" \
  --key "$APPWRITE_API_KEY"

# 정적 사이트 생성 (이미 빌드된 dist를 업로드하므로 빌드 러닝타임은 형식상 지정)
appwrite sites create \
  --site-id modelforge \
  --name "ModelForge" \
  --framework other \
  --build-runtime static-1 \
  --adapter static \
  --output-directory ./ \
  --fallback-file index.html \
  --build-command "" \
  --install-command ""
```

사이트가 만들어지면 Console → Sites → modelforge에서 기본 도메인
(`https://modelforge.appwrite.network` 형태)을 확인할 수 있다.

> **주의**: `appwrite sites create`의 플래그는 CLI 버전에 따라 다를 수 있다. 플래그
> 에러가 나면 `appwrite sites create --help`로 확인하거나 Console UI에서 만들어도
> 된다 — 파이프라인은 site-id만 맞으면 동작한다.

### 2. CI 전용 API 키 생성

Console → Overview → Integrations → API Keys에서 **`sites.read` + `sites.write` 스코프만
가진** 새 키를 만든다. `apps/web/.env.local`에 있는 관리자 키를 CI에 넣지 않는다 —
배포 파이프라인이 필요로 하는 권한은 Sites 뿐이다.

### 3. GitHub 저장소 시크릿 등록

Settings → Secrets and variables → Actions → New repository secret, 또는:

```bash
gh secret set APPWRITE_ENDPOINT          # https://<REGION>.cloud.appwrite.io/v1
gh secret set APPWRITE_PROJECT_ID
gh secret set APPWRITE_DATABASE_ID
gh secret set APPWRITE_MODELS_TABLE_ID
gh secret set APPWRITE_DEPLOY_API_KEY    # 2에서 만든 CI 전용 키
gh secret set APPWRITE_SITE_ID           # 1에서 정한 site-id (예: modelforge)
```

앞 4개는 `apps/web/.env.local`의 같은 이름(`VITE_` 접두어 제외) 값과 동일하다.
`VITE_*` 값들은 어차피 브라우저 번들에 인라인되는 공개 식별자지만, 저장소가 public이
될 가능성에 대비해 시크릿으로 관리한다.

### 4. Appwrite Console에서 웹 플랫폼 허용 도메인 추가

Console → Overview → Integrations → Platforms에 배포 도메인
(`modelforge.appwrite.network` 등)을 **Web platform**으로 추가한다. 이걸 빼먹으면
배포된 사이트에서 Appwrite API 호출이 전부 CORS로 거부된다 (localhost는 이미 등록돼
있어 로컬 개발에선 문제가 안 보인다).

## 이후의 릴리스

없음 — PR을 `main`에 머지하면 끝. `deploy.yml`이 시크릿으로 `VITE_*`를 주입해 빌드하고
`appwrite sites create-deployment --activate`로 새 배포를 활성화한다. 수동 재배포가
필요하면 Actions 탭에서 Deploy 워크플로를 `workflow_dispatch`로 실행한다.

## 로컬에서 프로덕션 번들 검증

```bash
pnpm --filter @modelforge/web build
pnpm --filter @modelforge/web preview   # http://localhost:4173
```

`vite preview`는 실제 배포되는 것과 동일한 `dist/`를 서빙하므로, 머지 전에 minified
번들에서만 나타나는 문제(청크 로딩, env 인라인 등)를 잡을 수 있다.

## functions/deploy-appwrite는 별도

서버사이드 Deploy Function은 이 파이프라인과 무관하게 Appwrite의 Git 연동 또는
`appwrite push functions`로 배포한다 — [functions/deploy-appwrite/README.md](../functions/deploy-appwrite/README.md) 참고.
