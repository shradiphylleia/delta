package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"delta/backend/internal/planner"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestPlanEndpointReturnsSummary(t *testing.T) {
	body := `{
		"root":"Product API",
		"nodes":[
			{
				"name":"Product API",
				"health":"UP",
				"criticality":"REQUIRED",
				"cachePolicy":"NONE"
			}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/plan", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}

	var res planner.PlanResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if res.Root != "Product API" {
		t.Fatalf("expected Product API, got %s", res.Root)
	}

	if res.Status != planner.DecisionLive {
		t.Fatalf("expected %s, got %s", planner.DecisionLive, res.Status)
	}

	if res.Outcome != planner.OutcomeComplete {
		t.Fatalf("expected %s, got %s", planner.OutcomeComplete, res.Outcome)
	}
}

func TestPlanEndpointRejectsInvalidJson(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/plan", bytes.NewBufferString("{"))
	rec := httptest.NewRecorder()

	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestPlanEndpointRejectsInvalidPlan(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/plan", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d, got %d", http.StatusBadRequest, rec.Code)
	}
}
