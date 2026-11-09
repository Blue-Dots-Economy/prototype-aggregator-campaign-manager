import { describe, it, expect } from "vitest";
import { canAccess, landingFor } from "./permissions";
import { assertWritableRole } from "./write-policy";
describe("read-only JFC", () => {
  for (const path of ["/user-level-analysis", "/", "/campaigns", "/review", "/ecosystem-view", "/review/call-123"]) {
    it(`can read ${path}`, () => expect(canAccess("jfc_readonly", path)).toBe(true));
  }
  for (const path of ["/launch", "/campaign-requests", "/request-campaign", "/cm-test"]) {
    it(`cannot open ${path}`, () => expect(canAccess("jfc_readonly", path)).toBe(false));
    it(`preserves JFC access to ${path}`, () => expect(canAccess("jfc", path)).toBe(true));
  }
  it("lands on My Blue Dots", () => expect(landingFor("jfc_readonly")).toBe("/user-level-analysis"));
  it("cannot write", () => expect(() => assertWritableRole("jfc_readonly")).toThrow("read-only"));
  it("requires a verified role", () => expect(() => assertWritableRole(null)).toThrow());
  it("preserves JFC writes", () => expect(() => assertWritableRole("jfc")).not.toThrow());
});
