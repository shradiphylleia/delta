package graphgen

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"delta/backend/internal/planner"
)

type TextClient interface {
	Generate(ctx context.Context, prompt string) (string, error)
}

type Generator struct {
	client TextClient
}

type Request struct {
	Text string `json:"text"`
}

func New(client TextClient) Generator {
	return Generator{client: client}
}

func (g Generator) Generate(ctx context.Context, text string) (planner.PlanRequest, error) {
	if strings.TrimSpace(text) == "" {
		return planner.PlanRequest{}, errors.New("text is required")
	}
	raw, err := g.client.Generate(ctx, prompt(text))
	if err != nil {
		return planner.PlanRequest{}, err
	}
	graph, err := decodeGraph(raw)
	if err != nil {
		return planner.PlanRequest{}, err
	}

	if errs := planner.Validate(graph); len(errs) > 0 {
		return planner.PlanRequest{}, errors.New(strings.Join(errs, "; "))
	}

	return graph, nil
}

// prompting the model to get the json similar to what it already does. 
// input will be taken and then converted to structured json

func prompt(text string) string {
	return `Convert this architecture description into Delta graph JSON.
Return only valid JSON. Do not include markdown.

Rules:
- output must have root, nodes and edges
- every node needs name, health, criticality and cachePolicy
- use health "UP" unless the text says degraded or down
- use criticality "REQUIRED" for root and core dependencies
- use criticality "OPTIONAL" for recommendations, reviews and nice-to-have features
- use cachePolicy "NONE", "FRESH" or "STALE"
- use "STALE" for recommendations and reviews when unsure
- use "FRESH" for inventory when unsure

Description:
` + text
}

func decodeGraph(raw string) (planner.PlanRequest, error) {
	jsonText, err := extractJSON(raw)
	if err != nil {
		return planner.PlanRequest{}, err
	}
	var graph planner.PlanRequest
	if err := json.Unmarshal([]byte(jsonText), &graph); err != nil {
		return planner.PlanRequest{}, err
	}
	return graph, nil
}

func extractJSON(raw string) (string, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start == -1 || end == -1 || end <= start {
		return "", errors.New("model response did not contain json")
	}

	return raw[start : end+1], nil
}
