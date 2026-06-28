package planner

type Health string

const (
	HealthUp       Health = "UP"
	HealthDegraded Health = "DEGRADED"
	HealthDown     Health = "DOWN"
)

type Decision string

const (
	DecisionLive  Decision = "LIVE"
	DecisionCache Decision = "CACHE"
	DecisionStale Decision = "STALE"
	DecisionOmit  Decision = "OMIT"
	DecisionFail  Decision = "FAIL"
)

type Criticality string

const (
	CriticalityRequired Criticality = "REQUIRED"
	CriticalityOptional Criticality = "OPTIONAL"
)

type CachePolicy string

const (
	CachePolicyNone  CachePolicy = "NONE"
	CachePolicyFresh CachePolicy = "FRESH"
	CachePolicyStale CachePolicy = "STALE"
)

type Dependency struct {
	Name        string      `json:"name"`
	Health      Health      `json:"health"`
	Criticality Criticality `json:"criticality"`
	CachePolicy CachePolicy `json:"cachePolicy"`
}

type DependencyDecision struct {
	Name     string   `json:"name"`
	Decision Decision `json:"decision"`
	Reason   string   `json:"reason"`
}

type PlanRequest struct {
	Dependencies []Dependency `json:"dependencies"`
}

type PlanResponse struct {
	Decisions []DependencyDecision `json:"decisions"`
}

func Plan(request PlanRequest) PlanResponse {
	decisions := make([]DependencyDecision, 0, len(request.Dependencies))

	for _, dep := range request.Dependencies {
		decisions = append(decisions, decide(dep))
	}

	return PlanResponse{Decisions: decisions}
}

func decide(dep Dependency) DependencyDecision {
	decision := DecisionFail
	reason := "dependency health is unknown"

	if dep.Health == HealthUp {
		decision = DecisionLive
		reason = "dependency is healthy"
	}

	if dep.Health == HealthDegraded {
		decision = DecisionFail
		reason = "dependency is degraded, required and has no cache fallback"
	}

	if dep.Health == HealthDown {
		decision = DecisionFail
		reason = "dependency is down, required and has no cache fallback"
	}

	if dep.Health != HealthUp && dep.CachePolicy == CachePolicyFresh {
		decision = DecisionCache
		reason = "fresh cache is available"
	}

	if dep.Health != HealthUp && dep.CachePolicy == CachePolicyStale {
		decision = DecisionStale
		reason = "stale cache is acceptable"
	}

	if dep.Health != HealthUp && dep.CachePolicy == CachePolicyNone && dep.Criticality == CriticalityOptional {
		decision = DecisionOmit
		reason = "dependency is optional"
	}

	return DependencyDecision{
		Name:     dep.Name,
		Decision: decision,
		Reason:   reason,
	}
}
