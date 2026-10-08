import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  Users, UserPlus, Building2, Layers, Send, AlertTriangle, Clock,
  Info, ChevronRight, ChevronDown, ArrowUpDown, TrendingUp, TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
const REAL_TOTAL: Record<string, number> = { UP: 18772, KA: 28961 };
const AGG_NAMES: Record<string, string[]> = {
  UP: ["Ghaziabad Skills Mission", "Modinagar Livelihoods Trust", "Loni Rozgar Kendra", "Muradnagar Collective", "Dasna Udyog Samiti", "Pilkhuwa Skill Centre"],
  KA: ["Deshpande Foundation", "Hubli Skill Mission", "Dharwad Livelihoods Trust", "Navalgund Collective", "Kundgol Udyog Kendra", "Kalghatgi Rozgar Samiti"],
};
const CITIES: Record<string, string[]> = {
  UP: ["Ghaziabad", "Modinagar", "Loni", "Muradnagar", "Dasna", "Pilkhuwa"],
  KA: ["Hubli", "Dharwad", "Kalghatgi", "Kundgol", "Navalgund", "Annigeri"],
};
const FIRST = ["Rahul", "Priya", "Amit", "Sunita", "Vikas", "Pooja", "Santosh", "Anjali", "Kiran", "Manoj", "Deepa", "Ravi", "Neha", "Arun", "Kavya", "Suresh"];
const LAST = ["Patil", "Kulkarni", "Sharma", "Verma", "Gowda", "Hegde", "Yadav", "Singh", "Desai", "Naik"];
const ROLES = ["Delivery Executive", "Data Entry Operator", "Electrician", "Sales Executive", "Security Guard", "Machine Operator", "Tailor", "Driver", "Telecaller", "Housekeeping"];
const EDU = ["Below 10th", "10th Pass", "12th Pass", "ITI", "Diploma", "Graduate"];
const EXP = ["Fresher", "< 1 year", "1–3 years", "3–5 years", "5+ years"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const fmtN = (n: number) => n.toLocaleString("en-IN");
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Node {
  id: string; name: string; dots: number; new7d: number; active: number; inactive: number;
  applied: number; activity: number; trend: number; quiet: boolean;
}
interface AggNode extends Node { coordinators: Node[]; }

function makeCoord(instance: string, idx: number, dots: number): Node {
  const quiet = Math.random() < 0.12;
  const new7d = quiet ? 0 : Math.round(dots * (0.005 + Math.random() * 0.04));
  const active = Math.round(dots * (0.06 + Math.random() * 0.09));
  const inactive = Math.round(dots * (0.6 + Math.random() * 0.22));
  const applied = Math.round(dots * (0.45 + Math.random() * 0.2));
  const activity = clamp(Math.round((active / dots / 0.15) * 55 + (new7d / dots / 0.045) * 35 + 6), 6, 100);
  const trend = quiet ? -(2 + Math.floor(Math.random() * 7)) : Math.round(Math.random() * 16 - 8);
  return { id: `${instance}-C${idx}`, name: `${pick(FIRST)} ${pick(LAST)}`, dots, new7d, active, inactive, applied, activity, trend, quiet };
}

function splitInto(total: number, parts: number, min: number): number[] {
  const w = Array.from({ length: parts }, () => 0.5 + Math.random());
  const ws = w.reduce((a, b) => a + b, 0);
  const out: number[] = []; let rem = total;
  for (let i = 0; i < parts; i++) { const v = i === parts - 1 ? Math.max(min, rem) : Math.max(min, Math.round((total * w[i]) / ws)); out.push(v); rem -= v; }
  return out;
}

function genHierarchy(instance: string, realTotal: number): AggNode[] {
  const names = AGG_NAMES[instance] ?? AGG_NAMES.UP;
  const aggCount = Math.min(names.length, 5 + Math.floor(Math.random() * 2));
  const aggTotals = splitInto(realTotal, aggCount, 200);
  let ci = 0;
  return aggTotals.map((aggTotal, i) => {
    const cCount = 2 + Math.floor(Math.random() * 5);
    const coordinators = splitInto(aggTotal, cCount, 20).map((d) => makeCoord(instance, ci++, d));
    const sum = (k: keyof Node) => coordinators.reduce((a, c) => a + (c[k] as number), 0);
    const dots = sum("dots");
    const wavg = (k: keyof Node) => Math.round(coordinators.reduce((a, c) => a + (c[k] as number) * c.dots, 0) / (dots || 1));
    return {
      id: `${instance}-A${i}`, name: names[i % names.length], coordinators,
      dots, new7d: sum("new7d"), active: sum("active"), inactive: sum("inactive"), applied: sum("applied"),
      activity: wavg("activity"), trend: wavg("trend"), quiet: false,
    };
  });
}

interface Indiv { id: string; joined: string; role: string; education: string; experience: string; applications: number; lifecycle: string; city: string; }
function genIndividuals(instance: string, n: number): Indiv[] {
  const cities = CITIES[instance] ?? CITIES.UP; const now = Date.now();
  return Array.from({ length: n }, () => {
    const daysAgo = Math.floor(Math.random() * 240);
    const apps = Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 8);
    const lastApply = apps > 0 ? Math.floor(Math.random() * 180) : null;
    let lifecycle = "Inactive";
    if (daysAgo <= 7) lifecycle = "New"; else if (lastApply !== null && lastApply <= 30) lifecycle = "Active"; else if (lastApply !== null && lastApply <= 90) lifecycle = "At Risk";
    const d = new Date(now - daysAgo * 86400000);
    return { id: `${instance}-${100000 + Math.floor(Math.random() * 899999)}`, joined: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, role: pick(ROLES), education: pick(EDU), experience: pick(EXP), applications: apps, lifecycle, city: pick(cities) };
  });
}

