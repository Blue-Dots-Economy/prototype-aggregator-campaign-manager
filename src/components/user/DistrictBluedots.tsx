import { Fragment, useMemo, useState } from "react";
import {
  Users, UserPlus, Building2, Layers, Send, Sparkles, AlertTriangle, PauseCircle,
  RefreshCw, Copy, CheckCircle2, TrendingUp, Activity, ChevronRight, ChevronDown,
  ArrowUpDown, TrendingDown, Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
const REAL_TOTAL: Record<string, number> = { UP: 18772, KA: 28961 };
const AGG_NAMES: Record<string, string[]> = {
  UP: ["Ghaziabad Skills Mission", "Modinagar Livelihoods Trust", "Loni Rozgar Kendra", "Muradnagar Collective", "Dasna Udyog Samiti", "Pilkhuwa Skill Centre"],
  KA: ["Deshpande Foundation", "Hubli Skill Mission", "Dharwad Livelihoods Trust", "Navalgund Collective", "Kundgol Udyog Kendra", "Kalghatgi Rozgar Samiti"],
};
const CITIES: Record<string, string[]> = { UP: ["Ghaziabad", "Modinagar", "Loni", "Muradnagar", "Dasna", "Pilkhuwa"], KA: ["Hubli", "Dharwad", "Kalghatgi", "Kundgol", "Navalgund", "Annigeri"] };
const FIRST = ["Rahul", "Priya", "Amit", "Sunita", "Vikas", "Pooja", "Santosh", "Anjali", "Kiran", "Manoj", "Deepa", "Ravi", "Neha", "Arun", "Kavya", "Suresh"];
const LAST = ["Patil", "Kulkarni", "Sharma", "Verma", "Gowda", "Hegde", "Yadav", "Singh", "Desai", "Naik"];
const ROLES = ["Delivery Executive", "Data Entry Operator", "Electrician", "Sales Executive", "Security Guard", "Machine Operator", "Tailor", "Driver", "Telecaller", "Housekeeping"];
const EDU = ["Below 10th", "10th Pass", "12th Pass", "ITI", "Diploma", "Graduate"];
const AV = ["bg-amber-500", "bg-rose-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-cyan-600", "bg-fuchsia-500", "bg-indigo-500"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const fmtN = (n: number) => n.toLocaleString("en-IN");
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Node { id: string; name: string; dots: number; new7d: number; active: number; inactive: number; applied: number; activity: number; trend: number; quiet: boolean; }
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
  const ws = w.reduce((a, b) => a + b, 0); const out: number[] = []; let rem = total;
  for (let i = 0; i < parts; i++) { const v = i === parts - 1 ? Math.max(min, rem) : Math.max(min, Math.round((total * w[i]) / ws)); out.push(v); rem -= v; }
  return out;
}
function genHierarchy(instance: string, realTotal: number): AggNode[] {
  const names = AGG_NAMES[instance] ?? AGG_NAMES.UP;
  const aggCount = Math.min(names.length, 5 + Math.floor(Math.random() * 2));
  let ci = 0;
  return splitInto(realTotal, aggCount, 200).map((aggTotal, i) => {
    const coordinators = splitInto(aggTotal, 2 + Math.floor(Math.random() * 5), 20).map((d) => makeCoord(instance, ci++, d));
    const sum = (k: keyof Node) => coordinators.reduce((a, c) => a + (c[k] as number), 0);
    const dots = sum("dots");
    const wavg = (k: keyof Node) => Math.round(coordinators.reduce((a, c) => a + (c[k] as number) * c.dots, 0) / (dots || 1));
    return { id: `${instance}-A${i}`, name: names[i % names.length], coordinators, dots, new7d: sum("new7d"), active: sum("active"), inactive: sum("inactive"), applied: sum("applied"), activity: wavg("activity"), trend: wavg("trend"), quiet: false };
  });
}

interface Indiv { id: string; name: string; initials: string; color: string; joined: string; lastSeen: string; role: string; education: string; applications: number; lifecycle: string; completion: number; city: string; }
function genIndividuals(instance: string, n: number): Indiv[] {
  const cities = CITIES[instance] ?? CITIES.UP; const now = Date.now();
  return Array.from({ length: n }, () => {
    const daysAgo = Math.floor(Math.random() * 240);
    const apps = Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 8);
    const lastApply = apps > 0 ? Math.floor(Math.random() * 180) : null;
    let lifecycle = "Inactive";
    if (daysAgo <= 7) lifecycle = "New"; else if (lastApply !== null && lastApply <= 30) lifecycle = "Active"; else if (lastApply !== null && lastApply <= 90) lifecycle = "At Risk";
    const d = new Date(now - daysAgo * 86400000);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const seen = 1 + Math.floor(Math.random() * 20);
    return { id: `${instance}-${100000 + Math.floor(Math.random() * 899999)}`, name, initials: name.split(" ").map((p) => p[0]).join(""), color: pick(AV), joined: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, lastSeen: `last seen ${seen}d ago`, role: pick(ROLES), education: pick(EDU), applications: apps, lifecycle, completion: pick([100, 100, 100, 80, 60, 40]), city: pick(cities) };
  });
}

