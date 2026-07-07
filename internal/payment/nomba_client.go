package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	nombaProductionBase = "https://api.nomba.com/v1"
	nombaSandboxBase    = "https://sandbox.nomba.com/v1"
)

type NombaHTTPClient struct {
	clientID     string
	clientSecret string
	accountID    string
	subAccountID string
	httpClient   *http.Client
	baseURL      string
	isSandbox    bool

	mu          sync.Mutex
	accessToken string
	tokenExpiry time.Time
}

func NewNombaHTTPClient(clientID, clientSecret, accountID, subAccountID string) *NombaHTTPClient {
	sandbox := os.Getenv("NOMBA_ENV") == "sandbox"
	baseURL := nombaProductionBase
	if sandbox {
		baseURL = nombaSandboxBase
	}
	log.Info().Str("base_url", baseURL).Bool("sandbox", sandbox).Msg("nomba: client initialised")
	return &NombaHTTPClient{
		clientID:     clientID,
		clientSecret: clientSecret,
		accountID:    accountID,
		subAccountID: subAccountID,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		baseURL:      baseURL,
		isSandbox:    sandbox,
	}
}

// NewNombaHTTPClientForSandbox builds a client that always targets Nomba's
// sandbox, regardless of NOMBA_ENV. Used for test-mode API key traffic.
func NewNombaHTTPClientForSandbox(clientID, clientSecret, accountID, subAccountID string) *NombaHTTPClient {
	c := NewNombaHTTPClient(clientID, clientSecret, accountID, subAccountID)
	c.baseURL = nombaSandboxBase
	c.isSandbox = true
	return c
}

// maskEmail masks an email for safe logging. amaka@startup.ng → am***@startup.ng
func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local := parts[0]
	if len(local) <= 2 {
		return "**@" + parts[1]
	}
	return local[:2] + strings.Repeat("*", len(local)-2) + "@" + parts[1]
}

func (c *NombaHTTPClient) getToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.accessToken != "" && time.Now().Before(c.tokenExpiry.Add(-5*time.Minute)) {
		return c.accessToken, nil
	}

	body, _ := json.Marshal(map[string]string{
		"grant_type":    "client_credentials",
		"client_id":     c.clientID,
		"client_secret": c.clientSecret,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/auth/token/issue", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("nomba auth build: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accountId", c.accountID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("nomba auth call: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			AccessToken string `json:"access_token"`
			ExpiresAt   string `json:"expiresAt"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("nomba auth decode: %w", err)
	}
	if result.Code != "00" {
		return "", fmt.Errorf("nomba auth failed: %s", result.Description)
	}

	expiry, err := time.Parse(time.RFC3339, result.Data.ExpiresAt)
	if err != nil {
		expiry = time.Now().Add(25 * time.Minute)
	}
	c.accessToken = result.Data.AccessToken
	c.tokenExpiry = expiry
	return c.accessToken, nil
}

func (c *NombaHTTPClient) do(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	token, err := c.getToken(ctx)
	if err != nil {
		return nil, err
	}

	var br *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		br = bytes.NewReader(b)
	} else {
		br = bytes.NewReader(nil)
	}

	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, br)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("accountId", c.accountID)

	log.Debug().Str("method", method).Str("url", url).Msg("nomba: outbound request")
	return c.httpClient.Do(req)
}

// InitiateCheckout creates a Nomba hosted checkout order with tokenizeCard=true.
// The returned CheckoutURL is where you redirect the customer.
// After payment, Nomba sends a payment_success webhook containing the tokenKey.
func (c *NombaHTTPClient) InitiateCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResponse, error) {
	amount := fmt.Sprintf("%.2f", float64(req.Amount)/100)
	payload := map[string]interface{}{
		"order": map[string]interface{}{
			"amount":         amount,
			"currency":       req.Currency,
			"orderReference": req.Reference,
			"callbackUrl":    req.CallbackURL,
			"customerEmail":  req.CustomerEmail,
			"customerId":     req.CustomerID,
			"accountId":      c.subAccountID,
			"orderMetaData":  req.Metadata,
		},
		"tokenizeCard": true,
	}

	log.Info().
		Str("reference", req.Reference).
		Str("customer_email", maskEmail(req.CustomerEmail)).
		Int64("amount_kobo", req.Amount).
		Msg("nomba: initiating checkout")

	resp, err := c.do(ctx, http.MethodPost, "/checkout/order", payload)
	if err != nil {
		return nil, fmt.Errorf("nomba checkout: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			CheckoutLink   string `json:"checkoutLink"`
			OrderReference string `json:"orderReference"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba checkout decode: %w", err)
	}
	if result.Code != "00" {
		return nil, fmt.Errorf("nomba checkout failed [%s]: %s", result.Code, result.Description)
	}

	log.Info().
		Str("reference", result.Data.OrderReference).
		Str("checkout_url", result.Data.CheckoutLink).
		Msg("nomba: checkout created")

	return &CheckoutResponse{
		CheckoutURL: result.Data.CheckoutLink,
		Reference:   result.Data.OrderReference,
	}, nil
}

