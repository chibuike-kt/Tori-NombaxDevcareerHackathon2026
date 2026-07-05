#!/usr/bin/env bash
# Full endpoint smoke test for the Tori API.
#
# Logs in as the seed tenant, generates a Platform test API key, then exercises
# every public/JWT/API-key-protected endpoint against a live deployment.
# Prints a results table and a pass/fail summary; exits 1 if anything failed.
#
# Requires: curl, python3 (used only for safe JSON field extraction — no jq
# dependency assumed).
#
# Usage:
#   ./scripts/smoke_test.sh
#   BASE_URL=http://localhost:8080 ./scripts/smoke_test.sh
set -uo pipefail

BASE_URL="${BASE_URL:-https://api-production-3847.up.railway.app}"
SEED_EMAIL="${SEED_EMAIL:-dev@tori.ng}"
SEED_PASSWORD="${SEED_PASSWORD:-tori-dev-2026}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required (used for JSON field extraction) but was not found on PATH." >&2
  exit 1
fi

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# On Git Bash / MSYS, curl (MinGW build) and python3 (native Windows build)
# disagree about what a path like /tmp/xxx means — curl resolves it fine,
# python3 does not. cygpath, when present, gives python the C:\... form of
# the same file so both tools agree on where it lives.
BODY_FILE_FOR_PY="$BODY_FILE"
if command -v cygpath >/dev/null 2>&1; then
  BODY_FILE_FOR_PY="$(cygpath -w "$BODY_FILE")"
fi

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

# json_get EXPR — reads the last response body from $BODY_FILE, evaluates
# EXPR against the parsed object `d`, prints the result or "" on any error.
# Never raises — a malformed/absent field just yields an empty string so the
# script can keep going instead of aborting on an unexpected response shape.
json_get() {
  python3 -c "
import json, sys
try:
    with open(r'$BODY_FILE_FOR_PY', 'r', encoding='utf-8') as f:
        d = json.load(f)
except Exception:
    print('')
    sys.exit(0)
try:
    v = $1
    print('' if v is None else v)
except Exception:
    print('')
"
}

# record METHOD PATH EXPECTED ACTUAL [NOTE]
record() {
  local method="$1" path="$2" expected="$3" actual="$4" note="${5:-}"
  local status
  if [ "$actual" = "$expected" ]; then
    status="PASS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    status="FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  RESULTS+=("$(printf '%-6s | %-52s | %-8s | %-6s | %-4s | %s' "$method" "$path" "$expected" "$actual" "$status" "$note")")
}

# request METHOD PATH EXPECTED [AUTH_HEADER] [BODY] [NOTE]
# Leaves the response body in $BODY_FILE for the caller to extract fields from.
request() {
  local method="$1" path="$2" expected="$3" auth_header="${4:-}" body="${5:-}" note="${6:-}"
  local url="${BASE_URL}${path}"
  local args=(-s -o "$BODY_FILE" -w "%{http_code}" -X "$method" "$url" --max-time 20 -H "Content-Type: application/json")
  if [ -n "$auth_header" ]; then
    args+=(-H "$auth_header")
  fi
  if [ -n "$body" ]; then
    args+=(-d "$body")
  fi
  local actual
  actual=$(curl "${args[@]}" 2>/dev/null)
  record "$method" "$path" "$expected" "$actual" "$note"
}

echo "Smoke testing ${BASE_URL}"
echo

# ── Public (no auth) ─────────────────────────────────────────────────────────
request GET  "/v1/status" 200
request GET  "/v1/nomba/webhook" 200
request POST "/v1/team/invitations/accept" 400 "" \
  '{"token":"clearly-invalid-token-0000","password":"somepassword123"}' \
  "invalid token must 400, not 500"

# ── Login ────────────────────────────────────────────────────────────────────
request POST "/v1/auth/login" 200 "" \
  "$(printf '{"email":"%s","password":"%s"}' "$SEED_EMAIL" "$SEED_PASSWORD")"
JWT=$(json_get "d['data']['access_token']")

if [ -z "$JWT" ]; then
  echo "FATAL: login failed — cannot obtain a JWT, aborting remaining tests." >&2
  echo
  for line in "${RESULTS[@]}"; do echo "$line"; done
  echo
  echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed (aborted early)"
  exit 1
fi
AUTH="Authorization: Bearer $JWT"

# ── JWT-protected ────────────────────────────────────────────────────────────
request GET "/v1/me" 200 "$AUTH"
TENANT_NAME=$(json_get "d['data']['name']")
TENANT_EMAIL=$(json_get "d['data']['email']")

