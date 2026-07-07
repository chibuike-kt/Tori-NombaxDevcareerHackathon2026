package payment

import (
	"context"
	"time"
)

// ModeAwareClient picks between a live and a test NombaClient based on the
// mode of the API key that authenticated the current request. This lets a
// single tenant hold both a live and a test key and have Platform API calls
// route to the correct environment without any handler-level branching.
type ModeAwareClient struct {
	live NombaClient
	test NombaClient
	mode func(ctx context.Context) string
}

// NewModeAwareClient builds a client that delegates to live or test based on
// modeFromContext(ctx) — expected to return "test" or "live".
func NewModeAwareClient(live, test NombaClient, modeFromContext func(ctx context.Context) string) *ModeAwareClient {
	return &ModeAwareClient{live: live, test: test, mode: modeFromContext}
}

func (c *ModeAwareClient) pick(ctx context.Context) NombaClient {
	if c.mode(ctx) == "test" {
		return c.test
	}
	return c.live
}

func (c *ModeAwareClient) InitiateCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResponse, error) {
	return c.pick(ctx).InitiateCheckout(ctx, req)
}

func (c *ModeAwareClient) ChargeToken(ctx context.Context, req ChargeTokenRequest) (*ChargeResponse, error) {
	return c.pick(ctx).ChargeToken(ctx, req)
}

func (c *ModeAwareClient) VerifyPayment(ctx context.Context, reference string) (*VerifyResponse, error) {
	return c.pick(ctx).VerifyPayment(ctx, reference)
}

func (c *ModeAwareClient) RefundPayment(ctx context.Context, req RefundRequest) (*RefundResponse, error) {
	return c.pick(ctx).RefundPayment(ctx, req)
}

func (c *ModeAwareClient) ListTransactions(ctx context.Context, req ListTransactionsRequest) (*TransactionList, error) {
	return c.pick(ctx).ListTransactions(ctx, req)
}

func (c *ModeAwareClient) FetchSubAccountTransactions(ctx context.Context, from, to time.Time, limit int, cursor string) (*TransactionList, error) {
	return c.pick(ctx).FetchSubAccountTransactions(ctx, from, to, limit, cursor)
}

func (c *ModeAwareClient) DebitWallet(ctx context.Context, accountID string, amount int64, currency, reference, narration string) (*ChargeResponse, error) {
	return c.pick(ctx).DebitWallet(ctx, accountID, amount, currency, reference, narration)
}

func (c *ModeAwareClient) GetWalletBalance(ctx context.Context, accountID string) (int64, error) {
	return c.pick(ctx).GetWalletBalance(ctx, accountID)
}

func (c *ModeAwareClient) TransferToBank(ctx context.Context, req TransferRequest) (*TransferResponse, error) {
	return c.pick(ctx).TransferToBank(ctx, req)
}

func (c *ModeAwareClient) ListBanks(ctx context.Context) ([]Bank, error) {
	return c.pick(ctx).ListBanks(ctx)
}

func (c *ModeAwareClient) ResolveBankAccount(ctx context.Context, accountNumber, bankCode string) (string, error) {
	return c.pick(ctx).ResolveBankAccount(ctx, accountNumber, bankCode)
}
