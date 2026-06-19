package webhook_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/google/uuid"
)

func TestSign_HMACVerification(t *testing.T) {
	secret := "test-secret-key"
	payload := []byte(`{"event_type":"payment.failed"}`)

	sig := webhook.SignPayload(secret, payload)
	if !webhook.Verify(secret, "sha256="+sig, payload) {
		t.Error("valid signature should verify")
	}
}

func TestVerify_WrongSecret(t *testing.T) {
	payload := []byte(`{"event_type":"payment.failed"}`)
	sig := "sha256=" + webhook.SignPayload("correct-secret", payload)

	if webhook.Verify("wrong-secret", sig, payload) {
		t.Error("wrong secret should not verify")
	}
}

func TestVerify_TamperedPayload(t *testing.T) {
	secret := "test-secret"
	original := []byte(`{"event_type":"payment.failed"}`)
	sig := "sha256=" + webhook.SignPayload(secret, original)

	tampered := []byte(`{"event_type":"payment.succeeded"}`)
	if webhook.Verify(secret, sig, tampered) {
		t.Error("tampered payload should not verify")
	}
}

func TestDispatcher_DeliversToSubscribedEndpoint(t *testing.T) {
	received := make(chan []byte, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, 4096)
		n, _ := r.Body.Read(buf)
		received <- buf[:n]
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	repo := &mockWebhookRepo{endpointURL: server.URL}
	d := webhook.NewDispatcher(repo)

	err := d.Dispatch(t.Context(), testTenantID, domain.EventPaymentFailed, map[string]string{"test": "data"})
	if err != nil {
		t.Fatalf("dispatch error: %v", err)
	}

	select {
	case body := <-received:
		var event map[string]interface{}
		if err := json.Unmarshal(body, &event); err != nil {
			t.Fatalf("received invalid JSON: %v", err)
		}
		if event["event_type"] != string(domain.EventPaymentFailed) {
			t.Errorf("unexpected event_type: %v", event["event_type"])
		}
	default:
		t.Error("endpoint did not receive delivery")
	}
}

var testTenantID = uuid.New()
