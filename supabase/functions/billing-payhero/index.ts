// NEXORA subscription checkout through PayHero M-Pesa.
// Required secrets: PAYHERO_BASIC_AUTH, PAYHERO_CHANNEL_ID, SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. Never expose these in browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const plans={starter:{name:"Starter",monthly:2500,annual:25000},growth:{name:"Growth",monthly:7500,annual:75000}} as const;
function formatPhone(value:unknown){let p=String(value||"").replace(/[\s()+-]/g,"");if(p.startsWith("+"))p=p.slice(1);if(p.startsWith("254"))p="0"+p.slice(3);if(/^([17])\d{8}$/.test(p))p="0"+p;if(!/^0[17]\d{8}$/.test(p))throw new Error("Enter a valid Kenyan M-Pesa phone number.");return p;}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST required."},405);
 const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"",basicAuth=Deno.env.get("PAYHERO_BASIC_AUTH")||"",channelId=Number(Deno.env.get("PAYHERO_CHANNEL_ID")||0),apiUrl=Deno.env.get("PAYHERO_API_URL")||"https://backend.payhero.co.ke/api/v2";
 if(!supabaseUrl||!serviceKey||!anonKey)return json({error:"Supabase Edge Function secrets are incomplete."},503);
 const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),url=new URL(req.url);
 if(url.pathname.endsWith("/webhook")){
  let body:any;try{body=await req.json()}catch{return json({error:"Invalid webhook JSON."},400)}
  const response=body?.response||body?.data||body,ref=String(response?.ExternalReference||response?.external_reference||response?.externalReference||""),status=String(response?.Status||response?.status||body?.status||"").toLowerCase(),code=Number(response?.ResultCode??response?.result_code??-1);
  const success=code===0&&([true,"true","success","completed"].includes(typeof body?.status==="string"?body.status.toLowerCase():body?.status)||["success","completed","paid"].includes(status)),failed=code!==0||["failed","cancelled","canceled","declined","rejected"].includes(status);
  if(!ref)return json({error:"Missing external reference."},400);
  const {data:p,error}=await admin.from("subscription_payments").select("*").eq("external_reference",ref).maybeSingle();
  if(error)return json({error:"Could not find subscription payment."},500);if(!p)return json({success:true,status:"unmatched"});
  if(p.status==="completed")return json({success:true,status:"completed"});
  const now=new Date();
  if(success){
   const receipt=response?.MpesaReceiptNumber||response?.mpesa_receipt_number||response?.receipt_number||null,amount=Number(response?.Amount??response?.amount??0);
   if(amount&&amount!==Number(p.amount_kes))return json({error:"Payment amount mismatch; manual reconciliation required."},409);
   const upd=await admin.from("subscription_payments").update({status:"completed",mpesa_receipt_number:receipt,payhero_reference:response?.Reference||response?.reference||null,checkout_request_id:response?.CheckoutRequestID||response?.checkout_request_id||null,provider_response:body,completed_at:now.toISOString(),updated_at:now.toISOString()}).eq("id",p.id).neq("status","completed");
   if(upd.error)return json({error:"Could not save payment confirmation."},500);
   const {data:current}=await admin.from("organization_subscriptions").select("current_period_end").eq("organization_id",p.organization_id).maybeSingle();
   const prev=current?.current_period_end?new Date(current.current_period_end):now,start=prev>now?prev:now,end=new Date(start);end.setUTCMonth(end.getUTCMonth()+(p.billing_period==="annual"?12:1));
   const sub=await admin.from("organization_subscriptions").upsert({organization_id:p.organization_id,plan_code:p.plan_code,plan_name:p.plan_name,status:"active",billing_period:p.billing_period,current_period_start:now.toISOString(),current_period_end:end.toISOString(),last_payment_id:p.id,updated_at:now.toISOString()},{onConflict:"organization_id"});
   if(sub.error)return json({error:"Payment recorded but subscription activation needs review."},500);
   const org=await admin.from("organizations").update({plan:p.plan_name,status:"active",updated_at:now.toISOString()}).eq("id",p.organization_id);
   if(org.error)console.error("Organization sync warning",org.error.message);
   return json({success:true,status:"completed",receipt_number:receipt});
  }
  if(failed){await admin.from("subscription_payments").update({status:status.includes("cancel")?"cancelled":"failed",provider_response:body,updated_at:now.toISOString()}).eq("id",p.id).neq("status","completed");return json({success:true,status:"failed"});}
  await admin.from("subscription_payments").update({provider_response:body,updated_at:now.toISOString()}).eq("id",p.id);return json({success:true,status:"pending"});
 }
 if(!basicAuth||!channelId)return json({error:"PayHero is not configured. Add PAYHERO_BASIC_AUTH and PAYHERO_CHANNEL_ID secrets."},503);
 const auth=req.headers.get("Authorization");if(!auth)return json({error:"Sign in before checkout."},401);
 const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),{data:userData,error:authErr}=await caller.auth.getUser();
 if(authErr||!userData.user)return json({error:"Session invalid. Sign in again."},401);
 let body:any;try{body=await req.json()}catch{return json({error:"Invalid JSON body."},400)}
 if(body.action!=="checkout")return json({error:"Unsupported action."},400);
 const orgId=String(body.organization_id||""),planCode=String(body.plan_code||"").toLowerCase() as keyof typeof plans,billingPeriod=body.billing_period==="annual"?"annual":"monthly";
 if(!orgId||!(planCode in plans))return json({error:"Choose a valid workspace and plan."},400);
 let phone:string;try{phone=formatPhone(body.phone)}catch(e){return json({error:e.message},400)}
 const {data:pa}=await admin.from("platform_admins").select("user_id").eq("user_id",userData.user.id).eq("status","active").maybeSingle();
 const {data:member}=await admin.from("organization_members").select("role,status").eq("organization_id",orgId).eq("user_id",userData.user.id).eq("status","active").in("role",["owner","hr_manager"]).maybeSingle();
 if(!pa&&!member)return json({error:"Only a platform admin, workspace owner or HR manager can pay for this workspace."},403);
 const {data:org,error:orgErr}=await admin.from("organizations").select("id,name,contact_name").eq("id",orgId).maybeSingle();if(orgErr||!org)return json({error:"Workspace not found."},404);
 const plan=plans[planCode],amount=plan[billingPeriod],reference="NEX-"+crypto.randomUUID().replace(/-/g,"").slice(0,20).toUpperCase();
 const {data:payment,error:insErr}=await admin.from("subscription_payments").insert({organization_id:orgId,plan_code:planCode,plan_name:plan.name,amount_kes:amount,billing_period:billingPeriod,phone_number:phone,external_reference:reference,status:"pending",created_by:userData.user.id}).select("id,amount_kes,external_reference").single();
 if(insErr||!payment)return json({error:"Could not create payment record."},500);
 const payload={amount,phone_number:phone,channel_id:channelId,provider:"m-pesa",external_reference:reference,customer_name:org.contact_name||org.name,callback_url:supabaseUrl+"/functions/v1/billing-payhero/webhook"};
 let providerResponse:Response;try{providerResponse=await fetch(apiUrl.replace(/\/$/,"")+"/payments",{method:"POST",headers:{"Content-Type":"application/json","Authorization":basicAuth},body:JSON.stringify(payload)})}catch(e){await admin.from("subscription_payments").update({status:"failed",provider_response:{error:String(e)},updated_at:new Date().toISOString()}).eq("id",payment.id);return json({error:"Could not reach PayHero."},502)}
 const raw=await providerResponse.text();let result:any;try{result=JSON.parse(raw)}catch{result={message:"Invalid response from PayHero"}}
 if(!providerResponse.ok||result.success!==true){await admin.from("subscription_payments").update({status:"failed",provider_response:result,updated_at:new Date().toISOString()}).eq("id",payment.id);return json({error:result.message||result.error_message||"PayHero could not start checkout."},502)}
 const checkoutId=result.CheckoutRequestID||result.checkout_request_id||result.checkoutRequestID||null,referenceFromProvider=result.reference||result.transaction_reference||result.transactionReference||null;
 await admin.from("subscription_payments").update({checkout_request_id:checkoutId,payhero_reference:referenceFromProvider,provider_response:result,updated_at:new Date().toISOString()}).eq("id",payment.id);
 return json({success:true,message:"M-Pesa prompt sent. Complete payment on your phone.",payment_id:payment.id,reference,amount_kes:amount,checkout_request_id:checkoutId});
});