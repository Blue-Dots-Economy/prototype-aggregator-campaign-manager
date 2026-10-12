import { createServerFn } from "@tanstack/react-start";
import type { DistrictRollup } from "./rollup.server";

export type { DistrictRollup, RollupOrg, RollupSeeker } from "./rollup.server";

export const fetchDistrictRollup = createServerFn({ method: "POST" })
  .inputValidator((d: { instance: string }) => ({ instance: d.instance === "KA" ? "KA" : d.instance === "UP" ? "UP" : "" }))
  .handler(async ({ data }): Promise<DistrictRollup> => {
    if (!data.instance) return { available: false };
    const { loadDistrictRollup } = await import("./rollup.server");
    return loadDistrictRollup(data.instance);
  });
