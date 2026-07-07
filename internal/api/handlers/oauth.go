package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/events"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// oauthTokenTTL is how long a client_credentials access token stays valid.
const oauthTokenTTL = 30 * time.Minute

type OAuthHandler struct {
	oauth     domain.OAuthRepository
	eventsRec *events.Recorder
}

func NewOAuthHandler(oauth domain.OAuthRepository, eventsRecorder *events.Recorder) *OAuthHandler {
	return &OAuthHandler{oauth: oauth, eventsRec: eventsRecorder}
}

func randomHexToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

type createOAuthClientRequest struct {
	Name string `json:"name"`
	Mode string `json:"mode"`
}

type oauthClientRevealResponse struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	Name         string `json:"name"`
	Mode         string `json:"mode"`
}

// CreateClient generates a new OAuth client and returns the client_id and
// client_secret in full — the only time the raw secret is ever shown.
func (h *OAuthHandler) CreateClient(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var req createOAuthClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.Name == "" {
		respond.BadRequest(w, r, "missing_field", "name is required")
		return
	}
	if req.Mode != "test" && req.Mode != "live" {
		req.Mode = "live"
	}

	clientIDSuffix, err := randomHexToken(12)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	clientID := "oauth_client_" + clientIDSuffix

	secretSuffix, err := randomHexToken(32)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	clientSecret := "oauth_secret_" + secretSuffix
	secretHash := middleware.HashAPIKey(clientSecret)
	secretHint := clientSecret[:14] + "..." + clientSecret[len(clientSecret)-4:]

	client, err := h.oauth.CreateClient(r.Context(), tenantID, clientID, secretHash, secretHint, req.Name, req.Mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	h.eventsRec.Record(r.Context(), tenantID, client.Mode, domain.EventOAuthClientCreated, "oauth_client", client.ID,
		"OAuth client \""+client.Name+"\" created")

	respond.JSON(w, r, http.StatusCreated, oauthClientRevealResponse{
		ClientID:     client.ClientID,
		ClientSecret: clientSecret,
		Name:         client.Name,
		Mode:         client.Mode,
	})
}

// ListClients returns every OAuth client for the tenant, showing only the
// secret hint — never the raw secret.
func (h *OAuthHandler) ListClients(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	clients, err := h.oauth.ListClients(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, clients)
}

// RevokeClient deactivates an OAuth client. Already-issued tokens remain
// valid until their natural (30 minute) expiry — client_credentials tokens
// are short-lived enough that this is an acceptable revocation window.
func (h *OAuthHandler) RevokeClient(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "client id is not a valid UUID")
		return
	}

	client, err := h.oauth.RevokeClient(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	h.eventsRec.Record(r.Context(), tenantID, client.Mode, domain.EventOAuthClientRevoked, "oauth_client", client.ID,
		"OAuth client \""+client.Name+"\" revoked")

	respond.JSON(w, r, http.StatusOK, client)
}

type issueTokenRequest struct {
	GrantType    string `json:"grant_type"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

type issueTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	Mode        string `json:"mode"`
}

// IssueToken implements the OAuth 2.0 client_credentials grant. It is a
// public endpoint — the client_id/client_secret pair is the credential.
func (h *OAuthHandler) IssueToken(w http.ResponseWriter, r *http.Request) {
	var req issueTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.GrantType != "client_credentials" {
		respond.BadRequest(w, r, "unsupported_grant_type", "grant_type must be client_credentials")
		return
	}
	if req.ClientID == "" || req.ClientSecret == "" {
		respond.BadRequest(w, r, "missing_field", "client_id and client_secret are required")
		return
	}

	client, err := h.oauth.GetClientByClientID(r.Context(), req.ClientID)
	if err != nil {
		respond.Unauthorised(w, r, "invalid client credentials")
		return
	}
	if !client.IsActive {
		respond.Unauthorised(w, r, "invalid client credentials")
		return
	}

	suppliedHash := middleware.HashAPIKey(req.ClientSecret)
	if subtle.ConstantTimeCompare([]byte(suppliedHash), []byte(client.ClientSecretHash)) != 1 {
		respond.Unauthorised(w, r, "invalid client credentials")
		return
	}

	tokenSuffix, err := randomHexToken(32)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	accessToken := "tori_oauth_" + tokenSuffix
	tokenHash := middleware.HashAPIKey(accessToken)
	expiresAt := time.Now().UTC().Add(oauthTokenTTL)

	if _, err := h.oauth.CreateToken(r.Context(), client.TenantID, client.ClientID, tokenHash, client.Mode, expiresAt); err != nil {
		respond.InternalError(w, r, err)
		return
	}
	_ = h.oauth.TouchClientLastUsed(r.Context(), client.ID)

	respond.JSON(w, r, http.StatusOK, issueTokenResponse{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   int(oauthTokenTTL.Seconds()),
		Mode:        client.Mode,
	})
}
