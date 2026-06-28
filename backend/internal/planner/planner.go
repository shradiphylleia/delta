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

type Node struct {
	Name        string      `json:"name"`
	Health      Health      `json:"health"`
	Criticality Criticality `json:"criticality"`
	CachePolicy CachePolicy `json:"cachePolicy"`
}

type Dependency = Node

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type DependencyDecision struct {
	Name     string   `json:"name"`
	Decision Decision `json:"decision"`
	Reason   string   `json:"reason"`
}

type PlanRequest struct {
	Root         string       `json:"root"`
	Nodes        []Node       `json:"nodes"`
	Edges        []Edge       `json:"edges"`
	Dependencies []Dependency `json:"dependencies,omitempty"`
}

type PlanResponse struct {
	Decisions []DependencyDecision `json:"decisions"`
}

func Plan(request PlanRequest) PlanResponse {
	nodes := request.Nodes
	if len(nodes) == 0 {
		nodes = request.Dependencies
	}

	byName := make(map[string]Node, len(nodes))
	byDecision := make(map[string]DependencyDecision, len(nodes))

	for _, node := range nodes {
		byName[node.Name] = node
		byDecision[node.Name] = decide(node)
	}

	for i := 0; i < len(nodes); i++ {
		changed := false

		for _, edge := range request.Edges {
			child, ok := byName[edge.To]
			if !ok || child.Criticality != CriticalityRequired {
				continue
			}

			childDecision, ok := byDecision[edge.To]
			if !ok || childDecision.Decision != DecisionFail {
				continue
			}

			parentDecision, ok := byDecision[edge.From]
			if !ok || parentDecision.Decision == DecisionFail {
				continue
			}

			byDecision[edge.From] = DependencyDecision{
				Name:     edge.From,
				Decision: DecisionFail,
				Reason:   "required dependency " + edge.To + " failed",
			}
			changed = true
		}

		if !changed {
			break
		}
	}

	decisions := make([]DependencyDecision, 0, len(nodes))
	for _, node := range nodes {
		decisions = append(decisions, byDecision[node.Name])
	}

	return PlanResponse{Decisions: decisions}
}

func decide(dep Node) DependencyDecision {
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
