import { Fragment, useMemo, useState } from "react";
import {
  Users, UserPlus, AlertTriangle, PauseCircle, Send, Info,
  ChevronRight, ChevronDown, Layers, Building2, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Lifecycle = "New" | "Active" | "At Risk" | "Inactive";

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

interface CoordNode { id: string; name: string; dots: number; newC: number; active: number; atRisk: number; inactive: number; applied: number; }
interface AggNode { id: string; name: string; coordinators: CoordNode[]; dots: number; newC: number; active: number; atRisk: number; inactive: number; applied: number; }

function makeCoord(instance: string, idx: number, dots: number): CoordNode {
  const j = () => 0.8 + Math.random() * 0.4;
  const newC = Math.round(dots * 0.03 * j());
  const active = Math.round(dots * 0.09 * j());
  const atRisk = Math.round(dots * 0.19 * j());
  const inactive = Math.max(0, dots - newC - active - atRisk);
  const applied = Math.round(dots * (0.45 + Math.random() * 0.2));
  return { id: `${instance}-C${idx}`, name: `${pick(FIRST)} ${pick(LAST)}`, dots, newC, active, atRisk, inactive, applied };
}

function splitInto(total: number, parts: number, min: number): number[] {
  const w = Array.from({ length: parts }, () => 0.5 + Math.random());
  const ws = w.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let rem = total;
  for (let i = 0; i < parts; i++) {
    const v = i === parts - 1 ? Math.max(min, rem) : Math.max(min, Math.round((total * w[i]) / ws));
    out.push(v);
    rem -= v;
  }
  return out;
}

function genHierarchy(instance: string, realTotal: number): AggNode[] {
  const names = AGG_NAMES[instance] ?? AGG_NAMES.UP;
  const aggCount = Math.min(names.length, 5 + Math.floor(Math.random() * 2));
  const aggTotals = splitInto(realTotal, aggCount, 200);
  let coordIdx = 0;
  return aggTotals.map((aggTotal, i) => {
    const cCount = 2 + Math.floor(Math.random() * 5);
    const coordDots = splitInto(aggTotal, cCount, 20);
    const coordinators = coordDots.map((d) => makeCoord(instance, coordIdx++, d));
    const sum = (k: keyof CoordNode) => coordinators.reduce((a, c) => a + (c[k] as number), 0);
    return {
      id: `${instance}-A${i}`, name: names[i % names.length], coordinators,
      dots: sum("dots"), newC: sum("newC"), active: sum("active"), atRisk: sum("atRisk"), inactive: sum("inactive"), applied: sum("applied"),
    };
  });
}

// Sample individuals for the coordinator drill-down.
interface Indiv { id: string; joined: string; role: string; education: string; experience: string; applications: number; lifecycle: Lifecycle; city: string; }
function genIndividuals(instance: string, n: number): Indiv[] {
  const cities = CITIES[instance] ?? CITIES.UP;
  const now = Date.now();
  return Array.from({ length: n }, () => {
    const daysAgo = Math.floor(Math.random() * 240);
    const apps = Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 8);
    const lastApply = apps > 0 ? Math.floor(Math.random() * 180) : null;
    let lifecycle: Lifecycle;
    if (daysAgo <= 7) lifecycle = "New";
    else if (lastApply !== null && lastApply <= 30) lifecycle = "Active";
    else if (lastApply !== null && lastApply <= 90) lifecycle = "At Risk";
    else lifecycle = "Inactive";
    const d = new Date(now - daysAgo * 86400000);
    return {
      id: `${instance}-${100000 + Math.floor(Math.random() * 899999)}`,
      joined: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      role: pick(ROLES), education: pick(EDU), experience: pick(EXP), applications: apps, lifecycle, city: pick(cities),
    };
  });
}

