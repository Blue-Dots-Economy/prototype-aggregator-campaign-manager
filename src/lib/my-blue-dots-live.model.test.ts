import { describe, expect, it } from "vitest";
import { aggregateActions, mapLiveProfile, computeStatus, computeAction, summarizeSeekers, type LiveProfile, type ApplyAction } from "./my-blue-dots-live.model";
const now = Date.parse("2026-11-24T15:00:00Z");
const profile: LiveProfile = { item_id: "p1", created_by: "u1", created_at: "2026-10-01T15:00:00Z", instance: "UP", role_wanted_raw: "Driver", age_masked: "25–34", education_category: "Secondary", work_experience: "None", is_default_geo: false };
const map = (overrides: Partial<LiveProfile> = {}) => mapLiveProfile({ ...profile, ...overrides }, new Map(), now);
describe("live privacy-safe profile checks", () => {
  it("Role requires a nonblank value other than any", () => {
    expect(map({ role_wanted_raw: " AnY " }).profileFieldChecks.find(f => f.label === "Role")?.passed).toBe(false);
    expect(map({ role_wanted_raw: " " }).profileFieldChecks.find(f => f.label === "Role")?.passed).toBe(false);
    expect(map().profileFieldChecks.find(f => f.label === "Role")?.passed).toBe(true);
  });
  it("Age requires nonblank masked age", () => {
    expect(map({ age_masked: " " }).profileFieldChecks.find(f => f.label === "Age")?.passed).toBe(false);
    expect(map().profileFieldChecks.find(f => f.label === "Age")?.passed).toBe(true);
  });
  it("Education requires nonblank category", () => {
    expect(map({ education_category: null }).profileFieldChecks.find(f => f.label === "Education")?.passed).toBe(false);
    expect(map().profileFieldChecks.find(f => f.label === "Education")?.passed).toBe(true);
  });
  it("Experience requires nonblank experience and accepts None", () => {
    expect(map({ work_experience: " " }).profileFieldChecks.find(f => f.label === "Experience")?.passed).toBe(false);
    expect(map().profileFieldChecks.find(f => f.label === "Experience")?.passed).toBe(true);
  });
  it("Location requires explicit false, never null/default", () => {
    expect(map({ is_default_geo: true }).profileFieldChecks.find(f => f.label === "Location")?.passed).toBe(false);
    expect(map({ is_default_geo: null }).profileFieldChecks.find(f => f.label === "Location")?.passed).toBe(false);
    expect(map().profileFieldChecks.find(f => f.label === "Location")?.passed).toBe(true);
  });
  it("Complete and Strong require all five checks", () => {
    expect(map()).toMatchObject({ profileCompletion: 100, profileStatus: "Complete", profileSignal: "Strong", name: "", phone: "" });
    expect(map({ education_category: null })).toMatchObject({ profileCompletion: 80, profileStatus: "Incomplete", profileSignal: "Moderate" });
  });
  it("Moderate requires Role, Age and Location; otherwise Weak", () => {
    expect(map({ education_category: null, work_experience: null }).profileSignal).toBe("Moderate");
    expect(map({ age_masked: null }).profileSignal).toBe("Weak");
    expect(map({ role_wanted_raw: "any" }).profileSignal).toBe("Weak");
    expect(map({ is_default_geo: true }).profileSignal).toBe("Weak");
  });
  it("maps IDs, role and live created date without inventing PII", () => {
    expect(map()).toMatchObject({ id: "p1", userId: "u1", instance: "UP", role: "Driver", createdOn: profile.created_at, profileAge: 54, lastAppliedAge: null });
  });
});
describe("live apply funnel and lifecycle", () => {
  const actions: ApplyAction[] = ["created", "accepted", "rejected", "cancelled"].map((action_status, i) => ({ action_id: `a${i}`, source_item_id: "p1", action_status, created_at: "2026-11-23T15:00:00Z", instance: "UP" }));
  it("counts every apply, with created alone pending and cancelled included only in total", () => {
    const s = mapLiveProfile(profile, aggregateActions(actions), now);
    expect(s).toMatchObject({ applications: 4, accepted: 1, rejected: 1, pending: 1, cancelled: 1, lastAppliedAge: 1, status: "Active" });
  });
  it("never joins reused IDs across instances", () => {
    expect(mapLiveProfile({ ...profile, instance: "KA" }, aggregateActions(actions), now).applications).toBe(0);
  });
  it("uses the latest valid apply date", () => {
    const older = { ...actions[0], action_id: "older", source_item_id: "p1", action_status: "created", instance: "UP", created_at: "2026-09-01T15:00:00Z" };
    expect(mapLiveProfile(profile, aggregateActions([older, ...actions]), now).lastAppliedAge).toBe(1);
  });
  it("preserves New precedence through day seven", () => {
    expect(computeStatus(7, null)).toBe("New"); expect(computeStatus(8, null)).toBe("Inactive");
  });
  it("preserves Active through day 30 and At Risk through day 90", () => {
    expect(computeStatus(54, 30)).toBe("Active"); expect(computeStatus(54, 31)).toBe("At Risk");
    expect(computeStatus(100, 90)).toBe("At Risk"); expect(computeStatus(100, 91)).toBe("Inactive");
  });
  it("preserves existing recommended-action rules", () => {
    expect(computeAction("Active", "Incomplete", 1)).toBe("Complete Profile");
    expect(computeAction("New", "Complete", null)).toBe("Automated Call");
    expect(computeAction("At Risk", "Complete", 40)).toBe("Automated Call");
    expect(computeAction("Inactive", "Complete", null)).toBe("Manual Call");
    expect(computeAction("Active", "Complete", 14)).toBe("No Action");
    expect(computeAction("Active", "Complete", 15)).toBe("Automated Call");
  });
  it("summarizes profiles separately from users and application totals", () => {
    const s = mapLiveProfile(profile, aggregateActions(actions), now);
    const summary = summarizeSeekers([s, map({ item_id: "p2" }), map({ item_id: "p3", created_by: "u2", age_masked: null })]);
    expect(summary).toMatchObject({ profiles: 3, users: 2, usersMulti: 1, usersWithApps: 1, complete: 2, applications: 4, lifecycle: { New: 0, Active: 1, "At Risk": 0, Inactive: 2 } });
    expect(summary.signalByStatus.Inactive).toEqual({ Strong: 1, Moderate: 0, Weak: 1 });
  });
});