// ChargeToken charges a previously tokenised card for recurring billing.
// Called by the billing worker on every renewal cycle and by the dunning engine on retries.
func (c *NombaHTTPClient) ChargeToken(ctx context.Context, req ChargeTokenRequest) (*ChargeResponse, error) {
	amount := fmt.Sprintf("%.2f", float64(req.Amount)/100)
	payload := map[string]interface{}{
		"order": map[string]interface{}{
			"orderReference": req.Reference,
			"customerId":     req.CustomerID,
			"amount":         amount,
			"currency":       req.Currency,
			"accountId":      c.subAccountID,
		},
		"tokenKey": req.TokenisedCard,
	}

	log.Info().
		Str("reference", req.Reference).
		Str("customer_id", req.CustomerID).
		Int64("amount_kobo", req.Amount).
		Str("idempotency_key", req.IdempotencyKey).
		Msg("nomba: charging tokenised card")

	resp, err := c.do(ctx, http.MethodPost, "/checkout/tokenized-card-payment", payload)
	if err != nil {
		return nil, fmt.Errorf("nomba charge token: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			Status  bool   `json:"status"`
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba charge decode: %w", err)
	}

	if result.Code != "00" || !result.Data.Status {
		log.Warn().
			Str("reference", req.Reference).
			Str("code", result.Code).
			Str("message", result.Description).
			Msg("nomba: charge failed")
		return &ChargeResponse{
			Success:        false,
			Reference:      req.Reference,
			FailureCode:    MapNombaFailureCode(result.Code),
			FailureMessage: result.Description,
		}, nil
	}

	log.Info().
		Str("reference", req.Reference).
		Msg("nomba: charge succeeded")

	return &ChargeResponse{
		Success:   true,
		Reference: req.Reference,
	}, nil
}

// VerifyPayment verifies a checkout transaction by order reference.
func (c *NombaHTTPClient) VerifyPayment(ctx context.Context, reference string) (*VerifyResponse, error) {
	resp, err := c.do(ctx, http.MethodGet, "/checkout/order/"+reference, nil)
	if err != nil {
		return nil, fmt.Errorf("nomba verify: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			Status         string  `json:"status"`
			Amount         float64 `json:"amount"`
			OrderReference string  `json:"orderReference"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba verify decode: %w", err)
	}
	if result.Code != "00" {
		return nil, fmt.Errorf("nomba verify failed: %s", result.Description)
	}
	return &VerifyResponse{
		Success:   result.Data.Status == "SUCCESS" || result.Data.Status == "successful",
		Reference: result.Data.OrderReference,
		Amount:    int64(math.Round(result.Data.Amount * 100)),
		Status:    result.Data.Status,
	}, nil
}

// RefundPayment refunds a completed checkout transaction.
func (c *NombaHTTPClient) RefundPayment(ctx context.Context, req RefundRequest) (*RefundResponse, error) {
	payload := map[string]interface{}{
		"transactionId": req.Reference, // WEB-ONLINE_C-... Nomba transaction ID
	}
	// If amount > 0 it's a partial refund, otherwise full refund
	if req.Amount > 0 {
		// Formatted as a string, matching every other Nomba amount field
		// (InitiateCheckout, ChargeToken, mandate charges) — a raw float here
		// risks binary floating-point artifacts leaking into the JSON payload.
		payload["amount"] = fmt.Sprintf("%.2f", float64(req.Amount)/100)
	}

	log.Info().
		Str("transaction_id", req.Reference).
		Int64("amount_kobo", req.Amount).
		Str("reason", req.Reason).
		Msg("nomba: initiating refund")

	resp, err := c.do(ctx, http.MethodPost, "/checkout/refund", payload)
	if err != nil {
		return nil, fmt.Errorf("nomba refund: %w", err)
	}
	defer resp.Body.Close()

var result struct {
    Code        string `json:"code"`
    Description string `json:"description"`
    Data        struct {
        Success interface{} `json:"success"` // Nomba returns "true" string or bool
        Message string      `json:"message"`
    } `json:"data"`
}
if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
    return nil, fmt.Errorf("nomba refund decode: %w", err)
}

// Handle both string "true" and bool true
success := result.Code == "00"
switch v := result.Data.Success.(type) {
case bool:
    success = success && v
case string:
    success = success && (v == "true")
}

log.Info().
    Str("transaction_id", req.Reference).
    Str("code", result.Code).
    Str("message", result.Description).
    Bool("success", success).
    Msg("nomba: refund response")

return &RefundResponse{
    Success:   success,
    Reference: req.Reference,
}, nil
}

// ListTransactions fetches transactions on the sub-account.
func (c *NombaHTTPClient) ListTransactions(ctx context.Context, req ListTransactionsRequest) (*TransactionList, error) {
	path := fmt.Sprintf("/accounts/%s/transactions?limit=%d", c.subAccountID, req.Limit)
	if req.Cursor != "" {
		path += "&cursor=" + req.Cursor
	}
	if req.From != "" {
		path += "&from=" + req.From
	}
	if req.To != "" {
		path += "&to=" + req.To
	}

	resp, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("nomba list tx: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code string `json:"code"`
		Data struct {
			Results []struct {
				TransactionID string  `json:"transactionId"`
				Amount        float64 `json:"amount"`
				Status        string  `json:"status"`
				Time          string  `json:"time"`
			} `json:"results"`
			Cursor string `json:"cursor"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba list tx decode: %w", err)
	}

	txs := make([]Transaction, 0, len(result.Data.Results))
	for _, t := range result.Data.Results {
		txs = append(txs, Transaction{
			Reference: t.TransactionID,
			Amount:    int64(t.Amount * 100),
			Status:    t.Status,
			CreatedAt: t.Time,
		})
	}
	return &TransactionList{
		Transactions: txs,
		NextCursor:   result.Data.Cursor,
		HasMore:      result.Data.Cursor != "",
	}, nil
}

// FetchSubAccountTransactions fetches transactions from Nomba for the sub-account
// within a time window. Used by the reconciliation job.
// Nomba returns amount as either a string or float64 depending on the endpoint version,
// so we use interface{} and convert safely.
func (c *NombaHTTPClient) FetchSubAccountTransactions(ctx context.Context, from, to time.Time, limit int, cursor string) (*TransactionList, error) {
	path := fmt.Sprintf("/transactions/accounts/%s?limit=%d&dateFrom=%s&dateTo=%s",
		c.subAccountID,
		limit,
		from.UTC().Format("2006-01-02T15:04:05.000Z"),
		to.UTC().Format("2006-01-02T15:04:05.000Z"),
	)
	if cursor != "" {
		path += "&cursor=" + cursor
	}

	resp, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("nomba fetch sub-account transactions: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code string `json:"code"`
		Data struct {
			Results []struct {
				ID            string      `json:"id"`
				Status        string      `json:"status"`
				Amount        interface{} `json:"amount"` // Nomba returns string or float64
				Type          string      `json:"type"`
				TimeCreated   string      `json:"timeCreated"`
				MerchantTxRef string      `json:"merchantTxRef"`
			} `json:"results"`
			Cursor string `json:"cursor"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba fetch transactions decode: %w", err)
	}

	txs := make([]Transaction, 0, len(result.Data.Results))
	for _, t := range result.Data.Results {
		if t.Status != "SUCCESS" {
			continue
		}

		// Safely convert amount regardless of whether Nomba sends string or float64
		var amountKobo int64
		switch v := t.Amount.(type) {
		case float64:
			amountKobo = int64(v * 100)
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				amountKobo = int64(f * 100)
			}
		}

		txs = append(txs, Transaction{
			Reference: t.MerchantTxRef,
			Amount:    amountKobo,
			Status:    t.Status,
			CreatedAt: t.TimeCreated,
		})
	}
	return &TransactionList{
		Transactions: txs,
		NextCursor:   result.Data.Cursor,
		HasMore:      result.Data.Cursor != "",
	}, nil
}

// DebitWallet debits a customer's Nomba wallet — the first rail the
// recovery waterfall tries before falling back to card/mandate.
func (c *NombaHTTPClient) DebitWallet(ctx context.Context, accountID string, amount int64, currency, reference, narration string) (*ChargeResponse, error) {
	payload := map[string]interface{}{
		"amount":    fmt.Sprintf("%.2f", float64(amount)/100),
		"currency":  currency,
		"reference": reference,
		"narration": narration,
	}

	log.Info().
		Str("account_id", accountID).
		Str("reference", reference).
		Int64("amount_kobo", amount).
		Msg("nomba: debiting customer wallet")

	resp, err := c.do(ctx, http.MethodPost, fmt.Sprintf("/accounts/%s/debit", accountID), payload)
	if err != nil {
		return nil, fmt.Errorf("nomba debit wallet: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			Status  bool   `json:"status"`
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba debit wallet decode: %w", err)
	}

	if result.Code != "00" || !result.Data.Status {
		log.Warn().
			Str("account_id", accountID).
			Str("reference", reference).
			Str("code", result.Code).
			Str("message", result.Description).
			Msg("nomba: wallet debit failed")
		return &ChargeResponse{
			Success:        false,
			Reference:      reference,
			FailureCode:    MapNombaFailureCode(result.Code),
			FailureMessage: result.Description,
		}, nil
	}

	log.Info().Str("account_id", accountID).Str("reference", reference).Msg("nomba: wallet debit succeeded")
	return &ChargeResponse{Success: true, Reference: reference}, nil
}

// GetWalletBalance returns a customer's current Nomba wallet balance in kobo.
func (c *NombaHTTPClient) GetWalletBalance(ctx context.Context, accountID string) (int64, error) {
	resp, err := c.do(ctx, http.MethodGet, fmt.Sprintf("/accounts/%s", accountID), nil)
	if err != nil {
		return 0, fmt.Errorf("nomba get wallet balance: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			WalletBalance float64 `json:"walletBalance"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("nomba get wallet balance decode: %w", err)
	}
	if result.Code != "00" {
		return 0, fmt.Errorf("nomba get wallet balance failed: %s", result.Description)
	}

	return int64(math.Round(result.Data.WalletBalance * 100)), nil
}

// TransferToBank sends a single payout to a Nigerian bank account.
func (c *NombaHTTPClient) TransferToBank(ctx context.Context, req TransferRequest) (*TransferResponse, error) {
	payload := map[string]interface{}{
		"amount":        fmt.Sprintf("%.2f", float64(req.Amount)/100),
		"currency":      req.Currency,
		"accountNumber": req.AccountNumber,
		"bankCode":      req.BankCode,
		"narration":     req.Narration,
		"reference":     req.Reference,
		"accountId":     c.subAccountID,
	}

	log.Info().
		Str("reference", req.Reference).
		Str("bank_code", req.BankCode).
		Int64("amount_kobo", req.Amount).
		Msg("nomba: initiating bank transfer")

	resp, err := c.do(ctx, http.MethodPost, "/transfers/single", payload)
	if err != nil {
		return nil, fmt.Errorf("nomba transfer: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			Status    string `json:"status"`
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba transfer decode: %w", err)
	}

	if result.Code != "00" {
		log.Warn().
			Str("reference", req.Reference).
			Str("code", result.Code).
			Str("message", result.Description).
			Msg("nomba: transfer failed")
		return &TransferResponse{
			Success:        false,
			Reference:      req.Reference,
			FailureMessage: result.Description,
		}, nil
	}

	log.Info().Str("reference", req.Reference).Str("status", result.Data.Status).Msg("nomba: transfer accepted")
	return &TransferResponse{
		Success:   true,
		Reference: req.Reference,
		Status:    result.Data.Status,
	}, nil
}

// ListBanks returns Nomba's supported bank list for the payout bank selector.
func (c *NombaHTTPClient) ListBanks(ctx context.Context) ([]Bank, error) {
	resp, err := c.do(ctx, http.MethodGet, "/transfers/banks", nil)
	if err != nil {
		return nil, fmt.Errorf("nomba list banks: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code string `json:"code"`
		Data []struct {
			Code string `json:"code"`
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba list banks decode: %w", err)
	}

	banks := make([]Bank, 0, len(result.Data))
	for _, b := range result.Data {
		banks = append(banks, Bank{Code: b.Code, Name: b.Name})
	}
	return banks, nil
}

// ResolveBankAccount looks up the account holder's name for a bank account,
// so operators can confirm a payout destination before submitting it.
func (c *NombaHTTPClient) ResolveBankAccount(ctx context.Context, accountNumber, bankCode string) (string, error) {
	payload := map[string]interface{}{
		"accountNumber": accountNumber,
		"bankCode":      bankCode,
		"accountId":     c.subAccountID,
	}
	resp, err := c.do(ctx, http.MethodPost, "/accounts/resolve", payload)
	if err != nil {
		return "", fmt.Errorf("nomba resolve account: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			AccountName string `json:"accountName"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("nomba resolve account decode: %w", err)
	}
	if result.Code != "00" {
		return "", fmt.Errorf("nomba resolve account failed [%s]: %s", result.Code, result.Description)
	}
	return result.Data.AccountName, nil
}

// MapNombaFailureCode maps Nomba response codes to our internal dunning classifier codes.
func MapNombaFailureCode(nombaCode string) string {
	switch nombaCode {
	case "51":
		return "insufficient_funds"
	case "41", "43":
		return "stolen_card"
	case "54":
		return "card_expired"
	case "62", "57", "36":
		return "card_blocked"
	case "91", "96":
		return "issuer_unavailable"
	case "06", "12", "34":
		return "processing_error"
	case "68":
		return "timeout"
	default:
		return fmt.Sprintf("nomba_%s", nombaCode)
	}
}
