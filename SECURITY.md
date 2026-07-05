# Security Policy

## Reporting a vulnerability
Email security@tori.ng with: description, reproduction steps, potential impact.
We respond within 48 hours and aim to patch critical issues within 7 days.

## What we protect
- Tenant data isolation — every query is tenant-scoped
- Payment credentials — API keys are SHA-256 hashed, never stored in plaintext
- Webhook signatures — HMAC-SHA256, timing-safe comparison
- Passwords — Argon2id with unique salts
- Sessions — Redis-backed with instant revocation

## Scope
This covers the Tori API and dashboard. Nomba's payment infrastructure is governed by Nomba's own security policies.
