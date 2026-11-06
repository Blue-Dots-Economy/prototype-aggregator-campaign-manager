import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export type StageSegment = { label: string; value: number; barClass: string };

function SegmentedBar({ segments, total }: { segments: StageSegment[]; total: number }) {
  return (
    <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      {total > 0 &&
        segments.map((s) =>
          s.value > 0 ? (
            <div key={s.label} className={s.barClass} style={{ width: `${(s.value / total) * 100}%` }} />
          ) : null,
        )}
    </div>
  );
}

/** One column per funnel stage: total + proportional bar, full split on hover. */
export function StageCell({ title, total, segments }: { title: string; total: number; segments: StageSegment[] }) {
  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <div className="inline-flex cursor-default items-center gap-2 tabular-nums">
          <span className="w-6 text-right font-medium">{total}</span>
          <SegmentedBar segments={segments} total={total} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-48 p-3 text-xs">
        <div className="mb-2 font-semibold">{title}</div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted-foreground">Total</span>
          <span className="tabular-nums font-medium">{total}</span>
        </div>
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between py-0.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${s.barClass}`} />
              {s.label}
            </span>
            <span className="tabular-nums">{s.value}</span>
          </div>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
