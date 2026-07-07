package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ClassPay demo seed — creates the tenant, catalog, customers, and
// activity through the real HTTP API so every write goes through actual
// business logic. Subscriptions, their invoices/ledger entries, and the
// payout are written directly to Postgres because their exact states,
// dates, and dunning progress can't be produced through the API surface.

var (
	baseURL    string
	httpClient = &http.Client{Timeout: 30 * time.Second}
)

func main() {
	ctx := context.Background()

	baseURL = os.Getenv("SEED_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	tenantEmail := envOr("SEED_TENANT_EMAIL", "dev@tori.ng")
	tenantPassword := envOr("SEED_TENANT_PASSWORD", "tori-dev-2026")
	tenantName := envOr("SEED_TENANT_NAME", "ClassPay")
	inviteEmail := envOr("SEED_INVITE_EMAIL", "kingsleychibueze16@gmail.com")

	pool, err := postgres.NewPool(ctx)
	if err != nil {
		fail("connect db", err)
	}
	defer pool.Close()

	if os.Getenv("SEED_CLEAN") == "true" {
		fmt.Println("SEED_CLEAN=true — truncating all business tables before reseeding")
		if _, err := pool.Exec(ctx, `TRUNCATE TABLE
			api_keys, audit_log, customer_otp_codes, customers, email_templates,
			email_verifications, events, invitations, invoices, ledger_entries,
			members, oauth_clients, oauth_tokens, payment_links, payouts, plans,
			promo_codes, reconciliation_runs, scheduled_jobs, subscription_transitions,
			subscriptions, tenants, webhook_deliveries, webhook_endpoints CASCADE`); err != nil {
			fail("truncate tables", err)
		}
		fmt.Println("  all tables truncated")
	}

	fmt.Printf("seeding against %s\n", baseURL)

	// ---- Tenant registration ----
	fmt.Println("\n== Tenant ==")
	regData := must(call("POST", "/v1/auth/register", nil, map[string]string{
		"name":     tenantName,
		"email":    tenantEmail,
		"password": tenantPassword,
	}))
	accessToken := getStr(regData, "access_token")
	fmt.Println("  registered", tenantName, "<"+tenantEmail+">")

	if _, err := pool.Exec(ctx, `UPDATE tenants SET email_verified = true WHERE email = $1`, tenantEmail); err != nil {
		fail("mark email verified", err)
	}
	fmt.Println("  email marked verified")

	var tenantID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM tenants WHERE email = $1`, tenantEmail).Scan(&tenantID); err != nil {
		fail("look up tenant id", err)
	}

	jwtAuth := map[string]string{"Authorization": "Bearer " + accessToken}
	jwtTest := map[string]string{"Authorization": "Bearer " + accessToken, "X-Tori-Mode": "test"}

	// Registration auto-generates a live+test key, but doesn't return the raw
	// values — rotate both now so we have usable raw keys for Platform API calls.
	liveKeyData := must(call("POST", "/v1/api-keys", jwtAuth, map[string]string{"name": "Live key"}))
	liveKey := getStr(liveKeyData, "key")
	testKeyData := must(call("POST", "/v1/api-keys/test", jwtAuth, nil))
	testKey := getStr(testKeyData, "key")
	fmt.Println("  live + test API keys generated")

	liveAPIKey := map[string]string{"X-API-Key": liveKey}
	testAPIKey := map[string]string{"X-API-Key": testKey}

	oauthData := must(call("POST", "/v1/oauth/clients", jwtAuth, map[string]string{
		"name": "ClassPay Integration", "mode": "live",
	}))
	fmt.Println("  OAuth client created:", getStr(oauthData, "client_id"))

	// ---- Plans ----
	fmt.Println("\n== Plans ==")
	type planSeed struct {
		name     string
		amount   int64
		interval string
		trial    int
	}
	livePlanDefs := []planSeed{
		{"Basic Monthly", 250000, "monthly", 0},
		{"Pro Monthly", 500000, "monthly", 0},
		{"Starter with Trial", 150000, "monthly", 7},
		{"Annual Plan", 2500000, "annual", 0},
	}
	testPlanDefs := []planSeed{
		{"Basic Monthly Test", 250000, "monthly", 0},
		{"Pro Monthly Test", 500000, "monthly", 0},
		{"Starter Trial Test", 150000, "monthly", 7},
	}

	livePlans := map[string]uuid.UUID{}
	for _, d := range livePlanDefs {
		data := must(call("POST", "/v1/plans", jwtAuth, map[string]interface{}{
			"name": d.name, "amount": d.amount, "currency": "NGN",
			"interval": d.interval, "trial_period_days": d.trial,
		}))
		livePlans[d.name] = uuid.MustParse(getStr(data, "id"))
		fmt.Printf("  [live] %s created\n", d.name)
	}
	testPlans := map[string]uuid.UUID{}
	for _, d := range testPlanDefs {
		data := must(call("POST", "/v1/platform/plans", testAPIKey, map[string]interface{}{
			"name": d.name, "amount": d.amount, "currency": "NGN",
			"interval": d.interval, "trial_period_days": d.trial,
		}))
		testPlans[d.name] = uuid.MustParse(getStr(data, "id"))
		fmt.Printf("  [test] %s created\n", d.name)
	}
	planAmount := map[string]int64{}
	for _, d := range append(append([]planSeed{}, livePlanDefs...), testPlanDefs...) {
		planAmount[d.name] = d.amount
	}

	// ---- Customers ----
	fmt.Println("\n== Customers ==")
	type customerSeed struct {
		name, email, externalID string
	}
	liveCustomerDefs := []customerSeed{
		{"Amaka Obi", "amaka.obi@greenfield.edu.ng", "school_amaka_001"},
		{"Chidi Nwosu", "chidi.nwosu@faithacademy.ng", "school_chidi_002"},
		{"Fatima Abubakar", "fatima@starlight.edu.ng", "school_fatima_003"},
		{"Emeka Eze", "emeka.eze@excellence.ng", "school_emeka_004"},
		{"Ngozi Adeyemi", "ngozi@brightfuture.edu.ng", "school_ngozi_005"},
		{"Taiwo Okonkwo", "taiwo@heritage.edu.ng", "school_taiwo_006"},
	}
	testCustomerDefs := []customerSeed{
		{"Test School One", "test1@school.ng", "test_school_001"},
		{"Test School Two", "test2@school.ng", "test_school_002"},
		{"Test School Three", "test3@school.ng", "test_school_003"},
	}

	liveCustomers := map[string]uuid.UUID{}
	for _, d := range liveCustomerDefs {
		data := must(call("POST", "/v1/platform/customers", liveAPIKey, map[string]interface{}{
			"external_id": d.externalID, "email": d.email, "name": d.name,
		}))
		liveCustomers[d.externalID] = uuid.MustParse(getStr(data, "id"))
		fmt.Printf("  [live] %s (%s)\n", d.name, d.externalID)
	}
	testCustomers := map[string]uuid.UUID{}
	for _, d := range testCustomerDefs {
		data := must(call("POST", "/v1/platform/customers", testAPIKey, map[string]interface{}{
			"external_id": d.externalID, "email": d.email, "name": d.name,
		}))
		testCustomers[d.externalID] = uuid.MustParse(getStr(data, "id"))
		fmt.Printf("  [test] %s (%s)\n", d.name, d.externalID)
	}

	// ---- Subscriptions (direct SQL — exact states/dates required) ----
	fmt.Println("\n== Subscriptions (direct SQL) ==")
	type subSeed struct {
		mode              string
		customerExtID     string
		planName          string
		status            string
		periodStart       time.Time
		periodEnd         time.Time
		trialEnd          *time.Time
		dunningAttempt    int
		nextRetryAt       *time.Time
		recoveryRail      string
		cancelAtPeriodEnd bool
	}
	d := func(y, m, day int) time.Time { return time.Date(y, time.Month(m), day, 0, 0, 0, 0, time.UTC) }
	tp := func(t time.Time) *time.Time { return &t }

	subs := []subSeed{
		// LIVE — the 6 named customers
		{mode: "live", customerExtID: "school_amaka_001", planName: "Basic Monthly", status: "ACTIVE",
			periodStart: d(2026, 6, 1), periodEnd: d(2026, 7, 1)},
		{mode: "live", customerExtID: "school_chidi_002", planName: "Pro Monthly", status: "ACTIVE",
			periodStart: d(2026, 6, 15), periodEnd: d(2026, 7, 15)},
		{mode: "live", customerExtID: "school_fatima_003", planName: "Starter with Trial", status: "TRIALING",
			periodStart: d(2026, 7, 5), periodEnd: d(2026, 7, 12), trialEnd: tp(d(2026, 7, 12))},
		{mode: "live", customerExtID: "school_emeka_004", planName: "Basic Monthly", status: "ACTIVE",
			periodStart: d(2026, 6, 20), periodEnd: d(2026, 7, 20), dunningAttempt: 1, recoveryRail: "card"},
		{mode: "live", customerExtID: "school_ngozi_005", planName: "Pro Monthly", status: "PAST_DUE",
			periodStart: d(2026, 6, 25), periodEnd: d(2026, 7, 25), nextRetryAt: tp(d(2026, 7, 10))},
		{mode: "live", customerExtID: "school_taiwo_006", planName: "Basic Monthly", status: "DUNNING",
			periodStart: d(2026, 6, 10), periodEnd: d(2026, 7, 10), dunningAttempt: 2,
			nextRetryAt: tp(d(2026, 7, 14)), recoveryRail: "card"},
		// LIVE extras — second subscriptions on the first three customers
		{mode: "live", customerExtID: "school_amaka_001", planName: "Pro Monthly", status: "ACTIVE",
			periodStart: d(2026, 6, 20), periodEnd: d(2026, 7, 20), cancelAtPeriodEnd: true},
		{mode: "live", customerExtID: "school_chidi_002", planName: "Basic Monthly", status: "SUSPENDED",
			periodStart: d(2026, 5, 1), periodEnd: d(2026, 6, 1), dunningAttempt: 4, recoveryRail: "manual"},
		{mode: "live", customerExtID: "school_fatima_003", planName: "Annual Plan", status: "ACTIVE",
			periodStart: d(2026, 1, 1), periodEnd: d(2027, 1, 1)},
		// TEST
		{mode: "test", customerExtID: "test_school_001", planName: "Basic Monthly Test", status: "ACTIVE",
			periodStart: d(2026, 6, 20), periodEnd: d(2026, 7, 20)},
		{mode: "test", customerExtID: "test_school_002", planName: "Pro Monthly Test", status: "TRIALING",
			periodStart: d(2026, 7, 8), periodEnd: d(2026, 7, 15), trialEnd: tp(d(2026, 7, 15))},
		{mode: "test", customerExtID: "test_school_003", planName: "Basic Monthly Test", status: "PAST_DUE",
			periodStart: d(2026, 6, 5), periodEnd: d(2026, 7, 5)},
		{mode: "test", customerExtID: "test_school_001", planName: "Pro Monthly Test", status: "DUNNING",
			periodStart: d(2026, 6, 1), periodEnd: d(2026, 7, 1), dunningAttempt: 1, nextRetryAt: tp(d(2026, 7, 8))},
		{mode: "test", customerExtID: "test_school_002", planName: "Basic Monthly Test", status: "ACTIVE",
			periodStart: d(2026, 6, 15), periodEnd: d(2026, 7, 15), cancelAtPeriodEnd: true},
	}

	for i, s := range subs {
		custID := liveCustomers[s.customerExtID]
		planID := livePlans[s.planName]
		if s.mode == "test" {
			custID = testCustomers[s.customerExtID]
			planID = testPlans[s.planName]
		}
		if s.recoveryRail == "" {
			s.recoveryRail = "card"
		}
		tokenKey := fmt.Sprintf("tok_%s_%s", s.mode, randomHex(16))
		metadata := fmt.Sprintf(`{"external_id": "%s", "seeded": true}`, s.customerExtID)
		subID := uuid.New()

		_, err := pool.Exec(ctx, `
			INSERT INTO subscriptions
				(id, tenant_id, customer_id, plan_id, status, current_period_start, current_period_end,
				 trial_end, cancel_at_period_end, dunning_attempt, next_retry_at, token_key,
				 recovery_rail, metadata, mode)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		`, subID, tenantID, custID, planID, s.status, s.periodStart, s.periodEnd,
			s.trialEnd, s.cancelAtPeriodEnd, s.dunningAttempt, s.nextRetryAt, tokenKey,
			s.recoveryRail, metadata, s.mode)
		if err != nil {
			fail(fmt.Sprintf("insert subscription %d (%s/%s)", i+1, s.customerExtID, s.planName), err)
		}
		fmt.Printf("  [%s] %-18s %-20s %s\n", s.mode, s.customerExtID, s.planName, s.status)

		// ---- Invoices + ledger entries for every ACTIVE subscription ----
		if s.status == "ACTIVE" {
			amount := planAmount[s.planName]
			invoiceID := uuid.New()
			nombaRef := fmt.Sprintf("SEED-CHARGE-%s-001", subID)
			lineItems := fmt.Sprintf(`[{"description": "%s", "amount": %d, "currency": "NGN"}]`, s.planName, amount)
			invoiceIK := fmt.Sprintf("seed-invoice-%s", subID)
			_, err := pool.Exec(ctx, `
				INSERT INTO invoices
					(id, tenant_id, subscription_id, customer_id, amount, currency, status,
					 due_date, paid_at, nomba_charge_ref, line_items, idempotency_key, mode)
				VALUES ($1,$2,$3,$4,$5,'NGN','paid',$6,$7,$8,$9,$10,$11)
			`, invoiceID, tenantID, subID, custID, amount, s.periodStart, s.periodStart,
				nombaRef, lineItems, invoiceIK, s.mode)
			if err != nil {
				fail("insert invoice for "+subID.String(), err)
			}

			ledgerIK := fmt.Sprintf("initial-charge-%s", subID)
			_, err = pool.Exec(ctx, `
				INSERT INTO ledger_entries
					(id, tenant_id, subscription_id, invoice_id, customer_id, entry_type, direction,
					 amount, currency, description, idempotency_key, mode)
				VALUES ($1,$2,$3,$4,$5,'CHARGE','DEBIT',$6,'NGN',$7,$8,$9)
			`, uuid.New(), tenantID, subID, invoiceID, custID, amount,
				"Initial charge — "+s.planName, ledgerIK, s.mode)
			if err != nil {
				fail("insert ledger entry for "+subID.String(), err)
			}
		}
	}

	// ---- Webhook endpoint ----
	fmt.Println("\n== Webhook endpoint ==")
	webhookURL := realWebhookSiteURL()
	must(call("POST", "/v1/webhooks/endpoints", jwtAuth, map[string]interface{}{
		"url": webhookURL, "events": []string{"*"},
	}))
	fmt.Println("  endpoint created:", webhookURL)

	// ---- Promo codes ----
	fmt.Println("\n== Promo codes ==")
	must(call("POST", "/v1/promo-codes", jwtAuth, map[string]interface{}{
		"code": "LAUNCH20", "description": "Launch discount", "discount_type": "percentage", "discount_value": 20,
	}))
	fmt.Println("  [live] LAUNCH20 — 20% off")
	must(call("POST", "/v1/promo-codes", jwtAuth, map[string]interface{}{
		"code": "SAVE500", "description": "Flat ₦500 off", "discount_type": "fixed", "discount_value": 50000,
	}))
	fmt.Println("  [live] SAVE500 — ₦500 fixed")
	expiredYesterday := time.Now().UTC().AddDate(0, 0, -1).Format(time.RFC3339)
	testOnly := must(call("POST", "/v1/promo-codes", jwtAuth, map[string]interface{}{
		"code": "TESTONLY", "description": "Expired test promo", "discount_type": "percentage",
		"discount_value": 10, "expires_at": expiredYesterday,
	}))
	must(call("DELETE", "/v1/promo-codes/"+getStr(testOnly, "id"), jwtAuth, nil))
	fmt.Println("  [live] TESTONLY — 10% off, expired + deactivated")
	must(call("POST", "/v1/promo-codes", jwtTest, map[string]interface{}{
		"code": "TEST20", "description": "Test mode discount", "discount_type": "percentage", "discount_value": 20,
	}))
	fmt.Println("  [test] TEST20 — 20% off")

	// ---- Team invitation (also writes the member.invited audit log entry) ----
	fmt.Println("\n== Team ==")
	must(call("POST", "/v1/team/members/invite", jwtAuth, map[string]interface{}{
		"email": inviteEmail, "role": "developer",
	}))
	fmt.Println("  invited", inviteEmail, "as developer")

	// ---- Payment link ----
	fmt.Println("\n== Payment link ==")
	linkData := must(call("POST", "/v1/payment-links", jwtAuth, map[string]interface{}{
		"title":       "ClassPay Setup Fee",
		"description": "One-time school onboarding fee",
		"amount_kobo": 500000,
		"max_uses":    100,
	}))
	fmt.Println("  created:", getStr(linkData, "id"))

	// ---- Payout (direct SQL) ----
	fmt.Println("\n== Payout (direct SQL) ==")
	completedAt := d(2026, 7, 1)
	_, err = pool.Exec(ctx, `
		INSERT INTO payouts
			(id, tenant_id, mode, amount_kobo, currency, bank_code, bank_name,
			 account_number, account_name, status, requested_at, completed_at)
		VALUES ($1,$2,'live',$3,'NGN','044','Access Bank','0123456789','ClassPay Ltd','completed',$4,$4)
	`, uuid.New(), tenantID, 1000000, completedAt)
	if err != nil {
		fail("insert payout", err)
	}
	fmt.Println("  ₦10,000 payout to Access Bank — completed")

	// ---- Verification ----
	fmt.Println("\n== Verification ==")
	printRowCounts(ctx, pool)
	printModeDistribution(ctx, pool)
	printInvoiceLedgerConsistency(ctx, pool)

	fmt.Println("\nseed complete.")
	fmt.Printf("  login:    %s\n", tenantEmail)
	fmt.Printf("  password: %s\n", tenantPassword)
}

var seedTables = []string{
	"tenants", "customers", "plans", "subscriptions", "invoices", "ledger_entries",
	"promo_codes", "payment_links", "payouts", "members", "oauth_clients",
	"email_templates", "webhook_endpoints", "events",
}

func printRowCounts(ctx context.Context, pool *pgxpool.Pool) {
	fmt.Println("  row counts:")
	for _, t := range seedTables {
		var n int
		if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM "+t).Scan(&n); err != nil {
			fmt.Printf("    %-18s error: %v\n", t, err)
			continue
		}
		fmt.Printf("    %-18s %d\n", t, n)
	}
}

func printModeDistribution(ctx context.Context, pool *pgxpool.Pool) {
	fmt.Println("  mode distribution:")
	queries := map[string]string{
		"subscriptions (mode, status)": "SELECT mode, status, COUNT(*) FROM subscriptions GROUP BY mode, status ORDER BY mode, status",
		"customers (mode)":             "SELECT mode, COUNT(*) FROM customers GROUP BY mode ORDER BY mode",
		"plans (mode)":                 "SELECT mode, COUNT(*) FROM plans GROUP BY mode ORDER BY mode",
		"invoices (mode)":              "SELECT mode, COUNT(*) FROM invoices GROUP BY mode ORDER BY mode",
		"ledger_entries (mode)":        "SELECT mode, COUNT(*) FROM ledger_entries GROUP BY mode ORDER BY mode",
	}
	for label, q := range queries {
		rows, err := pool.Query(ctx, q)
		if err != nil {
			fmt.Printf("    %s: error: %v\n", label, err)
			continue
		}
		fmt.Printf("    %s:\n", label)
		for rows.Next() {
			vals, err := rows.Values()
			if err != nil {
				continue
			}
			fmt.Printf("      %v\n", vals)
		}
		rows.Close()
	}
}

func printInvoiceLedgerConsistency(ctx context.Context, pool *pgxpool.Pool) {
	fmt.Println("  invoice/ledger consistency (paid invoices vs matching ledger charge):")
	rows, err := pool.Query(ctx, `
		SELECT i.id, i.amount, i.status, le.amount as ledger_amount
		FROM invoices i
		LEFT JOIN ledger_entries le ON le.invoice_id = i.id
		WHERE i.status = 'paid'
		ORDER BY i.created_at DESC`)
	if err != nil {
		fmt.Printf("    error: %v\n", err)
		return
	}
	defer rows.Close()

	total, mismatches, nulls := 0, 0, 0
	for rows.Next() {
		var id uuid.UUID
		var amount int64
		var status string
		var ledgerAmount *int64
		if err := rows.Scan(&id, &amount, &status, &ledgerAmount); err != nil {
			continue
		}
		total++
		if ledgerAmount == nil {
			nulls++
			fmt.Printf("    MISSING ledger entry for invoice %s\n", id)
			continue
		}
		if *ledgerAmount != amount {
			mismatches++
			fmt.Printf("    MISMATCH invoice %s: invoice=%d ledger=%d\n", id, amount, *ledgerAmount)
		}
	}
	fmt.Printf("    %d paid invoices checked — %d missing ledger entries, %d amount mismatches\n", total, nulls, mismatches)
}

func fail(stage string, err error) {
	fmt.Printf("seed failed at %s: %v\n", stage, err)
	os.Exit(1)
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func randomHex(n int) string {
	b := make([]byte, n/2)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// realWebhookSiteURL asks webhook.site for a fresh disposable token so the
// seeded endpoint is a real, inspectable URL rather than a dead placeholder.
// Falls back to the literal placeholder if the request fails for any reason.
func realWebhookSiteURL() string {
	req, err := http.NewRequest("POST", "https://webhook.site/token", nil)
	if err != nil {
		return "https://webhook.site/your-test-url"
	}
	req.Header.Set("Accept", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "https://webhook.site/your-test-url"
	}
	defer resp.Body.Close()
	var body struct {
		UUID string `json:"uuid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || body.UUID == "" {
		return "https://webhook.site/your-test-url"
	}
	return "https://webhook.site/" + body.UUID
}

func getStr(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func must(data map[string]interface{}, err error) map[string]interface{} {
	if err != nil {
		fail("api call", err)
	}
	return data
}

func call(method, path string, headers map[string]string, body interface{}) (map[string]interface{}, error) {
	var buf io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		buf = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, baseURL+path, buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed struct {
		Data  json.RawMessage `json:"data"`
		Error *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rawBody, &parsed); err != nil {
		return nil, fmt.Errorf("%s %s: status %d, unparseable body: %s", method, path, resp.StatusCode, string(rawBody))
	}
	if resp.StatusCode >= 400 || parsed.Error != nil {
		msg := string(rawBody)
		if parsed.Error != nil {
			msg = parsed.Error.Code + ": " + parsed.Error.Message
		}
		return nil, fmt.Errorf("%s %s: status %d — %s", method, path, resp.StatusCode, msg)
	}

	var data map[string]interface{}
	if len(parsed.Data) > 0 {
		if err := json.Unmarshal(parsed.Data, &data); err != nil {
			// data was a non-object (rare) — return an empty map, caller
			// only needed the side effect.
			return map[string]interface{}{}, nil
		}
	}
	return data, nil
}
