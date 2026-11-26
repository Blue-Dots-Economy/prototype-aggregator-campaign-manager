import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./blue-dots-auth.server", () => ({ blueDotsClient: () => ({ rpc }) }));
import { loadScopedSeekers } from "./scoped-seekers.server";

const row = { item_id: "real-id", joined: null, profile_signal: "Strong", profile_completion: 100, status: "Active", applied: 8, accepted: 3, rejected: 2, pending: 1, services: 2, source: "QR" };
beforeEach(() => rpc.mockReset());
describe("one-RPC scoped seekers", () => {
  it("forwards every scope and preserves signal, lifecycle, funnel and source values", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    const result = await loadScopedSeekers("UP", "arm-id", "2026-11-01", "2026-12-01", "qr");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_bluedot_seekers", { p_instance: "UP", p_coordinator: "arm-id", p_from: "2026-11-01", p_to: "2026-12-01", p_source: "qr", p_limit: 1000 });
    expect(result).toEqual({ rows: [{ id: "real-id", userId: "", joined: "", profileSignal: "Strong", profileCompletion: 100, status: "Active", applied: 8, accepted: 3, rejected: 2, pending: 1, servicesAccepted: 2, source: "QR" }], capped: false });
  });
  it("returns exactly 1000 rows and marks the 1001-row RPC response capped", async () => {
    rpc.mockResolvedValue({ data: Array.from({ length: 1001 }, (_, i) => ({ ...row, item_id: String(i) })), error: null });
    const result = await loadScopedSeekers("KA", "arm-id");
    expect(result.rows).toHaveLength(1000);
    expect(result.rows.at(-1)?.id).toBe("999");
    expect(result.capped).toBe(true);
    expect(rpc).toHaveBeenCalledWith("get_bluedot_seekers", { p_instance: "KA", p_coordinator: "arm-id", p_from: null, p_to: null, p_source: null, p_limit: 1000 });
  });
  it("does not mark exactly 1000 rows capped", async () => {
    rpc.mockResolvedValue({ data: Array.from({ length: 1000 }, () => row), error: null });
    expect((await loadScopedSeekers("UP", "arm-id")).capped).toBe(false);
  });
  it("returns an empty result for null RPC data", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadScopedSeekers("UP", "arm-id")).toEqual({ rows: [], capped: false });
  });
  it("rejects RPC errors without exposing database details", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    await expect(loadScopedSeekers("UP", "arm-id")).rejects.toThrow("Couldn't load seekers");
  });
});
