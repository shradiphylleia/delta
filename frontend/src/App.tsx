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

type GraphTextResponse = PlanRequest;
type DependencyInputMode = "natural" | "json";
type WorkView = "both" | "graph" | "decisions";

const scenarios: Record<string, PlanRequest> = {
  "Pricing outage blocks response": {
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
  "Response survives with fallbacks": {
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
  const [scenarioName, setScenarioName] = useState("Pricing outage blocks response");
  const [draft, setDraft] = useState<PlanRequest>(() => cloneScenario(scenarios["Pricing outage blocks response"]));
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState("");
  const [graphText, setGraphText] = useState("The Dashboard API depends on User, Orders, Inventory and Recommendations. Recommendations depends on User Profile.");
  const [jsonText, setJsonText] = useState(() => JSON.stringify(scenarios["Pricing outage blocks response"], null, 2));
  const [inputMode, setInputMode] = useState<DependencyInputMode>("natural");
  const [workView, setWorkView] = useState<WorkView>("both");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  async function generateGraph() {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/graphs/from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: graphText })
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "graph generation failed");
      }

      const graph = (await res.json()) as GraphTextResponse;
      loadDraft(graph, "AI generated draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "graph generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function applyJSONDraft() {
    setError("");

    try {
      const graph = JSON.parse(jsonText) as PlanRequest;
      if (!graph.root || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new Error("json must include root, nodes and edges");
      }

      loadDraft(graph, "JSON draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "invalid graph json");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#111827]">
      <section className="grainy-gradient relative flex min-h-screen items-center justify-center">
        <svg className="absolute h-0 w-0" aria-hidden="true">
          <filter id="grainy-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div className="relative text-center">
          <div className="font-['Montserrat'] text-[55px] font-bold  tracking-normal text-[#111827] blur-[0.2px]">
            delta
          </div>
          <div className="mt-1 text-[14px] text-white">
            dependency aware service composition
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-6 py-10">
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-4 border-b border-[#d8dde6] pb-5">
          <div>
            <p className="text-[18px] font-semibold  tracking-wide text-[#536173]">Planning console</p>
            <h1 className="mt-1 text-2xl font-semibold">Compose response plan</h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="h-10 rounded-md border border-[#c9d1dc] bg-white px-3 text-sm shadow-sm"
              value={scenarioName}
              onChange={(event) => {
                setScenarioName(event.target.value);
                loadDraft(scenarios[event.target.value], event.target.value);
              }}
            >
              {scenarioName === "AI generated draft" && <option>AI generated draft</option>}
              {scenarioName === "JSON draft" && <option>JSON draft</option>}
              {Object.keys(scenarios).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>

            <button
              className="h-10 rounded-md border border-[#c9d1dc] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm"
              onClick={() => {
                const scenario = scenarios[scenarioName] || scenarios["Pricing outage blocks response"];
                loadDraft(scenario, scenarios[scenarioName] ? scenarioName : "Pricing outage blocks response");
                if (!scenarios[scenarioName]) {
                  setScenarioName("Pricing outage blocks response");
                }
              }}
            >
              Reset
            </button>
          </div>
        </header>

        {error && (
          <section className="rounded-md border border-[#e09a9a] bg-[#fff5f5] px-4 py-3 text-sm text-[#8a1f1f]">
            {error}
          </section>
        )}

        <DefineDependenciesPanel
          inputMode={inputMode}
          setInputMode={setInputMode}
          graphText={graphText}
          setGraphText={setGraphText}
          jsonText={jsonText}
          setJsonText={setJsonText}
          generating={generating}
          generateGraph={generateGraph}
          applyJSONDraft={applyJSONDraft}
        />

        <section className="mx-auto w-full max-w-6xl rounded-md border border-[#d8dde6] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Composition workspace</h2>
              <p className="mt-1 text-sm text-[#667085]">Choose how you want to inspect the current dependency draft.</p>
            </div>
            <SegmentedControl value={workView} setValue={setWorkView} />
          </div>

          <div className="grid gap-4">
            {(workView === "both" || workView === "decisions") && (
              <DependencyTable draft={draft} decisionsByName={decisionsByName} updateNode={updateNode} />
            )}

            {(workView === "both" || workView === "graph") && (
              <div className="rounded-md border border-[#d8dde6] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Composition graph</h2>
              <span className="text-xs text-[#667085]">{draft.nodes.length} nodes</span>
            </div>

            <GraphView scenario={draft} decisionsByName={decisionsByName} />

            <button
              className="mt-4 h-10 w-full rounded-md bg-[#1f2937] px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#7a8594]"
              disabled={loading}
              onClick={runPlan}
            >
              {loading ? "Planning" : "Run plan"}
            </button>
          </div>
            )}
          </div>

          {workView === "decisions" && (
            <button
              className="mt-4 h-10 w-full rounded-md bg-[#1f2937] px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#7a8594]"
              disabled={loading}
              onClick={runPlan}
            >
              {loading ? "Planning" : "Run plan"}
            </button>
          )}
        </section>

        <PlanSummary plan={plan} />

        <footer className="py-8 text-center text-sm text-[#667085]">
          made with love for curiosity during nights and days by shraddha
        </footer>
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

  function loadDraft(graph: PlanRequest, name: string) {
    const next = cloneScenario(graph);
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    setPlan(null);
    setError("");
    setScenarioName(name);
  }
}

function DependencyTable({
  draft,
  decisionsByName,
  updateNode
}: {
  draft: PlanRequest;
  decisionsByName: Map<string, NodeDecision>;
  updateNode: (name: string, patch: Partial<Node>) => void;
}) {
  return (
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
  );
}

function DefineDependenciesPanel({
  inputMode,
  setInputMode,
  graphText,
  setGraphText,
  jsonText,
  setJsonText,
  generating,
  generateGraph,
  applyJSONDraft
}: {
  inputMode: DependencyInputMode;
  setInputMode: (value: DependencyInputMode) => void;
  graphText: string;
  setGraphText: (value: string) => void;
  jsonText: string;
  setJsonText: (value: string) => void;
  generating: boolean;
  generateGraph: () => void;
  applyJSONDraft: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl rounded-md border border-[#d8dde6] bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Define dependencies</h2>
          <p className="mt-1 text-sm text-[#667085]">Start with natural language or paste graph JSON.</p>
        </div>
      </div>

      <div className="mb-3 inline-flex rounded-md border border-[#c9d1dc] bg-[#f8fafc] p-1">
        <ModeButton active={inputMode === "natural"} onClick={() => setInputMode("natural")}>
          Natural language
        </ModeButton>
        <ModeButton active={inputMode === "json"} onClick={() => setInputMode("json")}>
          JSON
        </ModeButton>
      </div>

      {inputMode === "natural" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <textarea
              className="min-h-[112px] w-full resize-y rounded-md border border-[#c9d1dc] bg-white p-3 text-sm text-[#344054] shadow-sm"
              value={graphText}
              onChange={(event) => setGraphText(event.target.value)}
            />
          </div>

          <button
            className="h-10 rounded-md border border-[#c9d1dc] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm disabled:cursor-not-allowed disabled:bg-[#f0f3f7] disabled:text-[#98a2b3]"
            disabled={generating}
            onClick={generateGraph}
          >
            {generating ? "Generating" : "Generate graph"}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
          <textarea
            className="min-h-[220px] w-full resize-y rounded-md border border-[#c9d1dc] bg-[#fbfcfe] p-3 font-mono text-xs text-[#344054] shadow-sm"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
          />
          </div>
          <button
            className="h-10 rounded-md border border-[#c9d1dc] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm"
            onClick={applyJSONDraft}
          >
            Generate graph
          </button>
        </div>
      )}
    </section>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      className={`h-8 rounded px-3 text-sm font-medium ${active ? "bg-white text-[#111827] shadow-sm" : "text-[#667085]"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SegmentedControl({ value, setValue }: { value: WorkView; setValue: (value: WorkView) => void }) {
  return (
    <div className="inline-flex rounded-md border border-[#c9d1dc] bg-[#f8fafc] p-1">
      <ModeButton active={value === "both"} onClick={() => setValue("both")}>
        Both
      </ModeButton>
      <ModeButton active={value === "graph"} onClick={() => setValue("graph")}>
        Graph
      </ModeButton>
      <ModeButton active={value === "decisions"} onClick={() => setValue("decisions")}>
        Decisions
      </ModeButton>
    </div>
  );
}

function PlanSummary({ plan }: { plan: PlanResponse | null }) {
  return (
    <section className="mx-auto w-full max-w-6xl rounded-md border border-[#d8dde6] bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Plan summary</h2>
      {plan ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
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
    </section>
  );
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
  const rowHeight = 112;
  const nodeHeight = 88;
  const graphWidth = 720;
  const rootX = 24;
  const rootWidth = 190;
  const depX = 466;
  const depWidth = 230;
  const rootY = Math.max(136, deps.length * rowHeight / 2);
  const graphHeight = Math.max(360, deps.length * rowHeight + 64);

  return (
    <div
      className="overflow-x-auto rounded-md border border-[#d8dde6] bg-[#f8fafc]"
    >
      <div className="relative" style={{ width: graphWidth, height: graphHeight }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${graphWidth} ${graphHeight}`} aria-hidden="true">
          {deps.map((item, index) => {
            const y = depY(index, rowHeight) + nodeHeight / 2;
            const decision = decisionsByName.get(item.name)?.decision;
            return (
              <path
                key={item.name}
                d={`M ${rootX + rootWidth} ${rootY + nodeHeight / 2} C 300 ${rootY + nodeHeight / 2}, 330 ${y}, ${depX} ${y}`}
                className={edgeStrokeClass(decision)}
                fill="none"
                strokeWidth="2"
              />
            );
          })}
        </svg>

        {root && (
          <div className="absolute" style={{ left: rootX, top: rootY, width: rootWidth }}>
            <GraphNode item={root} decision={rootDecision} variant="root" />
          </div>
        )}

        {deps.map((item, index) => {
          const top = depY(index, rowHeight);
          return (
            <div key={item.name}>
              <div className="absolute" style={{ left: 262, top: top + 22, width: 142 }}>
                <EdgeLabel item={item} />
              </div>
              <div className="absolute" style={{ left: depX, top, width: depWidth }}>
                <GraphNode item={item} decision={decisionsByName.get(item.name)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GraphNode({
  item,
  decision,
  variant = "dependency"
}: {
  item: Node;
  decision?: NodeDecision;
  variant?: "root" | "dependency";
}) {
  return (
    <div
      className={`relative z-10 w-full rounded-md border bg-white p-3 shadow-sm ${nodeClass(decision?.decision)} ${
        variant === "root" ? "min-h-[96px]" : "min-h-[80px]"
      }`}
    >
      <div>
        <div className="break-words text-sm font-semibold leading-5">{item.name}</div>
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
    <div className="rounded-md border border-[#d8dde6] bg-white px-2 py-1 text-center shadow-sm">
      <div className={`text-[10px] font-semibold ${item.criticality === "REQUIRED" ? "text-[#a31f1f]" : "text-[#475467]"}`}>
        {item.criticality}
      </div>
      <div className="mt-0.5 text-[10px] font-medium text-[#667085]">{cacheLabel(item.cachePolicy)}</div>
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

function edgeStrokeClass(value?: Decision) {
  if (value === "LIVE") return "stroke-[#2e8b57]";
  if (value === "CACHE") return "stroke-[#2f6fbd]";
  if (value === "STALE") return "stroke-[#c98712]";
  if (value === "OMIT") return "stroke-[#8a94a3]";
  if (value === "FAIL") return "stroke-[#d14343]";
  return "stroke-[#c4ccd8]";
}

function depY(index: number, rowHeight: number) {
  return 32 + index * rowHeight;
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
