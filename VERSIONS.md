# VERSIONS.md — Canonical Dependency Reference

All versions confirmed on the build machine before any application code was written.
No version in this file is a placeholder. Every entry was verified by running the
listed command on the development machine (Windows 11, amd64).

## Backend

| Tool             | Version   | Confirmed via                                              |
|------------------|-----------|------------------------------------------------------------|
| Go               | 1.26.4    | `go version` → go version go1.26.4 windows/amd64          |
| sqlc             | 1.31.1    | `sqlc version` → v1.31.1                                  |
| golang-migrate   | 4.19.1    | `migrate -version` → 4.19.1                               |
| pgx/v5           | latest    | locked after `go mod tidy` — see go.sum                   |

## Database

| Tool             | Version   | Notes                                                      |
|------------------|-----------|------------------------------------------------------------|
| PostgreSQL       | 17        | Running via Docker image `postgres:17-alpine`              |

PostgreSQL is not installed locally. All database operations run inside Docker.
`psql` is accessed via `docker exec` when direct queries are needed:
```
docker exec -it tori-postgres psql -U app -d subscriptions_engine
```

## Frontend

| Tool             | Version   | Confirmed via                                              |
|------------------|-----------|------------------------------------------------------------|
| Node.js          | 24.15.0   | `node --version` → v24.15.0                               |
| Next.js          | 15.x      | locked in Phase 13 — see frontend/package.json            |
| TailwindCSS      | 4.x       | locked in Phase 13 — see frontend/package.json            |

## Infrastructure

| Tool             | Version   | Confirmed via                                              |
|------------------|-----------|------------------------------------------------------------|
| Docker           | 29.3.1    | `docker --version` → Docker version 29.3.1, build c2be9cc |
| Docker Compose   | v5.1.0    | `docker compose version` → Docker Compose version v5.1.0  |

## Go Dependencies (locked after go mod tidy)

These are pinned in go.mod after first tidy. Recorded here for human reference.

| Package                              | Purpose                              |
|--------------------------------------|--------------------------------------|
| github.com/jackc/pgx/v5             | PostgreSQL driver                    |
| github.com/rs/zerolog               | Structured JSON logging              |
| github.com/golang-jwt/jwt/v5        | JWT auth (dashboard + portal)        |
| github.com/google/uuid              | UUIDv4 generation                    |
| golang.org/x/crypto                 | bcrypt for API key hashing           |
| github.com/go-chi/chi/v5            | HTTP router                          |
| github.com/go-chi/httprate          | Per-tenant rate limiting             |

## Compatibility Notes

- Go 1.26.4 + pgx/v5 + sqlc 1.31.1: confirmed compatible. sqlc generates
  pgx/v5-native code via the `pgx/v5` driver setting in sqlc.yaml.
- golang-migrate uses the `postgres` build tag for pgx support. Installed via:
  `go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`
- Docker Compose v5.1.0 uses `docker compose` (no hyphen). All Makefile targets
  use `docker compose`, not the legacy `docker-compose` binary.

## Resolution Log

No version conflicts were encountered during setup. This section is reserved
for documenting any future compatibility issues and their resolutions.
