package planner

import "testing"

func TestHealthyDependencyGoesLive(t *testing.T) {
	res := Plan(PlanRequest{
		Dependencies: []Dependency{
			{
				Name:        "Pricing",
				Health:      HealthUp,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
		},
	})

	got := res.Decisions[0].Decision
	if got != DecisionLive {
		t.Fatalf("expected %s, got %s", DecisionLive, got)
	}
}

func TestDownDependencyCanUseFreshCache(t *testing.T) {
	res := Plan(PlanRequest{
		Dependencies: []Dependency{
			{
				Name:        "Inventory",
				Health:      HealthDown,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyFresh,
			},
		},
	})

	got := res.Decisions[0].Decision
	if got != DecisionCache {
		t.Fatalf("expected %s, got %s", DecisionCache, got)
	}
}

func TestOptionalDependencyCanBeOmitted(t *testing.T) {
	res := Plan(PlanRequest{
		Dependencies: []Dependency{
			{
				Name:        "Recommendations",
				Health:      HealthDown,
				Criticality: CriticalityOptional,
				CachePolicy: CachePolicyNone,
			},
		},
	})

	got := res.Decisions[0].Decision
	if got != DecisionOmit {
		t.Fatalf("expected %s, got %s", DecisionOmit, got)
	}
}

func TestRequiredDependencyWithoutFallbackFails(t *testing.T) {
	res := Plan(PlanRequest{
		Dependencies: []Dependency{
			{
				Name:        "Pricing",
				Health:      HealthDown,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
		},
	})

	got := res.Decisions[0].Decision
	if got != DecisionFail {
		t.Fatalf("expected %s, got %s", DecisionFail, got)
	}
}

func TestRequiredChildFailureFailsParent(t *testing.T) {
	res := Plan(PlanRequest{
		Root: "Product API",
		Nodes: []Node{
			{
				Name:        "Product API",
				Health:      HealthUp,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
			{
				Name:        "Pricing",
				Health:      HealthDown,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
		},
		Edges: []Edge{
			{From: "Product API", To: "Pricing"},
		},
	})

	got := findDecision(t, res, "Product API")
	if got.Decision != DecisionFail {
		t.Fatalf("expected %s, got %s", DecisionFail, got.Decision)
	}

	if res.Status != DecisionFail {
		t.Fatalf("expected response status %s, got %s", DecisionFail, res.Status)
	}
}

func TestOptionalChildDoesNotFailParent(t *testing.T) {
	res := Plan(PlanRequest{
		Root: "Product API",
		Nodes: []Node{
			{
				Name:        "Product API",
				Health:      HealthUp,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
			{
				Name:        "Recommendations",
				Health:      HealthDown,
				Criticality: CriticalityOptional,
				CachePolicy: CachePolicyNone,
			},
		},
		Edges: []Edge{
			{From: "Product API", To: "Recommendations"},
		},
	})

	parent := findDecision(t, res, "Product API")
	child := findDecision(t, res, "Recommendations")

	if parent.Decision != DecisionLive {
		t.Fatalf("expected parent %s, got %s", DecisionLive, parent.Decision)
	}

	if child.Decision != DecisionOmit {
		t.Fatalf("expected child %s, got %s", DecisionOmit, child.Decision)
	}
}

func TestPlanUsesFirstNodeAsRootWhenRootIsMissing(t *testing.T) {
	res := Plan(PlanRequest{
		Nodes: []Node{
			{
				Name:        "Dashboard API",
				Health:      HealthUp,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
		},
	})

	if res.Root != "Dashboard API" {
		t.Fatalf("expected Dashboard API, got %s", res.Root)
	}

	if res.Status != DecisionLive {
		t.Fatalf("expected %s, got %s", DecisionLive, res.Status)
	}
}

func TestValidateNeedsAtLeastOneNode(t *testing.T) {
	errors := Validate(PlanRequest{})

	if len(errors) == 0 {
		t.Fatal("expected validation error")
	}
}

func TestValidateCatchesBadNodeValues(t *testing.T) {
	errors := Validate(PlanRequest{
		Nodes: []Node{
			{
				Name:        "Pricing",
				Health:      "BROKEN",
				Criticality: "IMPORTANT",
				CachePolicy: "MAYBE",
			},
		},
	})

	if len(errors) != 3 {
		t.Fatalf("expected 3 errors, got %d", len(errors))
	}
}

func TestValidateCatchesMissingEdgeNodes(t *testing.T) {
	errors := Validate(PlanRequest{
		Nodes: []Node{
			{
				Name:        "Product API",
				Health:      HealthUp,
				Criticality: CriticalityRequired,
				CachePolicy: CachePolicyNone,
			},
		},
		Edges: []Edge{
			{From: "Product API", To: "Pricing"},
		},
	})

	if len(errors) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errors))
	}
}

func findDecision(t *testing.T, res PlanResponse, name string) DependencyDecision {
	t.Helper()

	for _, item := range res.Decisions {
		if item.Name == name {
			return item
		}
	}

	t.Fatalf("missing decision for %s", name)
	return DependencyDecision{}
}
