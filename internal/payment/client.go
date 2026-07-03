package payment

import (
	"context"
	"time"
)

type CheckoutRequest struct {
	CustomerEmail string
	CustomerName  string
	CustomerID    string
	Amount        int64
	Currency      string
	Reference     string
	CallbackURL   string
	Metadata      map[string]string
}

type CheckoutResponse struct {
	CheckoutURL string
	Reference   string
}

type ChargeTokenRequest struct {
	CustomerID     string
	TokenisedCard  string
	Amount         int64
	Currency       string
	IdempotencyKey string
	Reference      string
}

type ChargeResponse struct {
	Success        bool
	Reference      string
	FailureCode    string
	FailureMessage string
}

type RefundRequest struct {
	Reference string
	Amount    int64
	Reason    string
}

type RefundResponse struct {
	Success   bool
	Reference string
}

type VerifyResponse struct {
	Success   bool
	Reference string
	Amount    int64
	Status    string
}

type ListTransactionsRequest struct {
	From   string
	To     string
	Limit  int
	Cursor string
}

type Transaction struct {
	Reference string
	Amount    int64
	Status    string
	CreatedAt string
}

type TransactionList struct {
	Transactions []Transaction
	NextCursor   string
	HasMore      bool
}

// NombaClient is the interface all business logic depends on.
// The mock and real HTTP implementations both satisfy this interface.
type NombaClient interface {
	InitiateCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResponse, error)
	ChargeToken(ctx context.Context, req ChargeTokenRequest) (*ChargeResponse, error)
	VerifyPayment(ctx context.Context, reference string) (*VerifyResponse, error)
	RefundPayment(ctx context.Context, req RefundRequest) (*RefundResponse, error)
	ListTransactions(ctx context.Context, req ListTransactionsRequest) (*TransactionList, error)
	FetchSubAccountTransactions(ctx context.Context, from, to time.Time, limit int, cursor string) (*TransactionList, error)
}

// MandateCharger is implemented by clients that can debit a direct-debit mandate.
// The recovery ladder type-asserts against this to escalate from card to mandate.
type MandateCharger interface {
	DebitMandate(ctx context.Context, req DebitMandateRequest) (*ChargeResponse, error)
}
