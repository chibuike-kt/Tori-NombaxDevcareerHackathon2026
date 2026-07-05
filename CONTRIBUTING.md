# Contributing to Tori

## Prerequisites

- Go 1.26+
- Node.js 18+
- Docker and Docker Compose
- [sqlc](https://sqlc.dev) — `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`

## Local setup

```bash
# 1. Clone the repo
git clone https://github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026.git
cd Tori-NombaxDevcareerHackathon2026

# 2. Copy environment variables
cp .env.example .env
# Fill in your Nomba credentials, JWT secret, and Resend API key

# 3. Start the database and Redis
docker compose up postgres redis -d

# 4. Apply migrations
make migrate

# 5. Seed demo data
make seed

# 6. Start the API and worker
make dev

# 7. Start the frontend (separate terminal)
cd frontend && npm install && npm run dev
```

The API runs on `http://localhost:8080`, the dashboard on `http://localhost:3001`.

## Running tests

```bash
make test
# or
go test ./...
```

## Regenerating sqlc

After changing any file in `db/migrations/` or `db/queries/`:

```bash
make sqlc
# or
sqlc generate
```

## Code conventions

- All amounts are in **kobo** (int64), never naira floats
- Every database query must be scoped by `tenant_id` — no cross-tenant data leakage
- Use `zerolog` for logging — never `fmt.Println`
- New job types go in `internal/domain/models.go` and must be registered in `cmd/worker/main.go`
- State machine transitions go through `subscription.Transition()` — never update status directly without a transition check

## Commit format

```
feat: add promo code validation to checkout
fix: cancel at period end skips dunning retries
docs: update API reference with team endpoints
refactor: extract recovery ladder into standalone method
```
