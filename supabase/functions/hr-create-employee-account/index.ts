// Create an employee login securely for an existing HR employee record.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "POST required." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return reply({ error: "Server configuration is incomplete." }, 500);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return reply({ error: "Your session is invalid. Sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Valid JSON body required." }, 400); }
  const organizationId = String(body.organizationId || "");
  const employeeId = String(body.employeeId || "");
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const password = String(body.password || "");
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[0-9a-f-]{36}$/i.test(employeeId)) return reply({ error: "A valid organisation and employee record are required." }, 400);
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return reply({ error: "Enter a valid employee work email before creating a login." }, 400);
  if (!fullName) return reply({ error: "Employee name is required." }, 400);
  if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return reply({ error: "Password must be at least 6 characters and include uppercase, lowercase, a number and a symbol." }, 400);
  }

  const { data: org, error: orgError } = await admin.from("organizations").select("id,status").eq("id", organizationId).maybeSingle();
  if (orgError || !org || org.status !== "active") return reply({ error: "The selected organisation is not active." }, 403);
  const { data: membership, error: membershipError } = await admin.from("organization_members")
    .select("role,status").eq("organization_id", organizationId).eq("user_id", authData.user.id).maybeSingle();
  const { data: platformAdmin, error: platformError } = await admin.from("platform_admins")
    .select("role,status").eq("user_id", authData.user.id).eq("status", "active").maybeSingle();
  if (membershipError || platformError) return reply({ error: "Could not verify your HR permissions." }, 500);
  const authorised = (membership?.status === "active" && ["owner", "hr_manager"].includes(String(membership.role))) ||
    (platformAdmin?.status === "active" && platformAdmin.role === "platform_admin");
  if (!authorised) return reply({ error: "Only an active organisation owner, HR manager or platform administrator can create employee logins." }, 403);

  const { data: employee, error: employeeError } = await admin.from("hr_employees")
    .select("id,organization_id,email,full_name,user_id,employment_status")
    .eq("id", employeeId).eq("organization_id", organizationId).maybeSingle();
  if (employeeError || !employee) return reply({ error: "Employee record not found in this organisation." }, 404);
  if (employee.user_id) return reply({ error: "This employee already has a linked login account." }, 409);
  if (employee.employment_status === "terminated") return reply({ error: "A login cannot be created for a terminated employee." }, 409);
  if (String(employee.email || "").trim().toLowerCase() !== email) return reply({ error: "The login email must match the employee record email." }, 409);

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return reply({ error: "Could not verify the login email: " + error.message }, 500);
    const batch = data.users || [];
    if (batch.some((u) => (u.email || "").trim().toLowerCase() === email)) return reply({ error: "A login account already exists for this email. Use account recovery or resolve the existing account; no password was changed." }, 409);
    if (batch.length < 1000) break;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, account_type: "employee", organization_id: organizationId },
  });
  if (createError || !created.user) return reply({ error: createError?.message || "Could not create the employee login." }, 400);
  const employeeUserId = created.user.id;
  const { error: memberInsertError } = await admin.from("organization_members").insert({
    organization_id: organizationId, user_id: employeeUserId, role: "employee", status: "active",
  });
  if (memberInsertError) {
    await admin.auth.admin.deleteUser(employeeUserId);
    return reply({ error: "Login creation was rolled back because employee workspace access could not be created: " + memberInsertError.message }, 500);
  }
  const { data: linked, error: linkError } = await admin.from("hr_employees")
    .update({ user_id: employeeUserId, updated_at: new Date().toISOString() })
    .eq("id", employeeId).eq("organization_id", organizationId).is("user_id", null).select("id").maybeSingle();
  if (linkError || !linked) {
    await admin.from("organization_members").delete().eq("organization_id", organizationId).eq("user_id", employeeUserId);
    await admin.auth.admin.deleteUser(employeeUserId);
    return reply({ error: "Login creation was rolled back because the employee profile could not be linked safely." }, 500);
  }
  return reply({ success: true, employeeId, userId: employeeUserId, email, message: "Employee login created and linked. The employee can now sign in to the employee portal." });
});
