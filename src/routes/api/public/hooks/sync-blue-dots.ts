import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-blue-dots")({
  server: { handlers: { POST: async ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { blueDotsClient } = await import("@/lib/blue-dots-auth.server");
    const { data } = await blueDotsClient().from("bd_sync_state").select("sync_token").eq("id", true).single();
    if (!data?.sync_token || token.length !== data.sync_token.length || !Array.from(token).reduce((same, c, i) => same & Number(c === data.sync_token[i]), 1)) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const { performBlueDotsSync } = await import("@/lib/blue-dots-sync.server");
      return Response.json(await performBlueDotsSync());
    } catch { return Response.json({ error: "Blue Dots update failed" }, { status: 500 }); }
  } } },
});