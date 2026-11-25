import { Fragment, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, LoaderCircle, MapPin, RefreshCw, Sparkles, Users, AlertTriangle, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveRollup, Freshness, LiveState } from "./live-rollup";
import { fetchScopedSeekers, type ScopedSeekerRow } from "@/lib/scoped-seekers.functions";
import type { RollupStats } from "@/lib/rollup.functions";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
type Status = ScopedSeekerRow["status"];
const LIFE: { status: Status; key: keyof RollupStats; desc: string; Icon: typeof Users; c: string; dot: string }[] = [
  { status: "New", key: "new7d", desc: "Joined within the last 7 days", Icon: Sparkles, c: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { status: "Active", key: "active", desc: "Applied in the last 30 days", Icon: Users, c: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  { status: "At Risk", key: "atRisk", desc: "No applications for 30–90 days", Icon: AlertTriangle, c: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  { status: "Inactive", key: "inactive", desc: "No activity 90+ days", Icon: PauseCircle, c: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
];
const SIGNAL: Record<ScopedSeekerRow["profileSignal"], string> = {
  Strong: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Moderate: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Weak: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};
const fmt = (n: number) => n.toLocaleString("en-IN");
type Level = "org" | "coord" | "flat";
type Agg = { id: string; name: string; s: RollupStats };
type Filters = { time: "all" | "7" | "30" | "90"; signal: "all" | ScopedSeekerRow["profileSignal"]; status: "all" | Status };

function Seg<T extends string>({ value, options, onChange, disabled }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return <div className={cn("inline-flex rounded-lg border bg-muted/40 p-0.5", disabled && "opacity-50")}>{options.map(([v, l]) => (
    <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", value === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground", disabled && "cursor-not-allowed")}>{l}</button>
  ))}</div>;
}
const td = "px-3 py-2.5 text-right tabular-nums";
function AggCells({ s }: { s: RollupStats }) {
  return <>
    <td className={td}>{fmt(s.dots)}</td>
    {LIFE.map(l => <td key={l.status} className={cn(td, l.c)}>{fmt(s[l.key])}</td>)}
    <td className={td} title="Seekers with ≥1 application">{fmt(s.applied)}</td>
    {[0, 1, 2, 3].map(i => <td key={i} className={cn(td, "text-muted-foreground")}>—</td>)}
    <td className={cn(td, "text-muted-foreground")}>—</td>
    <td className="px-3 py-2.5 text-muted-foreground">—</td>
  </>;
}
function SeekerRow({ r, depth }: { r: ScopedSeekerRow; depth: number }) {
  return <tr className="border-t hover:bg-muted/30">
    <td className="px-3 py-2.5" style={{ paddingLeft: 12 + depth * 24 }}><span className="font-mono text-xs break-all text-muted-foreground">{r.id}</span></td>
    <td className={td}>1</td>
    {LIFE.map(l => <td key={l.status} className={td}>{r.status === l.status && <span className={cn("inline-block h-2.5 w-2.5 rounded-full", l.dot)} aria-label={l.status} />}</td>)}
    <td className={td}>{r.applied}</td><td className={td}>{r.accepted}</td><td className={td}>{r.rejected}</td><td className={td}>{r.pending}</td><td className={td}>{r.servicesAccepted}</td>
    <td className={cn(td, "text-muted-foreground")}>—</td>
    <td className="px-3 py-2.5 whitespace-nowrap"><span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", SIGNAL[r.profileSignal])}>{r.profileSignal}</span><span className="ml-2 text-xs text-muted-foreground">{r.profileCompletion}% complete</span></td>
  </tr>;
}
function passes(r: ScopedSeekerRow, f: Filters, now: number) {
  if (f.signal !== "all" && r.profileSignal !== f.signal) return false;
  if (f.status !== "all" && r.status !== f.status) return false;
  if (f.time !== "all") { const t = Date.parse(r.joined); if (!Number.isFinite(t) || now - t > Number(f.time) * 86400000) return false; }
  return true;
}
function SeekerRows({ instance, coordId, depth, filters }: { instance: string; coordId: string; depth: number; filters: Filters }) {
  const fn = useServerFn(fetchScopedSeekers);
  const q = useQuery({ queryKey: ["scoped-seekers", instance, coordId], queryFn: () => fn({ data: { instance, coordinatorId: coordId } }), staleTime: 5 * 60_000 });
  const pad = { paddingLeft: 12 + depth * 24 };
  if (q.isPending) return <tr className="border-t"><td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground" style={pad}><LoaderCircle className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading seekers…</td></tr>;
  if (q.isError) return <tr className="border-t"><td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground" style={pad}>Couldn't load seekers. <button className="underline" onClick={() => void q.refetch()}>Retry</button></td></tr>;
  const now = Date.now();
  const rows = q.data.rows.filter(r => passes(r, filters, now));
  return <>
    {rows.map(r => <SeekerRow key={r.id} r={r} depth={depth} />)}
    {!rows.length && <tr className="border-t"><td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground" style={pad}>No seekers match.</td></tr>}
    {q.data.capped && <tr className="border-t"><td colSpan={13} className="px-3 py-2 text-xs text-muted-foreground" style={pad}>Showing first 1,000 profiles.</td></tr>}
  </>;
}
function FlatRows({ instance, coords, filters }: { instance: string; coords: Agg[]; filters: Filters }) {
  const fn = useServerFn(fetchScopedSeekers);
  const qs = useQueries({ queries: coords.map(c => ({ queryKey: ["scoped-seekers", instance, c.id], queryFn: () => fn({ data: { instance, coordinatorId: c.id } }), staleTime: 5 * 60_000 })) });
  const now = Date.now();
  const rows = qs.flatMap(q => q.data?.rows ?? []).filter(r => passes(r, filters, now));
  const loading = qs.some(q => q.isPending);
  return <>
    {rows.map(r => <SeekerRow key={r.id} r={r} depth={0} />)}
    {loading && <tr className="border-t"><td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground"><LoaderCircle className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading seekers…</td></tr>}
    {qs.some(q => q.isError) && <tr className="border-t"><td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground">Some coordinators couldn't load.</td></tr>}
    {!loading && !rows.length && <tr className="border-t"><td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground">No seekers match.</td></tr>}
  </>;
}
function AggRow({ a, depth, open, onToggle }: { a: Agg; depth: number; open: boolean; onToggle: () => void }) {
  const Icon = open ? ChevronDown : ChevronRight;
  return <tr className="border-t hover:bg-muted/30">
    <td className="px-3 py-2.5" style={{ paddingLeft: 12 + depth * 24 }}>
      <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-left font-semibold" aria-expanded={open}><Icon className="h-4 w-4 shrink-0 text-muted-foreground" />{a.name}</button>
    </td>
    <AggCells s={a.s} />
  </tr>;
}

export function UnifiedBluedots({ district, readOnly: _readOnly = false }: { district: string; readOnly?: boolean }) {
  const instance = INSTANCE[district] ?? "UP";
  const live = useLiveRollup(instance);
  const [level, setLevel] = useState<Level>("org");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({ time: "all", signal: "all", status: "all" });
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const orgs = useMemo(() => live.orgs.map(o => ({ id: o.id, name: o.name, s: o.seekers, coords: o.coordinators.map(c => ({ id: c.id, name: c.name, s: c.seekers })) })), [live.orgs]);
  const coords = useMemo(() => orgs.flatMap(o => o.coords), [orgs]);
  const totals = useMemo(() => orgs.reduce((t, o) => ({ new7d: t.new7d + o.s.new7d, active: t.active + o.s.active, atRisk: t.atRisk + o.s.atRisk, inactive: t.inactive + o.s.inactive, dots: t.dots + o.s.dots, applied: t.applied + o.s.applied }), { new7d: 0, active: 0, atRisk: 0, inactive: 0, dots: 0, applied: 0 } as RollupStats), [orgs]);

  if (live.loading && !orgs.length) return <LiveState loading retry={live.retry} />;
  if (live.isError || !live.available) return <LiveState loading={false} retry={live.retry} />;

  const chip = <K extends keyof Filters>(k: K, opts: [Filters[K], string][]) => <Seg value={filters[k]} options={opts} onChange={v => setFilters(f => ({ ...f, [k]: v }))} />;
  const th = "px-3 py-2 font-medium text-right";
  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-bold">My Blue Dots</h1><p className="text-sm text-muted-foreground">Organisations, coordinators and seekers in one view.</p></div>
      <div className="flex items-center gap-3"><Freshness updatedAt={live.updatedAt} error={live.refreshError} /><Button variant="outline" size="sm" onClick={live.refresh} disabled={live.refreshing}><RefreshCw className={cn("mr-2 h-4 w-4", live.refreshing && "animate-spin")} />Refresh</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {LIFE.map(l => <div key={l.status} className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground"><l.Icon className={cn("h-4 w-4", l.c)} /><span className="text-sm font-medium">{l.status}</span></div>
        <div className={cn("mt-3 text-3xl font-bold tabular-nums", l.c)}>{fmt(totals[l.key])}</div>
        <div className="mt-1 text-xs text-muted-foreground">{l.desc}</div>
      </div>)}
    </div>

    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium"><MapPin className="h-3.5 w-3.5" />{district}</span>
      <span className="text-xs text-muted-foreground">Start level</span>
      <Seg value={level} options={[["org", "Organisation"], ["coord", "Coordinator"], ["flat", "Seekers (flat)"]]} onChange={setLevel} />
      <span className="text-xs text-muted-foreground">Source</span>
      <TooltipProvider><Tooltip><TooltipTrigger asChild><span><Seg value="all" options={[["all", "All"], ["voice", "Voice"], ["qr", "QR"]]} onChange={() => {}} disabled /></span></TooltipTrigger><TooltipContent>Coming soon — Sanketika</TooltipContent></Tooltip></TooltipProvider>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {chip("time", [["all", "All time"], ["7", "7d"], ["30", "30d"], ["90", "90d"]])}
      {chip("signal", [["all", "All profiles"], ["Strong", "Strong"], ["Moderate", "Moderate"], ["Weak", "Weak"]])}
      {chip("status", [["all", "All status"], ["New", "New"], ["Active", "Active"], ["At Risk", "At Risk"], ["Inactive", "Inactive"]])}
      <span className="text-xs text-muted-foreground">Filters apply to seeker rows.</span>
    </div>

    <div className="overflow-auto rounded-xl border bg-card">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr><th rowSpan={2} className="px-3 py-2 text-left font-medium">Name</th><th rowSpan={2} className={th}>Seekers</th><th colSpan={4} className="px-3 py-2 text-center font-medium border-l">Lifecycle</th><th colSpan={5} className="px-3 py-2 text-center font-medium border-l">Applied · outcomes</th><th rowSpan={2} className={cn(th, "border-l")}>Source</th><th rowSpan={2} className="px-3 py-2 text-left font-medium">Profile</th></tr>
          <tr>{LIFE.map(l => <th key={l.status} className={th}>{l.status}</th>)}{["Total", "Accepted", "Rejected", "Pending", "Services"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {level === "org" && orgs.map(o => <Fragment key={o.id}>
            <AggRow a={o} depth={0} open={open.has(o.id)} onToggle={() => toggle(o.id)} />
            {open.has(o.id) && o.coords.map(c => <Fragment key={c.id}>
              <AggRow a={c} depth={1} open={open.has(c.id)} onToggle={() => toggle(c.id)} />
              {open.has(c.id) && <SeekerRows instance={instance} coordId={c.id} depth={2} filters={filters} />}
            </Fragment>)}
          </Fragment>)}
          {level === "coord" && coords.map(c => <Fragment key={c.id}>
            <AggRow a={c} depth={0} open={open.has(c.id)} onToggle={() => toggle(c.id)} />
            {open.has(c.id) && <SeekerRows instance={instance} coordId={c.id} depth={1} filters={filters} />}
          </Fragment>)}
          {level === "flat" && <FlatRows instance={instance} coords={coords.filter(c => c.s.dots > 0)} filters={filters} />}
        </tbody>
      </table>
    </div>
    <p className="text-xs text-muted-foreground">Aggregate rows show seeker counts from the district rollup; per-outcome splits appear on seeker rows. Source (voice/QR) data isn't available yet.</p>
  </section>;
}