const LC_BADGE: Record<string, string> = {
  New: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Active: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "At Risk": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Inactive: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};
const actColor = (a: number) => (a >= 60 ? "bg-emerald-500" : a >= 40 ? "bg-amber-500" : "bg-rose-500");

// Lifecycle cards — Agg DPG style: soft tint + big coloured number + white icon square + descriptive sub-text.
const LIFECYCLE: { key: "new7d" | "active" | "atRiskN" | "inactive"; label: string; desc: string; icon: typeof Users; tint: string; icon_c: string; num_c: string }[] = [
  { key: "new7d", label: "New", desc: "Joined within the last 7 days", icon: Sparkles, tint: "from-emerald-50 to-card dark:from-emerald-950/20 dark:to-card", icon_c: "text-emerald-600 dark:text-emerald-400", num_c: "text-emerald-600 dark:text-emerald-400" },
  { key: "active", label: "Active", desc: "Applied to a job in the last 30 days", icon: Users, tint: "from-blue-50 to-card dark:from-blue-950/20 dark:to-card", icon_c: "text-blue-600 dark:text-blue-400", num_c: "text-blue-600 dark:text-blue-400" },
  { key: "atRiskN", label: "At Risk", desc: "No applications for 30–90 days", icon: AlertTriangle, tint: "from-amber-50 to-card dark:from-amber-950/20 dark:to-card", icon_c: "text-amber-500", num_c: "text-amber-600 dark:text-amber-400" },
  { key: "inactive", label: "Inactive", desc: "No activity 90+ days", icon: PauseCircle, tint: "from-rose-50 to-card dark:from-rose-950/20 dark:to-card", icon_c: "text-rose-500", num_c: "text-rose-600 dark:text-rose-400" },
];

function MetricTile({ label, value, caption, Icon }: { label: string; value: string; caption: string; Icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-sm font-medium">{label}</span></div>
      <div className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{caption}</div>
    </div>
  );
}
type SortKey = "activity" | "dots" | "new7d";

