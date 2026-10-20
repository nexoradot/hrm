(()=>{'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null,user=null,employee=null,leaves=[],attendance=[],reviews=[],payItems=[],periods=[],employeeDocuments=[],announcements=[];
let profilePhotoObjectUrl=null,profilePhotoDisplayUrl=null;
function msg(text,error=false){const el=$('#message');el.textContent=text;el.hidden=!text;el.classList.toggle('error',error)}
function pill(v){const s=String(v||'pending').toLowerCase();return '<span class="pill '+esc(s)+'">'+esc(s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))+'</span>'}
function table(headers,rows){return rows.length?'<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<div class="empty">No records available yet.</div>'}
function money(v){return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:2}).format(Number(v)||0)}
function tab(name){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id==='tab-'+name));document.querySelectorAll('#portalNav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));document.querySelectorAll('[data-tab-jump]').forEach(x=>x.addEventListener('click',()=>tab(x.dataset.tabJump),{once:true}))}
function annualLeaveBalance(){
 const start=employee?.start_date?new Date(String(employee.start_date).slice(0,10)+'T00:00:00'):null;
 if(!start||Number.isNaN(start.getTime()))return {entitled:null,used:0,pending:0,remaining:null};
 const today=new Date();today.setHours(0,0,0,0);
 if(start>today)return {entitled:0,used:0,pending:0,remaining:0};
 // Kenya's statutory baseline: 21 working days for each completed 12 months of service,
 // accrued monthly for employee-facing estimates. HR policy/carry-over may differ.
 const months=Math.max(0,(today.getFullYear()-start.getFullYear())*12+today.getMonth()-start.getMonth()-(today.getDate()<start.getDate()?1:0));
 const entitled=Math.round((months*21/12)*100)/100;
 const annual=leaves.filter(x=>String(x.leave_type||'').toLowerCase()==='annual');
 const used=Math.round(annual.filter(x=>String(x.status||'').toLowerCase()==='approved').reduce((n,x)=>n+Number(x.days_requested||0),0)*100)/100;
 const pending=Math.round(annual.filter(x=>String(x.status||'').toLowerCase()==='pending').reduce((n,x)=>n+Number(x.days_requested||0),0)*100)/100;
 return {entitled,used,pending,remaining:Math.max(0,Math.round((entitled-used-pending)*100)/100)};
}
function renderLeaveBalanceNotice(){
 const target=$('#leaveBalanceNotice');if(!target)return;
 const b=annualLeaveBalance();
 const type=$('#leaveForm select[name="leave_type"]')?.value||'annual';
 const days=Number($('#leaveForm input[name="days_requested"]')?.value||0);
 if(type==='annual'){
  target.innerHTML=b.remaining===null
   ? '<strong>Annual leave balance unavailable</strong><div>Ask HR to confirm your start date and leave entitlement before applying.</div>'
   : '<strong>'+b.remaining+' annual leave day'+(b.remaining===1?'':'s')+' available</strong><div>Accrued: '+b.entitled+' days · Approved/used: '+b.used+' days · Pending requests reserved: '+b.pending+' days</div>'+(days>b.remaining?'<div style="color:#b42332;font-weight:700;margin-top:5px">Your request exceeds the available balance by '+(Math.round((days-b.remaining)*100)/100)+' days.</div>':'');
 }else{
  const used=leaves.filter(x=>String(x.leave_type||'').toLowerCase()===type&&String(x.status||'').toLowerCase()==='approved').reduce((n,x)=>n+Number(x.days_requested||0),0);
  const pending=leaves.filter(x=>String(x.leave_type||'').toLowerCase()===type&&String(x.status||'').toLowerCase()==='pending').reduce((n,x)=>n+Number(x.days_requested||0),0);
  target.innerHTML='<strong>'+esc(type.replace(/_/g,' '))+' leave</strong><div>'+used+' approved days used · '+pending+' pending days.</div><div>Remaining entitlement for this leave type is not configured in the portal. Contact HR to confirm the applicable policy.</div>';
 }
}
function refreshLiveClock(){const d=new Date();const c=$('#liveClock'),date=$('#liveDate');if(c)c.textContent=d.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'});if(date)date.textContent=d.toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
function renderDashboardSummary(){const docs=$('#documentMetric');if(docs)docs.textContent=employeeDocuments.length;const salary=$('#attendanceMetric');if(salary){const latest=payItems[0];salary.textContent=latest?money(latest.net_pay):'KES 0'}const metric=$('#statusMetric');if(metric){const now=new Date(),month=String(now.getMonth()+1).padStart(2,'0'),year=now.getFullYear();metric.textContent=attendance.filter(a=>String(a.work_date||'').startsWith(year+'-'+month)&&!['absent','leave'].includes(String(a.attendance_status||'').toLowerCase())).length+' / '+new Date(year,now.getMonth()+1,0).getDate()}const clockDate=new Date(),today=clockDate.getFullYear()+'-'+String(clockDate.getMonth()+1).padStart(2,'0')+'-'+String(clockDate.getDate()).padStart(2,'0'),record=attendance.find(a=>String(a.work_date||'').slice(0,10)===today);const clockIn=$('#clockInAction'),clockOut=$('#clockOutAction'),hasClockIn=!!record?.clock_in,hasClockOut=!!record?.clock_out;const setClockButton=(b,kind,done,blocked,label)=>{if(!b)return;b.disabled=done||blocked;b.classList.toggle('is-complete',done);b.classList.toggle('is-blocked',blocked&&!done);b.textContent=done?'✓ '+(kind==='in'?'Clocked in':'Clocked out'):(kind==='in'?'◎  Clock in':'⇥  Clock out')};setClockButton(clockIn,'in',hasClockIn,false);setClockButton(clockOut,'out',hasClockOut,!hasClockIn);document.querySelectorAll('[data-attendance-action="in"]').forEach(b=>setClockButton(b,'in',hasClockIn,false));document.querySelectorAll('[data-attendance-action="out"]').forEach(b=>setClockButton(b,'out',hasClockOut,!hasClockIn));const attendanceStatus=$('#locationStatus');if(attendanceStatus&&record){const fmt=t=>t?new Date('1970-01-01T'+String(t).slice(0,8)).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'}):'';attendanceStatus.textContent='Today: '+(hasClockIn?'Clocked in at '+fmt(record.clock_in):'Not clocked in yet')+(hasClockOut?' · Clocked out at '+fmt(record.clock_out):hasClockIn?' · Remember to clock out at the end of your shift':'');}const label=$('#locationLabel');if(label&&!record)label.textContent='Your location will appear here after GPS lookup';const summary=$('#recentPayslips');if(summary)summary.innerHTML=payItems.length?payItems.slice(0,5).map(p=>{const period=periods.find(x=>x.id===p.payroll_period_id);return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #edf1f6"><span style="color:#1477e8">▤</span><span style="flex:1;font-size:11px">'+esc(period?.period_name||'Payroll period')+'</span><strong style="font-size:11px">'+esc(money(p.net_pay))+'</strong><button type="button" class="btn ghost" data-tab-jump="payslips" style="padding:6px 8px;font-size:10px">View</button></div>'}).join(''):'<div class="empty">No payslips available yet.</div>';const leave=$('#leaveBalanceSummary');if(leave){const b=annualLeaveBalance();const groups=[{key:'annual',label:'Annual leave',icon:'▤',match:/annual/},{key:'sick',label:'Sick leave',icon:'✚',match:/sick/},{key:'maternity',label:'Maternity leave',icon:'♡',match:/maternity/},{key:'other',label:'Other leave',icon:'✦',match:/(?!annual|sick|maternity).+/}];const approved=leaves.filter(x=>String(x.status||'').toLowerCase()==='approved');leave.innerHTML=groups.map(g=>{const used=approved.filter(x=>g.match.test(String(x.leave_type||'').toLowerCase())).reduce((n,x)=>n+Number(x.days_requested||0),0);const requested=leaves.filter(x=>g.match.test(String(x.leave_type||'').toLowerCase())&&String(x.status||'').toLowerCase()==='pending').reduce((n,x)=>n+Number(x.days_requested||0),0);const annualExtra=g.key==='annual'&&b.remaining!==null?'<small style="display:block;color:#087f8c;font-weight:800;margin-top:4px">'+b.remaining+' days remaining</small>':'';return '<div class="leave-balance-row"><span class="balance-icon">'+g.icon+'</span><div class="balance-main"><div>'+g.label+'</div><small style="color:#7b879e">'+used+' approved days used'+(requested?' · '+requested+' pending':'')+'</small>'+annualExtra+'<div class="balance-line"><i style="width:'+(used>0?100:0)+'%"></i></div></div><span class="balance-days">'+(g.key==='annual'&&b.remaining!==null?b.remaining:used)+' days</span></div>'}).join('')||'<div class="empty">No leave records yet.</div>'}renderLeaveBalanceNotice()
async function reverseGeocode(latitude,longitude){try{const response=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(latitude)+'&lon='+encodeURIComponent(longitude)+'&zoom=18&addressdetails=1&accept-language=en',{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('Reverse geocoding unavailable');const data=await response.json(),a=data.address||{},parts=[a.building||a.amenity||a.shop||a.office||a.tourism,a.road||a.pedestrian||a.residential,a.neighbourhood||a.suburb||a.quarter,a.city||a.town||a.village||a.county,a.state,a.country].filter(Boolean);return [...new Set(parts)].join(', ')||data.display_name||'Location name unavailable (GPS coordinates recorded)'}catch(e){return 'Location name unavailable (GPS coordinates recorded)'}}
async function recordLiveAttendance(requestedMode){
 if(!employee||!user){msg('Sign in before recording attendance.',true);return}
 const status=$('#locationStatus'),tabStatus=$('#attendanceTabLocationStatus'),inButton=$('#clockInAction'),outButton=$('#clockOutAction'),activeButton=document.activeElement,tabButton=activeButton?.matches?.('[data-attendance-action]')?activeButton:null,button=tabButton||(requestedMode==='out'?outButton:inButton||$('#liveClockAction'));
 if(!button||button.disabled)return;
 if(!navigator.geolocation){msg('This browser does not support live location. Use a location-enabled browser.',true);return}
 const originalLabel=button.textContent;
 button.disabled=true;button.textContent='Acquiring GPS…';
 if(status)status.textContent='Collecting GPS readings. Keep your location services enabled and remain still.';if(tabStatus)tabStatus.textContent='Collecting GPS readings. Keep your location services enabled and remain still.';
 const getReading=()=>new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:Number(p.coords.accuracy),timestamp:p.timestamp||Date.now()}),()=>resolve(null),{enableHighAccuracy:true,timeout:9000,maximumAge:0}));
 const distance=(a,b)=>{const rad=x=>x*Math.PI/180,R=6371000,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))};
 const confirmAttendance=details=>new Promise(resolve=>{
  const old=$('#employeeAttendanceConfirm');if(old)old.remove();
  const modal=document.createElement('div');modal.id='employeeAttendanceConfirm';
  modal.style.cssText='position:fixed;inset:0;z-index:1000000;background:rgba(10,20,40,.58);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:18px';
  modal.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="employeeAttendanceConfirmTitle" style="background:#fff;width:min(460px,100%);border-radius:20px;padding:24px;box-shadow:0 24px 70px #06132d40;color:#17243b"><div style="font-size:30px;text-align:center">📍</div><h2 id="employeeAttendanceConfirmTitle" style="margin:6px 0;text-align:center;font-size:21px">Confirm '+esc(details.mode==='out'?'clock-out':'clock-in')+'</h2><p style="text-align:center;color:#718096;margin:0 0 18px">Review your recorded location before saving attendance.</p><div style="background:#f5f8fc;border-radius:12px;padding:14px;display:grid;gap:9px;font-size:13px"><div><b>Employee</b><span style="float:right">'+esc(employee.full_name||user.email||'Employee')+'</span></div><div><b>Action</b><span style="float:right">'+esc(details.mode==='out'?'Clock out':'Clock in')+'</span></div><div><b>GPS accuracy</b><span style="float:right">±'+esc(Math.round(details.accuracy))+' m</span></div><div><b>Readings</b><span style="float:right">'+esc(details.readings)+'</span></div><div><b>Location</b><div style="margin-top:4px;overflow-wrap:anywhere;color:#475569">'+esc(details.address)+'</div></div></div><div style="display:flex;gap:10px;margin-top:18px"><button type="button" data-attendance-cancel style="flex:1;border:1px solid #dbe2ed;border-radius:10px;background:#fff;padding:12px;font-weight:700;color:#475569">Cancel</button><button type="button" data-attendance-confirm style="flex:1;border:0;border-radius:10px;background:linear-gradient(135deg,#087f8c,#10a2aa);padding:12px;font-weight:800;color:white">Confirm & save</button></div></div>';
  document.body.appendChild(modal);modal.querySelector('[data-attendance-cancel]').onclick=()=>{modal.remove();resolve(false)};modal.querySelector('[data-attendance-confirm]').onclick=()=>{modal.remove();resolve(true)};
 });
 try{
  const readings=[];for(let i=0;i<5;i++){const r=await getReading();if(r&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&r.accuracy>0&&r.accuracy<=200)readings.push(r);if(status)status.textContent='Collecting GPS readings: '+(i+1)+'/5 · valid readings '+readings.length}
  if(readings.length<3)throw new Error('GPS could not obtain at least 3 reliable readings. Move near a window or outdoors and retry.');
  const weights=readings.map(r=>1/Math.max(1,r.accuracy)),total=weights.reduce((a,b)=>a+b,0);
  const location={lat:readings.reduce((s,r,i)=>s+r.lat*weights[i],0)/total,lon:readings.reduce((s,r,i)=>s+r.lon*weights[i],0)/total,accuracy:readings.reduce((s,r)=>s+r.accuracy,0)/readings.length};
  const spread=Math.sqrt(readings.reduce((s,r)=>s+distance(location,r)**2,0)/readings.length);
  if(location.accuracy>100)throw new Error('GPS accuracy is ±'+Math.round(location.accuracy)+' m. For a reliable check-in, improve the signal and try again.');
  if(spread>100)throw new Error('GPS readings were inconsistent ('+Math.round(spread)+' m spread). Remain still and retry.');
  const now=new Date(),workDate=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'),time=now.toTimeString().slice(0,8);
  const fresh=await db.from('hr_attendance_records').select('*').eq('organization_id',employee.organization_id).eq('employee_id',employee.id).eq('work_date',workDate).maybeSingle();
  if(fresh.error)throw fresh.error;
  const existing=fresh.data||null,mode=requestedMode||(existing?.clock_in&&!existing?.clock_out?'out':'in');
  if(mode==='in'&&existing?.clock_in)throw new Error('You have already clocked in today.');
  if(mode==='out'&&!existing?.clock_in)throw new Error('Clock in first before clocking out.');
  if(mode==='out'&&existing?.clock_out)throw new Error('Your attendance for today is already complete.');
  const locationName=await reverseGeocode(location.lat,location.lon);
  const employeeLat=Number(employee.work_latitude??employee.location_latitude),employeeLon=Number(employee.work_longitude??employee.location_longitude),hasWorkplace=Number.isFinite(employeeLat)&&Number.isFinite(employeeLon)&&Math.abs(employeeLat)>0.00001&&Math.abs(employeeLon)>0.00001;
  const workplaceDistance=hasWorkplace?distance(location,{lat:employeeLat,lon:employeeLon}):null;
  const allowedRadius=Number(employee.work_location_radius_m||employee.attendance_radius_m||200);
  if(hasWorkplace&&workplaceDistance>allowedRadius)throw new Error('You appear to be '+Math.round(workplaceDistance)+' m from the configured work location (allowed '+allowedRadius+' m). Attendance was not saved.');
  const details={mode,accuracy:location.accuracy,readings:readings.length,address:locationName};
  if(status)status.textContent='GPS ready. Review your location and confirm to save.';if(tabStatus)tabStatus.textContent='GPS ready. Review the location in the confirmation window before saving.';
  if(!await confirmAttendance(details)){msg('Attendance action cancelled.');if(status)status.textContent='No attendance changes were saved.';return}
  const deviceKey='nexora_employee_device_v1';let deviceId='';try{deviceId=localStorage.getItem(deviceKey)||'';if(!deviceId){deviceId='dev_'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));localStorage.setItem(deviceKey,deviceId)}}catch(_){}
  const geoNote='Location: '+locationName+'; GPS '+location.lat.toFixed(6)+','+location.lon.toFixed(6)+'; accuracy ±'+Math.round(location.accuracy)+'m; readings '+readings.length+'; spread '+Math.round(spread)+'m'+(hasWorkplace?'; workplace distance '+Math.round(workplaceDistance)+'m':'');
  let payload;
  if(mode==='out')payload={clock_out:time,clock_out_latitude:location.lat,clock_out_longitude:location.lon,clock_out_accuracy_m:location.accuracy,clock_out_location_captured_at:now.toISOString(),notes:[existing.notes,geoNote,'Device '+deviceId].filter(Boolean).join(' | ')};
  else payload={organization_id:employee.organization_id,employee_id:employee.id,work_date:workDate,clock_in:time,clock_in_latitude:location.lat,clock_in_longitude:location.lon,clock_in_accuracy_m:location.accuracy,clock_in_location_captured_at:now.toISOString(),attendance_status:'present',recorded_by:user.id,notes:[geoNote,'Device '+deviceId].filter(Boolean).join(' | ')};
  const result=mode==='out'?await db.from('hr_attendance_records').update(payload).eq('id',existing.id).eq('employee_id',employee.id).eq('organization_id',employee.organization_id).select().single():existing?await db.from('hr_attendance_records').update(payload).eq('id',existing.id).eq('employee_id',employee.id).eq('organization_id',employee.organization_id).select().single():await db.from('hr_attendance_records').insert(payload).select().single();
  if(result.error)throw result.error;
  const label=$('#locationLabel');if(label)label.textContent=locationName;
  if(status)status.textContent=(mode==='out'?'Clock-out':'Clock-in')+' saved · '+locationName+' · GPS ±'+Math.round(location.accuracy)+' m'+(hasWorkplace?' · '+Math.round(workplaceDistance)+' m from workplace':'');
  msg((mode==='out'?'Clock-out':'Clock-in')+' saved successfully. GPS accuracy ±'+Math.round(location.accuracy)+' m.');
  await load();tab('attendance');
 }catch(err){
  console.error('Employee attendance error:',err);
  msg('Attendance was not completed: '+(err.message||'Unknown error')+'. Please retry.',true);
  if(status)status.textContent='Attendance save failed: '+(err.message||'Unknown error');
 }finally{
  if(button){button.disabled=false;button.textContent=originalLabel}
  refreshLiveClock();
 }
}
async function uploadEmployeeDocument(event){
 event.preventDefault();
 const form=$('#employeeDocumentUploadForm'),fileInput=$('#employeeDocumentFile'),button=$('#employeeDocumentUploadButton'),status=$('#employeeDocumentUploadStatus');
 const file=fileInput?.files?.[0],name=$('#employeeDocumentName')?.value.trim(),type=$('#employeeDocumentType')?.value,notes=$('#employeeDocumentNotes')?.value.trim();
 const allowed=['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
 if(!employee||!user||!db){msg('Sign in to upload your documents.',true);return}
 if(!file){if(status)status.textContent='Choose a file to upload.';return}
 if(file.size>10485760){if(status)status.textContent='This file exceeds the 10 MB limit.';return}
 if(!allowed.includes(file.type)){if(status)status.textContent='File type not supported. Use PDF, JPG, PNG, WebP or Word.';return}
 if(!name){if(status)status.textContent='Enter a document title.';return}
 const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)||'document';
 const objectPath=employee.organization_id+'/'+employee.id+'/'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2))+'_'+safeName;
 button.disabled=true;button.textContent='Uploading…';if(status)status.textContent='Uploading securely. Please keep this page open.';
 let uploaded=false;
 try{
  const storage=await db.storage.from('nexora-hr-documents').upload(objectPath,file,{contentType:file.type,upsert:false});
  if(storage.error)throw storage.error;uploaded=true;
  const inserted=await db.from('hr_employee_documents').insert({organization_id:employee.organization_id,employee_id:employee.id,document_type:type,document_name:name,storage_path:objectPath,original_file_name:file.name,content_type:file.type,file_size_bytes:file.size,notes:notes||null,uploaded_by:user.id,verification_status:'pending'}).select('id,organization_id,employee_id,document_type,document_name,storage_path,original_file_name,verification_status,created_at').single();
  if(inserted.error)throw inserted.error;
  employeeDocuments=[inserted.data,...employeeDocuments];renderEmployeeDocuments();renderDashboardSummary();form.reset();if(status)status.textContent='Document uploaded successfully and sent to HR for review.';msg('Document uploaded and sent to HR for review.');
 }catch(err){
  if(uploaded){try{await db.storage.from('nexora-hr-documents').remove([objectPath])}catch(cleanupError){console.warn('Could not remove unregistered upload',cleanupError)}}
  console.error('Employee document upload failed:',err);if(status)status.textContent='Upload failed: '+(err.message||'Please try again or contact HR.');msg('Document upload failed: '+(err.message||'Please try again.'),true);
 }finally{button.disabled=false;button.textContent='Upload document securely'}
}
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
 const dialog=$('#employeeDocumentViewer'),content=$('#docViewerContent'),title=$('#docViewerTitle'),subtitle=$('#docViewerSubtitle'),download=$('#docViewerDownload');
 if(!dialog||!content)throw new Error('The in-site document viewer is unavailable. Refresh the portal and try again.');
 title.textContent=doc.document_name||doc.original_file_name||'Employee document';
 subtitle.textContent='Private document · secure temporary access';
 content.innerHTML='<div class="doc-viewer-message">Loading your document securely…</div>';
 download.hidden=true;download.removeAttribute('href');
 if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
 const result=await db.storage.from('nexora-hr-documents').createSignedUrl(doc.storage_path,300);
 if(result.error){content.innerHTML='<div class="doc-viewer-message"><h3>Unable to open document</h3><p>'+esc(result.error.message||'Your secure document link could not be created. Please try again.')+'</p></div>';throw result.error;}
 const url=result.data.signedUrl,mime=String(doc.content_type||''),filename=String(doc.original_file_name||doc.document_name||'document');
 const isImage=/^image\/(jpeg|png|webp)$/i.test(mime)||/\.(jpe?g|png|webp)$/i.test(filename);
 const isPdf=mime==='application/pdf'||/\.pdf$/i.test(filename);
 if(isImage){
  content.innerHTML='<img class="doc-viewer-image" alt="'+esc(filename)+'" src="'+esc(url)+'">';
 }else if(isPdf){
  const frame=document.createElement('iframe');frame.className='doc-viewer-frame';frame.title=filename;frame.src=url;frame.setAttribute('referrerpolicy','no-referrer');content.replaceChildren(frame);
 }else{
  content.innerHTML='<div class="doc-viewer-message"><h3>Word document ready</h3><p>This file is securely stored, but this browser cannot reliably preview Word documents inside the portal. Download it from here to open it in Word or a compatible app.</p></div>';
  download.href=url;download.download=filename;download.hidden=false;
 }
}
function renderEmployeeCharts(){const ah=$('#employeeAttendanceChart'),lh=$('#employeeLeaveChart');if(!ah||!lh)return;const now=new Date(),days=[];for(let i=6;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i),key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');days.push({key,label:d.toLocaleDateString('en-KE',{weekday:'short'}),count:attendance.filter(a=>String(a.work_date||'').slice(0,10)===key).length})}const max=Math.max(1,...days.map(d=>d.count)),W=520,H=185,L=24,R=12,T=14,B=29,pw=W-L-R,ph=H-T-B,bw=28,gap=(pw-7*bw)/6;const bars=days.map((d,i)=>{const height=d.count/max*ph,x=L+i*(bw+gap),y=T+ph-height;return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+Math.max(3,height)+'" rx="6" fill="'+(i===6?'#6d63dc':'#22b8c7')+'" opacity="'+(d.count?'.95':'.22')+'"><title>'+d.label+': '+d.count+' attendance records</title></rect><text x="'+(x+bw/2)+'" y="'+(H-9)+'" text-anchor="middle">'+d.label+'</text>'}).join('');ah.innerHTML=attendance.length?'<svg class="mini-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Attendance records over the last seven days"><line x1="'+L+'" y1="'+(T+ph)+'" x2="'+(W-R)+'" y2="'+(T+ph)+'" stroke="#e9eef5"/>'+bars+'</svg>':'<div class="mini-chart-empty">Your attendance chart will appear after your organisation records attendance.</div>';const keys=['approved','pending','other'],counts=[leaves.filter(l=>l.status==='approved').length,leaves.filter(l=>l.status==='pending').length,leaves.filter(l=>!['approved','pending'].includes(String(l.status||'').toLowerCase())).length],sum=counts.reduce((a,b)=>a+b,0);if(!sum){lh.innerHTML='<div class="mini-chart-empty">Your leave summary will appear when you have leave requests.</div>';return}const colors=['#22b8c7','#6d63dc','#d6deea'],circ=2*Math.PI*43;let off=0;const rings=counts.map((n,i)=>{const d=n/sum*circ,out='<circle cx="65" cy="65" r="43" fill="none" stroke="'+colors[i]+'" stroke-width="14" stroke-dasharray="'+d+' '+(circ-d)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 65 65)"/>';off+=d;return out}).join('');lh.innerHTML='<div style="display:flex;align-items:center;justify-content:center;gap:18px;min-height:155px"><svg class="mini-chart" style="width:min(48%,165px)" viewBox="0 0 130 130" role="img" aria-label="Leave request statuses"><circle cx="65" cy="65" r="43" fill="none" stroke="#edf1f7" stroke-width="14"/>'+rings+'<text x="65" y="61" text-anchor="middle" style="font-size:23px;font-weight:800;fill:#17243b">'+sum+'</text><text x="65" y="77" text-anchor="middle" style="font-size:9px">REQUESTS</text></svg><div style="display:grid;gap:13px;font-size:11px;color:#748197">'+keys.map((k,i)=>'<div style="display:flex;align-items:center;gap:8px"><i style="width:9px;height:9px;border-radius:3px;background:'+colors[i]+';flex-shrink:0"></i><span>'+({approved:'Approved',pending:'Pending',other:'Other statuses'}[k])+'</span><b style="margin-left:auto;color:#17243b">'+counts[i]+'</b></div>').join('')+'</div></div>'}
function render(){
 $('#welcome').textContent='Welcome, '+(employee.full_name||user.email||'employee');
 renderProfilePhoto();
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
function initials(){return String(employee?.full_name||user?.email||'N').trim().split(/\\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'N'}
function placeholderPhoto(){return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#bceff1"/><text x="50" y="63" font-size="35" font-family="Arial" font-weight="700" text-anchor="middle" fill="#0d1830">'+initials()+'</text></svg>')}
function renderProfilePhoto(url){if(url!==undefined)profilePhotoDisplayUrl=url||null;const avatar=$('#employeeAvatar'),preview=$('#profilePhotoPreview');const src=profilePhotoDisplayUrl||placeholderPhoto();[avatar,preview].forEach(img=>{if(img)img.src=src});if(avatar)avatar.classList.toggle('employee-avatar-fallback',!profilePhotoDisplayUrl)}
async function loadProfilePhoto(){if(!employee?.profile_photo_url){renderProfilePhoto(null);return}const path=String(employee.profile_photo_url);if(path.startsWith('https://')||path.startsWith('http://')){renderProfilePhoto(path);return}const result=await db.storage.from('nexora-hr-documents').createSignedUrl(path,300);if(result.error){renderProfilePhoto(null);return}renderProfilePhoto(result.data.signedUrl)}
async function load(){
 const p=await db.from('hr_employees').select('*').eq('user_id',user.id).maybeSingle();if(p.error){if(p.error.code==='PGRST205'||/could not find the table .*hr_employees.*schema cache/i.test(p.error.message||'')){throw new Error('Employee portal setup is incomplete: Supabase cannot find public.hr_employees. Ask the platform administrator to compare the live database with supabase/migrations/005_hrm_workforce_core.sql, safely apply any missing schema after backup, and refresh the Supabase API schema cache. This is a database setup issue, not a password problem.')}throw p.error;}
 if(!p.data){
  // Safely self-link an HR-created employee record by the confirmed Auth email.
  // The server verifies uniqueness, active employment and least-privilege membership;
  // the browser cannot choose an employee or organisation.
  const linked=await db.rpc('link_my_hr_employee_by_email');
  if(linked.error && !/function .*link_my_hr_employee_by_email.*does not exist|schema cache/i.test(linked.error.message||''))throw linked.error;
  if(!linked.error && linked.data){
    const retry=await db.from('hr_employees').select('*').eq('user_id',user.id).maybeSingle();
    if(retry.error)throw retry.error;
    if(retry.data)p.data=retry.data;
  }
  if(!p.data){
    employee=null;$('#authSection').hidden=false;$('#appSection').hidden=true;
    msg(linked.error?'Your sign-in succeeded, but employee access could not be activated. Please contact HR and ask them to verify your work email and employee record.':'Your sign-in succeeded, but no eligible employee record matches this confirmed email. Ask HR to create or correct your employee record using this exact work email. If it already exists, HR should check spelling, duplicate records or a link to another account. After HR updates it, sign out and sign in again. For your security, this portal only links an existing HR employee record.',true);
    return
  }
}
 employee=p.data;
 await loadProfilePhoto();
 const [d,l,a,r,pi,docs,news]=await Promise.all([
  db.from('hr_departments').select('name').eq('id',employee.department_id||'00000000-0000-0000-0000-000000000000').maybeSingle(),
  db.from('hr_leave_requests').select('*').eq('employee_id',employee.id).order('created_at',{ascending:false}),
  db.from('hr_attendance_records').select('*').eq('employee_id',employee.id).order('work_date',{ascending:false}).limit(100),
  db.from('hr_performance_reviews').select('*').eq('employee_id',employee.id).order('review_date',{ascending:false}),
  db.from('hr_payroll_items').select('*').eq('employee_id',employee.id).order('created_at',{ascending:false}),
  db.from('hr_employee_documents').select('id,organization_id,employee_id,document_type,document_name,storage_path,original_file_name,content_type,verification_status,created_at').eq('employee_id',employee.id).eq('organization_id',employee.organization_id).order('created_at',{ascending:false}),
  db.from('platform_announcements').select('id,title,body,publish_at,created_at').in('audience',['all','employees']).eq('status','published').or('publish_at.is.null,publish_at.lte.'+new Date().toISOString()).order('publish_at',{ascending:false,nullsFirst:false})
 ]);
 for(const x of [d,l,a,r,pi,docs,news])if(x.error)throw x.error;
 employee.department_name=d.data?.name||'';
 leaves=l.data||[];attendance=a.data||[];reviews=r.data||[];payItems=pi.data||[];employeeDocuments=docs.data||[];announcements=news.data||[];
 const ids=[...new Set(payItems.map(x=>x.payroll_period_id))];
 if(ids.length){const pr=await db.from('hr_payroll_periods').select('id,period_name,period_start,period_end,payment_date').in('id',ids);if(pr.error)throw pr.error;periods=pr.data||[]}else periods=[];
 $('#authSection').hidden=true;$('#appSection').hidden=false;$('#logoutBtn').hidden=false;render();renderEmployeeDocuments();renderAnnouncements();renderDashboardSummary();refreshLiveClock();msg('');
}
async function init(){
 if(!window.supabase||!window.NEXORA_CONFIG){msg('Secure connection configuration is missing.',true);return}
 db=window.supabase.createClient(window.NEXORA_CONFIG.url,window.NEXORA_CONFIG.anonKey);
 $('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector('button');b.disabled=true;msg('Signing in…');try{const r=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(r.error)throw r.error;user=r.data.user;await load()}catch(err){msg(err.message||'Sign in failed.',true)}finally{b.disabled=false}});
 $('#employeeDocumentUploadForm')?.addEventListener('submit',uploadEmployeeDocument);
 $('#logoutBtn').addEventListener('click',async()=>{const b=$('#logoutBtn');b.disabled=true;try{const result=await db.auth.signOut({scope:'local'});if(result.error)throw result.error;user=null;employee=null;leaves=[];attendance=[];reviews=[];payItems=[];periods=[];employeeDocuments=[];announcements=[];$('#appSection').hidden=true;$('#authSection').hidden=false;$('#logoutBtn').hidden=true;$('#loginForm')?.reset();msg('You have signed out.');window.scrollTo({top:0,behavior:'instant'});}catch(err){msg('Could not sign out safely. Please try again. '+(err.message||''),true)}finally{b.disabled=false}});
 $('#portalNav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)tab(b.dataset.tab)});
 document.addEventListener('click',e=>{const jump=e.target.closest('[data-tab-jump]');if(jump){tab(jump.dataset.tabJump);return}if(e.target.closest('#clockInAction'))recordLiveAttendance('in');else if(e.target.closest('#clockOutAction'))recordLiveAttendance('out');else if(e.target.closest('#liveClockAction'))recordLiveAttendance();else if(e.target.closest('[data-attendance-action="in"]'))recordLiveAttendance('in');else if(e.target.closest('[data-attendance-action="out"]'))recordLiveAttendance('out')});
 setInterval(refreshLiveClock,30000);
 $('#profilePhotoInput')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){e.target.value='';msg('Choose a JPG, PNG or WebP image no larger than 5 MB.',true);return}if(profilePhotoObjectUrl)URL.revokeObjectURL(profilePhotoObjectUrl);profilePhotoObjectUrl=URL.createObjectURL(file);$('#profilePhotoPreview').src=profilePhotoObjectUrl;msg('Preview ready. Select Save photograph to update your profile.')});
 $('#uploadProfilePhotoBtn')?.addEventListener('click',async()=>{const input=$('#profilePhotoInput'),file=input?.files?.[0],button=$('#uploadProfilePhotoBtn');if(!employee||!file){msg('Choose a passport/profile photograph first.',true);return}button.disabled=true;button.textContent='Saving…';try{const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];const path=employee.organization_id+'/'+employee.id+'/profile-photo-'+Date.now()+'.'+ext;const up=await db.storage.from('nexora-hr-documents').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;const saved=await db.rpc('employee_update_my_profile_photo',{photo_path:path});if(saved.error)throw saved.error;employee.profile_photo_url=path;await loadProfilePhoto();input.value='';if(profilePhotoObjectUrl){URL.revokeObjectURL(profilePhotoObjectUrl);profilePhotoObjectUrl=null}msg('Profile photograph saved successfully.');}catch(err){msg('Could not save the photograph. Ensure migration 021_employee_profile_photo.sql is applied and try again. '+(err.message||''),true)}finally{button.disabled=false;button.textContent='Save photograph'}});

 document.addEventListener('click',async e=>{const b=e.target.closest('[data-doc-download]');if(!b)return;b.disabled=true;const label=b.textContent;b.textContent='Opening…';try{await openEmployeeDocument(b.dataset.docDownload)}catch(err){msg(err.message||'Could not open this document. Check that the employee document access migration has been applied.',true)}finally{b.disabled=false;b.textContent=label}});
 $('#docViewerClose')?.addEventListener('click',()=>{$('#employeeDocumentViewer')?.close?.()});
 $('#employeeDocumentViewer')?.addEventListener('click',e=>{if(e.target===$('#employeeDocumentViewer'))$('#employeeDocumentViewer').close?.()});
 $('#employeeDocumentViewer')?.addEventListener('close',()=>{$('#docViewerContent').replaceChildren();$('#docViewerDownload').hidden=true;$('#docViewerDownload').removeAttribute('href')});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#employeeDocumentViewer')?.open)$('#employeeDocumentViewer').close()});
 $('#leaveForm select[name="leave_type"]')?.addEventListener('change',renderLeaveBalanceNotice);$('#leaveForm input[name="days_requested"]')?.addEventListener('input',renderLeaveBalanceNotice);
 $('#leaveForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!employee||!user)return;
  const form=e.currentTarget;if(!form.reportValidity())return;
  const f=new FormData(form),start=String(f.get('start_date')||''),end=String(f.get('end_date')||''),days=Number(f.get('days_requested'));
  if(!start||!end||end<start||!Number.isFinite(days)||days<=0){msg('Check the leave dates and enter a number of days greater than zero.',true);return}
  if(String(f.get('leave_type')||'').toLowerCase()==='annual'){const balance=annualLeaveBalance();if(balance.remaining===null){msg('Annual leave balance cannot be verified because your start date is missing. Contact HR before submitting.',true);return}if(days>balance.remaining){msg('You requested '+days+' days, but only '+balance.remaining+' annual leave days remain after approved and pending requests.',true);renderLeaveBalanceNotice();return}}
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
