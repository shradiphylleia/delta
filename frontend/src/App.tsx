import { useMemo, useState } from "react";

type Health = "UP" | "DEGRADED" | "DOWN";
type Criticality = "REQUIRED" | "OPTIONAL";
type CachePolicy = "NONE" | "FRESH" | "STALE";
type Decision = "LIVE" | "CACHE" | "STALE" | "OMIT" | "FAIL";
type Outcome = "COMPLETE" | "DEGRADED" | "FAILED";

type Node = {
  name: string;
  health: Health;
  criticality: Criticality;
  cachePolicy: CachePolicy;
};

type Edge = {
  from: string;
  to: string;
};

type PlanRequest = {
  root: string;
  nodes: Node[];
  edges: Edge[];
};

type NodeDecision = {
  name: string;
  decision: Decision;
  reason: string;
};

type Impact = {
  name: string;
  decision: Decision;
  severity: string;
  reason: string;
};

type PlanResponse = {
  root: string;
  status: Decision;
  outcome: Outcome;
  reason: string;
  decisionCounts: Record<Decision, number>;
  impacts: Impact[];
  decisions: NodeDecision[];
};

const scenarios: Record<string, PlanRequest> = {
  "Required dependency fails": {
    root: "Product API",
    nodes: [
      node("Product API", "UP", "REQUIRED", "NONE"),
      node("Pricing", "DOWN", "REQUIRED", "NONE"),
      node("Inventory", "DEGRADED", "REQUIRED", "FRESH"),
      node("Reviews", "DOWN", "OPTIONAL", "STALE"),
      node("Recommendations", "DOWN", "OPTIONAL", "NONE")
    ],
    edges: productEdges()
  },
  "Response survives degraded": {
    root: "Product API",
    nodes: [
      node("Product API", "UP", "REQUIRED", "NONE"),
      node("Pricing", "UP", "REQUIRED", "NONE"),
      node("Inventory", "DEGRADED", "REQUIRED", "FRESH"),
      node("Reviews", "DOWN", "OPTIONAL", "STALE"),
      node("Recommendations", "DOWN", "OPTIONAL", "NONE")
    ],
    edges: productEdges()
  }
};

const decisionOrder: Decision[] = ["LIVE", "CACHE", "STALE", "OMIT", "FAIL"];
const healthOptions: Health[] = ["UP", "DEGRADED", "DOWN"];
const criticalityOptions: Criticality[] = ["REQUIRED", "OPTIONAL"];
const cacheOptions: CachePolicy[] = ["NONE", "FRESH", "STALE"];

