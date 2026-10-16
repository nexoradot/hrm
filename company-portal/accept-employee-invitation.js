(()=>{'use strict';
const $=s=>document.querySelector(s);let db,t,mode='signup',pendingEmail='',pendingPassword='',confirmationPending=false;
function msg(s,err=false){const e=$('#message');e.textContent=s;e.className='notice show'+(err?' error':'')}
async function redeem(){const r=await db.rpc('redeem_hr_employee_invitation',{p_token:t});if(r.error)throw r.error;return r.data}
function setMode(next){mode=next;const confirm=$('[name="confirm"]'),confirmLabel=confirm.closest('label'),submit=$('#submitBtn');confirmLabel.hidden=mode==='signin';confirm.required=mode==='signup';$('[name="password"]').autocomplete=mode==='signin'?'current-password':'new-password';submit.type=confirmationPending?'button':'submit';submit.textContent=confirmationPending?'Finish activation':mode==='signin'?'Sign in and accept invitation':'Create account and accept invitation';$('#toggleMode').textContent=mode==='signin'?'New employee? Create an account':'Already have an account? Sign in'}
async function activateSignedIn(){try{await redeem();msg('Invitation accepted. Redirecting to employee registration…');location.href='employee-registration.html?invited=1'}catch(err){await db.auth.signOut();throw err}}
async function finish(){const b=$('#submitBtn');b.disabled=true;try{const r=await db.auth.signInWithPassword({email:pendingEmail,password:pendingPassword});if(r.error)throw r.error;await activateSignedIn()}catch(err){msg(err.message||'Activation failed. Confirm your email and try again.',true)}finally{b.disabled=false}}
async function init(){
 if(!window.supabase||!window.NEXORA_CONFIG){msg('Secure database configuration is missing.',true);return}
 db=window.supabase.createClient(window.NEXORA_CONFIG.url,window.NEXORA_CONFIG.anonKey);t=new URLSearchParams(location.search).get('token');
 if(!t||!/^[0-9a-f]{64}$/i.test(t)){msg('This invitation link is missing or invalid. Ask HR for a new link.',true);$('#acceptForm').hidden=true;$('#toggleMode').hidden=true;return}
 const existing=await db.auth.getSession();
 if(existing.data?.session?.user){try{await activateSignedIn();return}catch(e){msg('The currently signed-in account could not use this invitation. Sign in with the invited email address below.',true)}}
 $('#toggleMode').addEventListener('click',()=>{setMode(mode==='signup'?'signin':'signup');msg('')});
 $('#acceptForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!e.currentTarget.reportValidity())return;
  const f=new FormData(e.currentTarget),email=String(f.get('email')).trim().toLowerCase(),password=String(f.get('password'));
  if(mode==='signup'&&password!==f.get('confirm')){msg('Passwords do not match.',true);return}
  const b=$('#submitBtn');b.disabled=true;pendingEmail=email;pendingPassword=password;
  try{
   if(mode==='signin'){const signIn=await db.auth.signInWithPassword({email,password});if(signIn.error)throw signIn.error;await activateSignedIn();return}
   const signup=await db.auth.signUp({email,password,options:{emailRedirectTo:location.href}});
   if(signup.error)throw signup.error;
   if(!signup.data.session){confirmationPending=true;setMode(mode);msg('Account created. Confirm your email using the message from NEXORA/Supabase, then return to this invitation link and tap “Finish activation”.');return}
   await activateSignedIn();
  }catch(err){const text=err.message||'Could not accept invitation.';if(mode==='signup'&&/already registered|already exists|user already|email address is already/i.test(text)){setMode('signin');msg('An account already exists for this email. Sign in with that account to accept the invitation.',true)}else msg(text,true)}
  finally{b.disabled=false}
 });
}
document.addEventListener('DOMContentLoaded',init);
})();