ME_BODY=$(python3 -c "
import json, sys
print(json.dumps({'name': sys.argv[1], 'email': sys.argv[2]}))
" "$TENANT_NAME" "$TENANT_EMAIL")
request PATCH "/v1/me" 200 "$AUTH" "$ME_BODY" "no-op update — same name/email"

request GET "/v1/api-keys" 200 "$AUTH"
request GET "/v1/plans" 200 "$AUTH"

request POST "/v1/plans" 201 "$AUTH" \
  '{"name":"Smoke Test Plan","amount":100000,"currency":"NGN","interval":"monthly","trial_period_days":0}'
PLAN_ID=$(json_get "d['data']['id']")

request GET "/v1/customers" 200 "$AUTH"
request GET "/v1/subscriptions" 200 "$AUTH"
request GET "/v1/invoices" 200 "$AUTH"
request GET "/v1/ledger" 200 "$AUTH"
request GET "/v1/finance/mrr" 200 "$AUTH"
request GET "/v1/finance/arr" 200 "$AUTH"
request GET "/v1/finance/churn" 200 "$AUTH"
request GET "/v1/finance/revenue-report" 200 "$AUTH"
request GET "/v1/finance/recovery-center" 200 "$AUTH"
request GET "/v1/finance/dunning-recovery" 200 "$AUTH"
request GET "/v1/health" 200 "$AUTH" "" "aka Billing Health — /v1/billing/health does not exist"
request GET "/v1/webhooks/endpoints" 200 "$AUTH"
request GET "/v1/webhooks/logs" 200 "$AUTH"
request GET "/v1/team/members" 200 "$AUTH"
request GET "/v1/team/audit-log" 200 "$AUTH"
request GET "/v1/auth/sessions" 200 "$AUTH"
request GET "/v1/promo-codes" 200 "$AUTH"
request GET "/v1/email-templates" 200 "$AUTH"
request GET "/v1/metrics" 200 "$AUTH"
request PATCH "/v1/dunning-config" 200 "$AUTH" \
  '{"retry_intervals_days":[3,7,14,21],"max_attempts":4,"suspension_action":"suspend","notify_customer":true,"notify_merchant":true,"smart_retry":true}'

# ── Generate a Platform (test-mode) API key ─────────────────────────────────
request POST "/v1/api-keys/test" 201 "$AUTH" "" "generates the key used below"
API_KEY=$(json_get "d['data']['key']")

if [ -z "$API_KEY" ]; then
  echo "FATAL: could not generate a test API key — aborting Platform API tests." >&2
  API_KEY="MISSING"
fi
APIKEY_HEADER="X-API-Key: $API_KEY"

# ── Platform API key-protected ──────────────────────────────────────────────
request GET "/v1/platform/plans" 200 "$APIKEY_HEADER"
request GET "/v1/platform/customers" 200 "$APIKEY_HEADER"
request GET "/v1/platform/subscriptions" 200 "$APIKEY_HEADER" "" "200 whether or not any exist yet"

request POST "/v1/platform/checkout" 201 "$APIKEY_HEADER" \
  "$(printf '{"email":"smoketest+%s@tori.ng","plan_id":"%s","idempotency_key":"smoketest-%s"}' "$$" "$PLAN_ID" "$$")" \
  "uses the test key — routes to Nomba sandbox only"
SUB_ID=$(json_get "d['data']['subscription']['id']")

# ── Subscription-specific (needs a real subscription ID) ───────────────────
if [ -n "$SUB_ID" ]; then
  request GET "/v1/subscriptions/${SUB_ID}" 200 "$AUTH"
  request GET "/v1/subscriptions/${SUB_ID}/transitions" 200 "$AUTH"
else
  echo "WARNING: no subscription ID captured from the checkout step — falling back to the first subscription in the account, if any." >&2
  request GET "/v1/subscriptions" 200 "$AUTH"
  FALLBACK_ID=$(json_get "d['data'][0]['id'] if d.get('data') else None")
  if [ -n "$FALLBACK_ID" ]; then
    request GET "/v1/subscriptions/${FALLBACK_ID}" 200 "$AUTH"
    request GET "/v1/subscriptions/${FALLBACK_ID}/transitions" 200 "$AUTH"
  else
    record GET "/v1/subscriptions/{id}" 200 "SKIP" "no subscription exists to test against"
    record GET "/v1/subscriptions/{id}/transitions" 200 "SKIP" "no subscription exists to test against"
  fi
fi

# ── Results ──────────────────────────────────────────────────────────────────
echo
printf '%-6s | %-52s | %-8s | %-6s | %-4s | %s\n' "METHOD" "PATH" "EXPECT" "ACTUAL" "PASS" "NOTE"
printf -- '-------|------------------------------------------------------|----------|--------|------|------------------------------------\n'
for line in "${RESULTS[@]}"; do
  echo "$line"
done

echo
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
