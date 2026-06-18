BINARY_API=bin/api
BINARY_WORKER=bin/worker
MODULE=github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026
MIGRATE=migrate -path db/migrations -database "$(DATABASE_URL)"

.PHONY: all build build-api build-worker run-api run-worker \
        migrate-up migrate-down migrate-create \
        sqlc-generate \
        test test-unit test-integration \
        docker-up docker-down docker-logs \
        tidy lint clean

## ── Build ────────────────────────────────────────────────────────────────────

all: build

build: build-api build-worker

build-api:
	go build -o $(BINARY_API) ./cmd/api

build-worker:
	go build -o $(BINARY_WORKER) ./cmd/worker

## ── Run (local, no Docker) ───────────────────────────────────────────────────

run-api:
	go run ./cmd/api

run-worker:
	go run ./cmd/worker

## ── Database migrations ──────────────────────────────────────────────────────

migrate-up:
	$(MIGRATE) up

migrate-down:
	$(MIGRATE) down 1

migrate-reset:
	$(MIGRATE) down -all
	$(MIGRATE) up

migrate-create:
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir db/migrations -seq $$name

## ── sqlc ─────────────────────────────────────────────────────────────────────

sqlc-generate:
	sqlc generate

## ── Tests ────────────────────────────────────────────────────────────────────

test:
	go test ./... -v -race

test-unit:
	go test ./internal/... -v -race

test-integration:
	go test ./tests/... -v -race

## ── Docker ───────────────────────────────────────────────────────────────────

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-down-volumes:
	docker compose down -v

docker-logs:
	docker compose logs -f

docker-logs-api:
	docker compose logs -f api

docker-logs-worker:
	docker compose logs -f worker

## ── Dependencies ─────────────────────────────────────────────────────────────

tidy:
	go mod tidy

lint:
	golangci-lint run ./...

## ── Clean ────────────────────────────────────────────────────────────────────

clean:
	rm -rf bin/
