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
  try {
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
  if (action === "create-company-admin") {
    const organizationId = String(body.organizationId || "");
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const password = String(body.password || "");
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return response({ error: "A valid organization is required." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({ error: "A valid login email is required." }, 400);
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return response({ error: "Temporary password must be at least 12 characters and include uppercase, lowercase, a number and a symbol." }, 400);
    if (!fullName) return response({ error: "Contact person's name is required." }, 400);
    const { data: org, error: orgError } = await admin.from("organizations").select("id,name,contact_email,contact_name,status").eq("id", organizationId).maybeSingle();
    if (orgError || !org) return response({ error: "Workspace not found." }, 404);
    if (String(org.contact_email || "").toLowerCase() !== email) return response({ error: "Login email must match the company's registered contact email." }, 409);
    let emailAlreadyExists = false;
    for (let page = 1; page <= 20; page++) {
      const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError) return response({ error: "Could not verify whether this login email is already registered: " + listError.message }, 500);
      const batch = existing.users || [];
      if (batch.some(u => (u.email || "").toLowerCase() === email)) { emailAlreadyExists = true; break; }
      if (batch.length < 1000) break;
    }
    if (emailAlreadyExists) return response({ error: "An account already exists for this email. Use the existing account invitation or account-recovery workflow; no password was changed." }, 409);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, require_password_change: true, provisioned_by: "nexora_super_admin", organization_id: organizationId }
    });
    if (createError || !created.user) return response({ error: createError?.message || "Could not create the company administrator account." }, 400);
    const { error: memberError } = await admin.from("organization_members").upsert({
      organization_id: organizationId, user_id: created.user.id, role: "owner", status: org.status === "active" ? "active" : "pending", invited_by: callerData.user.id
    }, { onConflict: "organization_id,user_id" });
    if (memberError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return response({ error: "Account creation was rolled back because workspace membership failed: " + memberError.message }, 500);
    }
    return response({ user: { id: created.user.id, email: created.user.email }, organization: { id: org.id, name: org.name }, membershipStatus: org.status === "active" ? "active" : "pending", requirePasswordChange: true });
  }
  if (action === "reset-company-admin-password") {
    const organizationId = String(body.organizationId || "");
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return response({ error: "A valid workspace is required." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({ error: "A valid company login email is required." }, 400);
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return response({ error: "Password must be at least 12 characters and include uppercase, lowercase, a number and a symbol." }, 400);
    const { data: org, error: orgError } = await admin.from("organizations").select("id,name,contact_email").eq("id", organizationId).maybeSingle();
    if (orgError || !org) return response({ error: "Workspace not found." }, 404);
    if (String(org.contact_email || "").trim().toLowerCase() !== email) return response({ error: "Password can only be reset for the registered company contact email." }, 409);
    let user = null;
    for (let page = 1; page <= 20; page++) {
      const { data: batchData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError) return response({ error: "Could not find the company login account: " + listError.message }, 500);
      const batch = batchData.users || [];
      user = batch.find(u => (u.email || "").trim().toLowerCase() === email) || null;
      if (user || batch.length < 1000) break;
    }
    let createdDuringReset = false;
    if (!user) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: String(org.contact_name || org.name || email), require_password_change: true, provisioned_by: "nexora_super_admin_password_recovery", organization_id: organizationId }
      });
      if (createError || !created.user) return response({ error: "No existing login was found and account recovery could not create one: " + (createError?.message || "Unknown Auth error") }, 400);
      user = created.user;
      createdDuringReset = true;
    }
    const { data: membership, error: membershipError } = await admin.from("organization_members").select("id,status").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
    if (membershipError) {
      if (createdDuringReset) await admin.auth.admin.deleteUser(user.id);
      return response({ error: "Could not verify company workspace membership: " + membershipError.message }, 500);
    }
    if (!membership) {
      const { error: linkError } = await admin.from("organization_members").upsert({
        organization_id: organizationId, user_id: user.id, role: "owner", status: org.status === "active" ? "active" : "pending", invited_by: callerData.user.id
      }, { onConflict: "organization_id,user_id" });
      if (linkError) {
        if (createdDuringReset) await admin.auth.admin.deleteUser(user.id);
        return response({ error: "The login was found, but company workspace access could not be linked: " + linkError.message }, 500);
      }
    }
    const userMetadata = { ...(user.user_metadata || {}), require_password_change: true, password_reset_by: "nexora_super_admin", password_reset_at: new Date().toISOString(), organization_id: organizationId };
    const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(user.id, { password, user_metadata: userMetadata });
    if (updateError || !updated.user) return response({ error: updateError?.message || "Password update failed." }, 400);
    return response({ user: { id: updated.user.id, email: updated.user.email }, passwordChanged: true, requirePasswordChange: true, accountCreated: createdDuringReset });
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
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: String(body.redirectTo || "") || undefined });
    if (error) return response({ error: error.message }, 400);
    const userId = data.user?.id;
    if (!userId) return response({ error: "Invitation was requested but no user ID was returned." }, 502);
    const { error: memberError } = await admin.from("organization_members").upsert({
      organization_id: organizationId, user_id: userId, role, status: "pending", invited_by: callerData.user.id
    }, { onConflict: "organization_id,user_id" });
    if (memberError) return response({ error: "Invitation was sent, but workspace membership could not be prepared: " + memberError.message, invited: true, userId }, 500);
    return response({ user: { id: userId, email: data.user?.email }, invited: true, membershipStatus: "pending" });
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
  } catch (error) {
    console.error("admin-user-admin request failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return response({ error: "Unexpected server error while processing the request.", detail: message }, 500);
  }
});