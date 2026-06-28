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
