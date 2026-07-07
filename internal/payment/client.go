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
	// IsInfraError is true when the charge attempt failed because Tori
	// couldn't complete the call to Nomba (network/timeout/API error) — not
	// because the card was genuinely declined. Callers use this to retry the
	// job rather than spend a dunning/grace attempt on Tori's own hiccup.
	IsInfraError bool
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

type TransferRequest struct {
	Amount        int64
	Currency      string
	AccountNumber string
	BankCode      string
	Narration     string
	Reference     string
}

type TransferResponse struct {
	Success        bool
	Reference      string
	Status         string
	FailureMessage string
}

// Bank is a Nigerian bank as returned by Nomba's bank list.
type Bank struct {
	Code string `json:"code"`
	Name string `json:"name"`
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
	// DebitWallet debits a customer's Nomba wallet — the first rail the
	// recovery waterfall tries, before falling back to card/mandate.
	DebitWallet(ctx context.Context, accountID string, amount int64, currency, reference, narration string) (*ChargeResponse, error)
	// GetWalletBalance returns a customer's current Nomba wallet balance in kobo.
	GetWalletBalance(ctx context.Context, accountID string) (int64, error)
	// TransferToBank sends a payout to a Nigerian bank account.
	TransferToBank(ctx context.Context, req TransferRequest) (*TransferResponse, error)
	// ListBanks returns Nomba's supported bank list, used to populate the
	// payout bank selector.
	ListBanks(ctx context.Context) ([]Bank, error)
	// ResolveBankAccount looks up the account holder's name for a given
	// account number and bank code, so operators can confirm a payout
	// destination before submitting it.
	ResolveBankAccount(ctx context.Context, accountNumber, bankCode string) (string, error)
}

// MandateCharger is implemented by clients that can debit a direct-debit mandate.
// The recovery ladder type-asserts against this to escalate from card to mandate.
type MandateCharger interface {
	DebitMandate(ctx context.Context, req DebitMandateRequest) (*ChargeResponse, error)
}
