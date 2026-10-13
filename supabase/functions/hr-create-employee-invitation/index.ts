import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return respond({ error: "Invitation service is not configured." }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in as an authorised HR user first." }, 401);
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return respond({ error: "Your session is invalid or expired. Sign in again." }, 401);

  let body: { organization_id?: string; email?: string; first_name?: string; last_name?: string; department?: string; job_title?: string; redirect_url?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid request body." }, 400); }
  const organizationId = String(body.organization_id || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const firstName = String(body.first_name || "").trim();
  const lastName = String(body.last_name || "").trim();
  if (!organizationId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !firstName || !lastName) {
    return respond({ error: "Organisation, valid work email, first name and last name are required." }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: membership, error: memberError } = await admin.from("organization_members")
    .select("role,status").eq("organization_id", organizationId).eq("user_id", caller.id).eq("status", "active")
    .in("role", ["owner", "hr_manager"]).maybeSingle();
  const { data: platformAdmin } = await admin.from("platform_admins").select("user_id")
    .eq("user_id", caller.id).eq("status", "active").maybeSingle();
  if (memberError || (!membership && !platformAdmin)) return respond({ error: "Only an active organisation owner, HR manager or platform administrator can invite staff." }, 403);

  const { data: organization, error: orgError } = await admin.from("organizations").select("id,name,status")
    .eq("id", organizationId).eq("status", "active").maybeSingle();
  if (orgError || !organization) return respond({ error: "The selected organisation is not active." }, 400);

  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const already = existing?.users?.find((u) => (u.email || "").toLowerCase() === email);
  if (already) return respond({ error: "This email already has a NEXORA account. Ask the employee to sign in or use account recovery; no duplicate account was created." }, 409);

  const appUrl = String(body.redirect_url || "").trim();
  const allowedRedirect = appUrl.startsWith("https://nexoradot.github.io/hrm/") ? appUrl : "https://nexoradot.github.io/hrm/company-portal/employee-registration.html";
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: allowedRedirect,
    data: { first_name: firstName, last_name: lastName, organization_id: organizationId, department: body.department || null, job_title: body.job_title || null, invited_by: caller.id }
  });
  if (inviteError || !invite.user) return respond({ error: inviteError?.message || "Could not create the employee account invitation." }, 502);
  const employeeUserId = invite.user.id;
  const { error: memberInsertError } = await admin.from("organization_members").insert({
    organization_id: organizationId, user_id: employeeUserId, role: "employee", status: "active"
  });
  if (memberInsertError) {
    await admin.auth.admin.deleteUser(employeeUserId);
    return respond({ error: "Invitation membership could not be created: " + memberInsertError.message }, 500);
  }

  return respond({
    success: true,
    message: "Employee account invitation processed. Ask the employee to check their email, including spam/junk, for the secure account setup link.",
    email,
    organization: organization.name
  });
});