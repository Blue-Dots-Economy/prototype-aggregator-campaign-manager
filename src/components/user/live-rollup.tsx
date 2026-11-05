import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchDistrictRollup, fetchArmMembers, syncBlueDots, type RollupMember } from "@/lib/rollup.functions";
export { nodeFor, type LiveNode, type ParticipantView } from "@/lib/rollup.view";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, LoaderCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function useLiveRollup(instance: string, aggregatorId?: string, coordinatorId?: string) {
  const fn = useServerFn(fetchDistrictRollup);
  const sync = useServerFn(syncBlueDots);
  const cache = useQueryClient();
  const refresh = useMutation({ mutationFn: () => sync({ data: { instance, aggregatorId, coordinatorId } }), onSuccess: async (result) => {
    if (result.busy) throw new Error("An update is already running; try again shortly");
    await cache.invalidateQueries({ queryKey: ["live-blue-dots"] });
    await cache.invalidateQueries({ queryKey: ["blue-dots-members"] });
  } });
  const query = useInfiniteQuery({
    queryKey: ["live-blue-dots", instance, aggregatorId ?? "", coordinatorId ?? ""], initialPageParam: 0,
    queryFn: ({ pageParam }) => fn({ data: { instance, aggregatorId, coordinatorId, offset: pageParam } }),
    getNextPageParam: page => page.available ? page.nextOffset ?? undefined : undefined,
    staleTime: 5 * 60_000,
  });
  useEffect(() => { if (query.hasNextPage && !query.isFetching && !query.isError) void query.fetchNextPage(); }, [query.hasNextPage, query.isFetching, query.isError, query.fetchNextPage]);
  const available = !!query.data && query.data.pages.every(p => p.available);
  const orgs = query.data?.pages.flatMap(p => p.available ? p.orgs : []) ?? [];
  const first = query.data?.pages[0];
  return { ...query, orgs, available, updatedAt: first?.available ? first.updatedAt : null, refreshing: refresh.isPending, refreshError: refresh.error?.message, refresh: () => refresh.mutate(), loading: query.isPending || (query.hasNextPage && !query.isError), retry: () => void query.refetch() };
}
export function Freshness({ updatedAt, error }: { updatedAt?: string | null; error?: string }) {
  return <span className="text-xs text-muted-foreground" role={error ? "alert" : undefined}>{error ?? (updatedAt ? `Updated ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}` : "")}</span>;
}
export function useLiveMembers(instance: string, orgId: string | undefined, coordinatorId: string | undefined, kind: "all" | "seeker" | "provider", enabled: boolean) {
  const fn = useServerFn(fetchArmMembers);
  return useQuery({ queryKey: ["blue-dots-members", instance, orgId ?? "", coordinatorId ?? "", kind], queryFn: () => fn({ data: { instance, orgId, coordinatorId, kind } }), enabled, staleTime: 5 * 60_000 });
}
export function MemberLoading({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="flex justify-center py-12" aria-label="Loading participants"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="py-12 text-center space-y-3"><p className="text-muted-foreground">Couldn't load participants.</p><Button variant="outline" onClick={retry}>Retry</Button></div>;
  return null;
}
export function LiveState({ loading, retry, empty }: { loading: boolean; retry: () => void; empty?: string }) {
  return <section className="space-y-6"><h1 className="text-3xl font-bold">My Blue Dots</h1>{loading ? <div aria-label="Loading Blue Dots" className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div><Skeleton className="h-80 w-full" /></div> : <div className="py-16 text-center space-y-4"><p className="text-muted-foreground">{empty ?? "Couldn't load live Blue Dots data — Retry"}</p><Button variant="outline" onClick={retry}>Retry</Button></div>}</section>;
}
export function MemberTable({ members, avatarClasses = ["bg-muted text-muted-foreground"], months }: { members: RollupMember[]; avatarClasses?: string[]; months?: string[] }) {
  const joinedDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : months ? `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}` : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
  return <div className="max-h-[560px] overflow-auto rounded-lg border"><table className="w-full min-w-[640px] text-sm"><thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr>{["Participant", "Joined", "Type", "Apps", "Live postings", "Lifecycle"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{members.map(m => <tr key={`${m.id}-${m.kind}`} className="border-t"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className={`rounded-full p-2 ${avatarClasses[0] ?? "bg-muted text-muted-foreground"}`}><User className="h-4 w-4" /></div><span className="font-mono text-xs break-all">{m.id}</span></div></td><td className="px-4 py-3 whitespace-nowrap">{joinedDate(m.joined)}</td><td className="px-4 py-3 capitalize">{m.kind}</td><td className="px-4 py-3">{m.applications}</td><td className="px-4 py-3">{m.livePostings}</td><td className="px-4 py-3"><Badge variant="outline">{m.lifecycle}</Badge></td></tr>)}</tbody></table>{!members.length && <p className="p-8 text-center text-muted-foreground">No participants found.</p>}</div>;
}