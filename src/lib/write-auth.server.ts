import { getCookie } from "@tanstack/react-start/server";
import { jwtVerify } from "jose";
import { assertWritableRole } from "@/auth/write-policy";

export async function requireWriteAccess() {
  const token = getCookie("bd_session");
  const secret = process.env.BD_SESSION_SECRET;
  if (!token || !secret) throw new Error("Please sign in again before making changes.");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
  if (typeof payload.email !== "string") throw new Error("Unauthorized");
  const { sbForAuth } = await import("./db.server");
  const client = sbForAuth();
  const { data: actor, error } = await client.from("app_users").select("role,active").eq("email", payload.email).maybeSingle();
  if (error) throw new Error("Unable to verify write access.");
  if (actor) {
    if (!actor.active) throw new Error("Unauthorized");
    assertWritableRole(actor.role);
    return;
  }
  const { data: reviewer } = await client.from("reviewers").select("email").eq("email", payload.email).maybeSingle();
  const legacy = ["admin@bluedots.com", "sanketika@bluedots.com", "aggregator-coordinator@bluedots.com", "aggregator-owner@bluedots.com", "ecosystem@bluedots.com"];
  if (!reviewer && !legacy.includes(payload.email)) throw new Error("Unauthorized");
}
