import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Info, ArrowUpDown, Users } from "lucide-react";

import { Panel } from "@/components/Panel";
import { MetricCard } from "@/components/metrics/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/context";
import { canAccess, landingFor } from "@/auth/permissions";
import { fetchMyBlueDots, type BlueDot } from "@/lib/my-blue-dots.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-blue-dots")({
  head: () => ({
    meta: [
      { title: "My Blue Dots · District Roster" },
      { name: "description", content: "Every Blue Dot onboarded across your district — seekers and providers." },
      { property: "og:title", content: "My Blue Dots · District Roster" },
      { property: "og:description", content: "Every Blue Dot onboarded across your district — seekers and providers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyBlueDotsPage,
});

const DISTRICTS = ["Ghaziabad", "Hubli-Dharwad"] as const;
type SortKey = "name" | "calls" | "campaigns" | "onboardedAt";
type Kind = "all" | "seeker" | "provider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(v: string | null, withYear: boolean) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const s = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${s} ${d.getFullYear()}` : s;
}
const fmt1 = (n: number | null) => (n === null ? "—" : n.toFixed(1));
const fmtN = (n: number) => n.toLocaleString("en-IN");
const CAP = 500;

function MyBlueDotsPage() {
  const { session, hydrated } = useAuth();
  const role = session?.role;
  const navigate = useNavigate();
  const allowed = canAccess(role, "/my-blue-dots");

  useEffect(() => {
    if (hydrated && !allowed) navigate({ to: landingFor(role) });
  }, [hydrated, allowed, role, navigate]);

  const sessionDistrict = session?.district || null;
  const [picked, setPicked] = useState<string>("Ghaziabad");
  const effectiveDistrict = sessionDistrict ?? picked;

  const fn = useServerFn(fetchMyBlueDots);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-blue-dots", effectiveDistrict],
    queryFn: () => fn({ data: { district: effectiveDistrict } }),
    staleTime: 60_000,
    enabled: allowed,
  });

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "calls", dir: "desc" });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = (data?.dots ?? []).filter((d) => {
      if (kind !== "all" && d.kind !== kind) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || d.phone_masked.toLowerCase().includes(q) || d.region.toLowerCase().includes(q);
    });
    const m = sort.dir === "asc" ? 1 : -1;
    const val = (d: BlueDot) =>
      sort.key === "name" ? d.name.toLowerCase()
      : sort.key === "onboardedAt" ? (d.onboardedAt ? new Date(d.onboardedAt).getTime() || 0 : 0)
      : d[sort.key];
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return x < y ? -m : x > y ? m : 0;
    });
  }, [data, search, kind, sort]);

  const visible = filtered.slice(0, CAP);


  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  const downloadCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Name", "Type", "Phone(masked)", "Region", "Calls", "Campaigns", "Applications", "Intent", "Confidence", "Onboarded", "Last Call"];
    const lines = filtered.map((d) =>
      [d.name, d.kind, d.phone_masked, d.region, d.calls, d.campaigns, d.applications, fmt1(d.intent), fmt1(d.confidence), fmtDate(d.onboardedAt, true), fmtDate(d.lastCallDate, true)].map(esc).join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-blue-dots-${effectiveDistrict}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hydrated || !allowed) return null;

  const s = data?.summary;
  const SortTh = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={cn("px-3 py-2 font-medium", right && "text-right")}>
      <button type="button" onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === k && "text-foreground")}>
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Blue Dots</h1>
            <Badge variant="secondary" className="bg-brand-soft text-brand">
              {effectiveDistrict}{data?.instance ? ` · ${data.instance}` : ""}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Every Blue Dot onboarded across your district — seekers and providers.</p>
        </div>
        {!sessionDistrict && role === "admin" && (
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger className="w-48" aria-label="Choose district"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Blue Dots…</div>
        </div>
      ) : error ? (
        <Panel><p className="text-sm text-muted-foreground">Couldn't load Blue Dots. Please try again.</p></Panel>
      ) : data && !data.available ? (
        <Panel><p className="text-sm text-muted-foreground">Blue Dots source isn't configured.</p></Panel>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total Blue Dots" value={fmtN(s.total)} />
            <MetricCard label="Seekers" value={fmtN(s.seekers)} />
            <MetricCard label="Providers" value={fmtN(s.providers)} />
            <MetricCard label="Ever Applied" value={fmtN(s.applied)} />
            <MetricCard label="Ever Answered" value={fmtN(s.answered)} />
            <MetricCard label="Onboarded · 30d" value={fmtN(s.onboarded30)} />
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Aggregator-owner and coordinator breakdown activates once onboarding attribution is populated. For now this shows the full district roster.</p>
          </div>

          {s.total === 0 ? (
            <Panel>
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="rounded-full bg-brand-soft p-3 text-brand"><Users className="h-6 w-6" /></div>
                <p className="text-sm text-muted-foreground">No Blue Dots found for this district yet.</p>
              </div>
            </Panel>
          ) : (
            <Panel
              title="Roster"
              description={`Showing ${fmtN(filtered.length)} of ${fmtN(s.total)}`}
              action={
                <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={!filtered.length}>
                  <Download className="mr-1.5 h-4 w-4" /> Download CSV
                </Button>
              }
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or region" className="max-w-xs" />
                <div role="group" aria-label="Filter by type" className="inline-flex rounded-lg bg-muted p-1">
                  {(["all", "seeker", "provider"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      aria-pressed={kind === k}
                      className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {k === "all" ? "All" : k === "seeker" ? "Seekers" : "Providers"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[560px] overflow-auto rounded-lg border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <SortTh k="name" label="Name" />
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Region</th>
                      <SortTh k="calls" label="Calls" right />
                      <SortTh k="campaigns" label="Campaigns" right />
                      <th className="px-3 py-2 text-right font-medium">Applications</th>
                      <th className="px-3 py-2 text-right font-medium">Intent</th>
                      <th className="px-3 py-2 text-right font-medium">Confidence</th>
                      <SortTh k="onboardedAt" label="Onboarded" right />
                      <th className="px-3 py-2 text-right font-medium">Last Call</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {visible.map((d) => (
                      <tr key={`${d.kind}-${d.id}`} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.phone_masked}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", d.kind === "seeker" ? "bg-brand-soft text-brand" : "bg-secondary text-secondary-foreground")}>{d.kind}</span>
                        </td>
                        <td className="px-3 py-2">{d.region}</td>
                        <td className="px-3 py-2 text-right">{fmtN(d.calls)}</td>
                        <td className="px-3 py-2 text-right">{fmtN(d.campaigns)}</td>
                        <td className="px-3 py-2 text-right">{fmtN(d.applications)}</td>
                        <td className="px-3 py-2 text-right">{fmt1(d.intent)}</td>
                        <td className="px-3 py-2 text-right">{fmt1(d.confidence)}</td>
                        <td className="px-3 py-2 text-right">{fmtDate(d.onboardedAt, true)}</td>
                        <td className="px-3 py-2 text-right">{fmtDate(d.lastCallDate, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > CAP && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first {fmtN(CAP)} of {filtered.length.toLocaleString("en-IN")} — refine your search to narrow the list.
                </p>
              )}
            </Panel>
          )}
        </>
      ) : null}
    </div>
  );
}
