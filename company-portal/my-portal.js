(()=>{'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null,user=null,employee=null,leaves=[],attendance=[],reviews=[],payItems=[],periods=[];
function msg(text,error=false){const el=$('#message');el.textContent=text;el.hidden=!text;el.classList.toggle('error',error)}
function pill(v){const s=String(v||'pending').toLowerCase();return '<span class="pill '+esc(s)+'">'+esc(s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))+'</span>'}
function table(headers,rows){return rows.length?'<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<div class="empty">No records available yet.</div>'}
function money(v){return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:2}).format(Number(v)||0)}
function tab(name){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id==='tab-'+name));document.querySelectorAll('#portalNav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name))}
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
 $('#recentActivity').innerHTML=table(['Activity','Date','Status'],recent.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.date||'—')+'</td><td>'+pill(x.status)+'</td></tr>'));
}
async function load(){
 const p=await db.from('hr_employees').select('*').eq('user_id',user.id).maybeSingle();if(p.error)throw p.error;
 if(!p.data){employee=null;$('#authSection').hidden=false;$('#appSection').hidden=true;msg('Your account is signed in, but HR has not linked it to an employee record yet. Ask your HR administrator to set the employee record’s user account.',true);return}
 employee=p.data;
 const [d,l,a,r,pi]=await Promise.all([
  db.from('hr_departments').select('name').eq('id',employee.department_id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
  db.from('hr_leave_requests').select('*').eq('employee_id',employee.id).order('created_at',{ascending:false}),
  db.from('hr_attendance_records').select('*').eq('employee_id',employee.id).order('work_date',{ascending:false}).limit(100),
  db.from('hr_performance_reviews').select('*').eq('employee_id',employee.id).order('review_date',{ascending:false}),
  db.from('hr_payroll_items').select('*').eq('employee_id',employee.id).order('created_at',{ascending:false})
 ]);
 for(const x of [d,l,a,r,pi])if(x.error)throw x.error;
 employee.department_name=d.data?.name||'';
 leaves=l.data||[];attendance=a.data||[];reviews=r.data||[];payItems=pi.data||[];
 const ids=[...new Set(payItems.map(x=>x.payroll_period_id))];
 if(ids.length){const pr=await db.from('hr_payroll_periods').select('id,period_name,period_start,period_end,payment_date').in('id',ids);if(pr.error)throw pr.error;periods=pr.data||[]}else periods=[];
 $('#authSection').hidden=true;$('#appSection').hidden=false;$('#logoutBtn').hidden=false;render();msg('');
}
async function init(){
 if(!window.supabase||!window.NEXORA_CONFIG){msg('Secure connection configuration is missing.',true);return}
 db=window.supabase.createClient(window.NEXORA_CONFIG.url,window.NEXORA_CONFIG.anonKey);
 $('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector('button');b.disabled=true;msg('Signing in…');try{const r=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(r.error)throw r.error;user=r.data.user;await load()}catch(err){msg(err.message||'Sign in failed.',true)}finally{b.disabled=false}});
 $('#logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();user=null;employee=null;$('#appSection').hidden=true;$('#authSection').hidden=false;$('#logoutBtn').hidden=true;msg('You have signed out.')});
 $('#portalNav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)tab(b.dataset.tab)});
 $('#leaveForm').addEventListener('submit',async e=>{e.preventDefault();if(!employee||!user)return;const f=new FormData(e.currentTarget),start=f.get('start_date'),end=f.get('end_date'),days=Number(f.get('days_requested'));if(end<start||days<=0){msg('Check the leave dates and number of days.',true);return}const b=e.currentTarget.querySelector('button');b.disabled=true;try{const result=await db.from('hr_leave_requests').insert({organization_id:employee.organization_id,employee_id:employee.id,leave_type:f.get('leave_type'),start_date:start,end_date:end,days_requested:days,reason:f.get('reason'),requested_by:user.id,status:'pending'});if(result.error)throw result.error;e.currentTarget.reset();await load();tab('leave');msg('Leave request submitted to HR for review.')}catch(err){msg(err.message||'Could not submit leave request.',true)}finally{b.disabled=false}});
 const {data:{session}}=await db.auth.getSession();if(session){user=session.user;try{await load()}catch(err){msg(err.message||'Could not load your employee records.',true)}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();