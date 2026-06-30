package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type MandateRequest struct {
	CustomerName    string
	CustomerEmail   string
	CustomerPhone   string
	AccountNumber   string
	BankCode        string
	Amount          int64
	Currency        string
	Reference       string
	StartDate       time.Time
	EndDate         time.Time
	Frequency       string // DAILY, WEEKLY, MONTHLY
	MaxDebitAmount  int64
}

type MandateResponse struct {
	MandateID   string
	Status      string
	Reference   string
	AuthURL     string
}

type DebitMandateRequest struct {
	MandateID  string
	Amount     int64
	Currency   string
	Reference  string
	Narration  string
}

type MandateStatus struct {
	MandateID string
	Status    string
	Amount    int64
}

// NombaMandateClient extends NombaHTTPClient with mandate (direct debit) support.
type NombaMandateClient struct {
	*NombaHTTPClient
}

func NewNombaMandateClient(clientID, clientSecret, accountID, subAccountID string) *NombaMandateClient {
	return &NombaMandateClient{
		NombaHTTPClient: NewNombaHTTPClient(clientID, clientSecret, accountID, subAccountID),
	}
}

// CreateMandate creates a direct debit mandate for a customer.
// The customer must authorise the mandate via the returned AuthURL.
func (c *NombaMandateClient) CreateMandate(ctx context.Context, req MandateRequest) (*MandateResponse, error) {
	amount := fmt.Sprintf("%.2f", float64(req.Amount)/100)
	maxDebit := fmt.Sprintf("%.2f", float64(req.MaxDebitAmount)/100)

	payload := map[string]interface{}{
		"customerName":   req.CustomerName,
		"customerEmail":  req.CustomerEmail,
		"phoneNumber":    req.CustomerPhone,
		"accountNumber":  req.AccountNumber,
		"bankCode":       req.BankCode,
		"amount":         amount,
		"currency":       req.Currency,
		"reference":      req.Reference,
		"startDate":      req.StartDate.Format("2006-01-02"),
		"endDate":        req.EndDate.Format("2006-01-02"),
		"frequency":      req.Frequency,
		"maxDebitAmount": maxDebit,
		"accountId":      c.subAccountID,
	}

	resp, err := c.do(ctx, http.MethodPost, "/direct-debits", payload)
	if err != nil {
		return nil, fmt.Errorf("nomba create mandate: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			MandateID string `json:"mandateId"`
			Status    string `json:"status"`
			Reference string `json:"reference"`
			AuthURL   string `json:"authUrl"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba create mandate decode: %w", err)
	}
	if result.Code != "00" {
		return nil, fmt.Errorf("nomba create mandate failed [%s]: %s", result.Code, result.Description)
	}
	return &MandateResponse{
		MandateID: result.Data.MandateID,
		Status:    result.Data.Status,
		Reference: result.Data.Reference,
		AuthURL:   result.Data.AuthURL,
	}, nil
}

// DebitMandate charges an active mandate.
// Used instead of ChargeToken for customers who authorised via direct debit.
func (c *NombaMandateClient) DebitMandate(ctx context.Context, req DebitMandateRequest) (*ChargeResponse, error) {
	amount := fmt.Sprintf("%.2f", float64(req.Amount)/100)
	payload := map[string]interface{}{
		"amount":    amount,
		"currency":  req.Currency,
		"reference": req.Reference,
		"narration": req.Narration,
		"accountId": c.subAccountID,
	}

	resp, err := c.do(ctx, http.MethodPost,
		fmt.Sprintf("/direct-debits/%s/debit", req.MandateID), payload)
	if err != nil {
		return nil, fmt.Errorf("nomba debit mandate: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			Status  string `json:"status"`
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba debit mandate decode: %w", err)
	}

	if result.Code != "00" {
		return &ChargeResponse{
			Success:        false,
			Reference:      req.Reference,
			FailureCode:    MapNombaFailureCode(result.Code),
			FailureMessage: result.Description,
		}, nil
	}
	return &ChargeResponse{
		Success:   true,
		Reference: req.Reference,
	}, nil
}

// GetMandateStatus fetches the current status of a mandate.
func (c *NombaMandateClient) GetMandateStatus(ctx context.Context, mandateID string) (*MandateStatus, error) {
	resp, err := c.do(ctx, http.MethodGet,
		fmt.Sprintf("/direct-debits/%s", mandateID), nil)
	if err != nil {
		return nil, fmt.Errorf("nomba get mandate: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code        string `json:"code"`
		Description string `json:"description"`
		Data        struct {
			MandateID string  `json:"mandateId"`
			Status    string  `json:"status"`
			Amount    float64 `json:"amount"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("nomba get mandate decode: %w", err)
	}
	if result.Code != "00" {
		return nil, fmt.Errorf("nomba get mandate failed: %s", result.Description)
	}
	return &MandateStatus{
		MandateID: result.Data.MandateID,
		Status:    result.Data.Status,
		Amount:    int64(result.Data.Amount * 100),
	}, nil
}