function App() {
  const [scenarioName, setScenarioName] = useState("Required dependency fails");
  const [draft, setDraft] = useState<PlanRequest>(() => cloneScenario(scenarios["Required dependency fails"]));
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const decisionsByName = useMemo(() => {
    const byName = new Map<string, NodeDecision>();
    plan?.decisions.forEach((item) => byName.set(item.name, item));
    return byName;
  }, [plan]);

  async function runPlan() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.errors?.join(", ") || "planner request failed");
      }

      setPlan(await res.json());
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : "planner request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#111827]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d8dde6] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#536173]">Delta</p>
            <h1 className="mt-1 text-2xl font-semibold">Response composition planner</h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="h-10 rounded-md border border-[#c9d1dc] bg-white px-3 text-sm shadow-sm"
              value={scenarioName}
              onChange={(event) => {
                setScenarioName(event.target.value);
                setDraft(cloneScenario(scenarios[event.target.value]));
                setPlan(null);
                setError("");
              }}
            >
              {Object.keys(scenarios).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>

            <button
              className="h-10 rounded-md border border-[#c9d1dc] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm"
              onClick={() => {
                setDraft(cloneScenario(scenarios[scenarioName]));
                setPlan(null);
                setError("");
              }}
            >
              Reset
            </button>

            <button
              className="h-10 rounded-md bg-[#1f2937] px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#7a8594]"
              disabled={loading}
              onClick={runPlan}
            >
              {loading ? "Planning" : "Run plan"}
            </button>
          </div>
        </header>

        {error && (
          <section className="rounded-md border border-[#e09a9a] bg-[#fff5f5] px-4 py-3 text-sm text-[#8a1f1f]">
            {error}
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-md border border-[#d8dde6] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Composition graph</h2>
              <span className="text-xs text-[#667085]">{draft.nodes.length} nodes</span>
            </div>

            <GraphView scenario={draft} decisionsByName={decisionsByName} />
          </div>

          <div className="rounded-md border border-[#d8dde6] bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Plan summary</h2>
            {plan ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <SummaryTile label="root" value={plan.root} />
                  <SummaryTile label="status" value={plan.status} tone={plan.status} />
                  <SummaryTile label="outcome" value={plan.outcome} tone={plan.outcome} />
                </div>

                <div className="rounded-md border border-[#d8dde6] bg-[#fafbfc] p-3 text-sm text-[#344054]">
                  {plan.reason}
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {decisionOrder.map((decision) => (
                    <div key={decision} className="rounded-md border border-[#d8dde6] p-3 text-center">
                      <div className="text-lg font-semibold">{plan.decisionCounts[decision]}</div>
                      <div className="mt-1 text-[11px] font-medium text-[#667085]">{decision}</div>
                    </div>
                  ))}
                </div>

                <ImpactList impacts={plan.impacts} />
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-dashed border-[#c9d1dc] p-5 text-sm text-[#667085]">
                Run a scenario to see the composed response plan.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-md border border-[#d8dde6] bg-white shadow-sm">
          <div className="border-b border-[#d8dde6] px-4 py-3">
            <h2 className="text-base font-semibold">Dependency decisions</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f0f3f7] text-xs uppercase text-[#536173]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Dependency</th>
                  <th className="px-4 py-3 font-semibold">Health</th>
                  <th className="px-4 py-3 font-semibold">Criticality</th>
                  <th className="px-4 py-3 font-semibold">Cache</th>
                  <th className="px-4 py-3 font-semibold">Decision</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e9ef]">
                {draft.nodes.map((item) => {
                  const decision = decisionsByName.get(item.name);
                  return (
                    <tr key={item.name}>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3">
                        <SelectValue
                          value={item.health}
                          options={healthOptions}
                          onChange={(value) => updateNode(item.name, { health: value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SelectValue
                          value={item.criticality}
                          options={criticalityOptions}
                          onChange={(value) => updateNode(item.name, { criticality: value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SelectValue
                          value={item.cachePolicy}
                          options={cacheOptions}
                          onChange={(value) => updateNode(item.name, { cachePolicy: value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {decision ? <Badge value={decision.decision} /> : <span className="text-[#98a2b3]">pending</span>}
                      </td>
                      <td className="px-4 py-3 text-[#536173]">{decision?.reason || "not planned yet"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );

  function updateNode(name: string, patch: Partial<Node>) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((item) => (item.name === name ? { ...item, ...patch } : item))
    }));
    setPlan(null);
    setError("");
  }
}

function ImpactList({ impacts }: { impacts: Impact[] }) {
  if (impacts.length === 0) {
    return (
      <div className="rounded-md border border-[#cfe8d7] bg-[#f4fbf6] p-3 text-sm text-[#17633a]">
        No fallback or failure impact in this plan.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#d8dde6]">
      <div className="border-b border-[#d8dde6] px-3 py-2 text-xs font-semibold uppercase text-[#667085]">
        Impact analysis
      </div>
      <div className="divide-y divide-[#e5e9ef]">
        {impacts.map((item) => (
          <div key={`${item.name}-${item.decision}`} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{item.name}</span>
              <Badge value={item.decision} />
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>
                {item.severity}
              </span>
            </div>
            <div className="mt-2 text-sm text-[#536173]">{item.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphView({
  scenario,
  decisionsByName
}: {
  scenario: PlanRequest;
  decisionsByName: Map<string, NodeDecision>;
}) {
  const root = scenario.nodes.find((item) => item.name === scenario.root);
  const deps = scenario.nodes.filter((item) => item.name !== scenario.root);
  const rootDecision = root ? decisionsByName.get(root.name) : undefined;

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-md border border-[#d8dde6] bg-[#f8fafc]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true">
        {deps.map((item, index) => {
          const y = graphY(index, deps.length);
          const decision = decisionsByName.get(item.name)?.decision;
          return (
            <path
              key={item.name}
              d={`M 254 180 C 390 180, 420 ${y}, 560 ${y}`}
              className={edgeClass(decision)}
              fill="none"
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <div className="absolute left-[43%] top-6 flex h-[312px] w-[20%] flex-col justify-between">
        {deps.map((item) => (
          <EdgeLabel key={item.name} item={item} />
        ))}
      </div>

      {root && (
        <div className="absolute left-[5%] top-1/2 w-[28%] -translate-y-1/2">
          <GraphNode item={root} decision={rootDecision} />
        </div>
      )}

      <div className="absolute right-[5%] top-6 flex h-[312px] w-[34%] flex-col justify-between">
        {deps.map((item) => (
          <GraphNode key={item.name} item={item} decision={decisionsByName.get(item.name)} />
        ))}
      </div>
    </div>
  );
}

function GraphNode({ item, decision }: { item: Node; decision?: NodeDecision }) {
  return (
    <div className={`min-h-[68px] rounded-md border bg-white p-3 shadow-sm ${nodeClass(decision?.decision)}`}>
      <div>
        <div className="truncate text-sm font-semibold">{item.name}</div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <PolicyChip value={item.health} tone={healthTone(item.health)} />
          <PolicyChip value={item.criticality} tone={item.criticality === "REQUIRED" ? "critical" : "neutral"} />
          <PolicyChip value={cacheLabel(item.cachePolicy)} tone={item.cachePolicy === "NONE" ? "neutral" : "cache"} />
        </div>
      </div>
      <div className="mt-2">{decision ? <Badge value={decision.decision} /> : <span className="text-xs text-[#98a2b3]">pending</span>}</div>
    </div>
  );
}

function EdgeLabel({ item }: { item: Node }) {
  return (
    <div className="flex h-[68px] items-center justify-center">
      <div className="rounded-md border border-[#d8dde6] bg-white/90 px-2 py-1 text-center shadow-sm">
        <div className={`text-[10px] font-semibold ${item.criticality === "REQUIRED" ? "text-[#a31f1f]" : "text-[#475467]"}`}>
          {item.criticality}
        </div>
        <div className="mt-0.5 text-[10px] font-medium text-[#667085]">{cacheLabel(item.cachePolicy)}</div>
      </div>
    </div>
  );
}

function PolicyChip({ value, tone }: { value: string; tone: "good" | "warn" | "bad" | "cache" | "critical" | "neutral" }) {
  return <span className={`rounded-md px-1.5 py-1 font-semibold ${policyClass(tone)}`}>{value}</span>;
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: Decision | Outcome }) {
  return (
    <div className="rounded-md border border-[#d8dde6] p-3">
      <div className="text-[11px] font-semibold uppercase text-[#667085]">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${toneText(tone)}`}>{value}</div>
    </div>
  );
}

function SelectValue<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      className="h-9 min-w-[118px] rounded-md border border-[#c9d1dc] bg-white px-2 text-xs font-medium text-[#344054]"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function Badge({ value }: { value: Decision }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${badgeClass(value)}`}>{value}</span>;
}

function badgeClass(value: Decision) {
  if (value === "LIVE") return "bg-[#e7f6ed] text-[#17633a]";
  if (value === "CACHE") return "bg-[#e9f2ff] text-[#175cd3]";
  if (value === "STALE") return "bg-[#fff4d6] text-[#7a4b00]";
  if (value === "OMIT") return "bg-[#eef0f3] text-[#475467]";
  return "bg-[#fde7e7] text-[#a31f1f]";
}

function severityClass(value: string) {
  if (value === "BLOCKING") return "bg-[#fde7e7] text-[#a31f1f]";
  if (value === "FAILED_DEPENDENCY") return "bg-[#fff0e6] text-[#9a4b00]";
  return "bg-[#eef0f3] text-[#475467]";
}

function policyClass(tone: "good" | "warn" | "bad" | "cache" | "critical" | "neutral") {
  if (tone === "good") return "bg-[#e7f6ed] text-[#17633a]";
  if (tone === "warn") return "bg-[#fff4d6] text-[#7a4b00]";
  if (tone === "bad") return "bg-[#fde7e7] text-[#a31f1f]";
  if (tone === "cache") return "bg-[#e9f2ff] text-[#175cd3]";
  if (tone === "critical") return "bg-[#fde7e7] text-[#a31f1f]";
  return "bg-[#eef0f3] text-[#475467]";
}

function nodeClass(value?: Decision) {
  if (value === "LIVE") return "border-[#a7dfbf]";
  if (value === "CACHE") return "border-[#a8cfff]";
  if (value === "STALE") return "border-[#f2cc72]";
  if (value === "OMIT") return "border-[#cbd3dd]";
  if (value === "FAIL") return "border-[#f0a3a3]";
  return "border-[#d8dde6]";
}

function edgeClass(value?: Decision) {
  if (value === "LIVE") return "stroke-[#2e8b57]";
  if (value === "CACHE") return "stroke-[#2f6fbd]";
  if (value === "STALE") return "stroke-[#c98712]";
  if (value === "OMIT") return "stroke-[#8a94a3]";
  if (value === "FAIL") return "stroke-[#d14343]";
  return "stroke-[#c4ccd8]";
}

function graphY(index: number, count: number) {
  if (count <= 1) return 180;
  return 60 + (240 / (count - 1)) * index;
}

function healthTone(value: Health) {
  if (value === "UP") return "good";
  if (value === "DEGRADED") return "warn";
  return "bad";
}

function cacheLabel(value: CachePolicy) {
  if (value === "FRESH") return "FRESH CACHE";
  if (value === "STALE") return "STALE OK";
  return "NO CACHE";
}

function toneText(value?: Decision | Outcome) {
  if (value === "LIVE" || value === "COMPLETE") return "text-[#17633a]";
  if (value === "CACHE") return "text-[#175cd3]";
  if (value === "STALE" || value === "DEGRADED") return "text-[#7a4b00]";
  if (value === "OMIT") return "text-[#475467]";
  if (value === "FAIL" || value === "FAILED") return "text-[#a31f1f]";
  return "text-[#111827]";
}

function node(name: string, health: Health, criticality: Criticality, cachePolicy: CachePolicy): Node {
  return { name, health, criticality, cachePolicy };
}

function productEdges(): Edge[] {
  return [
    { from: "Product API", to: "Pricing" },
    { from: "Product API", to: "Inventory" },
    { from: "Product API", to: "Reviews" },
    { from: "Product API", to: "Recommendations" }
  ];
}

function cloneScenario(scenario: PlanRequest): PlanRequest {
  return {
    root: scenario.root,
    nodes: scenario.nodes.map((item) => ({ ...item })),
    edges: scenario.edges.map((item) => ({ ...item }))
  };
}

export default App;
