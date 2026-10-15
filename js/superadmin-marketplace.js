(()=>{"use strict";
const $=s=>document.querySelector(s),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let sb=null,rows=[],audit=[],ready=false,busy=false;
const say=(s,bad=false)=>{const n=$("#marketplaceMessage");if(n){n.textContent=s;n.style.background=bad?"#fff0ef":"#f1f4ff";n.style.color=bad?"#a32620":"#343b78"}};
const date=s=>s?new Date(s).toLocaleDateString("en-KE",{day:"2-digit",month:"short",year:"numeric"}):"—";
const statusLabel=s=>({"pending_review":"Awaiting review","published":"Published","rejected":"Rejected","suspended":"Unpublished","draft":"Draft","closed":"Closed"}[s]||s||"Unknown");
function statusClass(s){return s==="published"?"good":s==="pending_review"?"warn":(["rejected","suspended","closed"].includes(s)?"bad":"")}
function visibleRows(){const q=($("#marketSearch")?.value||"").trim().toLowerCase(),st=$("#marketStatus")?.value||"all";return rows.filter(j=>(st==="all"||j.status===st)&&(!q||[j.title,j.public_employer_name,j.location,j.summary].some(x=>String(x||"").toLowerCase().includes(q))))}
function render(){
 const today=new Date().toISOString().slice(0,10);
 $("#marketPending").textContent=rows.filter(j=>j.status==="pending_review").length;
 $("#marketPublished").textContent=rows.filter(j=>j.status==="published"&&(!j.closing_date||j.closing_date>=today)).length;
 $("#marketRejected").textContent=rows.filter(j=>j.status==="rejected").length;
 $("#marketExpired").textContent=rows.filter(j=>j.status==="published"&&j.closing_date&&j.closing_date<today).length;
 const list=visibleRows();$("#marketplaceRows").innerHTML=list.length?list.map(j=>{const actions=[];
 if(["pending_review","draft","rejected"].includes(j.status))actions.push('<button class="btn small primary" data-moderate="approve" data-id="'+esc(j.id)+'">Approve & publish</button>');
 if(["pending_review","draft"].includes(j.status))actions.push('<button class="btn small light" data-moderate="reject" data-id="'+esc(j.id)+'">Reject</button>');
 if(j.status==="published")actions.push('<button class="btn small light" data-moderate="unpublish" data-id="'+esc(j.id)+'">Unpublish</button>');
 return '<tr><td><div class="co"><span class="logo">JOB</span><div><b>'+esc(j.title)+'</b><small>'+esc(j.employment_type||"")+' · '+esc(j.workplace_type||"")+'</small></div></div><div class="ops-long">'+esc(j.summary||"")+'</div></td><td>'+esc(j.public_employer_name||"Employer")+'</td><td>'+esc(j.location||"Not specified")+'</td><td>'+date(j.created_at)+'</td><td><span class="ops-badge '+statusClass(j.status)+'">'+esc(statusLabel(j.status))+'</span>'+(j.closing_date&&j.closing_date<today&&j.status==="published"?'<br><small>Closing date passed</small>':"")+'</td><td><div class="ops-actions">'+(actions.join("")||'<span class="ops-muted">No action</span>')+'<button class="btn small light" data-details="'+esc(j.id)+'">Details</button></div></td></tr>'
 }).join(""):'<tr><td colspan="6" class="empty"><strong>No vacancies match this filter</strong><small>Refresh the queue or choose another status.</small></td></tr>';
 $("#marketAuditRows").innerHTML=audit.length?audit.map(a=>'<tr><td>'+date(a.created_at)+'</td><td><code>'+esc(String(a.job_id).slice(0,8))+'</code></td><td>'+esc(a.action)+'</td><td>'+esc(a.previous_status||"—")+' → '+esc(a.new_status)+'</td><td class="ops-long">'+esc(a.reason||"—")+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">No moderation actions recorded yet.</td></tr>';
}
async function init(){
 if(!window.supabase?.createClient){say("Supabase library did not load. Reload this page after checking connectivity.",true);return}
 let cfg;try{cfg=JSON.parse(localStorage.getItem("nexora_supabase_public_config_v1")||"null")}catch{}
 if(!cfg?.url||!cfg?.key){say("Supabase connection settings are missing. Reopen the Super Admin dashboard and reconnect.",true);return}
 sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 sb.auth.onAuthStateChange((event,session)=>{if(session&&!ready)setTimeout(()=>init().catch(e=>say("Marketplace startup failed: "+(e.message||e),true)),0);if(!session){ready=false;rows=[];audit=[];render();$("#marketLiveState").textContent="SIGN-IN REQUIRED";say("Sign in with an active NEXORA platform administrator account to review vacancies.",true);}});
 const {data:{session},error:se}=await sb.auth.getSession();if(se)throw se;
 if(!session?.user){say("Sign in with an active NEXORA platform administrator account to review vacancies.",true);$("#marketLiveState").textContent="SIGN-IN REQUIRED";return}
 const {data:pa,error:pe}=await sb.from("platform_admins").select("user_id,role,status").eq("user_id",session.user.id).maybeSingle();
 if(pe)throw pe;if(!pa||pa.role!=="platform_admin"||pa.status!=="active"){say("This account is not an active platform administrator. No moderation controls are enabled.",true);return}
 ready=true;$("#marketLiveState").textContent="LIVE DATABASE";say("Connected as authorized platform administrator. Vacancy changes are written to Supabase and logged.");
 await refresh();
}
async function refresh(){
 if(!ready||busy)return;busy=true;$("#marketplaceRefresh").disabled=true;
 try{
 const {data,error}=await sb.from("jobs").select("id,organization_id,title,public_employer_name,slug,summary,description,requirements,location,country_code,employment_type,workplace_type,salary_min,salary_max,salary_currency,show_salary,closing_date,status,moderation_notes,created_at,published_at").order("created_at",{ascending:false}).limit(500);
 if(error)throw error;rows=data||[];
 const ar=await sb.from("job_moderation_audit").select("id,job_id,action,previous_status,new_status,reason,created_at").order("created_at",{ascending:false}).limit(25);
 if(ar.error)throw ar.error;audit=ar.data||[];render();
 }catch(e){say("Could not load moderation data: "+(e.message||e),true);$("#marketplaceRows").innerHTML='<tr><td colspan="6" class="empty">Live queue unavailable. Check database policies and migration status.</td></tr>'}
 finally{busy=false;$("#marketplaceRefresh").disabled=false}
}
async function moderate(id,action){
 if(!ready||busy)return;const job=rows.find(j=>j.id===id);if(!job)return;
 let reason="";
 if(action==="reject"||action==="unpublish"){reason=window.prompt(action==="reject"?"Reason for rejecting this vacancy (required):":"Reason for taking this vacancy off the public board (required):","");if(reason===null)return;reason=reason.trim();if(!reason){say("A reason is required for rejection or unpublishing.",true);return}}
 if(action==="approve"&&!window.confirm('Approve and publish "'+job.title+'"? It will become visible on the public job board.'))return;
 busy=true;$("#marketplaceRefresh").disabled=true;say("Saving moderation decision…");
 try{const {data,error}=await sb.rpc("nexora_moderate_job",{p_job_id:id,p_action:action,p_reason:reason||null});if(error)throw error;
 say('Vacancy "'+job.title+'" updated: '+statusLabel(data?.status||({"approve":"published","reject":"rejected","unpublish":"suspended"}[action]))+'. Audit entry saved.');
 busy=false;await refresh();
 }catch(e){say("Moderation failed: "+(e.message||e),true)}
 finally{busy=false;$("#marketplaceRefresh").disabled=false}
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-moderate]");if(b){moderate(b.dataset.id,b.dataset.moderate);return}const d=e.target.closest("[data-details]");if(d){const j=rows.find(x=>x.id===d.dataset.details);if(j){const details='Vacancy: '+j.title+'\nEmployer: '+j.public_employer_name+'\nStatus: '+statusLabel(j.status)+'\n\nSummary:\n'+(j.summary||"—")+'\n\nDescription:\n'+(j.description||"—")+'\n\nRequirements:\n'+(j.requirements||"—")+'\n\nModeration notes: '+(j.moderation_notes||"—");window.alert(details)} }});
$("#marketplaceRefresh")?.addEventListener("click",refresh);
$("#marketSearch")?.addEventListener("input",render);$("#marketStatus")?.addEventListener("change",render);
const view=$("#view-marketplace");if(view)new MutationObserver(()=>{if(view.classList.contains("active")&&ready)refresh()}).observe(view,{attributes:true,attributeFilter:["class"]});
init().catch(e=>say("Marketplace startup failed: "+(e.message||e),true));
})();