import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchDistrictRollup, statsFor, type RollupOrg, type RollupCoordinator, type RollupMember } from "@/lib/rollup.functions";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

export function useLiveRollup(instance: string, aggregatorId?: string, coordinatorId?: string) {
  const fn = useServerFn(fetchDistrictRollup);
  const query = useInfiniteQuery({
    queryKey: ["live-blue-dots", instance, aggregatorId ?? "", coordinatorId ?? ""], initialPageParam: 0,
    queryFn: ({ pageParam }) => fn({ data: { instance, aggregatorId, coordinatorId, offset: pageParam } }),
    getNextPageParam: page => page.available ? page.nextOffset ?? undefined : undefined,
    staleTime: 5 * 60_000,
  });
  useEffect(() => { if (query.hasNextPage && !query.isFetching && !query.isError) void query.fetchNextPage(); }, [query.hasNextPage, query.isFetching, query.isError, query.fetchNextPage]);
  const available = !!query.data && query.data.pages.every(p => p.available);
  const orgs = query.data?.pages.flatMap(p => p.available ? p.orgs : []) ?? [];
  return { ...query, orgs, available, loading: query.isPending || (query.hasNextPage && !query.isError), retry: () => void query.refetch() };
}
export type ParticipantView = "all" | "seeker" | "provider";
export interface LiveNode { id: string; name: string; dots: number; new7d: number; active: number; atRisk: number; inactive: number; applied: number; activity: number; quiet: boolean; members: RollupMember[] }
export function nodeFor(o: RollupOrg | RollupCoordinator, view: ParticipantView): LiveNode {
  const s = statsFor(o, view);
  const activity = s.dots ? Math.max(6, Math.min(100, Math.round((s.active / s.dots / 0.15) * 55 + (s.new7d / s.dots / 0.045) * 35 + 6))) : 0;
  return { ...s, id: o.id, name: "name" in o ? o.name : o.typeLabel, activity, quiet: s.new7d === 0, members: o.members.filter(m => view === "all" || m.kind === view) };
}
export function LiveState({ loading, retry, empty }: { loading: boolean; retry: () => void; empty?: string }) {
  return <section className="space-y-6"><h1 className="text-3xl font-bold">My Blue Dots</h1>{loading ? <div aria-label="Loading Blue Dots" className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div><Skeleton className="h-80 w-full" /></div> : <div className="py-16 text-center space-y-4"><p className="text-muted-foreground">{empty ?? "Couldn't load live Blue Dots data — Retry"}</p><Button variant="outline" onClick={retry}>Retry</Button></div>}</section>;
}
export function MemberTable({ members }: { members: RollupMember[] }) {
  return <div className="max-h-[560px] overflow-auto rounded-lg border"><table className="w-full min-w-[640px] text-sm"><thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr>{["Participant", "Joined", "Type", "Apps", "Live postings", "Lifecycle"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{members.map(m => <tr key={`${m.id}-${m.kind}`} className="border-t"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="rounded-full bg-muted text-muted-foreground p-2"><User className="h-4 w-4" /></div><span className="font-mono text-xs break-all">{m.id}</span></div></td><td className="px-4 py-3 whitespace-nowrap">{Number.isNaN(Date.parse(m.joined)) ? "—" : new Date(m.joined).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td><td className="px-4 py-3 capitalize">{m.kind}</td><td className="px-4 py-3">{m.applications}</td><td className="px-4 py-3">{m.livePostings}</td><td className="px-4 py-3"><Badge variant="outline">{m.lifecycle}</Badge></td></tr>)}</tbody></table>{!members.length && <p className="p-8 text-center text-muted-foreground">No participants found.</p>}</div>;
}