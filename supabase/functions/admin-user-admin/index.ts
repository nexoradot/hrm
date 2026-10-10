// NEXORA privileged user-management Edge Function.
// Deploy only with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configured as server secrets.
// Never expose the service-role key to browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ error: "Server configuration is incomplete." }, 500);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return response({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return response({ error: "Invalid session." }, 401);
  const { data: role, error: roleError } = await admin.from("platform_admins")
    .select("role,status").eq("user_id", callerData.user.id).maybeSingle();
  if (roleError || !role || role.status !== "active" || role.role !== "platform_admin") {
    return response({ error: "Platform administrator permission required." }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response({ error: "Valid JSON body required." }, 400); }
  const action = String(body.action || "");
  if (action === "list") {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return response({ error: error.message }, 400);
    return response({ users: (data.users || []).map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, banned_until: u.banned_until, email_confirmed_at: u.email_confirmed_at })) });
  }
  if (action === "invite") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({ error: "A valid email is required." }, 400);
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: String(body.redirectTo || "") || undefined });
    if (error) return response({ error: error.message }, 400);
    return response({ user: { id: data.user?.id, email: data.user?.email }, invited: true });
  }
  if (action === "suspend" || action === "unsuspend") {
    const userId = String(body.userId || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return response({ error: "Valid userId required." }, 400);
    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: action === "suspend" ? "876000h" : "none",
    });
    if (error) return response({ error: error.message }, 400);
    return response({ user: { id: data.user.id, email: data.user.email }, suspended: action === "suspend" });
  }
  return response({ error: "Unsupported action." }, 400);
});
