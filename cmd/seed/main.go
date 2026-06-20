package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/postgres"
)

// Seeds the dev tenant with realistic Nigerian demo data so the dashboard
// shows live numbers. Idempotent by external_id and plan name — safe to re-run.

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
	ledgerRepo := postgres.NewLedgerRepo(pool)

	tenant, err := tenants.GetByEmail(ctx, tenantEmail)
	if err != nil {
		fail("find tenant "+tenantEmail, err)
	}
	tid := tenant.ID
	fmt.Printf("seeding tenant %s (%s)\n", tenant.Name, tid)

	// ---- Plans ----
	type planDef struct {
		name   string
		amount int64
		trial  int
	}
	defs := []planDef{
		{"Basic", 250000, 0},
		{"Starter", 500000, 7},
		{"Pro", 1500000, 14},
		{"Business", 5000000, 0},
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
		p, err := plansRepo.Create(ctx, tid, d.name, nil, d.amount, "NGN", domain.PlanInterval("monthly"), 1, d.trial, nil)
		if err != nil {
			fail("create plan "+d.name, err)
		}
		plans = append(plans, p)
		fmt.Printf("  plan %s created\n", d.name)
	}

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
	}

var customers []*domain.Customer
	for i, p := range people {
		ext := fmt.Sprintf("seed-cust-%02d", i+1)

		// try email lookup first since we may have created this customer manually
		if existing, err := customersRepo.GetByEmail(ctx, tid, p.email); err == nil && existing != nil {
			customers = append(customers, existing)
			continue
		}
		// try external_id lookup
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

	// ---- Subscriptions across states ----
	// Weighted: mostly active, some trialing/dunning/paused/cancelled.
	states := []domain.SubscriptionStatus{
		domain.StatusActive, domain.StatusActive, domain.StatusActive, domain.StatusActive,
		domain.StatusActive, domain.StatusActive, domain.StatusActive, domain.StatusActive,
		domain.StatusActive, domain.StatusActive,
		domain.StatusTrialing, domain.StatusTrialing,
		domain.StatusDunning, domain.StatusDunning,
		domain.StatusPaused, domain.StatusPaused,
		domain.StatusCancelled, domain.StatusCancelled,
	}

	now := time.Now().UTC()
	rng := rand.New(rand.NewSource(42))

	for i, c := range customers {
		status := states[i%len(states)]
		plan := plans[rng.Intn(len(plans))]

		periodStart := now.AddDate(0, 0, -rng.Intn(20))
		periodEnd := periodStart.AddDate(0, 1, 0)
		var trialEnd *time.Time

		switch status {
		case domain.StatusTrialing:
			t := now.AddDate(0, 0, 5+rng.Intn(7))
			trialEnd = &t
			periodEnd = t
		case domain.StatusCancelled:
			periodStart = now.AddDate(0, -2, 0)
			periodEnd = now.AddDate(0, -1, 0)
		}

		key := fmt.Sprintf("seed-sub-%02d", i+1)
		sub, err := subsRepo.Create(ctx, tid, c.ID, plan.ID, status, periodStart, periodEnd, trialEnd, &key, nil)
		if err != nil {
			// already seeded — skip
			continue
		}

		// Dunning subs carry a retry attempt
		if status == domain.StatusDunning {
			retry := now.AddDate(0, 0, 4)
			_, _ = subsRepo.UpdateDunning(ctx, sub.ID, tid, domain.StatusDunning, 2, &retry)
		}

		// Ledger history: charges for anything that has billed
		if status == domain.StatusActive || status == domain.StatusDunning || status == domain.StatusPaused {
			months := 3
			for m := 0; m < months; m++ {
				ik := fmt.Sprintf("seed-charge-%s-%d", sub.ID, m)
				subID := sub.ID
				custID := c.ID
				_, _ = ledgerRepo.Append(ctx, tid, &subID, nil, &custID,
					domain.EntryCharge, domain.DirectionDebit, plan.Amount, "NGN",
					"Subscription renewal", ik, nil)
			}
		}
	}

	// A couple of refunds for realism
	if len(customers) > 2 {
		for i := 0; i < 2; i++ {
			c := customers[i]
			subs, _ := subsRepo.ListByCustomer(ctx, tid, c.ID)
			if len(subs) == 0 {
				continue
			}
			subID := subs[0].ID
			custID := c.ID
			ik := fmt.Sprintf("seed-refund-%s", subID)
			_, _ = ledgerRepo.Append(ctx, tid, &subID, nil, &custID,
				domain.EntryRefund, domain.DirectionCredit, 250000, "NGN",
				"Goodwill refund", ik, nil)
		}
	}

	fmt.Println("seed complete.")
}

func fail(stage string, err error) {
	fmt.Printf("seed failed at %s: %v\n", stage, err)
	os.Exit(1)
}
