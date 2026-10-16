(()=>{'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null,user=null,employee=null,leaves=[],attendance=[],reviews=[],payItems=[],periods=[],employeeDocuments=[],announcements=[];
function msg(text,error=false){const el=$('#message');el.textContent=text;el.hidden=!text;el.classList.toggle('error',error)}
function pill(v){const s=String(v||'pending').toLowerCase();return '<span class="pill '+esc(s)+'">'+esc(s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))+'</span>'}
function table(headers,rows){return rows.length?'<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<div class="empty">No records available yet.</div>'}
function money(v){return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:2}).format(Number(v)||0)}
function tab(name){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id==='tab-'+name));document.querySelectorAll('#portalNav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name))}
function renderEmployeeDocuments(){
 const target=$('#employeeDocumentsTable');if(!target)return;
 target.innerHTML=table(['Document','Type','Uploaded','Verification','Action'],employeeDocuments.map(d=>'<tr><td><strong>'+esc(d.document_name||d.original_file_name||'Document')+'</strong><br><small>'+esc(d.original_file_name||'')+'</small></td><td>'+esc(String(d.document_type||'other').replace(/_/g,' '))+'</td><td>'+esc(d.created_at?new Date(d.created_at).toLocaleDateString('en-KE'):'—')+'</td><td>'+pill(d.verification_status)+'</td><td><button type="button" class="btn ghost" data-doc-download="'+esc(d.id)+'">Open securely</button></td></tr>'));
}
function renderAnnouncements(){
 const target=$('#employeeAnnouncements');if(!target)return;
 target.innerHTML=announcements.length?announcements.map(a=>'<article class="panel" style="margin-bottom:12px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><h2>'+esc(a.title||'Company update')+'</h2><small>'+esc(a.publish_at?new Date(a.publish_at).toLocaleDateString('en-KE'):new Date(a.created_at).toLocaleDateString('en-KE'))+'</small></div><div style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(a.body||'')+'</div></article>').join(''):'<div class="empty">There are no published announcements for employees yet.</div>';
}
async function openEmployeeDocument(id){
 const doc=employeeDocuments.find(x=>x.id===id);if(!doc)throw new Error('Document not found. Refresh and try again.');
 const result=await db.storage.from('nexora-hr-documents').createSignedUrl(doc.storage_path,60,{download:doc.original_file_name||true});
 if(result.error)throw result.error;
 const link=document.createElement('a');link.href=result.data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.click();
}
function renderEmployeeCharts(){const ah=$('#employeeAttendanceChart'),lh=$('#employeeLeaveChart');if(!ah||!lh)return;const now=new Date(),days=[];for(let i=6;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i),key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');days.push({key,label:d.toLocaleDateString('en-KE',{weekday:'short'}),count:attendance.filter(a=>String(a.work_date||'').slice(0,10)===key).length})}const max=Math.max(1,...days.map(d=>d.count)),W=520,H=185,L=24,R=12,T=14,B=29,pw=W-L-R,ph=H-T-B,bw=28,gap=(pw-7*bw)/6;const bars=days.map((d,i)=>{const height=d.count/max*ph,x=L+i*(bw+gap),y=T+ph-height;return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+Math.max(3,height)+'" rx="6" fill="'+(i===6?'#6d63dc':'#22b8c7')+'" opacity="'+(d.count?'.95':'.22')+'"><title>'+d.label+': '+d.count+' attendance records</title></rect><text x="'+(x+bw/2)+'" y="'+(H-9)+'" text-anchor="middle">'+d.label+'</text>'}).join('');ah.innerHTML=attendance.length?'<svg class="mini-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Attendance records over the last seven days"><line x1="'+L+'" y1="'+(T+ph)+'" x2="'+(W-R)+'" y2="'+(T+ph)+'" stroke="#e9eef5"/>'+bars+'</svg>':'<div class="mini-chart-empty">Your attendance chart will appear after your organisation records attendance.</div>';const keys=['approved','pending','other'],counts=[leaves.filter(l=>l.status==='approved').length,leaves.filter(l=>l.status==='pending').length,leaves.filter(l=>!['approved','pending'].includes(String(l.status||'').toLowerCase())).length],sum=counts.reduce((a,b)=>a+b,0);if(!sum){lh.innerHTML='<div class="mini-chart-empty">Your leave summary will appear when you have leave requests.</div>';return}const colors=['#22b8c7','#6d63dc','#d6deea'],circ=2*Math.PI*43;let off=0;const rings=counts.map((n,i)=>{const d=n/sum*circ,out='<circle cx="65" cy="65" r="43" fill="none" stroke="'+colors[i]+'" stroke-width="14" stroke-dasharray="'+d+' '+(circ-d)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 65 65)"/>';off+=d;return out}).join('');lh.innerHTML='<div style="display:flex;align-items:center;justify-content:center;gap:18px;min-height:155px"><svg class="mini-chart" style="width:min(48%,165px)" viewBox="0 0 130 130" role="img" aria-label="Leave request statuses"><circle cx="65" cy="65" r="43" fill="none" stroke="#edf1f7" stroke-width="14"/>'+rings+'<text x="65" y="61" text-anchor="middle" style="font-size:23px;font-weight:800;fill:#17243b">'+sum+'</text><text x="65" y="77" text-anchor="middle" style="font-size:9px">REQUESTS</text></svg><div style="display:grid;gap:13px;font-size:11px;color:#748197">'+keys.map((k,i)=>'<div style="display:flex;align-items:center;gap:8px"><i style="width:9px;height:9px;border-radius:3px;background:'+colors[i]+';flex-shrink:0"></i><span>'+({approved:'Approved',pending:'Pending',other:'Other statuses'}[k])+'</span><b style="margin-left:auto;color:#17243b">'+counts[i]+'</b></div>').join('')+'</div></div>'}
function render(){
 $('#welcome').textContent='Welcome, '+(employee.full_name||user.email||'employee');
 $('#profileSummary').textContent=[employee.job_title,employee.work_location,employee.department_name].filter(Boolean).join(' · ')||'Your personal HR information in one secure place.';
 $('#statusMetric').textContent=(employee.employment_status||'—').replace(/_/g,' ');
 $('#leaveMetric').textContent=leaves.filter(x=>x.status==='pending').length;
 $('#attendanceMetric').textContent=attendance.length;
 $('#profileTable').innerHTML=table(['Field','Value'],[['Employee number',employee.employee_number],['Full name',employee.full_name],['Work email',employee.email],['Phone',employee.phone],['Job title',employee.job_title],['Department',employee.department_name],['Employment type',employee.employment_type],['Employment status',employee.employment_status],['Start date',employee.start_date],['Work location',employee.work_location]].map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1]||'—')+'</td></tr>'));
 $('#leaveTable').innerHTML=table(['Type','Dates','Days','Reason','Status'],leaves.map(l=>'<tr><td>'+esc(l.leave_type)+'</td><td>'+esc(l.start_date)+' → '+esc(l.end_date)+'</td><td>'+esc(l.days_requested)+'</td><td>'+esc(l.reason||'—')+'</td><td>'+pill(l.status)+'</td></tr>'));
 $('#attendanceTable').innerHTML=table(['Date','Clock in','Clock out','Status','Notes'],attendance.map(a=>'<tr><td>'+esc(a.work_date)+'</td><td>'+esc(a.clock_in||'—')+'</td><td>'+esc(a.clock_out||'—')+'</td><td>'+pill(a.attendance_status)+'</td><td>'+esc(a.notes||'—')+'</td></tr>'));
 $('#performanceTable').innerHTML=table(['Review period','Date','Rating','Status','Comments'],reviews.map(r=>'<tr><td>'+esc(r.review_period)+'</td><td>'+esc(r.review_date||'—')+'</td><td>'+esc(r.rating)+'/5</td><td>'+pill(r.review_status)+'</td><td>'+esc(r.comments||'—')+'</td></tr>'));
 $('#payslipTable').innerHTML=table(['Period','Gross pay','Deductions entered','Net pay','Payment status'],payItems.map(p=>{const period=periods.find(x=>x.id===p.payroll_period_id);return '<tr><td>'+esc(period?.period_name||'Payroll period')+'<br><small>'+esc(period?.period_start||'')+' – '+esc(period?.period_end||'')+'</small></td><td>'+esc(money(p.gross_pay))+'</td><td>'+esc(money(Number(p.paye)+Number(p.nssf)+Number(p.shif)+Number(p.housing_levy)+Number(p.other_deductions)))+'</td><td><b>'+esc(money(p.net_pay))+'</b></td><td>'+pill(p.payment_status)+'</td></tr>'}));
 const recent=[...leaves.map(x=>({date:x.created_at,title:'Leave request',status:x.status})),...attendance.slice(0,8).map(x=>({date:x.work_date,title:'Attendance',status:x.attendance_status})),...reviews.map(x=>({date:x.review_date||x.created_at,title:'Performance review',status:x.review_status}))].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,8);
 $('#recentActivity').innerHTML=table(['Activity','Date','Status'],recent.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.date||'—')+'</td><td>'+pill(x.status)+'</td></tr>'));renderEmployeeCharts();
}
async function load(){
 const p=await db.from('hr_employees').select('*').eq('user_id',user.id).maybeSingle();if(p.error){if(p.error.code==='PGRST205'||/could not find the table .*hr_employees.*schema cache/i.test(p.error.message||'')){throw new Error('Employee portal setup is incomplete: Supabase cannot find public.hr_employees. Ask the platform administrator to compare the live database with supabase/migrations/005_hrm_workforce_core.sql, safely apply any missing schema after backup, and refresh the Supabase API schema cache. This is a database setup issue, not a password problem.')}throw p.error;}
 if(!p.data){
  // Attempt a safe self-link through the database RPC. The server verifies the
  // confirmed Auth email, active employee membership, organisation and uniqueness.
  const linked=await db.rpc('link_my_hr_employee_by_email');
  if(linked.error && !/function .*link_my_hr_employee_by_email.*does not exist|schema cache/i.test(linked.error.message||''))throw linked.error;
  if(!linked.error && linked.data){
    const retry=await db.from('hr_employees').select('*').eq('user_id',user.id).maybeSingle();
    if(retry.error)throw retry.error;
    if(retry.data)p.data=retry.data;
  }
  if(!p.data){
    employee=null;$('#authSection').hidden=false;$('#appSection').hidden=true;
    msg(linked.error?'Your account is signed in, but employee account linking is not enabled in the database yet. The platform administrator must apply migration 017_employee_self_service_account_link.sql in Supabase, then sign in again.':'You are signed in successfully, but NEXORA could not find an employee record linked to this account. The HR administrator must first add or verify your employee record in the HR workspace and use the exact same confirmed email address as this sign-in. If the record already exists, HR must check for a spelling difference, duplicate employee records, or a link to another account. After HR corrects it, sign out and sign in again. For security, this portal cannot create or guess your employment record.',true);
    return
  }
}
 employee=p.data;
 const [d,l,a,r,pi,docs,news]=await Promise.all([
  db.from('hr_departments').select('name').eq('id',employee.department_id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
  db.from('hr_leave_requests').select('*').eq('employee_id',employee.id).order('created_at',{ascending:false}),
  db.from('hr_attendance_records').select('*').eq('employee_id',employee.id).order('work_date',{ascending:false}).limit(100),
  db.from('hr_performance_reviews').select('*').eq('employee_id',employee.id).order('review_date',{ascending:false}),
  db.from('hr_payroll_items').select('*').eq('employee_id',employee.id).order('created_at',{ascending:false}),
  db.from('hr_employee_documents').select('id,organization_id,employee_id,document_type,document_name,storage_path,original_file_name,verification_status,created_at').eq('employee_id',employee.id).eq('organization_id',employee.organization_id).order('created_at',{ascending:false}),
  db.from('platform_announcements').select('id,title,body,publish_at,created_at').in('audience',['all','employees']).eq('status','published').or('publish_at.is.null,publish_at.lte.'+new Date().toISOString()).order('publish_at',{ascending:false,nullsFirst:false})
 ]);
 for(const x of [d,l,a,r,pi,docs,news])if(x.error)throw x.error;
 employee.department_name=d.data?.name||'';
 leaves=l.data||[];attendance=a.data||[];reviews=r.data||[];payItems=pi.data||[];employeeDocuments=docs.data||[];announcements=news.data||[];
 const ids=[...new Set(payItems.map(x=>x.payroll_period_id))];
 if(ids.length){const pr=await db.from('hr_payroll_periods').select('id,period_name,period_start,period_end,payment_date').in('id',ids);if(pr.error)throw pr.error;periods=pr.data||[]}else periods=[];
 $('#authSection').hidden=true;$('#appSection').hidden=false;$('#logoutBtn').hidden=false;render();renderEmployeeDocuments();renderAnnouncements();msg('');
}
async function init(){
 if(!window.supabase||!window.NEXORA_CONFIG){msg('Secure connection configuration is missing.',true);return}
 db=window.supabase.createClient(window.NEXORA_CONFIG.url,window.NEXORA_CONFIG.anonKey);
 $('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector('button');b.disabled=true;msg('Signing in…');try{const r=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(r.error)throw r.error;user=r.data.user;await load()}catch(err){msg(err.message||'Sign in failed.',true)}finally{b.disabled=false}});
 $('#logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();user=null;employee=null;$('#appSection').hidden=true;$('#authSection').hidden=false;$('#logoutBtn').hidden=true;msg('You have signed out.')});
 $('#portalNav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)tab(b.dataset.tab)});
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-doc-download]');if(!b)return;b.disabled=true;const label=b.textContent;b.textContent='Opening…';try{await openEmployeeDocument(b.dataset.docDownload)}catch(err){msg(err.message||'Could not open this document. Check that the employee document access migration has been applied.',true)}finally{b.disabled=false;b.textContent=label}});
 $('#leaveForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!employee||!user)return;
  const form=e.currentTarget;if(!form.reportValidity())return;
  const f=new FormData(form),start=String(f.get('start_date')||''),end=String(f.get('end_date')||''),days=Number(f.get('days_requested'));
  if(!start||!end||end<start||!Number.isFinite(days)||days<=0){msg('Check the leave dates and enter a number of days greater than zero.',true);return}
  const b=form.querySelector('button[type="submit"]');if(b.disabled)return;
  b.disabled=true;const originalLabel=b.textContent;b.textContent='Submitting…';
  try{
   const result=await db.from('hr_leave_requests').insert({organization_id:employee.organization_id,employee_id:employee.id,leave_type:f.get('leave_type'),start_date:start,end_date:end,days_requested:days,reason:f.get('reason'),requested_by:user.id,status:'pending'});
   if(result.error)throw result.error;
   form.reset();msg('Leave request submitted successfully. Refreshing your records…');
   try{await load();tab('leave');msg('Leave request submitted to HR for review.')}
   catch(refreshError){msg('Your leave request was submitted, but the portal could not refresh your records. Use the page again later; do not submit the same request twice. '+(refreshError.message||''),true)}
  }catch(err){msg(err.message||'Could not submit leave request. Please review the form and try again.',true)}
  finally{b.disabled=false;b.textContent=originalLabel}
 });
 const {data:{session}}=await db.auth.getSession();if(session){user=session.user;try{await load()}catch(err){msg(err.message||'Could not load your employee records.',true)}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* Global search for employee self-service navigation. */
(function(){
 const trigger=document.getElementById('dashSearchTrigger'),dialog=document.getElementById('dashSearchDialog'),input=document.getElementById('dashSearchInput'),results=document.getElementById('dashSearchResults');
 if(!trigger||!dialog||!input||!results||trigger.dataset.ready==='true')return;
 trigger.dataset.ready='true';let items=[],active=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function collect(){return [...document.querySelectorAll('#portalNav button[data-tab]')].map(el=>{const label=(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();return {label,el,search:(label+' '+(el.dataset.tab||'')).toLowerCase()}}).filter(x=>x.label)}
 function sync(){results.querySelectorAll('[data-result]').forEach((b,i)=>{b.style.background=i===active?'#eefafb':'';b.setAttribute('aria-selected',i===active?'true':'false')});results.querySelector('[data-result="'+active+'"]')?.scrollIntoView({block:'nearest'})}
 function paint(){const q=input.value.trim().toLowerCase();items=collect().filter(x=>!q||x.search.includes(q)).slice(0,15);active=0;if(!items.length){results.innerHTML='<div class="dash-search-empty">No matching destinations. Try another keyword.</div>';return}results.innerHTML=items.map((x,i)=>'<button type="button" class="dash-search-result" data-result="'+i+'"><span class="dash-search-icon">⌕</span><span class="dash-search-copy"><strong>'+esc(x.label)+'</strong><small>Open employee portal tab</small></span><span aria-hidden="true">↗</span></button>').join('');sync()}
 function open(){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');input.value='';paint();setTimeout(()=>input.focus(),0)}
 function choose(i){const item=items[i];if(!item)return;dialog.close();item.el.click()}
 trigger.addEventListener('click',open);document.getElementById('dashSearchClose')?.addEventListener('click',()=>dialog.close());input.addEventListener('input',paint);results.addEventListener('click',e=>{const b=e.target.closest('[data-result]');if(b)choose(Number(b.dataset.result))});
 input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,items.length-1);sync()}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);sync()}else if(e.key==='Enter'){e.preventDefault();choose(active)}else if(e.key==='Escape'){e.preventDefault();dialog.close()}});
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();dialog.open?dialog.close():open()}});
})();
