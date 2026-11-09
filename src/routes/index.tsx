import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProgram } from "@/programs/context";
import { useProgramAggregates } from "@/programs/useProgramAggregates";
import { ProgramAnalytics } from "@/components/metrics/ProgramAnalytics";
import {
  OverviewFilters,
  type OverviewFilterValue,
} from "@/components/metrics/OverviewFilters";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Campaign Overview | Blue Dots Dashboard" },
    { name: "description", content: "Blue Dots campaign outcomes, call performance and application metrics." },
    { property: "og:title", content: "Campaign Overview | Blue Dots Dashboard" },
    { property: "og:description", content: "Blue Dots campaign outcomes, call performance and application metrics." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Overview,
});

function Overview() {
  const { config } = useProgram();
  const isDkb = config.id === "dkb";
  const [filters, setFilters] = useState<OverviewFilterValue>({
    state: "all",
    dateFrom: null,
    dateTo: null,
    campaignType: "all",
    channel: "all",
  });
  const query = useProgramAggregates(config, filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <OverviewFilters value={filters} onChange={setFilters} showCampaignType={!isDkb} showChannel={!isDkb} />
        {query.isFetching && (
          <span className="text-xs text-muted-foreground">Updating…</span>
        )}
      </div>
      <ProgramAnalytics
        config={config}
        filters={filters}
        onClearFilters={() =>
          setFilters({
            state: "all",
            dateFrom: null,
            dateTo: null,
            campaignType: "all",
            channel: "all",
          })
        }
      />
    </div>
  );
}
