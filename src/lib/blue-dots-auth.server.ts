import { SignJWT, jwtVerify } from "jose";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export function blueDotsClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Blue Dots mirror is unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function signingKey() {
  const secret = process.env.BD_SESSION_SECRET;
  if (!secret) throw new Error("Blue Dots session is unavailable");
  return new TextEncoder().encode(secret);
}
export async function issueBlueDotsSession(email: string) {
  const token = await new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(signingKey());
  setCookie("bd_session", token, { httpOnly: true, secure: import.meta.env.PROD, sameSite: "lax", path: "/", maxAge: 43200 });
}
export async function blueDotsScope(input: { instance: string; aggregatorId?: string | null; coordinatorId?: string | null }) {
  const token = getCookie("bd_session");
  if (!token) throw new Error("Please sign in again to view Blue Dots");
  const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
  if (typeof payload.email !== "string") throw new Error("Unauthorized");
  const { sbForAuth } = await import("./db.server");
  const { data: actor, error } = await sbForAuth().from("app_users").select("role,district,node_name,active").eq("email", payload.email).eq("active", true).maybeSingle();
  if (error || !actor) throw new Error("Unauthorized");
  if (actor.role === "admin") return input;
  const districts: Record<string, string> = { Ghaziabad: "UP", GZB: "UP", UP: "UP", "Hubli-Dharwad": "KA", Dharwad: "KA", Karnataka: "KA", KA: "KA" };
  const instance = districts[actor.district ?? ""];
  if (!instance || instance !== input.instance) throw new Error("Unauthorized district");
  if (actor.role === "jfc") return input;
  if (actor.role === "owner" && actor.node_name) return { ...input, aggregatorId: actor.node_name };
  if (actor.role === "coordinator" && actor.node_name) return { ...input, coordinatorId: actor.node_name, aggregatorId: null };
  throw new Error("Unauthorized");
}