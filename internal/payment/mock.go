package payment

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MockNombaClient is used in all tests. No real network calls.
type MockNombaClient struct {
	mu sync.Mutex

	// ChargeResponses lets tests control what ChargeToken returns per call.
	// If empty, defaults to success.
	ChargeResponses []ChargeResponse

	// Recorded calls for assertion in tests.
	ChargeTokenCalls    []ChargeTokenRequest
	InitiateCheckoutCalls []CheckoutRequest
	VerifyPaymentCalls  []string

	chargeCallIndex int

	// WalletBalanceKobo is what GetWalletBalance returns for every account —
	// defaults to 0, so tests don't hit the wallet rail unless they opt in.
	WalletBalanceKobo int64
	DebitWalletCalls  []string // accountIDs debited
	TransferCalls     []TransferRequest
}

func NewMockNombaClient() *MockNombaClient {
	return &MockNombaClient{}
}

func (m *MockNombaClient) FetchSubAccountTransactions(_ context.Context, from, to time.Time, limit int, cursor string) (*TransactionList, error) {
	return &TransactionList{}, nil
}

// QueueChargeResponse adds a response to be returned on the next ChargeToken call.
func (m *MockNombaClient) QueueChargeResponse(r ChargeResponse) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ChargeResponses = append(m.ChargeResponses, r)
}

func (m *MockNombaClient) InitiateCheckout(_ context.Context, req CheckoutRequest) (*CheckoutResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.InitiateCheckoutCalls = append(m.InitiateCheckoutCalls, req)
	return &CheckoutResponse{
		CheckoutURL: "https://checkout.nomba.com/mock/" + req.Reference,
		Reference:   req.Reference,
	}, nil
}

func (m *MockNombaClient) ChargeToken(_ context.Context, req ChargeTokenRequest) (*ChargeResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ChargeTokenCalls = append(m.ChargeTokenCalls, req)

	if m.chargeCallIndex < len(m.ChargeResponses) {
		resp := m.ChargeResponses[m.chargeCallIndex]
		m.chargeCallIndex++
		return &resp, nil
	}

	// Default: success
	return &ChargeResponse{
		Success:   true,
		Reference: fmt.Sprintf("mock-ref-%s", req.IdempotencyKey),
	}, nil
}

func (m *MockNombaClient) VerifyPayment(_ context.Context, reference string) (*VerifyResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.VerifyPaymentCalls = append(m.VerifyPaymentCalls, reference)
	return &VerifyResponse{
		Success:   true,
		Reference: reference,
		Status:    "successful",
	}, nil
}

func (m *MockNombaClient) RefundPayment(_ context.Context, req RefundRequest) (*RefundResponse, error) {
	return &RefundResponse{Success: true, Reference: req.Reference}, nil
}

func (m *MockNombaClient) ListTransactions(_ context.Context, _ ListTransactionsRequest) (*TransactionList, error) {
	return &TransactionList{}, nil
}

// DebitWallet records the call and always succeeds — tests that need a
// failure should assert against DebitWalletCalls instead.
func (m *MockNombaClient) DebitWallet(_ context.Context, accountID string, _ int64, _, reference, _ string) (*ChargeResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.DebitWalletCalls = append(m.DebitWalletCalls, accountID)
	return &ChargeResponse{Success: true, Reference: reference}, nil
}

// GetWalletBalance returns the configured WalletBalanceKobo for every account.
func (m *MockNombaClient) GetWalletBalance(_ context.Context, _ string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.WalletBalanceKobo, nil
}

// TransferToBank records the call and always succeeds — tests that need a
// failure should assert against TransferCalls instead.
func (m *MockNombaClient) TransferToBank(_ context.Context, req TransferRequest) (*TransferResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.TransferCalls = append(m.TransferCalls, req)
	return &TransferResponse{Success: true, Reference: req.Reference, Status: "SUCCESS"}, nil
}

// ListBanks returns a small static list — enough for local dev and tests to
// populate a bank selector without a real Nomba credential.
func (m *MockNombaClient) ListBanks(_ context.Context) ([]Bank, error) {
	return []Bank{
		{Code: "058", Name: "Guaranty Trust Bank"},
		{Code: "057", Name: "Zenith Bank"},
		{Code: "044", Name: "Access Bank"},
		{Code: "011", Name: "First Bank of Nigeria"},
		{Code: "033", Name: "United Bank for Africa"},
	}, nil
}

// ResolveBankAccount returns a fixed mock account name.
func (m *MockNombaClient) ResolveBankAccount(_ context.Context, _, _ string) (string, error) {
	return "MOCK ACCOUNT HOLDER", nil
}

// ChargeCallCount returns how many times ChargeToken was called.
func (m *MockNombaClient) ChargeCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.ChargeTokenCalls)
}
