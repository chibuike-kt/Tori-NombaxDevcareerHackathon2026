package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
	"github.com/google/uuid"
)

func main() {
	ctx := context.Background()

	tenantEmail := os.Getenv("SEED_TENANT_EMAIL")
	if tenantEmail == "" {
		tenantEmail = "dev@tori.ng"
	}

	pool, err := postgres.NewPool(ctx)
	if err != nil {
		fail("connect db", err)
	}
	defer pool.Close()

	tenants := postgres.NewTenantRepo(pool)
	plansRepo := postgres.NewPlanRepo(pool)
	customersRepo := postgres.NewCustomerRepo(pool)
	subsRepo := postgres.NewSubscriptionRepo(pool)
	webhookRepo := postgres.NewWebhookRepo(pool)

	tenant, err := tenants.GetByEmail(ctx, tenantEmail)
	if err != nil {
		fail("find tenant "+tenantEmail, err)
	}
	tid := tenant.ID
	fmt.Printf("seeding tenant %s (%s)\n", tenant.Name, tid)

	// ---- Plans ----
	type planDef struct {
		name     string
		amount   int64
		trial    int
		interval string
	}
	defs := []planDef{
		{"Basic", 250000, 0, "monthly"},
		{"Starter", 500000, 7, "monthly"},
		{"Pro", 1500000, 14, "monthly"},
		{"Business", 5000000, 0, "monthly"},
		{"Annual Pro", 15000000, 0, "annual"},
	}

	existingPlans, _ := plansRepo.List(ctx, tid)
	byName := map[string]*domain.Plan{}
	for _, p := range existingPlans {
		byName[p.Name] = p
	}

	var plans []*domain.Plan
	for _, d := range defs {
		if p, ok := byName[d.name]; ok {
			plans = append(plans, p)
			continue
		}
		p, err := plansRepo.Create(ctx, tid, d.name, nil, d.amount, "NGN",
			domain.PlanInterval(d.interval), 1, d.trial, nil)
		if err != nil {
			fail("create plan "+d.name, err)
		}
		plans = append(plans, p)
		fmt.Printf("  plan %s created\n", d.name)
	}

	monthlyPlans := plans[:4]

	// ---- Customers ----
	people := []struct{ name, email string }{
		{"Amaka Obi", "amaka@startup.ng"},
		{"Emeka Nwosu", "emeka@saas.ng"},
		{"Fatima Bello", "fatima@retail.ng"},
		{"Chukwuemeka Okafor", "chukwu@tech.ng"},
		{"Ngozi Eze", "ngozi@app.ng"},
		{"Tunde Bakare", "tunde@fintech.ng"},
		{"Aisha Mohammed", "aisha@shop.ng"},
		{"Olusegun Adeyemi", "segun@media.ng"},
		{"Chiamaka Nwankwo", "chiamaka@edu.ng"},
		{"Ibrahim Sani", "ibrahim@logistics.ng"},
		{"Folake Adebayo", "folake@studio.ng"},
		{"Yusuf Aliyu", "yusuf@health.ng"},
		{"Blessing Okoro", "blessing@beauty.ng"},
		{"Damilola Ogunleye", "dami@travel.ng"},
		{"Hauwa Abubakar", "hauwa@food.ng"},
		{"Kelechi Onyeka", "kelechi@games.ng"},
		{"Zainab Yusuf", "zainab@learn.ng"},
		{"Oluwaseun Afolabi", "seun@cloud.ng"},
		{"Babajide Adewale", "jide@hrtech.ng"},
		{"Chidinma Okonkwo", "chidinma@legal.ng"},
	}

	var customers []*domain.Customer
	for i, p := range people {
		ext := fmt.Sprintf("seed-cust-%02d", i+1)
		if existing, err := customersRepo.GetByEmail(ctx, tid, p.email); err == nil && existing != nil {
			customers = append(customers, existing)
			continue
		}
		if existing, err := customersRepo.GetByExternalID(ctx, tid, ext); err == nil && existing != nil {
			customers = append(customers, existing)
			continue
		}
		name := p.name
		extID := ext
		c, err := customersRepo.Create(ctx, tid, &extID, p.email, &name, nil, nil)
		if err != nil {
			fmt.Printf("  skip customer %s: %v\n", p.email, err)
			continue
		}
		customers = append(customers, c)
	}
	fmt.Printf("  %d customers ready\n", len(customers))

	// ---- Subscriptions ----
	type subScenario struct {
		status         domain.SubscriptionStatus
		dunningAttempt int
		monthsActive   int
		description    string
	}

	scenarios := []subScenario{
		{domain.StatusActive, 0, 8, "long-term active"},
		{domain.StatusActive, 0, 6, "active"},
		{domain.StatusActive, 0, 4, "active"},
		{domain.StatusActive, 0, 10, "long-term active"},
		{domain.StatusActive, 0, 3, "active"},
		{domain.StatusActive, 0, 5, "active"},
		{domain.StatusActive, 0, 2, "active"},
		{domain.StatusActive, 0, 7, "long-term active"},
		{domain.StatusActive, 0, 3, "active"},
		{domain.StatusActive, 1, 4, "active — recovered from dunning once"},
		{domain.StatusTrialing, 0, 0, "trialing — 9 days left"},
		{domain.StatusTrialing, 0, 0, "trialing — 3 days left"},
		{domain.StatusGracePeriod, 0, 2, "grace period — first failure"},
		{domain.StatusDunning, 1, 3, "dunning attempt 1"},
		{domain.StatusDunning, 2, 4, "dunning attempt 2"},
		{domain.StatusPaused, 0, 3, "paused by customer"},
		{domain.StatusPaused, 0, 2, "paused by customer"},
		{domain.StatusSuspended, 0, 3, "suspended after dunning exhausted"},
		{domain.StatusCancelled, 0, 5, "cancelled after 5 months"},
		{domain.StatusCancelled, 0, 1, "cancelled early"},
	}

	now := time.Now().UTC()
	rng := rand.New(rand.NewSource(42))

	for i, c := range customers {
		if i >= len(scenarios) {
			break
		}
		sc := scenarios[i]
		plan := monthlyPlans[rng.Intn(len(monthlyPlans))]

		periodStart := now.AddDate(0, 0, -rng.Intn(15)-1)
		periodEnd := periodStart.AddDate(0, 1, 0)
		var trialEnd *time.Time

		switch sc.status {
		case domain.StatusTrialing:
			daysLeft := 9
			if i == 11 {
				daysLeft = 3
			}
			t := now.AddDate(0, 0, daysLeft)
			trialEnd = &t
			periodEnd = t
		case domain.StatusCancelled:
			periodStart = now.AddDate(0, -sc.monthsActive, 0)
			periodEnd = now.AddDate(0, -sc.monthsActive+1, 0)
		case domain.StatusSuspended:
			periodStart = now.AddDate(0, -1, -15)
			periodEnd = now.AddDate(0, 0, -15)
		}

		key := fmt.Sprintf("seed-sub-%02d", i+1)
		sub, err := subsRepo.Create(ctx, tid, c.ID, plan.ID, sc.status,
			periodStart, periodEnd, trialEnd, &key, nil)
		if err != nil {
			continue
		}

		if sc.status == domain.StatusDunning {
			retry := now.AddDate(0, 0, 2+rng.Intn(5))
			_, _ = subsRepo.UpdateDunning(ctx, sub.ID, tid, domain.StatusDunning,
				sc.dunningAttempt, &retry)
		}

		if sc.status == domain.StatusGracePeriod {
			retry := now.Add(36 * time.Hour)
			_, _ = subsRepo.UpdateDunning(ctx, sub.ID, tid, domain.StatusGracePeriod, 0, &retry)
		}

		// Insert backdated ledger entries directly via SQL
		for m := 0; m < sc.monthsActive; m++ {
			chargeTime := now.AddDate(0, -m, 0).Add(-time.Duration(rng.Intn(5)) * 24 * time.Hour)
			ik := fmt.Sprintf("seed-charge-%s-m%d", sub.ID, m)
			entryID := uuid.New()
			subID := sub.ID
			custID := c.ID
			_, err := pool.Exec(ctx, `
				INSERT INTO ledger_entries
					(id, tenant_id, subscription_id, customer_id, entry_type, direction, amount, currency, description, idempotency_key, created_at)
				VALUES ($1, $2, $3, $4, 'CHARGE', 'DEBIT', $5, 'NGN', $6, $7, $8)
				ON CONFLICT (idempotency_key) DO NOTHING
			`, entryID, tid, subID, custID, plan.Amount,
				fmt.Sprintf("Subscription renewal — month %d", m+1), ik, chargeTime)
			if err != nil {
				fmt.Printf("  ledger insert error: %v\n", err)
			}
		}

		// Recovery charge for dunning recovery
		if sc.dunningAttempt > 0 && sc.status == domain.StatusActive {
			ik := fmt.Sprintf("seed-recovery-%s", sub.ID)
			entryID := uuid.New()
			subID := sub.ID
			custID := c.ID
			_, _ = pool.Exec(ctx, `
				INSERT INTO ledger_entries
					(id, tenant_id, subscription_id, customer_id, entry_type, direction, amount, currency, description, idempotency_key, created_at)
				VALUES ($1, $2, $3, $4, 'CHARGE', 'DEBIT', $5, 'NGN', $6, $7, $8)
				ON CONFLICT (idempotency_key) DO NOTHING
			`, entryID, tid, subID, custID, plan.Amount, "Dunning recovery charge", ik, now.AddDate(0, 0, -3))
		}

		fmt.Printf("  sub %02d: %-35s %-20s %s\n", i+1, c.Email, plan.Name, sc.description)
	}

	// ---- Refunds — backdated ----
	for i := 0; i < 3; i++ {
		c := customers[i]
		subs, _ := subsRepo.ListByCustomer(ctx, tid, c.ID)
		if len(subs) == 0 {
			continue
		}
		subID := subs[0].ID
		custID := c.ID
		ik := fmt.Sprintf("seed-refund-%02d", i+1)
		amount := int64(250000 * (i + 1))
		refundTime := now.AddDate(0, -(i + 1), 0)
		entryID := uuid.New()
		_, _ = pool.Exec(ctx, `
			INSERT INTO ledger_entries
				(id, tenant_id, subscription_id, customer_id, entry_type, direction, amount, currency, description, idempotency_key, created_at)
			VALUES ($1, $2, $3, $4, 'REFUND', 'CREDIT', $5, 'NGN', $6, $7, $8)
			ON CONFLICT (idempotency_key) DO NOTHING
		`, entryID, tid, subID, custID, amount, "Goodwill refund", ik, refundTime)
	}

	// ---- Webhook endpoint ----
	endpoints, _ := webhookRepo.ListEndpoints(ctx, tid)
	if len(endpoints) == 0 {
		secret := "whsec_demo_a1b2c3d4e5f6789012345678901234567890abcd"
		_, err = webhookRepo.CreateEndpoint(ctx, tid,
			"https://demo.classpay.ng/webhooks/tori",
			[]string{"*"}, secret, "2026-06-01")
		if err != nil {
			fmt.Printf("  webhook endpoint error: %v\n", err)
		} else {
			fmt.Println("  webhook endpoint created")
		}
	}

	fmt.Println("\nseed complete.")
	fmt.Printf("  login:     %s\n", tenantEmail)
	fmt.Printf("  password:  tori-dev-2026\n")
	fmt.Println("  dashboard: http://localhost:3000/login")
}

func fail(stage string, err error) {
	fmt.Printf("seed failed at %s: %v\n", stage, err)
	os.Exit(1)
}
