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

type Outcome string

const (
	OutcomeComplete Outcome = "COMPLETE"
	OutcomeDegraded Outcome = "DEGRADED"
	OutcomeFailed   Outcome = "FAILED"
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

type Impact struct {
	Name     string   `json:"name"`
	Decision Decision `json:"decision"`
	Severity string   `json:"severity"`
	Reason   string   `json:"reason"`
}

type PlanRequest struct {
	Root         string       `json:"root"`
	Nodes        []Node       `json:"nodes"`
	Edges        []Edge       `json:"edges"`
	Dependencies []Dependency `json:"dependencies,omitempty"`
}

type PlanResponse struct {
	Root           string               `json:"root"`
	Status         Decision             `json:"status"`
	Outcome        Outcome              `json:"outcome"`
	Reason         string               `json:"reason"`
	DecisionCounts map[Decision]int     `json:"decisionCounts"`
	Impacts        []Impact             `json:"impacts"`
	Decisions      []DependencyDecision `json:"decisions"`
}

func Validate(request PlanRequest) []string {
	nodes := request.Nodes
	if len(nodes) == 0 {
		nodes = request.Dependencies
	}

	var errors []string
	if len(nodes) == 0 {
		errors = append(errors, "at least one node is required")
	}

	seen := map[string]bool{}
	for _, node := range nodes {
		if node.Name == "" {
			errors = append(errors, "node name is required")
			continue
		}

		if seen[node.Name] {
			errors = append(errors, "duplicate node "+node.Name)
		}
		seen[node.Name] = true

		if !validHealth(node.Health) {
			errors = append(errors, "node "+node.Name+" has invalid health")
		}

		if !validCriticality(node.Criticality) {
			errors = append(errors, "node "+node.Name+" has invalid criticality")
		}

		if !validCachePolicy(node.CachePolicy) {
			errors = append(errors, "node "+node.Name+" has invalid cache policy")
		}
	}

	if request.Root != "" && !seen[request.Root] {
		errors = append(errors, "root node "+request.Root+" does not exist")
	}

	for _, edge := range request.Edges {
		if !seen[edge.From] {
			errors = append(errors, "edge from "+edge.From+" does not exist")
		}

		if !seen[edge.To] {
			errors = append(errors, "edge to "+edge.To+" does not exist")
		}
	}

	return errors
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

	root := request.Root
	if root == "" && len(nodes) > 0 {
		root = nodes[0].Name
	}

	rootDecision := byDecision[root]
	return PlanResponse{
		Root:           root,
		Status:         rootDecision.Decision,
		Outcome:        outcome(rootDecision, decisions),
		Reason:         rootDecision.Reason,
		DecisionCounts: countDecisions(decisions),
		Impacts:        impacts(root, decisions),
		Decisions:      decisions,
	}
}

func countDecisions(decisions []DependencyDecision) map[Decision]int {
	counts := map[Decision]int{
		DecisionLive:  0,
		DecisionCache: 0,
		DecisionStale: 0,
		DecisionOmit:  0,
		DecisionFail:  0,
	}

	for _, item := range decisions {
		counts[item.Decision]++
	}

	return counts
}

func impacts(root string, decisions []DependencyDecision) []Impact {
	items := make([]Impact, 0)

	for _, item := range decisions {
		if item.Decision == DecisionLive {
			continue
		}

		items = append(items, Impact{
			Name:     item.Name,
			Decision: item.Decision,
			Severity: severity(root, item),
			Reason:   item.Reason,
		})
	}

	return items
}

func severity(root string, item DependencyDecision) string {
	if item.Decision == DecisionFail && item.Name == root {
		return "BLOCKING"
	}

	if item.Decision == DecisionFail {
		return "FAILED_DEPENDENCY"
	}

	return "DEGRADED"
}

func outcome(root DependencyDecision, decisions []DependencyDecision) Outcome {
	if root.Decision == DecisionFail {
		return OutcomeFailed
	}

	for _, item := range decisions {
		if item.Decision == DecisionCache || item.Decision == DecisionStale || item.Decision == DecisionOmit {
			return OutcomeDegraded
		}
	}

	return OutcomeComplete
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

func validHealth(value Health) bool {
	return value == HealthUp || value == HealthDegraded || value == HealthDown
}

func validCriticality(value Criticality) bool {
	return value == CriticalityRequired || value == CriticalityOptional
}

func validCachePolicy(value CachePolicy) bool {
	return value == CachePolicyNone || value == CachePolicyFresh || value == CachePolicyStale
}
