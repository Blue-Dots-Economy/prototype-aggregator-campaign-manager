import { useMemo, useState, type ReactNode } from "react";
import {
  Users, Layers, Sparkles, AlertTriangle, PauseCircle, RefreshCw,
  TrendingDown, Info, ArrowUpDown, Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveRollup, useLiveMembers, Freshness, MemberLoading, nodeFor, LiveState, MemberTable, type LiveNode } from "./live-rollup";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { coverageFor } from "@/lib/rollup.view";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
const AV = ["bg-muted text-muted-foreground"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtN = (n: number) => n.toLocaleString("en-IN");
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

type Coord = LiveNode;
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
  const liveQ = useLiveRollup(instance, orgName);
  const liveOrg = liveQ.orgs[0] ?? null;
  const liveStats = liveOrg ? nodeFor(liveOrg, view) : null;
  const realTotal = liveStats?.dots ?? 0;
  const typeLabel = view === "provider" ? "Providers" : view === "seeker" ? "Seekers" : "Participants";
  const coords = useMemo(() => liveOrg?.coordinators.map(c => nodeFor(c, view)) ?? [], [liveOrg, view]);
  const [drillId, setDrillId] = useState<string | null>(null);
  const drill = coords.find(c => c.id === drillId) ?? null;
  const setDrill = (c: Coord | null) => setDrillId(c?.id ?? null);
  const membersQ = useLiveMembers(instance, liveOrg?.id, drill?.id, view, !!drill);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "dots", dir: "desc" });
  const coverage = coverageFor(coords);
  const lcVal: Record<string, number> = { new7d: liveStats?.new7d ?? 0, active: liveStats?.active ?? 0, atRiskN: liveStats?.atRisk ?? 0, inactive: liveStats?.inactive ?? 0 };

  const attention = useMemo(() => {
    const quiet = coords.filter((c) => c.quiet);
    const worst = coords.filter(c => c.dots > 0).sort((a, b) => a.activity - b.activity)[0];
    const items: { tone: "danger" | "warn"; title: string; sub: string }[] = [];
    if (worst) items.push({ tone: "danger", title: `${worst.name} — activity ${worst.activity}`, sub: `lowest coordinator · ${pctOf(worst.inactive, worst.dots)}% inactive` });
    if (quiet.length) items.push({ tone: "warn", title: `${quiet.length} coordinator${quiet.length > 1 ? "s" : ""} · 0 new onboards`, sub: quiet.slice(0, 2).map((c) => c.name).join(", ") + (quiet.length > 2 ? "…" : "") });
    items.push({ tone: "warn", title: `Inactive share ${pctOf(liveStats?.inactive ?? 0, realTotal)}%`, sub: "org-wide · re-engagement needed" });
    return items.slice(0, 3);
  }, [coords, liveStats, realTotal]);

  const sorted = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...coords].sort((a, b) => (a[sort.key] - b[sort.key]) * m);
  }, [coords, sort]);
  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  const SortTh = ({ k, label, info }: { k: SortKey; label: string; info?: ReactNode }) => (
    <th className="px-3 py-2.5 text-right font-medium">
      <span className="inline-flex items-center gap-1 justify-end">
        <Button variant="ghost" size="sm" type="button" onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>{label}<ArrowUpDown className="h-3 w-3 opacity-60" /></Button>
        {info && (
          <TooltipProvider delayDuration={100}><Tooltip>
            <TooltipTrigger asChild><Button variant="ghost" size="sm" type="button" aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></Button></TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-w-[260px] text-left text-xs font-normal normal-case tracking-normal leading-relaxed">{info}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </span>
    </th>
  );

  if (liveQ.loading) return <LiveState loading retry={liveQ.retry} />;
  if (!liveQ.available || liveQ.isError) return <LiveState loading={false} retry={liveQ.retry} />;
  if (!liveOrg) return <LiveState loading={false} retry={liveQ.retry} empty="No Blue Dots data for this account yet" />;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">My Blue Dots</h1><Badge variant="secondary" className="bg-brand-soft text-brand"><span className="break-all" title={liveOrg.id}>{liveOrg.name}</span> · {instance}</Badge></div>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Participant type" className="inline-flex rounded-lg bg-muted p-1">
            {(["all", "seeker", "provider"] as const).map((v) => (
              <Button variant="ghost" size="sm" key={v} type="button" onClick={() => { setView(v); setSort({ key: "dots", dir: "desc" }); }} aria-pressed={view === v}
                className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors", view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{v}</Button>
            ))}
          </div>
        </div>
      </div>

      {liveOrg.name === liveOrg.id && <p className="text-xs text-muted-foreground">Orgs without a registered name shown by org id.</p>}

      {/* Participants summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <div className="h-11 w-11 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><Users className="h-5 w-5" /></div>
        <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{typeLabel}</div><div className="text-xl font-bold tabular-nums">{fmtN(realTotal)} total</div></div>
        <div className="hidden sm:block h-9 w-px bg-border mx-1" />
        <div className="text-sm text-muted-foreground">Lifecycle across {liveOrg && liveOrg.name !== liveOrg.id ? liveOrg.name : orgName}.</div>
        <div className="ml-auto flex flex-wrap items-center gap-3"><Freshness updatedAt={liveQ.updatedAt} error={liveQ.refreshError} /><Button variant="outline" size="sm" onClick={liveQ.refresh} disabled={liveQ.isFetching || liveQ.refreshing} className="gap-2"><RefreshCw className={cn("h-4 w-4", liveQ.refreshing && "animate-spin")} /> Refresh</Button></div>
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
          <MetricTile label="Coordinators" value={fmtN(coverage.count)} caption={`With ${typeLabel.toLowerCase()}`} Icon={Layers} />
          <MetricTile label="Avg Blue Dots / Coordinator" value={fmtN(coverage.average)} caption="Per unit with participants" Icon={Users} />
          <MetricTile label="Applied" value={`${pctOf(liveStats?.applied ?? 0, realTotal)}%`} caption={`${fmtN(liveStats?.applied ?? 0)} with submissions`} Icon={Send} />
        </div>
      </div>

      {/* By coordinator rollup */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By coordinator</div>
          <div className="text-xs text-muted-foreground">{coords.length} coordinators</div>
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
                    <div><span className="font-medium text-foreground">Activity score (0–100)</span> — blends recent onboarding (last 7 days) and active share.</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 60+ · healthy</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> 40–59 · slipping</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> below 40 · low</div>
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
                  <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-2"><Progress className="w-20" value={c.activity} /><span className="tabular-nums font-medium w-6 text-right">{c.activity}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coordinator drill-down */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{drill?.name}</DialogTitle><DialogDescription>{drill ? `${fmtN(drill.dots)} Blue Dots · ${pctOf(drill.active, drill.dots)}% active · showing ${fmtN(membersQ.data?.length ?? 0)} real participants` : ""}</DialogDescription></DialogHeader>
          <MemberLoading loading={membersQ.isPending} error={membersQ.isError} retry={() => void membersQ.refetch()} />
          {membersQ.isSuccess && <MemberTable members={membersQ.data} avatarClasses={AV} months={MONTHS} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
