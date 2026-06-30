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

	var draft struct {
		Root         json.RawMessage      `json:"root"`
		Nodes        []planner.Node       `json:"nodes"`
		Edges        []rawEdge            `json:"edges"`
		Dependencies []planner.Dependency `json:"dependencies,omitempty"`
	}
	if err := json.Unmarshal([]byte(jsonText), &draft); err != nil {
		return planner.PlanRequest{}, err
	}

	root, rootNode, err := decodeRoot(draft.Root)
	if err != nil {
		return planner.PlanRequest{}, err
	}

	nodes := draft.Nodes
	if rootNode.Name != "" && !hasNode(nodes, rootNode.Name) {
		nodes = append([]planner.Node{rootNode}, nodes...)
	}

	graph := planner.PlanRequest{
		Root:         root,
		Nodes:        nodes,
		Edges:        decodeEdges(draft.Edges),
		Dependencies: draft.Dependencies,
	}
	return graph, nil
}

type rawEdge struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Source string `json:"source"`
	Target string `json:"target"`
}

func decodeRoot(raw json.RawMessage) (string, planner.Node, error) {
	if len(raw) == 0 {
		return "", planner.Node{}, nil
	}

	var name string
	if err := json.Unmarshal(raw, &name); err == nil {
		return name, planner.Node{}, nil
	}

	var node planner.Node
	if err := json.Unmarshal(raw, &node); err == nil && node.Name != "" {
		return node.Name, node, nil
	}

	return "", planner.Node{}, errors.New("root must be a string or an object with name")
}

func decodeEdges(items []rawEdge) []planner.Edge {
	edges := make([]planner.Edge, 0, len(items))
	for _, item := range items {
		from := item.From
		if from == "" {
			from = item.Source
		}

		to := item.To
		if to == "" {
			to = item.Target
		}

		edges = append(edges, planner.Edge{From: from, To: to})
	}
	return edges
}

func hasNode(nodes []planner.Node, name string) bool {
	for _, node := range nodes {
		if node.Name == name {
			return true
		}
	}
	return false
}

func extractJSON(raw string) (string, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start == -1 || end == -1 || end <= start {
		return "", errors.New("model response did not contain json")
	}

	return raw[start : end+1], nil
}
