package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog/log"
)

const resendAPIURL = "https://api.resend.com/emails"

type ResendClient struct {
	apiKey     string
	fromAddr   string
	httpClient *http.Client
}

type EmailPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

type ResendResponse struct {
	ID    string `json:"id"`
	Error string `json:"message,omitempty"`
}

func NewResendClient() *ResendClient {
	apiKey := os.Getenv("RESEND_API_KEY")
	from := os.Getenv("RESEND_FROM")
	if from == "" {
		from = "Tori <onboarding@resend.dev>"
	}
	if apiKey == "" {
		log.Warn().Msg("email: RESEND_API_KEY not set — emails will be logged only")
	}
	return &ResendClient{
		apiKey:     apiKey,
		fromAddr:   from,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *ResendClient) Send(ctx context.Context, to, subject, html string) error {
	// If no API key, log the email instead of sending
	if c.apiKey == "" {
		log.Info().
			Str("to", to).
			Str("subject", subject).
			Msg("email: [DEV MODE — not sent] " + html)
		return nil
	}

	payload := EmailPayload{
		From:    c.fromAddr,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("email: marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPIURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("email: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("email: send request: %w", err)
	}
	defer resp.Body.Close()

	var result ResendResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("email: decode response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("email: resend error [%d]: %s", resp.StatusCode, result.Error)
	}

	log.Info().
		Str("to", to).
		Str("message_id", result.ID).
		Msg("email: sent successfully")

	return nil
}