const LC_BADGE: Record<Lifecycle, string> = {
  New: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Active: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "At Risk": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Inactive: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

const LIFECYCLE_CARDS: { key: "newC" | "active" | "atRisk" | "inactive"; label: Lifecycle; desc: string; icon: typeof Users; iconClass: string; valueClass: string; accent: string }[] = [
  { key: "newC", label: "New", desc: "Joined ≤ 7 days ago", icon: UserPlus, iconClass: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10", valueClass: "text-emerald-600", accent: "bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-transparent" },
  { key: "active", label: "Active", desc: "Applied ≤ 30 days ago", icon: Users, iconClass: "border-blue-500/30 text-blue-600 bg-blue-500/10", valueClass: "text-blue-600", accent: "bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-transparent" },
  { key: "atRisk", label: "At Risk", desc: "Last applied 31–90 days", icon: AlertTriangle, iconClass: "border-amber-500/30 text-amber-500 bg-amber-500/10", valueClass: "text-amber-600", accent: "bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-transparent" },
  { key: "inactive", label: "Inactive", desc: "Applied > 90 days or never", icon: PauseCircle, iconClass: "border-rose-500/30 text-rose-500 bg-rose-500/10", valueClass: "text-rose-600", accent: "bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-transparent" },
];


function KpiTile({ label, value, description, Icon, cardClass, iconClass, valueClass }: { label: string; value: string; description: string; Icon: typeof Users; cardClass?: string; iconClass?: string; valueClass?: string }) {
  return (
    <div className={cn("rounded-xl border p-5 bg-card", cardClass)}>
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground", iconClass)}><Icon className="h-4 w-4" /></div>
        <div className="text-sm font-medium leading-tight">{label}</div>
      </div>
      <div className={cn("mt-4 text-4xl font-semibold tracking-tight tabular-nums", valueClass)}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}


export function DistrictBluedots({ district }: { district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const realTotal = REAL_TOTAL[instance] ?? 0;
  const aggs = useMemo(() => genHierarchy(instance, realTotal), [instance, realTotal]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [drill, setDrill] = useState<CoordNode | null>(null);

  const totals = useMemo(() => {
    const t = { dots: 0, newC: 0, active: 0, atRisk: 0, inactive: 0, applied: 0, coords: 0 };
    for (const a of aggs) {
      t.dots += a.dots; t.newC += a.newC; t.active += a.active; t.atRisk += a.atRisk; t.inactive += a.inactive; t.applied += a.applied; t.coords += a.coordinators.length;
    }
    return t;
  }, [aggs]);

  const filteredAggs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return aggs;
    return aggs
      .map((a) => {
        const nameHit = a.name.toLowerCase().includes(q);
        const coords = a.coordinators.filter((c) => c.name.toLowerCase().includes(q));
        if (nameHit) return a;
        if (coords.length) return { ...a, coordinators: coords };
        return null;
      })
      .filter(Boolean) as AggNode[];
  }, [aggs, search]);

  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const drillRows = useMemo(() => (drill ? genIndividuals(instance, Math.min(drill.dots, 80)) : []), [drill, instance]);

  const Num = ({ v, muted }: { v: number; muted?: boolean }) => <td className={cn("px-3 py-2.5 text-right tabular-nums", muted && "text-muted-foreground")}>{fmtN(v)}</td>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">My Bluedots</h1>
            <Badge variant="secondary" className="bg-brand-soft text-brand">{district} · {instance}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">District rollup — Blue Dots aggregated by aggregator owner and coordinator across {district}.</p>
        </div>
        <Button className="gap-2"><UserPlus className="h-4 w-4" /> Add Participants</Button>
      </div>

      {/* Preview banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-amber-800 dark:text-amber-300">
          <span className="font-medium">Preview.</span> District totals use the live count ({fmtN(realTotal)} for {district}); the aggregator / coordinator grouping is sample data until the Blue Dots database is connected.
        </p>
      </div>

      {/* District KPIs */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">District totals</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Total Blue Dots" value={fmtN(realTotal)} description="Onboarded across the district (live)" Icon={Users} cardClass="bg-gradient-to-br from-muted/50 to-card dark:from-muted/20 dark:to-card" />
          <KpiTile label="Aggregator Owners" value={fmtN(aggs.length)} description="Partner organisations" Icon={Building2} cardClass="bg-gradient-to-br from-muted/50 to-card dark:from-muted/20 dark:to-card" />
          <KpiTile label="Coordinators" value={fmtN(totals.coords)} description="Across all aggregators" Icon={Layers} cardClass="bg-gradient-to-br from-muted/50 to-card dark:from-muted/20 dark:to-card" />
          <KpiTile label="Applied (≥1)" value={`${pctOf(totals.applied, totals.dots)}%`} description={`${fmtN(totals.applied)} dots have applied`} Icon={Send} cardClass="bg-gradient-to-br from-muted/50 to-card dark:from-muted/20 dark:to-card" />
        </div>
      </div>


      {/* Lifecycle cards */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Lifecycle</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {LIFECYCLE_CARDS.map((c) => {
            const value = totals[c.key];
            return (
              <KpiTile
                key={c.label}
                label={c.label}
                value={fmtN(value)}
                description={`${pctOf(value, totals.dots)}% of district · ${c.desc}`}
                Icon={c.icon}
                iconClass={c.iconClass}
                valueClass={c.valueClass}
              />
            );
          })}
        </div>
      </div>


      {/* Aggregated breakdown */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div>
            <div className="text-sm font-semibold">Aggregator & coordinator rollup</div>
            <div className="text-xs text-muted-foreground">Expand an aggregator to see its coordinators · click a coordinator to view their Blue Dots</div>
          </div>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search aggregator or coordinator…" className="pl-9 bg-muted/40 border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Aggregator / Coordinator</th>
                <th className="px-3 py-2.5 font-medium text-right">Coordinators</th>
                <th className="px-3 py-2.5 font-medium text-right">Blue Dots</th>
                <th className="px-3 py-2.5 font-medium text-right">New</th>
                <th className="px-3 py-2.5 font-medium text-right">Active</th>
                <th className="px-3 py-2.5 font-medium text-right">At Risk</th>
                <th className="px-3 py-2.5 font-medium text-right">Inactive</th>
                <th className="px-3 py-2.5 font-medium text-right">Applied</th>
                <th className="px-3 py-2.5 font-medium text-right">Applied %</th>
              </tr>
            </thead>
            <tbody>
              {filteredAggs.map((a) => {
                const open = expanded.has(a.id);
                return (
                  <Fragment key={a.id}>
                    <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(a.id)}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 font-medium">
                          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Building2 className="h-4 w-4 text-brand" />
                          {a.name}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtN(a.coordinators.length)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtN(a.dots)}</td>
                      <Num v={a.newC} /><Num v={a.active} /><Num v={a.atRisk} /><Num v={a.inactive} /><Num v={a.applied} />
                      <td className="px-3 py-2.5 text-right tabular-nums">{pctOf(a.applied, a.dots)}%</td>
                    </tr>
                    {open && a.coordinators.map((c) => (
                      <tr key={c.id} className="border-t bg-muted/20 hover:bg-muted/40 cursor-pointer" onClick={() => setDrill(c)}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 pl-6 text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand/60" />
                            <span className="text-foreground">{c.name}</span>
                            <span className="text-[11px] underline decoration-dotted">view dots</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtN(c.dots)}</td>
                        <Num v={c.newC} muted /><Num v={c.active} muted /><Num v={c.atRisk} muted /><Num v={c.inactive} muted /><Num v={c.applied} muted />
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{pctOf(c.applied, c.dots)}%</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {filteredAggs.length === 0 && (
                <tr><td colSpan={9} className="text-center text-sm text-muted-foreground py-10">No aggregators or coordinators match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coordinator drill-down: individual seekers */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{drill?.name}</DialogTitle>
            <DialogDescription>
              {drill ? `${fmtN(drill.dots)} Blue Dots onboarded · showing a sample of ${fmtN(Math.min(drill.dots, 80))}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[460px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Seeker</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                  <th className="px-3 py-2 font-medium">Role Wanted</th>
                  <th className="px-3 py-2 font-medium">Education</th>
                  <th className="px-3 py-2 font-medium text-right">Apps</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
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
