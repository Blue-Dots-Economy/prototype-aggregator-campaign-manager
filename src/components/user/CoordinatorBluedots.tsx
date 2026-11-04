import { useMemo, useState } from "react";
import {
  Users, Sparkles, AlertTriangle, PauseCircle, RefreshCw, Search, UserX, SendHorizonal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveRollup, nodeFor, LiveState, MemberTable } from "./live-rollup";
import { cn } from "@/lib/utils";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
const AV = ["bg-muted text-muted-foreground"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAP = 500;

const fmtN = (n: number) => n.toLocaleString("en-IN");
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

const LIFECYCLE: { key: string; label: string; desc: string; icon: typeof Users; tint: string; icon_c: string; num_c: string }[] = [
  { key: "New", label: "New", desc: "Joined within the last 7 days", icon: Sparkles, tint: "from-emerald-50 to-card dark:from-emerald-950/20 dark:to-card", icon_c: "text-emerald-600 dark:text-emerald-400", num_c: "text-emerald-600 dark:text-emerald-400" },
  { key: "Active", label: "Active", desc: "Applied to a job in the last 30 days", icon: Users, tint: "from-blue-50 to-card dark:from-blue-950/20 dark:to-card", icon_c: "text-blue-600 dark:text-blue-400", num_c: "text-blue-600 dark:text-blue-400" },
  { key: "At Risk", label: "At Risk", desc: "No applications for 30–90 days", icon: AlertTriangle, tint: "from-amber-50 to-card dark:from-amber-950/20 dark:to-card", icon_c: "text-amber-500", num_c: "text-amber-600 dark:text-amber-400" },
  { key: "Inactive", label: "Inactive", desc: "No activity 90+ days", icon: PauseCircle, tint: "from-rose-50 to-card dark:from-rose-950/20 dark:to-card", icon_c: "text-rose-500", num_c: "text-rose-500 dark:text-rose-400" },
];

export function CoordinatorBluedots({ coordName, district }: { coordName: string; district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const [view, setView] = useState<"all" | "seeker" | "provider">("all");
  const liveQ = useLiveRollup(instance, undefined, coordName);
  const arm = liveQ.orgs[0]?.coordinators.find(c => c.id === coordName);
  const stats = arm ? nodeFor(arm, view) : null;
  const realTotal = stats?.dots ?? 0;
  const typeLabel = view === "provider" ? "Providers" : view === "seeker" ? "Seekers" : "Participants";
  const dots = stats?.members ?? [];
  const [search, setSearch] = useState("");
  const [lcFilter, setLcFilter] = useState("all");

  const lc: Record<string, number> = { New: stats?.new7d ?? 0, Active: stats?.active ?? 0, "At Risk": stats?.atRisk ?? 0, Inactive: stats?.inactive ?? 0 };
  const attention = [
    { icon: UserX, tone: "danger" as const, title: `${fmtN(lc.Inactive)} inactive`, sub: "in this unit" },
    { icon: SendHorizonal, tone: "warn" as const, title: `${fmtN(realTotal - (stats?.applied ?? 0))} without submissions`, sub: "no job applications or live postings" },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dots.filter((d) => {
      if (lcFilter !== "all" && d.lifecycle !== lcFilter) return false;
      if (q && !(d.id.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [dots, search, lcFilter]);
  const visible = filtered.slice(0, CAP);

  if (liveQ.loading) return <LiveState loading retry={liveQ.retry} />;
  if (!liveQ.available || liveQ.isError) return <LiveState loading={false} retry={liveQ.retry} />;
  if (!arm) return <LiveState loading={false} retry={liveQ.retry} empty="No Blue Dots data for this account yet" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">My Blue Dots</h1><Badge variant="secondary" className="bg-brand-soft text-brand">{arm?.typeLabel ?? "Unit"} · {instance}</Badge></div>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Participant type" className="inline-flex rounded-lg bg-muted p-1">
            {(["all", "seeker", "provider"] as const).map((v) => (
              <Button variant="ghost" size="sm" key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors", view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{v}</Button>
            ))}
          </div>
          
          
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <div className="h-11 w-11 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><Users className="h-5 w-5" /></div>
        <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{typeLabel}</div><div className="text-xl font-bold tabular-nums">{fmtN(realTotal)} total</div></div>
        <div className="hidden sm:block h-9 w-px bg-border mx-1" />
        <div className="text-sm text-muted-foreground">Your participants' lifecycle.</div>
        <Button variant="outline" size="sm" onClick={liveQ.retry} disabled={liveQ.isFetching} className="ml-auto gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {/* Lifecycle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {LIFECYCLE.map((c) => { const Icon = c.icon; const v = lc[c.key] ?? 0; return (
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
          {attention.map((a, i) => { const Icon = a.icon; return (
            <div key={i} className={cn("flex items-start gap-3 rounded-xl border bg-card p-4", a.tone === "danger" ? "bg-rose-500/5" : "bg-amber-500/5")}>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", a.tone === "danger" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}><Icon className="h-4 w-4" /></div>
              <div><div className="text-sm font-medium leading-tight">{a.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{a.sub}</div></div>
            </div>
          ); })}
        </div>
      </div>

      {/* Participant roster */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="text-sm font-semibold">Participants</div>
          <div className="relative ml-auto w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by ID…" className="pl-9 bg-muted/40 border-0" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={lcFilter} onValueChange={setLcFilter}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Status: All</SelectItem><SelectItem value="New">New</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="At Risk">At Risk</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select>
          <div className="text-xs text-muted-foreground whitespace-nowrap">{fmtN(filtered.length)} loaded · {fmtN(realTotal)} total</div>
        </div>
        <MemberTable members={visible} avatarClasses={AV} months={MONTHS} />
        {filtered.length > CAP && (<div className="p-3 text-center text-xs text-muted-foreground border-t">Showing first {fmtN(CAP)} of {fmtN(filtered.length)} — refine with search or filter.</div>)}
      </div>
    </div>
  );
}
