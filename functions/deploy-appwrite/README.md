# deploy-appwrite

Appwrite Function that actually executes a Deploy Plan (`MigrationPlan` from
[`packages/deploy-engine`](../../packages/deploy-engine)) against a live Appwrite
Databases API. This is the only place in the whole repo allowed to hold an Appwrite API
key or run admin operations — `apps/web` never talks to the Databases admin API directly,
it only triggers this Function's execution (see [`docs/adapters.md`](../../docs/adapters.md)
and `AppwriteAdapter`/`AppwriteAdminAPI` in `packages/deploy-engine`).

## What it does

1. Receives `{ databaseId, plan }` in the execution request body.
2. Rejects the request unless it came from an authenticated session
   (`x-appwrite-user-id` header) — defense in depth on top of the Function's own execute
   permissions (see below).
3. Applies `plan.steps` against the Databases API in dependency-safe order — see the
   comment at the top of `src/applyPlan.ts` for why a plain top-to-bottom replay of the
   plan isn't safe (a brand-new collection's relationship attributes reference another
   collection that might not exist yet).
4. Returns a `DeployResult` (`{ planId, appliedSteps, failedStep? }`) as JSON.

## Deploying this Function

You need the [Appwrite CLI](https://appwrite.io/docs/tooling/command-line) installed and
logged in (`appwrite login`) against `https://appwrite.uulab.co.kr/v1`.

1. **Register the Function** — from the repo root, either run `appwrite init functions`
   interactively and point it at `functions/deploy-appwrite`, or add this entry to your
   project's `appwrite.config.json` under `functions`:

   ```json
   {
     "$id": "deploy-appwrite",
     "name": "Deploy Appwrite",
     "runtime": "node-22",
     "enabled": true,
     "logging": true,
     "timeout": 60,
     "entrypoint": "dist/main.js",
     "commands": "npm install && npm run build",
     "path": "functions/deploy-appwrite"
   }
   ```

2. **Set execute access** so only signed-in users of this project can trigger it (never
   `any`/guests — this Function can drop collections):

   ```bash
   appwrite functions update-execute-permissions \
     --function-id deploy-appwrite \
     --execute 'users'
   ```

3. **Grant the Function's scopes** (Settings → Usage & Scopes in the Console, or the
   equivalent `appwrite functions update` flags) so its per-execution dynamic API key
   (`APPWRITE_FUNCTION_API_KEY`, injected automatically by Appwrite — see below) can
   actually call the Databases admin endpoints:
   `databases.read`, `databases.write`, `collections.read`, `collections.write`,
   `attributes.read`, `attributes.write`, `indexes.read`, `indexes.write`.

4. **Deploy the code**:

   ```bash
   appwrite push functions --function-id deploy-appwrite --force
   ```

### API key: use the dynamic per-execution key, not a static one

This Function reads `process.env.APPWRITE_FUNCTION_API_KEY`, which Appwrite automatically
injects into every execution, scoped to exactly the permissions granted in step 3 above and
rotated per-execution. **Do not** paste a static API key into this Function's environment
variables — the dynamic key is strictly safer (smaller blast radius, no long-lived secret
sitting in Function config) and is all this code needs.

If you were handed a static Appwrite API key for this project (e.g. for local
experimentation against the Databases API directly), it does **not** need to go here —
see `apps/web/.env.local`'s `APPWRITE_API_KEY` comment for where that's parked, and rotate
it in the Console if it was ever shared outside a local, gitignored file.

## Wiring it up to apps/web

Once deployed, copy the Function's `$id` into `apps/web/.env.local`:

```
VITE_APPWRITE_DEPLOY_FUNCTION_ID=deploy-appwrite
```

The Deploy Plan tab's "Deploy to Appwrite" button (`apps/web/src/components/BottomPanel.tsx`)
only appears once this, plus the database/table env vars, are all set — see
`apps/web/src/lib/appwrite.ts`'s `canDeploy`.

## Local development

```bash
npm install
npm run build      # compiles src/ -> dist/
npm run typecheck
npm test
```

This package is deliberately **not** a pnpm workspace member — Appwrite's build
container runs a plain `npm install` inside this folder alone, so it can't resolve
`workspace:*` dependencies. `src/types.ts` keeps small, hand-synced copies of the
`MigrationStep`/Appwrite native-schema shapes it needs from `packages/sdk` and
`packages/deploy-engine` instead of importing them.
