package graphgen

import (
	"context"
	"testing"
)

type fakeClient struct {
	text string
	err  error
}

func (f fakeClient) Generate(ctx context.Context, prompt string) (string, error) {
	return f.text, f.err
}

func TestGenerateReturnsGraph(t *testing.T) {
	gen := New(fakeClient{text: `{
		"root":"Dashboard API",
		"nodes":[
			{"name":"Dashboard API","health":"UP","criticality":"REQUIRED","cachePolicy":"NONE"},
			{"name":"User","health":"UP","criticality":"REQUIRED","cachePolicy":"NONE"}
		],
		"edges":[
			{"from":"Dashboard API","to":"User"}
		]
	}`})

	graph, err := gen.Generate(context.Background(), "Dashboard API depends on User.")
	if err != nil {
		t.Fatalf("generate graph: %v", err)
	}

	if graph.Root != "Dashboard API" {
		t.Fatalf("expected Dashboard API, got %s", graph.Root)
	}

	if len(graph.Nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(graph.Nodes))
	}
}

func TestGenerateExtractsJsonFromText(t *testing.T) {
	gen := New(fakeClient{text: `Here is the graph:
	{
		"root":"Dashboard API",
		"nodes":[
			{"name":"Dashboard API","health":"UP","criticality":"REQUIRED","cachePolicy":"NONE"}
		],
		"edges":[]
	}`})

	_, err := gen.Generate(context.Background(), "Dashboard API.")
	if err != nil {
		t.Fatalf("generate graph: %v", err)
	}
}

func TestGenerateRejectsInvalidGraph(t *testing.T) {
	gen := New(fakeClient{text: `{"root":"","nodes":[],"edges":[]}`})

	_, err := gen.Generate(context.Background(), "Dashboard API.")
	if err == nil {
		t.Fatal("expected error")
	}
}
