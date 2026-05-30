# Coolify Deployment

FreeLLMAPI is a single-user, personal/internal proxy. Do not run it as a public SaaS API, do not share it with other people, and do not expose the dashboard or `/v1` endpoint on the public internet without an access-control layer such as VPN, Tailscale, Cloudflare Access, or Coolify/proxy basic auth.

## What Runs

- Backend: Express server from `server/dist/index.js`
- Dashboard: Vite build served by the same Express server
- Port: `3001`
- Bind address: `0.0.0.0`
- Health endpoint: `GET /api/ping`
- Storage: SQLite via `better-sqlite3`

The container runs one service, so a Dockerfile deployment is enough. Docker Compose is not required.

## Required Secret

`ENCRYPTION_KEY` is required. It must be exactly 64 hex characters, which is 32 random bytes for AES-256-GCM.

Generate one locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep this value stable. If you change it after adding provider API keys, FreeLLMAPI will no longer be able to decrypt those stored keys. Back it up together with the persistent SQLite volume.

## Coolify Settings

Create a new Coolify application from this Git repository and use the Dockerfile build pack.

Recommended application settings:

```text
Build Pack: Dockerfile
Dockerfile Location: /Dockerfile
Port: 3001
Healthcheck Path: /api/ping
```

Set these environment variables in Coolify:

```text
NODE_ENV=production
PORT=3001
DATABASE_PATH=/data/freeapi.db
ENCRYPTION_KEY=<paste-your-64-character-hex-key>
```

Do not set `DEV_MODE=true` in Coolify.

`DASHBOARD_ORIGINS` is normally not needed because the dashboard and API are served from the same origin. Only set it if a separate browser app on another origin must call this API directly.

## Persistent Storage

Add one persistent volume:

```text
Source: freellmapi-data
Destination: /data
Mode: read-write
```

Do not mount only `/data/freeapi.db`; SQLite also creates sidecar files such as `/data/freeapi.db-wal` and `/data/freeapi.db-shm`.

The container runs as the `node` user. If Coolify reports a SQLite permission error, make sure the storage is writable by UID/GID `1000:1000` or recreate it as a normal Coolify volume instead of a host bind mount.

The `/data` volume contains:

- SQLite database: `/data/freeapi.db`
- SQLite WAL/SHM sidecars
- Encrypted upstream provider API keys
- The generated `freellmapi-...` unified API key
- Dashboard settings, fallback-chain config, analytics, request logs, and rate-limit state

Application logs go to stdout/stderr and are collected by Coolify. No log file volume is required.

## First Run

After the app is deployed:

1. Open the Coolify domain for the app.
2. Go to the dashboard `Keys` page.
3. Add your upstream provider API keys.
4. Copy the generated unified API key from the dashboard.
5. Use that unified key as the bearer token for OpenAI-compatible clients.

## Test Commands

Replace `https://freellmapi.example.com` with your Coolify app URL.

Healthcheck:

```bash
curl -fsS https://freellmapi.example.com/api/ping
```

Model list:

```bash
curl -fsS https://freellmapi.example.com/v1/models
```

Chat completion after adding at least one provider key:

```bash
curl -fsS https://freellmapi.example.com/v1/chat/completions \
  -H "Authorization: Bearer freellmapi-your-unified-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      { "role": "user", "content": "Say hello in one short sentence." }
    ]
  }'
```

If you need to read the unified key from the API while on a trusted private network:

```bash
curl -fsS https://freellmapi.example.com/api/settings/api-key
```

Treat that endpoint as sensitive.

## Local Docker Test

```bash
docker build -t freellmapi:local .
docker run --rm \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e DATABASE_PATH=/data/freeapi.db \
  -e ENCRYPTION_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" \
  -v freellmapi-data:/data \
  freellmapi:local
```

Then test:

```bash
curl -fsS http://localhost:3001/api/ping
curl -fsS http://localhost:3001/v1/models
```

## Reliability And Security Notes

- This app is single-user by design. Dashboard/settings routes are not protected by app-level login.
- Put it behind private access control before exposing a Coolify domain broadly.
- Keep the `/data` volume and `ENCRYPTION_KEY` backed up.
- Free upstream provider tiers can change, rate-limit, or disappear without notice.
- SQLite is appropriate for this personal deployment, but do not scale this horizontally with multiple app containers writing to the same database.
