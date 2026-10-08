import { useMemo, useState, type ReactNode } from "react";
import {
  Users, UserPlus, User, Layers, Sparkles, AlertTriangle, PauseCircle, RefreshCw,
  TrendingUp, TrendingDown, Minus, Info, ArrowUpDown, Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
// Sample totals for a single aggregator org (one org, not the whole district).
const ORG_SEEKER_TOTAL: Record<string, number> = { UP: 5120, KA: 7836 };
const ORG_PROVIDER_TOTAL: Record<string, number> = { UP: 214, KA: 318 };
const CITIES: Record<string, string[]> = { UP: ["Ghaziabad", "Modinagar", "Loni", "Muradnagar", "Dasna", "Pilkhuwa"], KA: ["Hubli", "Dharwad", "Kalghatgi", "Kundgol", "Navalgund", "Annigeri"] };
const ROLES = ["Delivery Executive", "Data Entry Operator", "Electrician", "Sales Executive", "Security Guard", "Machine Operator", "Tailor", "Driver", "Telecaller", "Housekeeping"];
const EDU = ["Below 10th", "10th Pass", "12th Pass", "ITI", "Diploma", "Graduate"];
const AV = ["bg-amber-500", "bg-rose-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-cyan-600", "bg-fuchsia-500", "bg-indigo-500"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const fmtN = (n: number) => n.toLocaleString("en-IN");
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface Coord { id: string; name: string; dots: number; new7d: number; active: number; inactive: number; applied: number; activity: number; trend: number; quiet: boolean; }
function makeCoord(instance: string, idx: number, dots: number): Coord {
  const quiet = Math.random() < 0.12;
  const new7d = quiet ? 0 : Math.round(dots * (0.005 + Math.random() * 0.04));
  const active = Math.round(dots * (0.06 + Math.random() * 0.09));
  const inactive = Math.round(dots * (0.6 + Math.random() * 0.22));
  const applied = Math.round(dots * (0.45 + Math.random() * 0.2));
  const activity = clamp(Math.round((active / dots / 0.15) * 55 + (new7d / dots / 0.045) * 35 + 6), 6, 100);
  const trend = quiet ? -(2 + Math.floor(Math.random() * 7)) : Math.round(Math.random() * 16 - 8);
  return { id: `${instance}-C${idx}`, name: `CRD-${instance}-${String(idx + 1).padStart(3, "0")}`, dots, new7d, active, inactive, applied, activity, trend, quiet };
}
function splitInto(total: number, parts: number, min: number): number[] {
  const w = Array.from({ length: parts }, () => 0.5 + Math.random());
  const ws = w.reduce((a, b) => a + b, 0); const out: number[] = []; let rem = total;
  for (let i = 0; i < parts; i++) { const v = i === parts - 1 ? Math.max(min, rem) : Math.max(min, Math.round((total * w[i]) / ws)); out.push(v); rem -= v; }
  return out;
}
function genCoordinators(instance: string, total: number): Coord[] {
  const cCount = 4 + Math.floor(Math.random() * 4);
  let ci = 0;
  return splitInto(total, cCount, Math.max(10, Math.floor(total / (cCount * 4)))).map((d) => makeCoord(instance, ci++, d));
}

interface Indiv { id: string; color: string; joined: string; lastSeen: string; role: string; education: string; applications: number; lifecycle: string; completion: number; city: string; }
function genIndividuals(instance: string, n: number): Indiv[] {
  const cities = CITIES[instance] ?? CITIES.UP; const now = Date.now();
  return Array.from({ length: n }, () => {
    const daysAgo = Math.floor(Math.random() * 240);
    const apps = Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 8);
    const lastApply = apps > 0 ? Math.floor(Math.random() * 180) : null;
    let lifecycle = "Inactive";
    if (daysAgo <= 7) lifecycle = "New"; else if (lastApply !== null && lastApply <= 30) lifecycle = "Active"; else if (lastApply !== null && lastApply <= 90) lifecycle = "At Risk";
    const d = new Date(now - daysAgo * 86400000);
    const seen = 1 + Math.floor(Math.random() * 20);
    return { id: `${instance}-${100000 + Math.floor(Math.random() * 899999)}`, color: pick(AV), joined: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, lastSeen: `last seen ${seen}d ago`, role: pick(ROLES), education: pick(EDU), applications: apps, lifecycle, completion: pick([100, 100, 100, 80, 60, 40]), city: pick(cities) };
  });
}

const LC_BADGE: Record<string, string> = {
  New: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Active: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "At Risk": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Inactive: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};
const actColor = (a: number) => (a >= 60 ? "bg-emerald-500" : a >= 40 ? "bg-amber-500" : "bg-rose-500");
const LIFECYCLE: { key: "new7d" | "active" | "atRiskN" | "inactive"; label: string; desc: string; icon: typeof Users; tint: string; icon_c: string; num_c: string }[] = [
  { key: "new7d", label: "New", desc: "Joined within the last 7 days", icon: Sparkles, tint: "from-emerald-50 to-card dark:from-emerald-950/20 dark:to-card", icon_c: "text-emerald-600 dark:text-emerald-400", num_c: "text-emerald-600 dark:text-emerald-400" },
  { key: "active", label: "Active", desc: "Applied to a job in the last 30 days", icon: Users, tint: "from-blue-50 to-card dark:from-blue-950/20 dark:to-card", icon_c: "text-blue-600 dark:text-blue-400", num_c: "text-blue-600 dark:text-blue-400" },
  { key: "atRiskN", label: "At Risk", desc: "No applications for 30–90 days", icon: AlertTriangle, tint: "from-amber-50 to-card dark:from-amber-950/20 dark:to-card", icon_c: "text-amber-500", num_c: "text-amber-600 dark:text-amber-400" },
  { key: "inactive", label: "Inactive", desc: "No activity 90+ days", icon: PauseCircle, tint: "from-rose-50 to-card dark:from-rose-950/20 dark:to-card", icon_c: "text-rose-500", num_c: "text-rose-500 dark:text-rose-400" },
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

export function AggregatorBluedots({ orgName, district }: { orgName: string; district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const [view, setView] = useState<"all" | "seeker" | "provider">("all");
  const seekerTotal = ORG_SEEKER_TOTAL[instance] ?? 0;
  const providerTotal = ORG_PROVIDER_TOTAL[instance] ?? 0;
  const realTotal = view === "seeker" ? seekerTotal : view === "provider" ? providerTotal : seekerTotal + providerTotal;
  const typeLabel = view === "provider" ? "Providers" : view === "seeker" ? "Seekers" : "Participants";

  const coords = useMemo(() => genCoordinators(instance, realTotal), [instance, realTotal]);
  const [drill, setDrill] = useState<Coord | null>(null);
  const [period, setPeriod] = useState("7");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "activity", dir: "desc" });

  const t = useMemo(() => {
    const o = { new7d: 0, active: 0, inactive: 0, applied: 0 };
    for (const c of coords) { o.new7d += c.new7d; o.active += c.active; o.inactive += c.inactive; o.applied += c.applied; }
    return o;
  }, [coords]);
  const atRisk = Math.max(0, realTotal - t.new7d - t.active - t.inactive);
  const lcVal: Record<string, number> = { new7d: t.new7d, active: t.active, atRiskN: atRisk, inactive: t.inactive };

  const attention = useMemo(() => {
    const quiet = coords.filter((c) => c.quiet);
    const worst = [...coords].sort((a, b) => a.activity - b.activity)[0];
    const items: { tone: "danger" | "warn"; title: string; sub: string }[] = [];
    if (worst) items.push({ tone: "danger", title: worst.trend === 0 ? `${worst.name} — activity flat` : `${worst.name} — activity ${worst.trend > 0 ? "▲" : "▼"} ${Math.abs(worst.trend)} pts`, sub: `lowest coordinator · ${pctOf(worst.inactive, worst.dots)}% inactive` });
    if (quiet.length) items.push({ tone: "warn", title: `${quiet.length} coordinator${quiet.length > 1 ? "s" : ""} · 0 new onboards`, sub: quiet.slice(0, 2).map((c) => c.name).join(", ") + (quiet.length > 2 ? "…" : "") });
    items.push({ tone: "warn", title: `Inactive share ${pctOf(t.inactive, realTotal)}%`, sub: "org-wide · re-engagement needed" });
    return items.slice(0, 3);
  }, [coords, t, realTotal]);

  const sorted = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...coords].sort((a, b) => (a[sort.key] - b[sort.key]) * m);
  }, [coords, sort]);
  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  const drillRows = useMemo(() => (drill ? genIndividuals(instance, Math.min(drill.dots, 60)) : []), [drill, instance]);

  const SortTh = ({ k, label, info }: { k: SortKey; label: string; info?: ReactNode }) => (
    <th className="px-3 py-2.5 text-right font-medium">
      <span className="inline-flex items-center gap-1 justify-end">
        <button type="button" onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>{label}<ArrowUpDown className="h-3 w-3 opacity-60" /></button>
        {info && (
          <TooltipProvider delayDuration={100}><Tooltip>
            <TooltipTrigger asChild><button type="button" aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-w-[260px] text-left text-xs font-normal normal-case tracking-normal leading-relaxed">{info}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </span>
    </th>
  );
  const TrendIcon = ({ v }: { v: number }) => v === 0 ? <Minus className="h-3.5 w-3.5 text-muted-foreground" /> : v > 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">My Blue Dots</h1><Badge variant="secondary" className="bg-brand-soft text-brand">{orgName} · {instance}</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">Track every participant in your network — at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Participant type" className="inline-flex rounded-lg bg-muted p-1">
            {(["all", "seeker", "provider"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors", view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{v}</button>
            ))}
          </div>
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">This week</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Add Participants</Button>
        </div>
      </div>

      {/* Preview banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" /><p className="text-amber-800 dark:text-amber-300"><span className="font-medium">Preview.</span> All figures are sample data until the Blue Dots database is connected.</p></div>

      {/* Participants summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <div className="h-11 w-11 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><Users className="h-5 w-5" /></div>
        <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{typeLabel}</div><div className="text-xl font-bold tabular-nums">{fmtN(realTotal)} total</div></div>
        <div className="hidden sm:block h-9 w-px bg-border mx-1" />
        <div className="text-sm text-muted-foreground">Lifecycle and profile health across {orgName}.</div>
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
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", a.tone === "danger" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>{a.tone === "danger" ? <TrendingDown className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div>
              <div><div className="text-sm font-medium leading-tight">{a.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{a.sub}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage metric group */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Coverage</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricTile label="Coordinators" value={fmtN(coords.length)} caption="In your network" Icon={Layers} />
          <MetricTile label="Avg Blue Dots / Coordinator" value={fmtN(Math.round(realTotal / Math.max(1, coords.length)))} caption="Managed each" Icon={Users} />
          <MetricTile label="Applied" value={`${pctOf(t.applied, realTotal)}%`} caption={`${fmtN(t.applied)} with submissions`} Icon={Send} />
        </div>
      </div>

      {/* By coordinator rollup */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By coordinator</div>
          <div className="text-xs text-muted-foreground">{coords.length} coordinators · ranked by activity · click a row for their Blue Dots</div>
        </div>
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Coordinator</th>
                <SortTh k="dots" label="Blue Dots" /><SortTh k="new7d" label="New" />
                <th className="px-3 py-2.5 text-right font-medium">Active %</th><th className="px-3 py-2.5 text-right font-medium">Inactive %</th>
                <SortTh k="activity" label="Activity" info={
                  <div className="space-y-1.5">
                    <div><span className="font-medium text-foreground">Activity score (0–100)</span> — blends recent onboarding, active share, and the trend vs the previous period.</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 60+ · healthy</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> 40–59 · slipping</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> below 40 · low</div>
                    <div>Arrow shows the change vs last period: ▲ up · ▼ down · – flat.</div>
                  </div>
                } />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => setDrill(c)}>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand/60" />
                      <span className={cn(c.quiet ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground font-medium")}>{c.name}</span>
                      {c.quiet && <span className="text-[11px] text-amber-600 dark:text-amber-400">· 0 new</span>}
                      <span className="text-[11px] text-muted-foreground underline decoration-dotted">dots</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtN(c.dots)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.new7d === 0 ? <span className="text-amber-600 dark:text-amber-400">0</span> : fmtN(c.new7d)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{pctOf(c.active, c.dots)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{pctOf(c.inactive, c.dots)}%</td>
                  <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-2"><TrendIcon v={c.trend} /><div className="h-2 w-20 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", actColor(c.activity))} style={{ width: `${c.activity}%` }} /></div><span className="tabular-nums font-medium w-6 text-right">{c.activity}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coordinator drill-down */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{drill?.name}</DialogTitle><DialogDescription>{drill ? `${fmtN(drill.dots)} Blue Dots · ${pctOf(drill.active, drill.dots)}% active · sample of ${fmtN(Math.min(drill.dots, 60))}` : ""}</DialogDescription></DialogHeader>
          <div className="max-h-[500px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Participant</th><th className="px-4 py-2.5 font-medium">Joined</th><th className="px-4 py-2.5 font-medium">Profile status</th><th className="px-4 py-2.5 font-medium">Role wanted</th><th className="px-4 py-2.5 text-right font-medium">Apps</th><th className="px-4 py-2.5 font-medium">Lifecycle</th></tr></thead>
              <tbody>
                {drillRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5"><div className="flex items-center gap-3"><div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0", r.color)}><User className="h-4 w-4" /></div><div><div className="font-mono text-xs font-medium text-foreground">{r.id}</div><div className="text-[11px] text-muted-foreground">{r.city}</div></div></div></td>
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
