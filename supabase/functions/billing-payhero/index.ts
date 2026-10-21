// NEXORA subscription checkout through PayHero M-Pesa.
// Configure secrets: PAYHERO_BASIC_AUTH, PAYHERO_CHANNEL_ID, PAYHERO_ACCOUNT_ID,
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Never expose PayHero credentials or the service-role key in browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const plans = {
  starter: { name: "Starter", monthly: 2500, annual: 25000 },
  growth: { name: "Growth", monthly: 7500, annual: 75000 },
} as const;
const cleanPhone = (value: unknown) => {
  let phone = String(value || "").replace(/[\s()+-]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("254")) phone = "0" + phone.slice(3);
  if (/^7\d{8}$/.test(phone) || /^1\d{8}$/.test(phone)) phone = "0" + phone;
  if (!/^0[17]\d{8}$/.test(phone)) throw new Error("Enter a valid Kenyan M-Pesa phone number.");
  return phone;
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const basicAuth = Deno.env.get("PAYHERO_BASIC_AUTH") || "";
  const channelId = Number(Deno.env.get("PAYHERO_CHANNEL_ID") || 0);
  const apiUrl = Deno.env.get("PAYHERO_API_URL") || "https://backend.payhero.co.ke/api/v2";
  if (!supabaseUrl || !serviceKey || !anonKey || !basicAuth || !channelId) {
    return json({ error: "Billing is not configured. Add Supabase and PayHero secrets to the Edge Function." }, 503);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const url = new URL(req.url);
  // Webhooks are processed separately; they never trust browser-supplied payment status.
  if (url.pathname.endsWith("/webhook")) {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid webhook JSON." }, 400); }
    const response = body?.response || body?.data || body;
    const ref = String(response?.ExternalReference || response?.external_reference || response?.externalReference || "");
    const status = String(response?.Status || response?.status || body?.status || "").toLowerCase();
    const resultCode = Number(response?.ResultCode ?? response?.result_code ?? -1);
    const success = resultCode === 0 && (body?.status === true || String(body?.status).toLowerCase() === "true" || ["success","completed","paid"].includes(status));
    const failed = resultCode !== 0 || ["failed","cancelled","canceled","declined","rejected"].includes(status);
    if (!ref) return json({ error: "Missing external reference." }, 400);
    const { data: payment, error: lookupError } = await admin.from("subscription_payments").select("*").eq("external_reference", ref).maybeSingle();
    if (lookupError) return json({ error: "Could not find subscription payment." }, 500);
    if (!payment) return json({ success: true, status: "unmatched" });
    if (payment.status === "completed") return json({ success: true, status: "completed", message: "Already processed." });
    const now = new Date();
    if (success) {
      const receipt = response?.MpesaReceiptNumber || response?.mpesa_receipt_number || response?.receipt_number || null;
      const amount = Number(response?.Amount ?? response?.amount ?? 0);
      if (amount && amount !== Number(payment.amount_kes)) return json({ error: "Payment amount mismatch; needs reconciliation." }, 409);
      const { error: updateError } = await admin.from("subscription_payments").update({
        status: "completed", mpesa_receipt_number: receipt, payhero_reference: response?.Reference || response?.reference || null,
        checkout_request_id: response?.CheckoutRequestID || response?.checkout_request_id || null,
        provider_response: body, completed_at: now.toISOString(), updated_at: now.toISOString()
      }).eq("id", payment.id).neq("status", "completed");
      if (updateError) return json({ error: "Could not save payment confirmation." }, 500);
      const months = payment.billing_period === "annual" ? 12 : 1;
      const { data: current } = await admin.from("organization_subscriptions").select("current_period_end").eq("organization_id", payment.organization_id).maybeSingle();
      const previousEnd = current?.current_period_end ? new Date(current.current_period_end) : now;
      const start = previousEnd > now ? previousEnd : now;
      const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + months);
      const { error: subError } = await admin.from("organization_subscriptions").upsert({
        organization_id: payment.organization_id, plan_code: payment.plan_code, plan_name: payment.plan_name,
        status: "active", billing_period: payment.billing_period, current_period_start: now.toISOString(),
        current_period_end: end.toISOString(), last_payment_id: payment.id, updated_at: now.toISOString()
      }, { onConflict: "organization_id" });
      if (subError) return json({ error: "Payment was recorded but subscription activation failed; review billing records." }, 500);
      const { error: orgError } = await admin.from("organizations").update({ plan: payment.plan_name, status: "active", updated_at: now.toISOString() }).eq("id", payment.organization_id);
      if (orgError) console.error("Organization plan sync failed", orgError.message);
      return json({ success: true, status: "completed", receipt_number: receipt });
    }
    if (failed) {
      await admin.from("subscription_payments").update({ status: status.includes("cancel") ? "cancelled" : "failed", provider_response: body, updated_at: now.toISOString() }).eq("id", payment.id).neq("status", "completed");
      return json({ success: true, status: "failed" });
    }
    await admin.from("subscription_payments").update({ provider_response: body, updated_at: now.toISOString() }).eq("id", payment.id);
    return json({ success: true, status: "pending" });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in before starting checkout." }, 401);
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await caller.auth.getUser();
  if (authError || !userData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (body.action !== "checkout") return json({ error: "Unsupported action." }, 400);
  const orgId = String(body.organization_id || "");
  const planCode = String(body.plan_code || "").toLowerCase() as keyof typeof plans;
  const billingPeriod = body.billing_period === "annual" ? "annual" : "monthly";
  if (!orgId || !(planCode in plans)) return json({ error: "Select a valid company and plan." }, 400);
  let phone: string;
  try { phone = cleanPhone(body.phone); } catch (error) { return json({ error: error.message }, 400); }
  const { data: platformAdmin } = await admin.from("platform_admins").select("user_id").eq("user_id", userData.user.id).eq("status", "active").maybeSingle();
  const { data: membership } = await admin.from("organization_members").select("role,status").eq("organization_id", orgId).eq("user_id", userData.user.id).eq("status", "active").in("role", ["owner","hr_manager"]).maybeSingle();
  if (!platformAdmin && !membership) return json({ error: "Only an authorised platform admin, workspace owner or HR manager can pay for this workspace." }, 403);
  const { data: org, error: orgError } = await admin.from("organizations").select("id,name,contact_name,contact_email,status").eq("id", orgId).maybeSingle();
  if (orgError || !org) return json({ error: "Company workspace not found." }, 404);
  const plan = plans[planCode];
  const amount = plan[billingPeriod];
  const reference = "NEX-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
  const { data: payment, error: insertError } = await admin.from("subscription_payments").insert({
    organization_id: orgId, plan_code: planCode, plan_name: plan.name, amount_kes: amount, billing_period: billingPeriod,
    phone_number: phone, external_reference: reference, status: "pending", created_by: userData.user.id
  }).select("id,amount_kes,external_reference,plan_name,billing_period").single();
  if (insertError || !payment) return json({ error: "Could not create billing record." }, 500);
  const payload = {
    amount, phone_number: phone, channel_id: channelId, provider: "m-pesa", external_reference: reference,
    customer_name: org.contact_name || org.name, callback_url: supabaseUrl + "/functions/v1/billing-payhero/webhook"
  };
  const providerResponse = await fetch(apiUrl.replace(/\/$/, "") + "/payments", {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": basicAuth }, body: JSON.stringify(payload)
  });
  const raw = await providerResponse.text();
  let result: any; try { result = JSON.parse(raw); } catch { result = { message: "Invalid response from PayHero" }; }
  if (!providerResponse.ok || result.success !== true) {
    await admin.from("subscription_payments").update({ status: "failed", provider_response: result, updated_at: new Date().toISOString() }).eq("id", payment.id);
    return json({ error: result.message || result.error_message || "PayHero could not start M-Pesa checkout.", details: result }, 502);
  }
  const checkoutId = result.CheckoutRequestID || result.checkout_request_id || result.checkoutRequestID || null;
  const payheroRef = result.reference || result.transaction_reference || result.transactionReference || null;
  await admin.from("subscription_payments").update({ checkout_request_id: checkoutId, payhero_reference: payheroRef, provider_response: result, updated_at: new Date().toISOString() }).eq("id", payment.id);
  return json({ success: true, message: "M-Pesa prompt sent. Complete the payment on your phone.", payment_id: payment.id, reference, amount_kes: amount, checkout_request_id: checkoutId });
});
