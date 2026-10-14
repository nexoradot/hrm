// NEXORA privileged user-management Edge Function.
// Deploy with SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY as server secrets.
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return response({ error: "Server configuration is incomplete. Configure SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY." }, 500);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return response({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const caller = createClient(url, anonKey, {
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
    const users = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return response({ error: error.message }, 400);
      const batch = data.users || [];
      users.push(...batch.map(u => ({
        id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until, email_confirmed_at: u.email_confirmed_at
      })));
      if (batch.length < 1000) break;
    }
    return response({ users });
  }
  if (action === "list-workspaces") {
    const [orgResult, memberResult] = await Promise.all([
      admin.from("organizations").select("id,name,status,plan").order("name"),
      admin.from("organization_members").select("id,organization_id,user_id,role,status,created_at").order("created_at", { ascending: false })
    ]);
    if (orgResult.error) return response({ error: "Could not load workspaces: " + orgResult.error.message }, 400);
    if (memberResult.error) return response({ error: "Could not load workspace memberships: " + memberResult.error.message }, 400);
    return response({ organizations: orgResult.data || [], memberships: memberResult.data || [] });
  }
  if (action === "invite") {
    const email = String(body.email || "").trim().toLowerCase();
    const organizationId = String(body.organizationId || "");
    const role = String(body.role || "hr_manager");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({ error: "A valid email is required." }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return response({ error: "Choose a valid workspace." }, 400);
    if (!["owner","hr_manager","recruiter","consultant","member","viewer"].includes(role)) return response({ error: "Unsupported workspace role." }, 400);
    const { data: org, error: orgError } = await admin.from("organizations").select("id,status").eq("id", organizationId).maybeSingle();
    if (orgError || !org) return response({ error: "Workspace not found." }, 404);
    if (org.status !== "active") return response({ error: "Activate the workspace before inviting its users." }, 409);
    // Reuse an existing Auth account when the email is already registered.
    // inviteUserByEmail is only for new accounts; existing accounts should be
    // linked to the workspace instead of failing with "User already registered".
    let existingUser: { id: string; email?: string } | null = null;
    for (let page = 1; page <= 20; page++) {
      const { data: pageData, error: pageError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (pageError) return response({ error: "Could not check existing Auth accounts: " + pageError.message }, 400);
      const batch = pageData.users || [];
      const match = batch.find((u) => (u.email || "").toLowerCase() === email);
      if (match) { existingUser = { id: match.id, email: match.email }; break; }
      if (batch.length < 1000) break;
    }

    let userId = existingUser?.id || "";
    let userEmail = existingUser?.email || email;
    let invited = false;
    if (!existingUser) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: String(body.redirectTo || "") || undefined });
      if (error) return response({ error: error.message }, 400);
      userId = data.user?.id || "";
      userEmail = data.user?.email || email;
      invited = true;
      if (!userId) return response({ error: "Invitation was requested but no user ID was returned." }, 502);
    }

    const { error: memberError } = await admin.from("organization_members").upsert({
      organization_id: organizationId, user_id: userId, role, status: "pending", invited_by: callerData.user.id
    }, { onConflict: "organization_id,user_id" });
    if (memberError) return response({
      error: (invited ? "Invitation was sent" : "Existing Auth account was found") + ", but workspace membership could not be prepared: " + memberError.message,
      invited, userId
    }, 500);
    return response({
      user: { id: userId, email: userEmail },
      invited,
      existingAccount: !!existingUser,
      membershipStatus: "pending",
      message: existingUser
        ? "Existing account linked to the workspace. Membership is pending activation."
        : "Invitation sent. Membership is pending activation."
    });
  }
  if (action === "suspend" || action === "unsuspend") {
    const userId = String(body.userId || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return response({ error: "Valid userId required." }, 400);
    if (userId === callerData.user.id && action === "suspend") return response({ error: "You cannot suspend your own active administrator session." }, 409);
    const { data, error } = await admin.auth.admin.updateUserById(userId, { ban_duration: action === "suspend" ? "876000h" : "none" });
    if (error) return response({ error: error.message }, 400);
    return response({ user: { id: data.user.id, email: data.user.email }, suspended: action === "suspend" });
  }
  return response({ error: "Unsupported action." }, 400);
});
