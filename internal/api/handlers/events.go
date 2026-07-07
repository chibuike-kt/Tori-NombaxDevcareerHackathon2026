package handlers

import (
	"net/http"
	"strconv"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type EventsHandler struct {
	repo domain.EventRepository
}

func NewEventsHandler(repo domain.EventRepository) *EventsHandler {
	return &EventsHandler{repo: repo}
}

// List handles GET /v1/events — the account activity feed, mode-filtered
// and paginated, newest first.
func (h *EventsHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 50
	}

	events, err := h.repo.List(r.Context(), tenantID, mode, limit, offset)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.List(w, r, http.StatusOK, events, &respond.Pagination{Total: int64(len(events))})
}