export function DistrictBluedots({ district }: { district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const realTotal = REAL_TOTAL[instance] ?? 0;
  const aggs = useMemo(() => genHierarchy(instance, realTotal), [instance, realTotal]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<Node | null>(null);
  const [period, setPeriod] = useState("7");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "activity", dir: "desc" });

  const t = useMemo(() => {
    const o = { dots: 0, new7d: 0, active: 0, inactive: 0, applied: 0, coords: 0 };
    for (const a of aggs) { o.dots += a.dots; o.new7d += a.new7d; o.active += a.active; o.inactive += a.inactive; o.applied += a.applied; o.coords += a.coordinators.length; }
    return o;
  }, [aggs]);
  const atRisk = Math.max(0, realTotal - t.new7d - t.active - t.inactive);
  const lcVal: Record<string, number> = { new7d: t.new7d, active: t.active, atRiskN: atRisk, inactive: t.inactive };
  const users = Math.max(1, Math.round(realTotal / 2.6));

  const attention = useMemo(() => {
    const quietCoords = aggs.flatMap((a) => a.coordinators).filter((c) => c.quiet);
    const worst = [...aggs].sort((a, b) => a.activity - b.activity)[0];
    const items: { tone: "danger" | "warn"; title: string; sub: string }[] = [];
    if (worst) items.push({ tone: "danger", title: worst.trend === 0 ? `${worst.name} — activity flat` : `${worst.name} — activity ${worst.trend > 0 ? "▲" : "▼"} ${Math.abs(worst.trend)} pts`, sub: `lowest in district · ${pctOf(worst.inactive, worst.dots)}% inactive` });
    if (quietCoords.length) items.push({ tone: "warn", title: `${quietCoords.length} coordinator${quietCoords.length > 1 ? "s" : ""} · 0 new onboards`, sub: quietCoords.slice(0, 2).map((c) => c.name).join(", ") + (quietCoords.length > 2 ? "…" : "") });
    items.push({ tone: "warn", title: `Inactive share ${pctOf(t.inactive, t.dots)}%`, sub: "district-wide · re-engagement needed" });
    return items.slice(0, 3);
  }, [aggs, t]);

  const sortedAggs = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...aggs].sort((a, b) => (a[sort.key] - b[sort.key]) * m).map((a) => ({ ...a, coordinators: [...a.coordinators].sort((x, y) => (x[sort.key] - y[sort.key]) * m) }));
  }, [aggs, sort]);
  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  const drillRows = useMemo(() => (drill ? genIndividuals(instance, Math.min(drill.dots, 60)) : []), [drill, instance]);

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>{label}<ArrowUpDown className="h-3 w-3 opacity-60" /></button></th>
  );
  const TrendIcon = ({ v, sz = "h-3.5 w-3.5" }: { v: number; sz?: string }) => v === 0 ? <Minus className={cn(sz, "text-muted-foreground")} /> : v > 0 ? <TrendingUp className={cn(sz, "text-emerald-600 dark:text-emerald-400")} /> : <TrendingDown className={cn(sz, "text-rose-600 dark:text-rose-400")} />;
  const Row = ({ n, kind }: { n: Node; kind: "agg" | "coord" }) => (
    <tr className={cn("border-t cursor-pointer", kind === "coord" ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30")} onClick={() => (kind === "agg" ? toggle(n.id) : setDrill(n))}>
      <td className="px-3 py-2.5">
        {kind === "agg" ? (
          <span className="flex items-center gap-2 font-medium">{expanded.has(n.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}<Building2 className="h-4 w-4 text-brand" />{n.name}</span>
        ) : (
          <span className="flex items-center gap-2 pl-6"><span className="h-1.5 w-1.5 rounded-full bg-brand/60" /><span className={cn(n.quiet ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground")}>{n.name}</span>{n.quiet && <span className="text-[11px] text-amber-600 dark:text-amber-400">· 0 new</span>}<span className="text-[11px] text-muted-foreground underline decoration-dotted">dots</span></span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-muted-foreground">{kind === "agg" ? fmtN((n as AggNode).coordinators.length) : "—"}</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtN(n.dots)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{n.new7d === 0 ? <span className="text-amber-600 dark:text-amber-400">0</span> : fmtN(n.new7d)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{pctOf(n.active, n.dots)}%</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{pctOf(n.inactive, n.dots)}%</td>
      <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-2"><TrendIcon v={n.trend} /><div className="h-2 w-20 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", actColor(n.activity))} style={{ width: `${n.activity}%` }} /></div><span className="tabular-nums font-medium w-6 text-right">{n.activity}</span></div></td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">My Blue Dots</h1><Badge variant="secondary" className="bg-brand-soft text-brand">{district} · {instance}</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">Track every participant across your district — at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">This week</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Add Participants</Button>
        </div>
      </div>

      {/* Preview banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" /><p className="text-amber-800 dark:text-amber-300"><span className="font-medium">Preview.</span> Totals use the live count ({fmtN(realTotal)}); the organisation / coordinator split, trends and activity are sample until the Blue Dots database is connected.</p></div>

      {/* SEEKERS summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <div className="h-11 w-11 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><Users className="h-5 w-5" /></div>
        <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Seekers</div><div className="text-xl font-bold tabular-nums">{fmtN(realTotal)} total</div></div>
        <div className="hidden sm:block h-9 w-px bg-border mx-1" />
        <div className="text-sm text-muted-foreground">Lifecycle and profile health across {district}.</div>
        <Button variant="outline" size="sm" className="ml-auto gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {/* Lifecycle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {LIFECYCLE.map((c) => { const Icon = c.icon; const v = lcVal[c.key]; return (
          <div key={c.label} className={cn("rounded-xl border p-5 bg-gradient-to-b", c.tint)}>
            <div className={cn("h-10 w-10 rounded-lg bg-card border flex items-center justify-center", c.icon_c)}><Icon className="h-5 w-5" /></div>
            <div className={cn("mt-6 text-5xl font-bold tabular-nums", c.num_c)}>{fmtN(v)}</div>
            <div className="mt-2 font-semibold">{c.label}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">{c.desc}</div>
          </div>
        ); })}
      </div>

      {/* Needs attention */}
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

      {/* PROFILES + USERS metric groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Profiles</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricTile label="Profiles Registered" value={fmtN(realTotal)} caption="All seeker records" Icon={Copy} />
            <MetricTile label="Profiles Complete" value={fmtN(realTotal)} caption="100% of all profiles" Icon={CheckCircle2} />
            <MetricTile label="Applied for Jobs" value={fmtN(t.applied)} caption={`${pctOf(t.applied, realTotal)}% with submissions`} Icon={Send} />
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Users</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricTile label="Total Job Seekers" value={fmtN(users)} caption="Unique account holders" Icon={Users} />
            <MetricTile label="Avg Profiles / User" value={(realTotal / users).toFixed(1)} caption="Profiles managed each" Icon={TrendingUp} />
            <MetricTile label="Avg Actions / User" value={(t.applied / users).toFixed(1)} caption="Recorded interactions" Icon={Activity} />
          </div>
        </div>
      </div>

      {/* Organisation → coordinator rollup (district-specific) */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By organisation</div>
          <div className="text-xs text-muted-foreground">{aggs.length} organisations · {t.coords} coordinators · ranked by activity · expand to drill in</div>
        </div>
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2.5 font-medium">Organisation / Coordinator</th><th className="px-3 py-2.5 text-right font-medium">Coords</th><SortTh k="dots" label="Blue Dots" /><SortTh k="new7d" label="New" /><th className="px-3 py-2.5 text-right font-medium">Active %</th><th className="px-3 py-2.5 text-right font-medium">Inactive %</th><SortTh k="activity" label="Activity" /></tr>
            </thead>
            <tbody>
              {sortedAggs.map((a) => (
                <Fragment key={a.id}><Row n={a} kind="agg" />{expanded.has(a.id) && a.coordinators.map((c) => <Row key={c.id} n={c} kind="coord" />)}</Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {/* Coordinator drill-down — Agg DPG participant table style */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{drill?.name}</DialogTitle><DialogDescription>{drill ? `${fmtN(drill.dots)} Blue Dots · ${pctOf(drill.active, drill.dots)}% active · sample of ${fmtN(Math.min(drill.dots, 60))}` : ""}</DialogDescription></DialogHeader>
          <div className="max-h-[500px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Participant</th><th className="px-4 py-2.5 font-medium">Joined</th><th className="px-4 py-2.5 font-medium">Profile status</th><th className="px-4 py-2.5 font-medium">Role wanted</th><th className="px-4 py-2.5 text-right font-medium">Apps</th><th className="px-4 py-2.5 font-medium">Lifecycle</th></tr></thead>
              <tbody>
                {drillRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5"><div className="flex items-center gap-3"><div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0", r.color)}>{r.initials}</div><div><div className="font-medium leading-tight">{r.name}</div><div className="font-mono text-[11px] text-muted-foreground">{r.id} · {r.city}</div></div></div></td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><div className="text-foreground">{r.joined}</div><div className="text-[11px] text-muted-foreground">{r.lastSeen}</div></td>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.completion}%` }} /></div><span className="text-xs tabular-nums text-muted-foreground">{r.completion}%</span></div></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.role}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.applications}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className={`rounded-full ${LC_BADGE[r.lifecycle]}`}>{r.lifecycle}</Badge></td>
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