const LC_BADGE: Record<string, string> = {
  New: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Active: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "At Risk": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Inactive: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};
const actColor = (a: number) => (a >= 60 ? "bg-emerald-500" : a >= 40 ? "bg-amber-500" : "bg-rose-500");

function KpiTile({ label, value, description, Icon, cardClass }: { label: string; value: string; description: ReactNode; Icon: typeof Users; cardClass?: string }) {
  return (
    <div className={cn("rounded-xl border p-5 bg-card", cardClass)}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground"><Icon className="h-4 w-4" /></div>
        <div className="text-sm font-medium leading-tight">{label}</div>
      </div>
      <div className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}
const Trend = ({ v, unit = "pts" }: { v: number; unit?: string }) => (
  <span className={cn("inline-flex items-center gap-0.5 font-medium", v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
    {v >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{v >= 0 ? "+" : ""}{v} {unit}
  </span>
);

type SortKey = "activity" | "dots" | "new7d";

export function DistrictBluedots({ district }: { district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const realTotal = REAL_TOTAL[instance] ?? 0;
  const aggs = useMemo(() => genHierarchy(instance, realTotal), [instance, realTotal]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<Node | null>(null);
  const [period, setPeriod] = useState("7");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "activity", dir: "desc" });

  const totals = useMemo(() => {
    const t = { dots: 0, new7d: 0, active: 0, inactive: 0, applied: 0, coords: 0 };
    for (const a of aggs) { t.dots += a.dots; t.new7d += a.new7d; t.active += a.active; t.inactive += a.inactive; t.applied += a.applied; t.coords += a.coordinators.length; }
    return t;
  }, [aggs]);

  const attention = useMemo(() => {
    const quietCoords = aggs.flatMap((a) => a.coordinators).filter((c) => c.quiet);
    const worst = [...aggs].sort((a, b) => a.activity - b.activity)[0];
    const items: { tone: "danger" | "warn"; title: string; sub: string }[] = [];
    if (worst) items.push({ tone: "danger", title: `${worst.name} — activity ${worst.trend >= 0 ? "▲" : "▼"} ${Math.abs(worst.trend)} pts`, sub: `lowest in district · ${pctOf(worst.inactive, worst.dots)}% inactive` });
    if (quietCoords.length) items.push({ tone: "warn", title: `${quietCoords.length} coordinator${quietCoords.length > 1 ? "s" : ""} · 0 new onboards`, sub: quietCoords.slice(0, 2).map((c) => c.name).join(", ") + (quietCoords.length > 2 ? "…" : "") });
    items.push({ tone: "warn", title: `Inactive share ${pctOf(totals.inactive, totals.dots)}%`, sub: "district-wide · re-engagement needed" });
    return items.slice(0, 3);
  }, [aggs, totals]);

  const sortedAggs = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...aggs].sort((a, b) => (a[sort.key] - b[sort.key]) * m).map((a) => ({ ...a, coordinators: [...a.coordinators].sort((x, y) => (x[sort.key] - y[sort.key]) * m) }));
  }, [aggs, sort]);

  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  const drillRows = useMemo(() => (drill ? genIndividuals(instance, Math.min(drill.dots, 80)) : []), [drill, instance]);

  // Illustrative funnel (sample). Shortlisted/Placed shown as sample until the DB logs those events.
  const funnel = [
    { name: "Onboarded", value: realTotal, pct: 100 },
    { name: "Applied (≥1 job)", value: totals.applied, pct: pctOf(totals.applied, realTotal) },
    { name: "Shortlisted", value: Math.round(totals.applied * 0.27), pct: pctOf(Math.round(totals.applied * 0.27), realTotal) },
    { name: "Placed", value: Math.round(totals.applied * 0.08), pct: pctOf(Math.round(totals.applied * 0.08), realTotal) },
  ];

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2.5 text-right font-medium">
      <button type="button" onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>
        {label}<ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
  const Row = ({ n, kind, onClick }: { n: Node; kind: "agg" | "coord"; onClick: () => void }) => (
    <tr className={cn("border-t cursor-pointer", kind === "coord" ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30")} onClick={onClick}>
      <td className="px-3 py-2.5">
        {kind === "agg" ? (
          <span className="flex items-center gap-2 font-medium">
            {expanded.has(n.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Building2 className="h-4 w-4 text-brand" />{n.name}
          </span>
        ) : (
          <span className="flex items-center gap-2 pl-6">
            <span className="h-1.5 w-1.5 rounded-full bg-brand/60" />
            <span className={cn(n.quiet ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground")}>{n.name}</span>
            {n.quiet && <span className="text-[11px] text-amber-600 dark:text-amber-400">· 0 new</span>}
            <span className="text-[11px] text-muted-foreground underline decoration-dotted">dots</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-muted-foreground">{kind === "agg" ? fmtN((n as AggNode).coordinators.length) : "—"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtN(n.dots)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{n.new7d === 0 ? <span className="text-amber-600 dark:text-amber-400">0</span> : fmtN(n.new7d)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{pctOf(n.active, n.dots)}%</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{pctOf(n.inactive, n.dots)}%</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-2">
          {n.trend >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
          <div className="h-2 w-20 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", actColor(n.activity))} style={{ width: `${n.activity}%` }} /></div>
          <span className="tabular-nums font-medium w-6 text-right">{n.activity}</span>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">My Bluedots</h1>
        <Badge variant="secondary" className="bg-brand-soft text-brand">{district} · {instance}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]"><Clock className="h-4 w-4 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">This week</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">District monitor — Blue Dots across every partner organisation in {district}.</p>

      {/* Preview banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-amber-800 dark:text-amber-300"><span className="font-medium">Preview.</span> District totals use the live count ({fmtN(realTotal)}); the organisation / coordinator split, trends and shortlisted/placed are sample until the Blue Dots database is connected.</p>
      </div>

      {/* BAND 1 — District health */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">District health</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Total Blue Dots" value={fmtN(realTotal)} description={<>across {aggs.length} orgs · <Trend v={totals.new7d} unit="new" /></>} Icon={Users} cardClass="bg-gradient-to-br from-muted/50 to-card dark:from-muted/20 dark:to-card" />
          <KpiTile label="Active share" value={`${pctOf(totals.active, totals.dots)}%`} description={<>{fmtN(totals.active)} active · <Trend v={1.2} /></>} Icon={Layers} cardClass="bg-gradient-to-br from-blue-50 to-card dark:from-blue-950/20 dark:to-card" />
          <KpiTile label="Applied" value={`${pctOf(totals.applied, totals.dots)}%`} description={<>{fmtN(totals.applied)} applied · <Trend v={2} /></>} Icon={Send} cardClass="bg-gradient-to-br from-emerald-50 to-card dark:from-emerald-950/20 dark:to-card" />
          <KpiTile label="Shortlisted / placed" value={`${pctOf(funnel[3].value, realTotal)}%`} description={<>{fmtN(funnel[3].value)} placed · <Trend v={-0.4} /></>} Icon={UserPlus} cardClass="bg-gradient-to-br from-muted/50 to-card dark:from-muted/20 dark:to-card" />
        </div>
      </div>

      {/* BAND 2 — Needs attention */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Needs attention</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {attention.map((a, i) => (
            <div key={i} className={cn("flex items-start gap-3 rounded-xl border bg-card p-4", a.tone === "danger" ? "bg-rose-500/5" : "bg-amber-500/5")}>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", a.tone === "danger" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                {a.tone === "danger" ? <TrendingDown className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div><div className="text-sm font-medium leading-tight">{a.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{a.sub}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* BAND 3 — Organisation leaderboard */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisations</div>
          <div className="text-xs text-muted-foreground">ranked by activity · expand for coordinators · click a coordinator for individuals</div>
        </div>
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Organisation / Coordinator</th>
                <th className="px-3 py-2.5 text-right font-medium">Coords</th>
                <SortTh k="dots" label="Blue Dots" />
                <SortTh k="new7d" label="New" />
                <th className="px-3 py-2.5 text-right font-medium">Active %</th>
                <th className="px-3 py-2.5 text-right font-medium">Inactive %</th>
                <SortTh k="activity" label="Activity" />
              </tr>
            </thead>
            <tbody>
              {sortedAggs.map((a) => (
                <Fragment key={a.id}>
                  <Row n={a} kind="agg" onClick={() => toggle(a.id)} />
                  {expanded.has(a.id) && a.coordinators.map((c) => <Row key={c.id} n={c} kind="coord" onClick={() => setDrill(c)} />)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAND 4 — District funnel */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">District funnel</div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          {funnel.map((f) => (
            <div key={f.name} className="flex items-center gap-4">
              <div className="w-36 text-sm text-muted-foreground shrink-0">{f.name}</div>
              <div className="flex-1 h-7 rounded-lg bg-muted overflow-hidden"><div className="h-full rounded-lg bg-brand" style={{ width: `${Math.max(f.pct, 1)}%` }} /></div>
              <div className="w-32 text-right text-sm tabular-nums shrink-0"><span className="font-semibold">{fmtN(f.value)}</span> <span className="text-muted-foreground">{f.pct}%</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Coordinator drill-down */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{drill?.name}</DialogTitle>
            <DialogDescription>{drill ? `${fmtN(drill.dots)} Blue Dots · ${pctOf(drill.active, drill.dots)}% active · showing a sample of ${fmtN(Math.min(drill.dots, 80))}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[460px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Seeker</th><th className="px-3 py-2 font-medium">Joined</th><th className="px-3 py-2 font-medium">Role Wanted</th><th className="px-3 py-2 font-medium">Education</th><th className="px-3 py-2 font-medium text-right">Apps</th><th className="px-3 py-2 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {drillRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2"><div className="font-mono text-xs text-primary">{r.id}</div><div className="text-[11px] text-muted-foreground">{r.city}</div></td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.joined}</td>
                    <td className="px-3 py-2">{r.role}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.education}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.applications}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={`rounded-full ${LC_BADGE[r.lifecycle]}`}>{r.lifecycle}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
