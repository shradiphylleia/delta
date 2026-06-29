package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"delta/backend/internal/graphgen"
	"delta/backend/internal/hf"
	"delta/backend/internal/planner"
)

func main() {
	server := newServer()

	log.Println("delta api listening on :8080")
	if err := http.ListenAndServe(":8080", server); err != nil {
		log.Fatal(err)
	}
}

func newServer() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /plan", handlePlan)
	mux.HandleFunc("POST /graphs/from-text", handleGraphFromText)

	return mux
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handlePlan(w http.ResponseWriter, r *http.Request) {
	var req planner.PlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	if errors := planner.Validate(req); len(errors) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string][]string{"errors": errors})
		return
	}

	res := planner.Plan(req)
	writeJSON(w, http.StatusOK, res)
}

func handleGraphFromText(w http.ResponseWriter, r *http.Request) {
	var req graphgen.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	if req.Text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "text is required"})
		return
	}

	model := os.Getenv("HF_MODEL")
	if model == "" {
		model = "google/gemma-3-4b-it"
	}

	gen := graphgen.New(hf.NewClient(os.Getenv("HF_API_TOKEN"), model))
	graph, err := gen.Generate(r.Context(), req.Text)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, graph)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write json response: %v", err)
	}
}
