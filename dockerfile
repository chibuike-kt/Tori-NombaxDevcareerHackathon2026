FROM golang:1.26.4-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o bin/api ./cmd/api
RUN go build -o bin/worker ./cmd/worker

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/config ./config
EXPOSE 8080
