import { useMemo, useState } from "react";
import {
  Users, UserPlus, Sparkles, AlertTriangle, PauseCircle, RefreshCw, Search, Download, User, UserX, FileWarning, SendHorizonal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
// Sample totals for a single coordinator's own onboarded dots.
const COORD_SEEKER_TOTAL: Record<string, number> = { UP: 640, KA: 820 };
const COORD_PROVIDER_TOTAL: Record<string, number> = { UP: 18, KA: 24 };
const CITIES: Record<string, string[]> = { UP: ["Ghaziabad", "Modinagar", "Loni", "Muradnagar", "Dasna", "Pilkhuwa"], KA: ["Hubli", "Dharwad", "Kalghatgi", "Kundgol", "Navalgund", "Annigeri"] };
const ROLES = ["Delivery Executive", "Data Entry Operator", "Electrician", "Sales Executive", "Security Guard", "Machine Operator", "Tailor", "Driver", "Telecaller", "Housekeeping"];
const EDU = ["Below 10th", "10th Pass", "12th Pass", "ITI", "Diploma", "Graduate"];
const AV = ["bg-amber-500", "bg-rose-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-cyan-600", "bg-fuchsia-500", "bg-indigo-500"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAP = 500;

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const fmtN = (n: number) => n.toLocaleString("en-IN");
const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

interface Dot { id: string; color: string; joined: string; lastSeen: string; role: string; education: string; applications: number; lifecycle: string; completion: number; city: string; }
function genDots(instance: string, n: number): Dot[] {
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
const LIFECYCLE: { key: string; label: string; desc: string; icon: typeof Users; tint: string; icon_c: string; num_c: string }[] = [
  { key: "New", label: "New", desc: "Joined within the last 7 days", icon: Sparkles, tint: "from-emerald-50 to-card dark:from-emerald-950/20 dark:to-card", icon_c: "text-emerald-600 dark:text-emerald-400", num_c: "text-emerald-600 dark:text-emerald-400" },
  { key: "Active", label: "Active", desc: "Applied to a job in the last 30 days", icon: Users, tint: "from-blue-50 to-card dark:from-blue-950/20 dark:to-card", icon_c: "text-blue-600 dark:text-blue-400", num_c: "text-blue-600 dark:text-blue-400" },
  { key: "At Risk", label: "At Risk", desc: "No applications for 30–90 days", icon: AlertTriangle, tint: "from-amber-50 to-card dark:from-amber-950/20 dark:to-card", icon_c: "text-amber-500", num_c: "text-amber-600 dark:text-amber-400" },
  { key: "Inactive", label: "Inactive", desc: "No activity 90+ days", icon: PauseCircle, tint: "from-rose-50 to-card dark:from-rose-950/20 dark:to-card", icon_c: "text-rose-500", num_c: "text-rose-500 dark:text-rose-400" },
];

export function CoordinatorBluedots({ coordName, district }: { coordName: string; district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const [view, setView] = useState<"all" | "seeker" | "provider">("all");
  const seekerTotal = COORD_SEEKER_TOTAL[instance] ?? 0;
  const providerTotal = COORD_PROVIDER_TOTAL[instance] ?? 0;
  const realTotal = view === "seeker" ? seekerTotal : view === "provider" ? providerTotal : seekerTotal + providerTotal;
  const typeLabel = view === "provider" ? "Providers" : view === "seeker" ? "Seekers" : "Participants";

  const dots = useMemo(() => genDots(instance, realTotal), [instance, realTotal]);
  const [period, setPeriod] = useState("7");
  const [search, setSearch] = useState("");
  const [lcFilter, setLcFilter] = useState("all");

  const lc = useMemo(() => {
    const o: Record<string, number> = { New: 0, Active: 0, "At Risk": 0, Inactive: 0 };
    for (const d of dots) o[d.lifecycle]++;
    return o;
  }, [dots]);
  const incomplete = useMemo(() => dots.filter((d) => d.completion < 100).length, [dots]);
  const neverApplied = useMemo(() => dots.filter((d) => d.applications === 0).length, [dots]);

  const attention = [
    { icon: UserX, tone: "danger" as const, title: `${fmtN(lc.Inactive)} inactive`, sub: "no activity in 90+ days · re-engage" },
    { icon: FileWarning, tone: "warn" as const, title: `${fmtN(incomplete)} profiles incomplete`, sub: "missing required fields" },
    { icon: SendHorizonal, tone: "warn" as const, title: `${fmtN(neverApplied)} never applied`, sub: "onboarded but no job applications yet" },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dots.filter((d) => {
      if (lcFilter !== "all" && d.lifecycle !== lcFilter) return false;
      if (q && !(d.id.toLowerCase().includes(q) || d.role.toLowerCase().includes(q) || d.city.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [dots, search, lcFilter]);
  const visible = filtered.slice(0, CAP);

  const downloadCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["ID", "Joined", "Role Wanted", "Education", "Profile %", "Applications", "City", "Lifecycle"];
    const lines = filtered.map((d) => [d.id, d.joined, d.role, d.education, d.completion, d.applications, d.city, d.lifecycle].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `my-blue-dots-${coordName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">My Blue Dots</h1><Badge variant="secondary" className="bg-brand-soft text-brand">{coordName} · {instance}</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">Your onboarded participants — at a glance.</p>
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

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <div className="h-11 w-11 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><Users className="h-5 w-5" /></div>
        <div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{typeLabel}</div><div className="text-xl font-bold tabular-nums">{fmtN(realTotal)} total</div></div>
        <div className="hidden sm:block h-9 w-px bg-border mx-1" />
        <div className="text-sm text-muted-foreground">Your participants' lifecycle and profile health.</div>
        <Button variant="outline" size="sm" className="ml-auto gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
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
          <div className="relative ml-auto w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by ID, role or city…" className="pl-9 bg-muted/40 border-0" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={lcFilter} onValueChange={setLcFilter}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Status: All</SelectItem><SelectItem value="New">New</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="At Risk">At Risk</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCsv} disabled={!filtered.length}><Download className="h-4 w-4" /> CSV</Button>
          <div className="text-xs text-muted-foreground whitespace-nowrap">{fmtN(filtered.length)} of {fmtN(dots.length)}</div>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Participant</th><th className="px-4 py-2.5 font-medium">Joined</th><th className="px-4 py-2.5 font-medium">Profile status</th><th className="px-4 py-2.5 font-medium">Role wanted</th><th className="px-4 py-2.5 font-medium">Education</th><th className="px-4 py-2.5 text-right font-medium">Apps</th><th className="px-4 py-2.5 font-medium">Lifecycle</th></tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-3"><div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0", r.color)}><User className="h-4 w-4" /></div><div><div className="font-mono text-xs font-medium text-foreground">{r.id}</div><div className="text-[11px] text-muted-foreground">{r.city}</div></div></div></td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><div className="text-foreground">{r.joined}</div><div className="text-[11px] text-muted-foreground">{r.lastSeen}</div></td>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.completion}%` }} /></div><span className="text-xs tabular-nums text-muted-foreground">{r.completion}%</span></div></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.role}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.education}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.applications}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className={`rounded-full ${LC_BADGE[r.lifecycle]}`}>{r.lifecycle}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > CAP && (<div className="p-3 text-center text-xs text-muted-foreground border-t">Showing first {fmtN(CAP)} of {fmtN(filtered.length)} — refine with search or filter.</div>)}
      </div>
    </div>
  );
}
