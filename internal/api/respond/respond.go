package respond

import (
	"encoding/json"
	"net/http"

	apicontext "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/context"
	"github.com/rs/zerolog/log"
)

const apiVersion = "2026-06-01"

type Meta struct {
	RequestID  string `json:"request_id"`
	APIVersion string `json:"api_version"`
}

type envelope struct {
	Data       interface{} `json:"data,omitempty"`
	Error      *apiError   `json:"error,omitempty"`
	Pagination *Pagination `json:"pagination,omitempty"`
	Meta       Meta        `json:"meta"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Param   string `json:"param,omitempty"`
}

type Pagination struct {
	Cursor  string `json:"cursor,omitempty"`
	HasMore bool   `json:"has_more"`
	Total   int64  `json:"total"`
}

func JSON(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{
		Data: data,
		Meta: meta(r),
	})
}

func List(w http.ResponseWriter, r *http.Request, status int, data interface{}, pagination *Pagination) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{
		Data:       data,
		Pagination: pagination,
		Meta:       meta(r),
	})
}

func Error(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{
		Error: &apiError{Code: code, Message: message},
		Meta:  meta(r),
	})
}

func Unauthorised(w http.ResponseWriter, r *http.Request, message string) {
	Error(w, r, http.StatusUnauthorized, "unauthorised", message)
}

func NotFound(w http.ResponseWriter, r *http.Request) {
	Error(w, r, http.StatusNotFound, "not_found", "the requested resource does not exist")
}

func BadRequest(w http.ResponseWriter, r *http.Request, code, message string) {
	Error(w, r, http.StatusBadRequest, code, message)
}

func InternalError(w http.ResponseWriter, r *http.Request, err error) {
	log.Error().Err(err).Str("request_id", apicontext.GetRequestID(r.Context())).Msg("internal error")
	Error(w, r, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
}

func Conflict(w http.ResponseWriter, r *http.Request, code, message string) {
	Error(w, r, http.StatusConflict, code, message)
}

func UnprocessableEntity(w http.ResponseWriter, r *http.Request, code, message string) {
	Error(w, r, http.StatusUnprocessableEntity, code, message)
}

func meta(r *http.Request) Meta {
	return Meta{
		RequestID:  apicontext.GetRequestID(r.Context()),
		APIVersion: apiVersion,
	}
}
