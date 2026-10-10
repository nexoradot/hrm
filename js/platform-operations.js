/* NEXORA Super Admin supplementary UI operations.
   Database authorization must remain enforced by Supabase RLS / trusted functions.
   This file only adds local UI conveniences; it does not grant privileges. */
(()=>{'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const KEY='nexora_admin_ui_preferences_v1';
 const ANN='nexora_demo_announcements_v1';
 const safeRead=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
 const note=(message)=>{const el=$('#announcementStatus');if(el)el.textContent=message;};
 function initModules(){
   const toggles=[...document.querySelectorAll('#view-modules input[type="checkbox"]:not([disabled])')];
   const saved=safeRead(KEY,{});
   toggles.forEach((input,i)=>{const key=input.closest('.module-row')?.querySelector('b')?.textContent||String(i);if(Object.hasOwn(saved,key))input.checked=!!saved[key];input.addEventListener('change',()=>{const next=safeRead(KEY,{});next[key]=input.checked;localStorage.setItem(KEY,JSON.stringify(next));toast('Module preference saved in this browser. Tenant entitlements are not changed.');});});
 }
 function toast(text){const host=$('#toasts');if(!host)return;const el=document.createElement('div');el.className='toast';el.textContent=text;host.append(el);setTimeout(()=>el.remove(),3200);}
 function initAnnouncement(){
   const form=$('#announcementForm');if(!form)return;
   const list=safeRead(ANN,[]);
   const status=$('#announcementStatus');
   if(status&&list.length)status.textContent=list.length+' draft announcement(s) saved locally. Not published.';
   form.addEventListener('submit',e=>{e.preventDefault();const title=$('#announcementTitle')?.value.trim(),message=$('#announcementMessage')?.value.trim(),audience=$('#announcementAudience')?.value||'All organizations';if(!title||!message)return;const items=safeRead(ANN,[]);items.unshift({title,message,audience,created_at:new Date().toISOString(),status:'draft'});localStorage.setItem(ANN,JSON.stringify(items.slice(0,50)));form.reset();note('Draft saved in this browser only. It has not been sent or published.');toast('Announcement draft saved locally.');});
 }
 function initNav(){
   document.addEventListener('click',e=>{const target=e.target.closest('[data-goto],[data-new]');if(!target)return;if(target.dataset.goto){const view=target.dataset.goto;const nav=document.querySelector('.nav[data-view="'+CSS.escape(view)+'"]');if(nav)nav.click();} });
 }
 function init(){
   initModules();initAnnouncement();initNav();
   const year=$('#year');if(year)year.textContent=new Date().getFullYear();
   const host=$('#interfaceHealth');if(host)host.textContent='Available · supplementary controls loaded';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();