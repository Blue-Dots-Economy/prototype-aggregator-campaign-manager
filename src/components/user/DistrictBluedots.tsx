import { useMemo, useState } from "react";
import {
  Users, UserPlus, Activity, AlertTriangle, PauseCircle, Send,
  Search, Download, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Lifecycle = "New" | "Active" | "At Risk" | "Inactive";
interface DSeeker {
  id: string; joined: string; roleWanted: string; education: string;
  experience: string; genderMasked: string; ageMasked: string; city: string;
  applications: number; lifecycle: Lifecycle;
}

const INSTANCE: Record<string, string> = { Ghaziabad: "UP", "Hubli-Dharwad": "KA", GZB: "UP", Dharwad: "KA", Karnataka: "KA", UP: "UP", KA: "KA" };
const REAL_TOTAL: Record<string, number> = { UP: 18772, KA: 28961 };
const CITIES: Record<string, string[]> = {
  UP: ["Ghaziabad", "Modinagar", "Loni", "Muradnagar", "Dasna", "Pilkhuwa"],
  KA: ["Hubli", "Dharwad", "Kalghatgi", "Kundgol", "Navalgund", "Annigeri"],
};
const ROLES = ["Delivery Executive", "Data Entry Operator", "Electrician", "Sales Executive", "Security Guard", "Machine Operator", "Tailor", "Driver", "Telecaller", "Housekeeping", "Warehouse Associate", "Field Technician"];
const EDU = ["Below 10th", "10th Pass", "12th Pass", "ITI", "Diploma", "Graduate"];
const EXP = ["Fresher", "< 1 year", "1–3 years", "3–5 years", "5+ years"];
const GENDERS = ["M••", "F••"];
const AGES = ["1•", "2•", "3•", "4•"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const fmtN = (n: number) => n.toLocaleString("en-IN");
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function genSeekers(instance: string, n: number): DSeeker[] {
  const cities = CITIES[instance] ?? CITIES.UP;
  const now = Date.now();
  const out: DSeeker[] = [];
  for (let i = 0; i < n; i++) {
    const daysAgo = Math.floor(Math.random() * 240);
    const joined = new Date(now - daysAgo * 86400000);
    const apps = Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 8);
    const lastApplyDays = apps > 0 ? Math.floor(Math.random() * 180) : null;
    let lifecycle: Lifecycle;
    if (daysAgo <= 7) lifecycle = "New";
    else if (lastApplyDays !== null && lastApplyDays <= 30) lifecycle = "Active";
    else if (lastApplyDays !== null && lastApplyDays <= 90) lifecycle = "At Risk";
    else lifecycle = "Inactive";
    out.push({
      id: `${instance}-${100000 + Math.floor(Math.random() * 899999)}`,
      joined: joined.toISOString(),
      roleWanted: pick(ROLES), education: pick(EDU), experience: pick(EXP),
      genderMasked: pick(GENDERS), ageMasked: pick(AGES), city: pick(cities),
      applications: apps, lifecycle,
    });
  }
  return out;
}

const LIFECYCLE_META: Record<Lifecycle, { desc: string; icon: typeof Users; accent: string; iconBg: string; iconColor: string; valueColor: string }> = {
  New: { desc: "Joined ≤ 7 days ago", icon: UserPlus, accent: "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-transparent", iconBg: "bg-card border border-emerald-500/30", iconColor: "text-emerald-600", valueColor: "text-emerald-600" },
  Active: { desc: "Applied ≤ 30 days ago", icon: Users, accent: "from-blue-50 to-white dark:from-blue-950/30 dark:to-transparent", iconBg: "bg-card border border-blue-500/30", iconColor: "text-blue-600", valueColor: "text-blue-600" },
  "At Risk": { desc: "Last applied 31–90 days", icon: AlertTriangle, accent: "from-amber-50 to-white dark:from-amber-950/30 dark:to-transparent", iconBg: "bg-card border border-amber-500/30", iconColor: "text-amber-500", valueColor: "text-amber-600" },
  Inactive: { desc: "Applied > 90 days or never", icon: PauseCircle, accent: "from-rose-50 to-white dark:from-rose-950/30 dark:to-transparent", iconBg: "bg-card border border-rose-500/30", iconColor: "text-rose-500", valueColor: "text-rose-600" },
};

const LC_BADGE: Record<Lifecycle, string> = {
  New: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Active: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "At Risk": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Inactive: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

const CAP = 500;

function MetricTile({ label, value, description, Icon }: { label: string; value: string; description: string; Icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground"><Icon className="h-4 w-4" /></div>
        <div className="text-sm font-medium leading-tight">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

export function DistrictBluedots({ district }: { district: string }) {
  const instance = INSTANCE[district] ?? "UP";
  const seekers = useMemo(() => genSeekers(instance, 600), [instance]);
  const [search, setSearch] = useState("");
  const [lcFilter, setLcFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const c = { New: 0, Active: 0, "At Risk": 0, Inactive: 0 } as Record<Lifecycle, number>;
    let applied = 0, totalApps = 0;
    for (const s of seekers) { c[s.lifecycle]++; if (s.applications > 0) applied++; totalApps += s.applications; }
    return { c, applied, totalApps, avg: seekers.length ? (totalApps / seekers.length).toFixed(1) : "0" };
  }, [seekers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seekers.filter((s) => {
      if (lcFilter !== "all" && s.lifecycle !== lcFilter) return false;
      if (roleFilter !== "all" && s.roleWanted !== roleFilter) return false;
      if (q && !(s.id.toLowerCase().includes(q) || s.roleWanted.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [seekers, search, lcFilter, roleFilter]);
  const visible = filtered.slice(0, CAP);

  const downloadCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Seeker ID", "Joined", "Role Wanted", "Education", "Experience", "Gender", "Age", "City", "Applications", "Lifecycle"];
    const lines = filtered.map((s) => [s.id, fmtDate(s.joined), s.roleWanted, s.education, s.experience, s.genderMasked, s.ageMasked, s.city, s.applications, s.lifecycle].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `my-bluedots-${district}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">My Bluedots</h1>
            <Badge variant="secondary" className="bg-brand-soft text-brand">{district} · {instance}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">District roster — every Blue Dot onboarded across {district}.</p>
        </div>
        <Button className="gap-2"><UserPlus className="h-4 w-4" /> Add Participants</Button>
      </div>

      {/* Preview banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-amber-800 dark:text-amber-300">
          <span className="font-medium">Preview with sample data.</span> Live count for {district} is {fmtN(REAL_TOTAL[instance] ?? 0)} seekers in the database — this view populates once the Blue Dots database is connected.
        </p>
      </div>

      {/* Lifecycle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(LIFECYCLE_META) as Lifecycle[]).map((lc) => {
          const m = LIFECYCLE_META[lc]; const Icon = m.icon; const value = counts.c[lc];
          const pct = seekers.length ? Math.round((value / seekers.length) * 100) : 0;
          return (
            <div key={lc} className={`rounded-xl border p-5 bg-gradient-to-br ${m.accent}`}>
              <div className={`h-10 w-10 rounded-lg ${m.iconBg} flex items-center justify-center ${m.iconColor}`}><Icon className="h-5 w-5" /></div>
              <div className={`mt-6 text-5xl font-bold tabular-nums ${m.valueColor}`}>{fmtN(value)}</div>
              <div className="mt-3 text-base font-semibold">{lc}</div>
              <div className="mt-1 text-sm text-muted-foreground">{m.desc}</div>
              <div className="mt-2 text-xs text-muted-foreground">{pct}% of sample</div>
            </div>
          );
        })}
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile label="Total Seekers" value={fmtN(REAL_TOTAL[instance] ?? 0)} description="In this district (live)" Icon={Users} />
        <MetricTile label="Applied (≥1)" value={fmtN(counts.applied)} description={`${seekers.length ? Math.round((counts.applied / seekers.length) * 100) : 0}% of sample`} Icon={Send} />
        <MetricTile label="Avg Applications" value={counts.avg} description="Per seeker (sample)" Icon={Activity} />
        <MetricTile label="New · 7d" value={fmtN(counts.c.New)} description="Joined in last week (sample)" Icon={UserPlus} />
      </div>

      {/* Roster */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by seeker ID, role or city…" className="pl-9 bg-muted/40 border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Role: All</SelectItem>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={lcFilter} onValueChange={setLcFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Lifecycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="At Risk">At Risk</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCsv} disabled={!filtered.length}><Download className="h-4 w-4" /> CSV</Button>
          <div className="text-xs text-muted-foreground whitespace-nowrap">{fmtN(filtered.length)} of {fmtN(seekers.length)}</div>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Seeker</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Role Wanted</th>
                <th className="px-4 py-2.5 font-medium">Education</th>
                <th className="px-4 py-2.5 font-medium">Experience</th>
                <th className="px-4 py-2.5 font-medium">Gender / Age</th>
                <th className="px-4 py-2.5 font-medium text-right">Applications</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-xs font-semibold text-primary">{s.id}</div>
                    <div className="text-[11px] text-muted-foreground">{s.city}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(s.joined)}</td>
                  <td className="px-4 py-2.5">{s.roleWanted}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.education}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.experience}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{s.genderMasked} · {s.ageMasked}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.applications}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className={`rounded-full ${LC_BADGE[s.lifecycle]}`}>{s.lifecycle}</Badge></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-sm text-muted-foreground py-10">No seekers match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > CAP && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t">Showing first {fmtN(CAP)} of {fmtN(filtered.length)} — refine with search or filters.</div>
        )}
      </div>
    </div>
  );
}
