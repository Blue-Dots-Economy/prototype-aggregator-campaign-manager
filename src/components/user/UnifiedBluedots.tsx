import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, LoaderCircle, MapPin, RefreshCw, Sparkles, Users, AlertTriangle, PauseCircle, X, Gauge, Building2, CircleCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveRollup, useLiveMembers, MemberTable, Freshness, LiveState } from "./live-rollup";
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
  Moderate: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Weak: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};
const SIG: { key: "strong" | "moderate" | "weak"; label: string; dot: string }[] = [
  { key: "strong", label: "Strong", dot: "bg-emerald-500" },
  { key: "moderate", label: "Moderate", dot: "bg-blue-500" },
  { key: "weak", label: "Weak", dot: "bg-amber-500" },
];
const fmt = (n: number) => n.toLocaleString("en-IN");
type Level = "org" | "coord" | "flat";
type Agg = { id: string; name: string; s: RollupStats; lp: number };
type View = "seeker" | "provider";
function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group">{options.map(([v, t]) => <Button key={v} variant="ghost" aria-pressed={value === v} onClick={() => onChange(v)} className={cn("h-auto rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-transparent", value === v && "bg-background text-foreground shadow-sm hover:bg-background")}>{t}</Button>)}</div>;
}
function ProviderCells({ s, lp }: { s: RollupStats; lp: number }) {
  return <>
    <td className={cn(td, s.dots ? "" : "text-muted-foreground")}>{fmt(s.dots)}</td>
    <td className={cn(td, s.new7d ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{fmt(s.new7d)}</td>
    <td className={cn(td, s.active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>{fmt(s.active)}</td>
    <td className={cn(td, s.inactive ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{fmt(s.inactive)}</td>
    <td className={cn(td, lp ? "text-violet-400" : "text-muted-foreground")}>{fmt(lp)}</td>
  </>;
}
function ProviderRows({ instance, coordId }: { instance: string; coordId: string }) {
  const q = useLiveMembers(instance, undefined, coordId, "provider", true);
  if (q.isPending) return <tr className="border-t bg-muted/20"><td colSpan={6} className="px-3 py-3 text-xs text-muted-foreground"><LoaderCircle className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading providers…</td></tr>;
  return <tr className="border-t"><td colSpan={6} className="p-2"><MemberTable members={q.data ?? []} /></td></tr>;
}
type Filters = { time: "all" | "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month"; signal: "all" | ScopedSeekerRow["profileSignal"]; status: "all" | Status };

function FilterMenu<T extends string>({ label, value, options, onValueChange, active = value !== "all" }: { label: string; value: T; options: [T, string][]; onValueChange: (v: T) => void; active?: boolean }) {
  const selected = options.find(([v]) => v === value)?.[1] ?? value;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className={cn("inline-flex h-auto items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-[13px] shadow-none", active && "border-primary/30 bg-primary/10 text-foreground")}>
        <span className={cn("text-xs text-muted-foreground", active && "text-primary/80")}>{label}</span>
        <span>{selected}</span><ChevronDown className="h-3 w-3 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuRadioGroup value={value} onValueChange={v => { const option = options.find(([key]) => key === v); if (option) onValueChange(option[0]); }}>
        {options.map(([v, text]) => <DropdownMenuRadioItem key={v} value={v}>{text}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
const td = "px-3 py-2.5 text-right tabular-nums";
function AggCells({ s }: { s: RollupStats }) {
  const rate = s.dots ? `${(s.applied / s.dots * 100).toFixed(1)}%` : null;
  const t = s.strong + s.moderate + s.weak;
  const split = SIG.map(x => `${x.label} ${fmt(s[x.key])}`).join(" · ");
  return <>
    <td className={td}>{fmt(s.dots)}</td>
    <td className={cn(td, s.live ? "" : "text-muted-foreground")}>{fmt(s.live)}</td>
    <td className={cn(td, s.draft ? "" : "text-muted-foreground")}>{fmt(s.draft)}</td>
    <td className="px-3 py-2.5">
      <div className="flex items-center justify-end gap-2">
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <span tabIndex={0} aria-label={split} className="flex h-[9px] w-[120px] overflow-hidden rounded-full bg-muted">
            {t > 0 && SIG.filter(x => s[x.key] > 0).map(x => <span key={x.key} className={cn("h-full shrink-0", x.dot)} style={{ width: `${s[x.key] / t * 100}%` }} />)}
          </span>
        </TooltipTrigger><TooltipContent>{split}</TooltipContent></Tooltip></TooltipProvider>
      </div>
    </td>
    <td className={cn(td, s.applied ? "" : "text-muted-foreground")} title="Seekers with ≥1 application">{fmt(s.applied)}</td>
    <td className="px-3 py-2.5 text-right"><span className={cn("inline-block rounded-full bg-muted/40 px-2 py-0.5 text-xs tabular-nums", rate ? "text-foreground" : "text-muted-foreground")}>{rate ?? "—"}</span></td>
  </>;
}
function SeekerRow({ r }: { r: ScopedSeekerRow }) {
  return <tr className="border-t hover:bg-muted/30">
    <td className="px-3 py-2.5"><span className="font-mono text-xs break-all text-muted-foreground">{r.id}</span></td>
    <td className="px-3 py-2.5"><span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", SIGNAL[r.profileSignal])}>{r.profileSignal}</span></td>
    <td className={td}>{r.applied}</td><td className={td}>{r.accepted}</td><td className={td}>{r.rejected}</td><td className={td}>{r.pending}</td><td className={td}>{r.servicesAccepted}</td>
    <td className={cn(td, r.source === "—" && "text-muted-foreground")}>{r.source}</td>
    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">{r.profileCompletion}% complete</td>
  </tr>;
}
function SeekerTable({ rows, children }: { rows: ScopedSeekerRow[]; children?: ReactNode }) {
  const subtotal = rows.reduce((s, r) => ({ accepted: s.accepted + r.accepted, rejected: s.rejected + r.rejected, pending: s.pending + r.pending, services: s.services + r.servicesAccepted }), { accepted: 0, rejected: 0, pending: 0, services: 0 });
  return <div className="bg-muted/20">
    <p className="px-3 py-3 text-xs text-muted-foreground">{fmt(rows.length)} seekers · {fmt(subtotal.accepted)} accepted · {fmt(subtotal.rejected)} rejected · {fmt(subtotal.pending)} pending · {fmt(subtotal.services)} services</p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Seeker application outcomes">
        <thead className="border-t bg-muted/50 text-xs text-muted-foreground"><tr>
          {["Seeker", "Signal", "Applied", "Accepted", "Rejected", "Pending", "Services", "Source", "Profile"].map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 font-medium whitespace-nowrap", i >= 2 && i <= 7 ? "text-right" : "text-left")}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(r => <SeekerRow key={r.id} r={r} />)}{children}</tbody>
      </table>
    </div>
  </div>;
}
/** Inclusive-from / exclusive-to window in local time; weeks start Monday, months are calendar months. */
function timeWindow(key: Filters["time"], now: number): [number, number] | null {
  if (key === "all") return null;
  const d = new Date(now);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const DAY = 86400000;
  // Monday = 0 … Sunday = 6
  const dow = (d.getDay() + 6) % 7;
  const startOfWeek = startOfDay - dow * DAY;
  const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const startOfLastMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  switch (key) {
    case "today":      return [startOfDay, Infinity];
    case "yesterday":  return [startOfDay - DAY, startOfDay];
    case "this_week":  return [startOfWeek, Infinity];
    case "last_week":  return [startOfWeek - 7 * DAY, startOfWeek];
    case "this_month": return [startOfMonth, Infinity];
    case "last_month": return [startOfLastMonth, startOfMonth];
  }
  return null;
}
function timeRange(key: Filters["time"], now: number): { from: string | null; to: string | null } {
  const w = timeWindow(key, now);
  if (!w) return { from: null, to: null };
  return { from: new Date(w[0]).toISOString(), to: Number.isFinite(w[1]) ? new Date(w[1]).toISOString() : null };
}
function passes(r: ScopedSeekerRow, f: Filters) {
  if (f.signal !== "all" && r.profileSignal !== f.signal) return false;
  if (f.status !== "all" && r.status !== f.status) return false;
  return true;
}
function SeekerRows({ instance, coordId, filters, from, to, source }: { instance: string; coordId: string; filters: Filters; from: string | null; to: string | null; source: string | null }) {
  const fn = useServerFn(fetchScopedSeekers);
  const q = useQuery({ queryKey: ["scoped-seekers", instance, coordId, from ?? "", to ?? "", source ?? ""], queryFn: () => fn({ data: { instance, coordinatorId: coordId, from, to, source } }), placeholderData: keepPreviousData, staleTime: 5 * 60_000 });
  if (q.isPending) return <tr className="border-t bg-muted/20"><td colSpan={7} className="px-3 py-3 text-xs text-muted-foreground"><LoaderCircle className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading seekers…</td></tr>;
  if (q.isError) return <tr className="border-t bg-muted/20"><td colSpan={7} className="px-3 py-3 text-xs text-muted-foreground">Couldn't load seekers. <Button variant="link" size="sm" onClick={() => void q.refetch()}>Retry</Button></td></tr>;
  const rows = q.data.rows.filter(r => passes(r, filters));
  return <tr className="border-t"><td colSpan={7} className="p-0"><SeekerTable rows={rows}>
    {!rows.length && <tr className="border-t"><td colSpan={9} className="px-3 py-3 text-xs text-muted-foreground">No seekers match.</td></tr>}
    {q.data.capped && <tr className="border-t"><td colSpan={9} className="px-3 py-2 text-xs text-muted-foreground">Showing first 1,000 profiles.</td></tr>}
  </SeekerTable></td></tr>;
}
function FlatRows({ instance, coords, filters, from, to, source }: { instance: string; coords: Agg[]; filters: Filters; from: string | null; to: string | null; source: string | null }) {
  const fn = useServerFn(fetchScopedSeekers);
  const qs = useQueries({ queries: coords.map(c => ({ queryKey: ["scoped-seekers", instance, c.id, from ?? "", to ?? "", source ?? ""], queryFn: () => fn({ data: { instance, coordinatorId: c.id, from, to, source } }), placeholderData: keepPreviousData, staleTime: 5 * 60_000 })) });
  const rows = qs.flatMap(q => q.data?.rows ?? []).filter(r => passes(r, filters));
  const loading = qs.some(q => q.isPending);
  return <SeekerTable rows={rows}>
    {loading && <tr className="border-t"><td colSpan={9} className="px-3 py-3 text-xs text-muted-foreground"><LoaderCircle className="mr-2 inline h-3.5 w-3.5 animate-spin" />Loading seekers…</td></tr>}
    {qs.some(q => q.isError) && <tr className="border-t"><td colSpan={9} className="px-3 py-3 text-xs text-muted-foreground">Some coordinators couldn't load.</td></tr>}
    {!loading && !rows.length && <tr className="border-t"><td colSpan={9} className="px-3 py-3 text-xs text-muted-foreground">No seekers match.</td></tr>}
    {qs.some(q => q.data?.capped) && <tr className="border-t"><td colSpan={9} className="px-3 py-2 text-xs text-muted-foreground">Showing first 1,000 profiles per capped coordinator.</td></tr>}
  </SeekerTable>;
}
function AggRow({ a, depth, open, onToggle, view }: { a: Agg; depth: number; open: boolean; onToggle: () => void; view: View }) {
  const Icon = open ? ChevronDown : ChevronRight;
  return <tr className="border-t hover:bg-muted/30">
    <td className="px-3 py-2.5" style={{ paddingLeft: 12 + depth * 24 }}>
      <Button variant="ghost" onClick={onToggle} className="h-auto justify-start gap-1.5 whitespace-normal p-0 text-left font-semibold hover:bg-transparent" aria-expanded={open}><Icon className="h-4 w-4 shrink-0 text-muted-foreground" />{a.name}</Button>
    </td>
    {view === "provider" ? <ProviderCells s={a.s} lp={a.lp} /> : <AggCells s={a.s} />}
  </tr>;
}

export function UnifiedBluedots({ district, readOnly: _readOnly = false }: { district: string; readOnly?: boolean }) {
  const instance = INSTANCE[district] ?? "UP";
  const [level, setLevel] = useState<Level>("org");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({ time: "all", signal: "all", status: "all" });
  const [view, setView] = useState<View>("seeker");
  const [source, setSource] = useState<"all" | "voice" | "qr" | "bulk" | "self">("all");
  const scope = useMemo(() => ({ ...timeRange(filters.time, Date.now()), source: source === "all" ? null : source }), [filters.time, source]);
  const live = useLiveRollup(instance, undefined, undefined, scope);
  const windowed = filters.time !== "all" || source !== "all";
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const liveOrgs = useMemo(() => { const hide = windowed || view === "provider"; return live.orgs.map(o => ({ id: o.id, name: o.name, s: view === "provider" ? o.providers : o.seekers, lp: o.livePostings, coords: o.coordinators.map(c => ({ id: c.id, name: c.name, s: view === "provider" ? c.providers : c.seekers, lp: c.livePostings })).filter(c => !hide || c.s.dots > 0) })).filter(o => !hide || o.s.dots > 0); }, [live.orgs, windowed, view]);
  const liveSeekerOrgs = useMemo(() => live.orgs.map(o => o.seekers).filter(s => !windowed || s.dots > 0), [live.orgs, windowed]);
  const lastSeekerOrgs = useRef<RollupStats[]>([]);
  useEffect(() => { if (liveSeekerOrgs.length) lastSeekerOrgs.current = liveSeekerOrgs; }, [liveSeekerOrgs]);
  const seekerOrgs = liveSeekerOrgs.length ? liveSeekerOrgs : lastSeekerOrgs.current;
  const lastOrgs = useRef<typeof liveOrgs>([]);
  useEffect(() => { if (liveOrgs.length) lastOrgs.current = liveOrgs; }, [liveOrgs]);
  const orgs = liveOrgs.length ? liveOrgs : lastOrgs.current;
  const coords = useMemo(() => orgs.flatMap(o => o.coords), [orgs]);
  const totals = useMemo(() => seekerOrgs.reduce((t, s) => ({ new7d: t.new7d + s.new7d, active: t.active + s.active, atRisk: t.atRisk + s.atRisk, inactive: t.inactive + s.inactive, dots: t.dots + s.dots, applied: t.applied + s.applied, strong: t.strong + s.strong, moderate: t.moderate + s.moderate, weak: t.weak + s.weak, live: t.live + s.live, draft: t.draft + s.draft, compSum: t.compSum + s.compSum, compUsers: t.compUsers + s.compUsers, below60: t.below60 + s.below60 }), { new7d: 0, active: 0, atRisk: 0, inactive: 0, dots: 0, applied: 0, strong: 0, moderate: 0, weak: 0, live: 0, draft: 0, compSum: 0, compUsers: 0, below60: 0 } as RollupStats), [seekerOrgs]);
  const avgComp = totals.compUsers ? Math.round(totals.compSum / totals.compUsers) : null;
  const orgCount = seekerOrgs.length;

  if (live.loading && !orgs.length) return <LiveState loading retry={live.retry} />;
  if (live.isError || !live.available) return <LiveState loading={false} retry={live.retry} />;

  const activeCount = Number(filters.time !== "all") + Number(source !== "all") + Number(filters.signal !== "all") + Number(filters.status !== "all");
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
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /><span className="text-sm font-medium">Organisations</span></div>
        <div className="mt-3 text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{fmt(orgCount)}</div>
        <div className="mt-1 text-xs text-muted-foreground">In this scope</div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground"><CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /><span className="text-sm font-medium">Live</span></div>
        <div className="mt-3 text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(totals.live)}</div>
        <div className="mt-1 text-xs text-muted-foreground">Seekers with a published profile</div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" /><span className="text-sm font-medium">Draft</span></div>
        <div className="mt-3 text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmt(totals.draft)}</div>
        <div className="mt-1 text-xs text-muted-foreground">Only draft, not yet published</div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground"><Gauge className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><span className="text-sm font-medium">Average completeness</span></div>
        <div className="mt-3 text-3xl font-bold tabular-nums text-cyan-600 dark:text-cyan-400">{avgComp === null ? "—" : `${avgComp}%`}</div>
        <div className="mt-1 text-xs text-muted-foreground">Participant-weighted</div>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Scope</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium"><MapPin className="h-3.5 w-3.5" />{district}</span>
      <Seg value={view} options={[["seeker", "Seekers"], ["provider", "Providers"]]} onChange={setView} />
      <FilterMenu label="Level" value={level} options={[["org", "Organisation"], ["coord", "Coordinator"], ["flat", "Seekers (flat)"]]} onValueChange={setLevel} active={false} />
      {view === "seeker" && <FilterMenu label="Source" value={source} options={[["all", "All"], ["voice", "Voice"], ["qr", "QR"], ["bulk", "Bulk"], ["self", "Self"]]} onValueChange={setSource} />}
      <FilterMenu label="Period" value={filters.time} options={[["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["this_week", "This week"], ["last_week", "Last week"], ["this_month", "This month"], ["last_month", "Last month"]]} onValueChange={v => setFilters(f => ({ ...f, time: v }))} />
      <span className="mx-1 h-5 w-px bg-border" />
      <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-slate-400/60" />Refine</span>
      {view === "seeker" && <FilterMenu label="Signal" value={filters.signal} options={[["all", "All"], ["Strong", "Strong"], ["Moderate", "Moderate"], ["Weak", "Weak"]]} onValueChange={v => setFilters(f => ({ ...f, signal: v }))} />}
      <FilterMenu label="Status" value={filters.status} options={[["all", "All"], ["New", "New"], ["Active", "Active"], ["At Risk", "At Risk"], ["Inactive", "Inactive"]]} onValueChange={v => setFilters(f => ({ ...f, status: v }))} />
      <span className="flex-1" />
      {activeCount > 0 && <Button variant="ghost" className="inline-flex h-auto items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-muted-foreground hover:border-border hover:bg-transparent hover:text-foreground" onClick={() => { setFilters({ time: "all", signal: "all", status: "all" }); setSource("all"); }}><X className="h-3 w-3" />{activeCount} active · Clear</Button>}
    </div>

    <div className={cn("overflow-auto rounded-xl border bg-card", live.fetching && "opacity-60 transition-opacity")}>
      {level === "flat" ? <FlatRows instance={instance} coords={coords.filter(c => c.s.dots > 0)} filters={filters} from={scope.from} to={scope.to} source={scope.source} /> : <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          {view === "provider" ? <tr><th scope="col" className="px-3 py-2 text-left font-medium">Name</th>{["Providers", "New", "Active", "Inactive", "Live postings"].map(h => <th key={h} scope="col" className={cn(th, "tabular-nums")}>{h}</th>)}</tr> : <tr><th scope="col" className="px-3 py-2 text-left font-medium">Name</th><th scope="col" className={cn(th, "tabular-nums")}>Seekers</th><th scope="col" className={cn(th, "tabular-nums")} title="Seekers with ≥1 published profile">Live</th><th scope="col" className={cn(th, "tabular-nums")} title="Seekers with only draft profiles">Draft</th><th scope="col" className={cn(th, "tabular-nums")}>Profile status</th><th scope="col" className={cn(th, "tabular-nums")} title="Seekers with ≥1 application">Applied</th><th scope="col" className={cn(th, "tabular-nums")}>Apply rate</th></tr>}
        </thead>
        <tbody>
          {level === "org" && orgs.map(o => <Fragment key={o.id}>
            <AggRow a={o} depth={0} open={open.has(o.id)} onToggle={() => toggle(o.id)} view={view} />
            {open.has(o.id) && o.coords.map(c => <Fragment key={c.id}>
              <AggRow a={c} depth={1} open={open.has(c.id)} onToggle={() => toggle(c.id)} view={view} />
              {open.has(c.id) && (view === "provider" ? <ProviderRows instance={instance} coordId={c.id} /> : <SeekerRows instance={instance} coordId={c.id} filters={filters} from={scope.from} to={scope.to} source={scope.source} />)}
            </Fragment>)}
          </Fragment>)}
          {level === "coord" && coords.map(c => <Fragment key={c.id}>
            <AggRow a={c} depth={0} open={open.has(c.id)} onToggle={() => toggle(c.id)} view={view} />
            {open.has(c.id) && (view === "provider" ? <ProviderRows instance={instance} coordId={c.id} /> : <SeekerRows instance={instance} coordId={c.id} filters={filters} from={scope.from} to={scope.to} source={scope.source} />)}
          </Fragment>)}
        </tbody>
      </table>}
    </div>
    <p className="text-xs text-muted-foreground">Aggregate rows show seeker counts from the district rollup; per-outcome splits appear on seeker rows.</p>
  </section>;
}
