(()=>{'use strict';
const C=window.PORTAL_CONFIG;
const MAIN_URL='https://rgsrubdtljyxmnihwlah.supabase.co',MAIN_KEY='sb_publishable_-pG3ePRGckIiK5ncn2hzgQ_jeJF1xFr';
const STORAGE_SCHEMA='workforce-nondot-dot-shell-v1';
if(localStorage.getItem('s4u_workforce_storage_schema')!==STORAGE_SCHEMA){
  ['ctpa_workforce','employer_workforce','employee_workforce','driver_workforce'].forEach(code=>{
    localStorage.removeItem(`s4u_${code}_membership`);
    localStorage.removeItem(`s4u_${code}_subscription`);
  });
  localStorage.setItem('s4u_workforce_storage_schema',STORAGE_SCHEMA);
}
const sb=window.supabase.createClient(C.workforceUrl,C.workforceKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=v=>String(v??'—').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const fmt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)};
const money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:String(c||'USD')}).format(Number(v||0));
const badge=v=>`<span class="badge ${/active|complete|paid|eligible|final|negative|enabled|yes/i.test(String(v))?'good':/cancel|inactive|terminated|positive|failed|closed|archived|expired/i.test(String(v))?'bad':'warn'}">${esc(pretty(v))}</span>`;
const page=()=>location.pathname.split('/').pop()?.replace('.html','')||'dashboard';
const norm=v=>String(v||'').trim().toLowerCase().replaceAll('_','-');
const storageKey=()=>`s4u_${C.portalCode}_membership`, subKey=()=>`s4u_${C.portalCode}_subscription`;
const stored=()=>localStorage.getItem(storageKey())||'', storedSub=()=>localStorage.getItem(subKey())||'';
const cfgPage=id=>C.pages.find(x=>norm(x.id)===norm(id))||{id,label:pretty(id),icon:'•'};
const apiName=()=>C.kind==='ctpa'?'workforce-ctpa-actions':C.kind==='employer'?'workforce-employer-operations':'workforce-employer-employee-access';
let ctx=null,data=null,NAV=[];

async function session(){const {data:{session},error}=await sb.auth.getSession();if(error)throw error;return session}
async function invoke(name,body={}){
  const s=await session();
  if(!s)throw new Error('Your session has expired. Please sign in again.');
  const payload={portal_code:C.portalCode,membership_id:stored()||undefined,subscription_id:storedSub()||undefined,...body};
  const r=await fetch(`${C.workforceUrl}/functions/v1/${name}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':C.workforceKey},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error)throw new Error(d.error||d.reason||`Request failed (${r.status}).`);
  return d;
}
async function access(){return invoke('workforce-session-context',{requested_portal_code:C.portalCode,requested_page:page()})}
async function invokeMain(body={}){
  const s=await session();
  if(!s)throw new Error('Your session has expired. Please sign in again.');
  const r=await fetch(`${MAIN_URL}/functions/v1/workforce-portal-service-checkout`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':MAIN_KEY},body:JSON.stringify({portal_code:C.portalCode,...body})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error)throw new Error(d.error||`Purchase request failed (${r.status}).`);
  return d;
}
async function loadServices(){const [catalog,history]=await Promise.all([invoke('workforce-service-store',{action:'catalog'}),invokeMain({action:'history'})]);return{...catalog,...history}}
let stripeJsPromise=null;
function loadStripeJs(){if(window.Stripe)return Promise.resolve();if(stripeJsPromise)return stripeJsPromise;stripeJsPromise=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://js.stripe.com/v3/';el.async=true;el.onload=()=>window.Stripe?resolve():reject(new Error('Stripe.js failed to initialize.'));el.onerror=()=>reject(new Error('Unable to load secure payment fields.'));document.head.appendChild(el)});return stripeJsPromise}
async function showMountedCheckout(d){
  if(!d?.client_secret||!d?.stripe_publishable_key)throw new Error('Secure payment session is incomplete.');
  await loadStripeJs();
  const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal modal-wide"><h2>Secure Payment</h2><p style="color:#52657a;line-height:1.55;margin:0 0 12px">Complete payment below. You will remain inside your screenings4u Workforce portal.</p><div class="notice" style="margin-bottom:14px"><strong>${esc(d.service?.name||'Workforce Service')}</strong><div style="margin-top:4px">${money(d.service?.amount,d.service?.currency||'USD')}</div></div><div id="stripe-payment-element" style="min-height:180px"></div><div id="stripe-payment-message" style="margin-top:12px"></div><div class="modal-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" data-pay type="button">Pay Securely</button></div></div>`;document.body.appendChild(b);
  const close=()=>b.remove();b.querySelector('[data-close]').onclick=close;const pay=b.querySelector('[data-pay]'),msg=b.querySelector('#stripe-payment-message');
  const stripe=window.Stripe(d.stripe_publishable_key);
  const checkout=stripe.initCheckoutElementsSdk({clientSecret:d.client_secret});
  const pe=checkout.createPaymentElement();pe.mount('#stripe-payment-element');
  pay.onclick=async()=>{pay.disabled=true;pay.textContent='Processing…';msg.innerHTML='';try{const loaded=await checkout.loadActions();if(loaded.type==='error')throw new Error(loaded.error?.message||'Unable to initialize payment.');const result=await loaded.actions.confirm();if(result?.type==='error'||result?.error)throw new Error(result.error?.message||'Payment could not be completed.');const st=await invokeMain({action:'status',session_id:d.checkout_session_id});if(String(st.payment_status)==='paid'||String(st.status)==='complete'){close();await brandedMessage('Payment received','Your service purchase was successful. screenings4u Testing Operations is creating the linked testing case.','success');await refresh()}else{msg.innerHTML='<div class="notice"><strong>Payment processing</strong><div style="margin-top:4px">Stripe is still confirming this payment. This page will update automatically.</div></div>';setTimeout(()=>location.reload(),1800)}}catch(err){msg.innerHTML=`<div class="notice"><strong>Payment issue</strong><div style="margin-top:4px">${esc(err.message||String(err))}</div></div>`;pay.disabled=false;pay.textContent='Pay Securely'}};
}
function brandedMessage(title,message,type='info'){return new Promise(resolve=>{const b=modalShell(title,`<div class="notice" style="border-left:4px solid ${type==='success'?'#17764a':type==='error'?'#b42318':'#ef6c00'}"><div>${esc(message)}</div></div>`,`<button class="btn primary" data-ok type="button">Continue</button>`);b.querySelector('[data-ok]').onclick=()=>{b.remove();resolve(true)}})}


async function load(){const p=page();if(p==='billing'&&C.kind!=='self')return invoke('workforce-invoice-portal',{action:'list'});if(p==='services'&&C.kind!=='self')return loadServices();return invoke(apiName(),{action:'workspace',page:p})}

function displayName(c){
  return String(c?.membership?.organization_name||c?.organization_name||c?.workspace?.organization_name||c?.subscription?.plan_name||C.label||'screenings4u Workforce');
}
function navRows(c){
  const allowed=Array.isArray(c?.navigation)&&c.navigation.length?c.navigation:C.pages;
  return allowed.map(n=>{const id=norm(n.id);const local=cfgPage(id);return {...n,id,label:local.label||n.label||pretty(id),icon:local.icon||n.icon||'•',href:n.href||`/${id}.html`}});
}
function shell(c){
  const current=norm(page());
  document.body.dataset.portalPage=current;
  NAV=navRows(c);
  const planLabel=displayName(c);
  const links=NAV.map(x=>`<a href="${esc(x.href)}" class="${current===norm(x.id)?'active':''}"${current===norm(x.id)?' aria-current="page"':''}><span class="ico">${esc(x.icon||'•')}</span><span>${esc(x.label||pretty(x.id))}</span></a>`).join('');
  document.title=`${cfgPage(current).label} | ${planLabel}`;
  document.body.className='loading';
  document.body.innerHTML=`<div class="app">
    <aside class="side" id="side">
      <div class="brand"><img class="brand-logo brand-logo-ready" src="/assets/img/logo.png" alt="screenings4u"></div>
      <nav class="nav"><div class="nav-title">${esc(planLabel)}</div>${links}</nav>
      <div class="side-foot"><div style="font-size:9px;color:#9fb3c7">Portal</div><div style="font-size:11px;font-weight:800;color:#fff;margin-top:3px">${esc(C.domain)}</div></div>
    </aside>
    <main class="main">
      <header class="top">
        <div class="top-left"><button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button><span class="crumb">${esc(planLabel)} / ${esc(cfgPage(current).label)}</span></div>
        <div class="top-right"><span class="pill">${esc(C.kind==='self'?'Self Service':'Management')}</span><span class="pill">NON-DOT</span><button class="signout" id="logout" type="button">Sign out</button></div>
      </header>
      <section class="mobile-nav" id="mobileNav" aria-hidden="true" aria-label="Portal navigation"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>${esc(planLabel)}</strong></div><span class="mobile-nav-current">${esc(cfgPage(current).label)}</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>${esc(C.domain)}</span><small>Select a page to close this menu.</small></div></div></section>
      <div class="content"><div id="toast"></div><section class="hero"><span class="hero-kicker">${esc(planLabel)}</span><h1>${esc(cfgPage(current).label)}</h1><p id="subtitle">Loading NON-DOT Workforce workspace.</p><div class="hero-actions" id="actions"></div></section><section class="section" id="content"><div class="panel"><div class="loading-msg">Loading…</div></div></section></div>
    </main>
  </div>`;
  const menuBtn=$('#menu'),mobileNav=$('#mobileNav');
  const setMobileNav=open=>{
    const isMobile=window.matchMedia('(max-width: 820px)').matches;
    const next=!!open&&isMobile;
    mobileNav?.classList.toggle('open',next);
    document.body.classList.toggle('mobile-nav-open',next);
    menuBtn?.classList.toggle('open',next);
    menuBtn?.setAttribute('aria-expanded',String(next));
    menuBtn?.setAttribute('aria-label',next?'Close navigation':'Open navigation');
    mobileNav?.setAttribute('aria-hidden',String(!next));
  };
  if(menuBtn&&mobileNav){
    menuBtn.onclick=()=>setMobileNav(!mobileNav.classList.contains('open'));
    mobileNav.addEventListener('click',e=>{if(e.target.closest('a'))setMobileNav(false)});
    window.addEventListener('resize',()=>{if(window.innerWidth>820)setMobileNav(false)},{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileNav(false)});
  }
  $('#logout').onclick=async()=>{localStorage.removeItem(storageKey());localStorage.removeItem(subKey());await sb.auth.signOut();location.replace('/login.html')};
}

function notice(message,type='bad'){
  const t=$('#toast');if(!t)return;
  t.innerHTML=`<div class="notice" style="border-left:4px solid ${type==='good'?'#17764a':'#ef6c00'};margin-bottom:14px"><strong>${type==='good'?'Success':'Notice'}</strong><div style="margin-top:4px">${esc(message)}</div></div>`;
  setTimeout(()=>{if(t)t.innerHTML=''},5500);
}
function modalShell(title,body,buttons='',wide=false){const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal${wide?' modal-wide':''}"><h2>${esc(title)}</h2>${body}<div class="modal-actions">${buttons}</div></div>`;document.body.appendChild(b);return b}
function confirmBox(title,message){return new Promise(resolve=>{const b=modalShell(title,`<p style="line-height:1.6;color:#52657a">${esc(message)}</p>`,`<button class="btn ghost" data-no type="button">Cancel</button><button class="btn primary" data-yes type="button">Continue</button>`);b.querySelector('[data-no]').onclick=()=>{b.remove();resolve(false)};b.querySelector('[data-yes]').onclick=()=>{b.remove();resolve(true)}})}
function fieldHtml(f,v={}){
  const value=v[f.name]??f.value??'';
  if(f.type==='select')return `<div class="field ${f.full?'full':''}"><label>${esc(f.label)}</label><select name="${esc(f.name)}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>`;
  if(f.type==='textarea')return `<div class="field ${f.full?'full':''}"><label>${esc(f.label)}</label><textarea name="${esc(f.name)}" rows="4" ${f.required?'required':''}>${esc(value)}</textarea></div>`;
  return `<div class="field ${f.full?'full':''}"><label>${esc(f.label)}</label><input type="${esc(f.type||'text')}" name="${esc(f.name)}" value="${esc(value)}" ${f.min!==undefined?`min="${esc(f.min)}"`:''} ${f.max!==undefined?`max="${esc(f.max)}"`:''} ${f.step!==undefined?`step="${esc(f.step)}"`:''} ${f.required?'required':''}></div>`;
}
function formModal(title,fields,initial,onSave){
  const b=document.createElement('div');b.className='modal-backdrop';
  b.innerHTML=`<form class="modal"><h2>${esc(title)}</h2><div class="modal-grid">${fields.map(f=>fieldHtml(f,initial||{})).join('')}</div><div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`;
  document.body.appendChild(b);b.querySelector('[data-cancel]').onclick=()=>b.remove();
  b.querySelector('form').onsubmit=async e=>{e.preventDefault();const vals=Object.fromEntries(new FormData(e.currentTarget).entries());try{await onSave(vals);b.remove();notice('Saved successfully.','good');await refresh()}catch(err){notice(err.message||String(err))}};
}
function addAction(label,fn,kind='primary'){const b=document.createElement('button');b.className=`btn ${kind}`;b.type='button';b.textContent=label;b.onclick=fn;$('#actions')?.appendChild(b)}
function read(o,keys){for(const k of keys){let v=o;for(const p of k.split('.'))v=v?.[p];if(v!==undefined&&v!==null&&v!=='')return v}return'—'}
const personName=r=>[r?.first_name,r?.middle_name,r?.last_name].filter(Boolean).join(' ')||r?.display_name||'—';
const percent=v=>v===null||v===undefined||v===''?'—':`${Number(v)}%`;

const COLS={
  employers:[['Employer',['legal_name','workforce_display_name']],['Status',['status'],v=>badge(v)],['Primary Contact',['primary_contact_email']],['State',['state']]],
  employees:[['Name',['first_name'],(v,r)=>esc(personName(r))],['Employee #',['employee_number']],['Worker Type',['workforce_worker_type'],v=>badge(v==='driver'?'NON-DOT Driver':v)],['Job Title',['job_title']],['Safety Sensitive',['safety_sensitive'],v=>badge(v===true?'yes':v===false?'no':'—')],['Status',['employment_status'],v=>badge(v)]],
  programs:[['Program',['name']],['Type',['program_type'],v=>badge(v||'NON_DOT')],['Category',['regulatory_category']],['Panel',['testing_panel']],['Method',['testing_method']],['Drug Rate',['drug_random_rate'],v=>percent(v)],['Alcohol Rate',['alcohol_random_rate'],v=>percent(v)],['Effective',['effective_date'],v=>fmt(v)],['Status',['status'],v=>badge(v)]],
  pools:[['Pool',['name']],['Type',['pool_type']],['Program',['program_id']],['Schedule',['selection_schedule']],['Drug Rate',['drug_testing_rate'],v=>percent(v)],['Alcohol Rate',['alcohol_testing_rate'],v=>percent(v)],['Effective',['effective_date'],v=>fmt(v)],['Status',['status'],v=>badge(v)]],
  selections:[['Date',['selection_date','selected_at'],v=>fmt(v)],['Type',['selection_type']],['Population',['population_size']],['Selected',['selected_count','drug_selection_count','drug_selected']],['Status',['status'],v=>badge(v)]],
  testing:[['Order',['order_number']],['Reason',['reason']],['Test',['test_type']],['Program Type',['program_type'],v=>badge(v||'NON_DOT')],['Status',['status'],v=>badge(v)],['Created',['created_at'],v=>fmt(v)]],
  results:[['Order',['testing_orders.order_number','order_number']],['Result',['final_status','verified_result','result'],v=>badge(v)],['Date',['result_date','finalized_at','created_at'],v=>fmt(v)],['Status',['notification_status','status'],v=>badge(v)]],
  compliance:[['Case',['case_number','id']],['Event',['event_type','case_type']],['Priority',['priority'],v=>badge(v)],['Opened',['opened_at','created_at'],v=>fmt(v)],['Status',['status'],v=>badge(v)]],
  documents:[['File',['file_name','title']],['Type',['document_type']],['Uploaded',['uploaded_at','created_at'],v=>fmt(v)],['Expires',['expires_at'],v=>fmt(v)],['Status',['status','access_level'],v=>badge(v)]],
  notifications:[['Subject',['subject','event_type']],['Channel',['channel']],['Status',['status'],v=>badge(v)],['Queued',['queued_at','created_at'],v=>fmt(v)]],
  invoices:[['Invoice',['invoice_number']],['Status',['status'],v=>badge(v)],['Total',['total'],v=>money(v)],['Paid',['amount_paid'],v=>money(v)],['Due',['amount_due'],v=>money(v)],['Issued',['issued_at','created_at'],v=>fmt(v)]],
  members:[['User',['profiles.display_name','profiles.first_name','user_id']],['Role',['roles.name','roles.code','role_name']],['Status',['status'],v=>badge(v)],['Primary',['is_primary'],v=>badge(v===true?'yes':v===false?'no':'—')]],
  locations:[['Location',['name']],['Type',['location_type']],['City',['city']],['State',['state']],['Primary',['is_primary'],v=>badge(v===true?'yes':v===false?'no':'—')],['Status',['status'],v=>badge(v)]],
  integrations:[['Integration',['provider','name','integration_type']],['Status',['status'],v=>badge(v)],['Updated',['updated_at'],v=>fmt(v)]],
  audit:[['Event',['event_type','action']],['Object',['object_type','entity_type']],['Actor',['actor_email','actor_user_id','user_id']],['Date',['event_at','created_at'],v=>fmt(v)]],
  contacts:[['Contact',['full_name','first_name'],(v,r)=>esc(r?.full_name||[r?.first_name,r?.last_name].filter(Boolean).join(' ')||'—')],['Type',['contact_type']],['Title',['title']],['Email',['email']],['Phone',['phone']],['Status',['status'],v=>badge(v)]],
  consents:[['Document',['title','form_snapshot.title','form_type']],['Type',['form_type']],['Status',['status'],v=>badge(v)],['Sent',['sent_at','created_at'],v=>fmt(v)],['Completed',['completed_at'],v=>fmt(v)]],
  training:[['Training',['training_title','title']],['Provider',['provider']],['Status',['status'],v=>badge(v)],['Completed',['completed_at'],v=>fmt(v)],['Expires',['expires_at'],v=>fmt(v)]],
  credentials:[['Credential',['credential_type']],['Number',['credential_number']],['State',['issuing_state']],['Expires',['expires_at'],v=>fmt(v)],['Status',['status'],v=>badge(v)]]
};
function table(title,rows,cols,actions){
  rows=Array.isArray(rows)?rows:[];
  const body=rows.length?rows.map(r=>`<tr>${cols.map(c=>{const v=read(r,c[1]);return `<td>${c[2]?c[2](v,r):esc(v)}</td>`}).join('')}${actions?`<td class="row-actions">${actions(r)}</td>`:''}</tr>`).join(''):`<tr><td colspan="${cols.length+(actions?1:0)}"><div class="empty">No records available.</div></td></tr>`;
  return `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2></div><span class="badge">${rows.length} record${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}${actions?'<th>Actions</th>':''}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function metrics(items){return `<div class="metrics">${items.map(([a,b,c])=>`<div class="metric"><small>${esc(a)}</small><strong>${esc(b)}</strong><span>${esc(c||'')}</span></div>`).join('')}</div>`}
function quickCards(){
  const rows=NAV.filter(x=>norm(x.id)!=='dashboard').slice(0,6);
  if(!rows.length)return'';
  return `<div class="panel" style="margin-top:14px"><div class="panel-head"><div><h2>Quick Actions</h2><p>Open another area of your NON-DOT Workforce portal.</p></div></div><div class="cards" style="padding:14px">${rows.map(x=>`<a class="card" href="${esc(x.href)}"><strong>${esc(x.label)}</strong><span>${esc(cardCopy(norm(x.id)))}</span></a>`).join('')}</div></div>`;
}
function cardCopy(id){const m={employers:'Manage customer Employer accounts.',company:'Review company and contact information.',people:'Manage Employees and NON-DOT Drivers.',programs:'Create and maintain NON-DOT testing programs.',pools:'Manage NON-DOT random testing pools.',selections:'Review NON-DOT random selection events.',testing:'Create and track NON-DOT testing orders.',results:'Review testing results available to this account.',compliance:'Track company-policy compliance cases and tasks.',documents:'Review Workforce program documents.',consents:'Manage consents and acknowledgments.',reports:'Review available Workforce reporting.',notifications:'Review portal notifications.',billing:'Review billing and invoices.',services:'Browse and purchase NON-DOT testing services for your workforce.',team:'Review users and roles.',locations:'Manage company locations.',branding:'Review portal branding.',integrations:'Review enabled integrations.','audit-history':'Review account activity history.',profile:'Review your Workforce profile.','my-testing':'Review testing assigned to you.','my-results':'Review results available to you.',training:'Review your training records.',credentials:'Review your credentials.'};return m[id]||'Open this portal area.'}
function rowButtons(r,type){if(C.kind==='self')return'';return `<button class="btn ghost" style="padding:6px 9px" data-edit="${type}" data-id="${esc(r.id)}" type="button">Edit</button><button class="btn ghost" style="padding:6px 9px" data-delete="${type}" data-id="${esc(r.id)}" type="button">Delete</button>${type==='employee'&&C.kind==='employer'?`<button class="btn ghost" style="padding:6px 9px" data-invite="${esc(r.id)}" type="button">Invite</button>`:''}`}

const employerFields=[
  {name:'legal_name',label:'Legal company name',required:true},{name:'dba_name',label:'DBA name'},
  {name:'primary_contact_email',label:'Primary contact email',type:'email'},{name:'phone',label:'Phone'},
  {name:'state',label:'State'}
];
const employeeFields=(employers=[])=>[
  ...(C.kind==='ctpa'?[{name:'employer_id',label:'Employer',type:'select',required:true,options:employers.map(x=>({value:x.id,label:x.legal_name||x.workforce_display_name||x.id}))}]:[]),
  {name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},
  {name:'employee_number',label:'Employee number'},{name:'email',label:'Email',type:'email'},
  {name:'mobile',label:'Mobile'},{name:'job_title',label:'Job title'},
  {name:'workforce_worker_type',label:'Worker type',type:'select',required:true,options:[{value:'employee',label:'Employee'},{value:'driver',label:'NON-DOT Driver'}]},
  {name:'safety_sensitive',label:'Safety-sensitive position',type:'select',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]},
  {name:'employment_status',label:'Employment status',type:'select',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'terminated',label:'Terminated'}]}
];
const programFields=(employers=[])=>[
  ...(C.kind==='ctpa'?[{name:'employer_id',label:'Employer',type:'select',required:true,options:employers.map(x=>({value:x.id,label:x.legal_name||x.id}))}]:[]),
  {name:'name',label:'Program name',required:true},
  {name:'regulatory_category',label:'Program category',type:'select',options:[{value:'workplace_testing',label:'Workplace Testing'},{value:'drug_free_workplace',label:'Drug-Free Workplace'},{value:'safety_program',label:'Safety Program'},{value:'company_policy',label:'Company Policy'}]},
  {name:'testing_panel',label:'Testing panel'},
  {name:'testing_method',label:'Testing method',type:'select',options:[{value:'urine',label:'Urine'},{value:'oral_fluid',label:'Oral Fluid'},{value:'hair',label:'Hair'},{value:'other',label:'Other'}]},
  {name:'drug_random_rate',label:'Drug random rate (%)',type:'number',min:0,max:100,step:'0.01'},
  {name:'alcohol_random_rate',label:'Alcohol random rate (%)',type:'number',min:0,max:100,step:'0.01'},
  {name:'testing_frequency',label:'Testing frequency',type:'select',options:[{value:'monthly',label:'Monthly'},{value:'quarterly',label:'Quarterly'},{value:'semiannual',label:'Semiannual'},{value:'annual',label:'Annual'},{value:'as_needed',label:'As Needed'}]},
  {name:'effective_date',label:'Effective date',type:'date'},
  {name:'status',label:'Status',type:'select',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}
];
const poolFields=(employers=[],programs=[])=>[
  ...(C.kind==='ctpa'?[{name:'employer_id',label:'Client Employer (optional for consortium)',type:'select',options:[{value:'',label:'C/TPA Consortium Pool'},...employers.map(x=>({value:x.id,label:x.legal_name||x.id}))]}]:[]),
  {name:'name',label:'Pool name',required:true},
  ...(C.kind==='ctpa'?[{name:'pool_type',label:'Pool type',type:'select',options:[{value:'consortium',label:'C/TPA Consortium'},{value:'employer',label:'Employer Pool'}]}]:[]),
  {name:'program_id',label:'NON-DOT program',type:'select',options:[{value:'',label:'No program selected'},...programs.map(x=>({value:x.id,label:x.name||x.id}))]},
  {name:'drug_testing_rate',label:'Drug testing rate (%)',type:'number',min:0,max:100,step:'0.01'},
  {name:'alcohol_testing_rate',label:'Alcohol testing rate (%)',type:'number',min:0,max:100,step:'0.01'},
  {name:'selection_schedule',label:'Selection schedule',type:'select',options:[{value:'monthly',label:'Monthly'},{value:'quarterly',label:'Quarterly'},{value:'semiannual',label:'Semiannual'},{value:'annual',label:'Annual'}]},
  {name:'effective_date',label:'Effective date',type:'date'},
  {name:'status',label:'Status',type:'select',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}
];
const locationFields=[{name:'name',label:'Location name',required:true},{name:'location_type',label:'Location type'},{name:'address_line1',label:'Address'},{name:'city',label:'City'},{name:'state',label:'State'},{name:'postal_code',label:'ZIP / Postal code'},{name:'phone',label:'Phone'},{name:'timezone',label:'Timezone'},{name:'status',label:'Status',type:'select',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}];
const contactFields=[{name:'contact_type',label:'Contact type',type:'select',options:[{value:'primary',label:'Primary'},{value:'hr',label:'HR'},{value:'safety',label:'Safety'},{value:'billing',label:'Billing'},{value:'other',label:'Other'}]},{name:'first_name',label:'First name'},{name:'last_name',label:'Last name'},{name:'title',label:'Title'},{name:'email',label:'Email',type:'email'},{name:'phone',label:'Phone'},{name:'status',label:'Status',type:'select',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}];

function findRow(type,id){const map={employer:data?.employers,employee:data?.employees,program:data?.programs,pool:data?.pools,location:data?.locations,contact:data?.contacts};return (map[type]||[]).find(x=>String(x.id)===String(id))||{}}
function edit(type,id){
  const row=findRow(type,id);
  const action=`save_${type}`;
  const fields=type==='employer'?employerFields:type==='employee'?employeeFields(data?.employers||[]):type==='program'?programFields(data?.employers||[]):type==='pool'?poolFields(data?.employers||[],data?.programs||[]):type==='location'?locationFields:contactFields;
  const initial={...row,safety_sensitive:String(!!row.safety_sensitive)};
  formModal(`Edit ${type==='employee'?'Employee / NON-DOT Driver':pretty(type)}`,fields,initial,async v=>invoke(apiName(),{action,[type]:{...row,...v,id:row.id,safety_sensitive:v.safety_sensitive==='true'}}));
}
async function remove(type,id){
  const ok=await confirmBox(`Delete ${pretty(type)}`,`Remove this ${type} from active NON-DOT Workforce records? Historical activity is retained where the system requires it.`);if(!ok)return;
  try{await invoke(apiName(),{action:`delete_${type}`,id});notice('Record removed.','good');await refresh()}catch(err){notice(err.message||String(err))}
}

function invoiceButtons(r){return `<button class="btn ghost" style="padding:6px 9px" data-invoice-view="${esc(r.id)}" type="button">View</button>${Number(r.amount_due||0)>0&&!['paid','void','refunded'].includes(String(r.status||'').toLowerCase())?`<button class="btn primary" style="padding:6px 9px" data-invoice-pay="${esc(r.id)}" type="button">Pay</button>`:''}`}
async function viewInvoice(id){
  try{
    const d=await invoke('workforce-invoice-portal',{action:'detail',invoice_id:id});const i=d.invoice||{};const items=i.invoice_items||[];
    const body=`${metrics([['Invoice',i.invoice_number||'—'],['Status',pretty(i.status||'—')],['Total',money(i.total||0,i.currency)],['Amount Due',money(i.amount_due||0,i.currency)]])}<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>Invoice Items</h3></div><div class="table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${items.length?items.map(x=>`<tr><td>${esc(x.description||x.name||'Service')}</td><td>${esc(x.quantity??1)}</td><td>${esc(money(x.amount||x.total||0,i.currency))}</td></tr>`).join(''):'<tr><td colspan="3"><div class="empty">No item detail available.</div></td></tr>'}</tbody></table></div></div>`;
    const b=modalShell(`Invoice ${i.invoice_number||''}`,body,'<button class="btn ghost" data-close type="button">Close</button>',true);b.querySelector('[data-close]').onclick=()=>b.remove();
  }catch(err){notice(err.message||String(err))}
}
async function payInvoice(id){
  try{
    const d=await invoke('workforce-invoice-portal',{action:'payment_intent',invoice_id:id});
    if(!d?.client_secret||!d?.publishable_key)throw new Error('Secure invoice payment is not ready.');
    await loadStripeJs();
    const i=d.invoice||{};
    const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal modal-wide"><h2>Pay Invoice ${esc(i.invoice_number||'')}</h2><p style="color:#52657a;line-height:1.55;margin:0 0 12px">Complete payment below. You will remain inside your screenings4u Workforce portal.</p><div class="notice" style="margin-bottom:14px"><strong>Amount Due</strong><div style="margin-top:4px">${money(i.amount_due||0,i.currency||'USD')}</div></div><div id="stripe-invoice-payment-element" style="min-height:180px"></div><div id="stripe-invoice-message" style="margin-top:12px"></div><div class="modal-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn primary" data-pay type="button">Pay Invoice</button></div></div>`;document.body.appendChild(b);
    const close=()=>b.remove();b.querySelector('[data-close]').onclick=close;const pay=b.querySelector('[data-pay]'),msg=b.querySelector('#stripe-invoice-message');
    const stripe=window.Stripe(d.publishable_key),elements=stripe.elements({clientSecret:d.client_secret,appearance:{theme:'stripe',variables:{colorPrimary:'#ff6b00',colorText:'#1d2d45',borderRadius:'10px'}}}),pe=elements.create('payment');pe.mount('#stripe-invoice-payment-element');
    pay.onclick=async()=>{pay.disabled=true;pay.textContent='Processing…';try{const out=await stripe.confirmPayment({elements,confirmParams:{return_url:location.href},redirect:'if_required'});if(out.error)throw out.error;msg.innerHTML='<div class="notice"><strong>Payment submitted</strong><div style="margin-top:4px">Confirming your invoice payment…</div></div>';for(let n=0;n<10;n++){await new Promise(r=>setTimeout(r,1200));const x=await invoke('workforce-invoice-portal',{action:'detail',invoice_id:id}),inv=x.invoice||{};if(String(inv.status)==='paid'||Number(inv.amount_due||0)<=0){close();await brandedMessage('Invoice paid','Your invoice payment was received successfully.','success');await refresh();return}}close();await brandedMessage('Payment processing','Stripe accepted the payment. The invoice will update as confirmation completes.','info');await refresh()}catch(err){await brandedMessage('Invoice payment needs attention',err.message||String(err),'error');pay.disabled=false;pay.textContent='Pay Invoice'}};
  }catch(err){await brandedMessage('Unable to open invoice payment',err.message||String(err),'error')}
}

function bindRows(){
  $$('[data-buy-service]').forEach(b=>b.onclick=()=>buyService(b.dataset.buyService));
  $$('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit,b.dataset.id));
  $$('[data-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.delete,b.dataset.id));
  $$('[data-invite]').forEach(b=>b.onclick=async()=>{try{const d=await invoke(apiName(),{action:'invite_employee',employee_id:b.dataset.invite});notice(`Self-service invitation sent${d.portal_code?` to ${pretty(d.portal_code)}`:''}.`,'good')}catch(err){notice(err.message||String(err))}});
  $$('[data-invoice-view]').forEach(b=>b.onclick=()=>viewInvoice(b.dataset.invoiceView));
  $$('[data-invoice-pay]').forEach(b=>b.onclick=()=>payInvoice(b.dataset.invoicePay));
}

function selfNotice(){return `<div class="notice" style="margin-top:14px"><strong>NON-DOT Workforce self-service</strong><div style="margin-top:4px">Your Employer manages these records. You can review your information and complete assigned Consents & Acknowledgments from this portal.</div></div>`}
function renderSelf(p){
  const employee=data?.employee||{};
  if(p==='dashboard')return `${metrics([['Name',personName(employee),'Workforce profile'],['Worker Type',employee.workforce_worker_type==='driver'?'NON-DOT Driver':'Employee','NON-DOT Workforce'],['Employee #',employee.employee_number||'—','Employer-assigned identifier'],['Status',pretty(employee.employment_status||'—'),'Employment status']])}${quickCards()}${selfNotice()}`;
  if(p==='profile')return `<div class="panel"><div class="panel-head"><div><h2>My Profile</h2><p>NON-DOT Workforce employment information.</p></div></div><div style="padding:16px">${metrics([['Name',personName(employee)],['Employee #',employee.employee_number||'—'],['Worker Type',employee.workforce_worker_type==='driver'?'NON-DOT Driver':'Employee'],['Status',pretty(employee.employment_status||'—')]])}${selfNotice()}</div></div>`;
  if(p==='my-testing')return table('My NON-DOT Testing',data.testing_orders||[],COLS.testing);
  if(p==='my-results')return table('My NON-DOT Results',data.results||[],COLS.results);
  if(p==='documents')return table('My Documents',data.documents||[],COLS.documents);
  if(p==='training')return table('Training Records',data.training||[],COLS.training);
  if(p==='credentials')return table('My Credentials',data.credentials||[],COLS.credentials);
  if(p==='consents')return table('Consents & Acknowledgments',data.consent_assignments||[],COLS.consents,r=>['pending','viewed'].includes(String(r.status))?`<button class="btn primary" style="padding:6px 9px" data-consent="${esc(r.id)}" type="button">Complete</button>`:'');
  return '<div class="panel"><div class="empty">No records available.</div></div>';
}
function serviceCard(x){return `<article class="panel" style="padding:18px;display:flex;flex-direction:column;gap:10px"><div><span class="badge">${esc(x.category||'Service')}</span></div><h3 style="margin:0;color:#173d78">${esc(x.name)}</h3><p style="margin:0;color:#63758a;line-height:1.55;min-height:48px">${esc(x.description||'screenings4u Workforce service')}</p><div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:#52657a">${x.specimen?`<span><strong>Specimen:</strong> ${esc(x.specimen)}</span>`:''}${x.results?`<span><strong>Results:</strong> ${esc(x.results)}</span>`:''}</div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:8px"><strong style="font-size:20px;color:#173d78">${money(x.unit_price,x.currency)}</strong><button class="btn primary" data-buy-service="${esc(x.id)}" type="button">Purchase</button></div></article>`}
function renderServicesPage(){
  const services=data.services||[],groups=[...new Set(services.map(x=>x.category||'Services'))];
  const orders=data.orders||[],cases=data.testing_cases||[];
  const recent=orders.map(o=>{const c=cases.find(x=>x.order_id===o.id),item=(o.order_items||[])[0];return{...o,service_name:item?.services?.name||item?.metadata?.service_name||'Workforce Service',testing_status:c?.status||null,donor_name:c?.donor_name||o.metadata?.donor_name||null}});
  return `${metrics([['Available Services',services.length,'Priced NON-DOT services'],['Recent Purchases',orders.length,'Workforce portal orders'],['Testing Cases',cases.length,'Linked screenings4u cases'],['Commerce','screenings4u','Secure Stripe checkout']])}<div style="height:16px"></div><div class="notice" style="margin-bottom:16px"><strong>Workforce Services</strong><div style="margin-top:4px">Choose a service, Employer (C/TPA accounts), Employee / NON-DOT Driver, and testing reason. Payment is processed securely by screenings4u and the paid order is linked directly to Testing Operations.</div></div>${groups.map(g=>`<div class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h2>${esc(g)}</h2><p>Available for your NON-DOT Workforce account.</p></div></div><div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">${services.filter(x=>(x.category||'Services')===g).map(serviceCard).join('')}</div></div>`).join('')}<div style="height:4px"></div>${table('Recent Service Purchases',recent,[['Order',['order_number']],['Service',['service_name']],['Donor',['donor_name']],['Payment',['payment_status'],v=>badge(v)],['Testing',['testing_status'],v=>v?badge(v):'—'],['Total',['total'],(v,r)=>money(v,r.currency)],['Created',['created_at'],v=>fmt(v)]])}`;
}
function buyService(id){
 const svc=(data.services||[]).find(x=>String(x.id)===String(id));if(!svc)return notice('Service is no longer available.');
 const employers=data.employers||[],employees=data.employees||[];
 const employerOptions=C.kind==='ctpa'?`<div class="field full"><label>Employer</label><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name||e.workforce_display_name||'Employer')}</option>`).join('')}</select></div>`:'';
 const employeeOptions=employees.map(e=>{const emp=employers.find(x=>String(x.id)===String(e.employer_id));return `<option value="${esc(e.id)}" data-employer="${esc(e.employer_id)}">${esc([e.first_name,e.last_name].filter(Boolean).join(' '))}${emp&&C.kind==='ctpa'?` — ${esc(emp.legal_name)}`:''}${e.workforce_worker_type==='driver'?' (NON-DOT Driver)':''}</option>`}).join('');
 const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<form class="modal"><h2>${esc(svc.name)}</h2><p style="color:#52657a;line-height:1.6">${esc(svc.description||'Select the worker who will receive this service.')}</p><div class="modal-grid">${employerOptions}<div class="field full"><label>Employee / NON-DOT Driver</label><select name="employee_id" required><option value="">Choose Worker</option>${employeeOptions}</select></div><div class="field full"><label>Testing reason</label><select name="reason" required><option value="pre_employment">Pre-employment</option><option value="random">Random</option><option value="reasonable_suspicion">Reasonable suspicion</option><option value="post_accident">Post-accident</option><option value="return_to_work">Return to work</option><option value="follow_up">Follow-up</option><option value="other">Other</option></select></div></div><div class="notice" style="margin-top:14px"><strong>${money(svc.unit_price,svc.currency)}</strong><div style="margin-top:4px">Secure Stripe payment will open here inside your Workforce portal. Your Workforce account is already linked; no second screenings4u account is required.</div></div><div class="modal-actions"><button class="btn ghost" data-cancel type="button">Cancel</button><button class="btn primary" type="submit">Continue to Secure Payment</button></div></form>`;document.body.appendChild(b);b.querySelector('[data-cancel]').onclick=()=>b.remove();
 const empSel=b.querySelector('[name="employer_id"]'),workerSel=b.querySelector('[name="employee_id"]');if(empSel)empSel.onchange=()=>{const eid=empSel.value;[...workerSel.options].forEach((o,i)=>{if(i===0)return;o.hidden=!!eid&&o.dataset.employer!==eid});workerSel.value=''};
 b.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('[type="submit"]');btn.disabled=true;btn.textContent='Loading Secure Payment…';try{const v=Object.fromEntries(new FormData(e.currentTarget).entries()),d=await invokeMain({action:'checkout',offering_id:svc.id,employer_id:v.employer_id||undefined,employee_id:v.employee_id,reason:v.reason});b.remove();await showMountedCheckout(d)}catch(err){await brandedMessage('Unable to start payment',err.message||String(err));btn.disabled=false;btn.textContent='Continue to Secure Payment'}};
}

function renderMgmt(p){
  if(p==='services')return renderServicesPage();
  if(p==='dashboard'){
    const top=C.kind==='ctpa'?
      [['Client Employers',(data.employers||[]).length,'Managed Employer accounts'],['Workers',(data.employees||[]).length,'Employees / NON-DOT Drivers'],['NON-DOT Programs',(data.programs||[]).length,'Company-policy programs'],['Testing Orders',(data.testing_orders||[]).length,'NON-DOT testing activity']]:
      [['Workers',(data.employees||[]).length,'Employees / NON-DOT Drivers'],['NON-DOT Programs',(data.programs||[]).length,'Company-policy programs'],['Testing Orders',(data.testing_orders||[]).length,'NON-DOT testing activity'],['Plan',ctx?.subscription?.plan_name||data?.subscription?.workforce_plans?.name||data?.subscription?.plan_name||'—','Workforce subscription']];
    return `${metrics(top)}${quickCards()}`;
  }
  if(p==='employers')return table('Client Employers',data.employers||[],COLS.employers,r=>rowButtons(r,'employer'));
  if(p==='people')return table('Employees / NON-DOT Drivers',data.employees||[],COLS.employees,r=>rowButtons(r,'employee'));
  if(p==='programs')return table('NON-DOT Programs',data.programs||[],COLS.programs,r=>rowButtons(r,'program'));
  if(p==='pools')return table('NON-DOT Random Testing Pools',data.pools||[],COLS.pools,r=>rowButtons(r,'pool'));
  if(p==='selections')return table('NON-DOT Random Selections',data.selections||[],COLS.selections);
  if(p==='testing')return table('NON-DOT Testing Orders',data.testing_orders||[],COLS.testing,r=>['created','assigned','employee_notified','scheduled'].includes(String(r.status))?`<button class="btn ghost" style="padding:6px 9px" data-cancel-testing="${esc(r.id)}" type="button">Cancel</button>`:'');
  if(p==='results')return table('NON-DOT Testing Results',data.results||[],COLS.results);
  if(p==='compliance')return `${table('NON-DOT Compliance Cases',data.cases||[],COLS.compliance)}${(data.tasks||[]).length?table('Compliance Tasks',data.tasks||[],[['Task',['title','task_type']],['Due',['due_at'],v=>fmt(v)],['Status',['status'],v=>badge(v)]]):''}`;
  if(p==='documents')return table('Workforce Documents',data.documents||[],COLS.documents);
  if(p==='notifications')return table('Notifications',data.notifications||[],COLS.notifications);
  if(p==='team')return table('Users & Roles',data.members||[],COLS.members);
  if(p==='locations')return table('Locations',data.locations||[],COLS.locations,r=>C.kind==='employer'?rowButtons(r,'location'):'');
  if(p==='integrations')return table('Integrations',data.integrations||[],COLS.integrations);
  if(p==='audit-history')return table('Audit History',data.audit_events||[],COLS.audit);
  if(p==='consents'){
    const forms=data.forms||[],assignments=data.assignments||[];
    return `${table('Consent & Acknowledgment Forms',forms,COLS.consents)}${assignments.length?`<div style="height:14px"></div>${table('Assignments',assignments,COLS.consents)}`:''}`;
  }
  if(p==='reports')return `<div class="panel"><div class="panel-head"><div><h2>NON-DOT Workforce Reports</h2><p>Reporting availability follows your selected Workforce plan and entitlements.</p></div></div><div style="padding:16px">${metrics([['Plan',ctx?.subscription?.plan_name||data?.subscription?.plan_name||'—','Current subscription'],['Business Surface','NON-DOT','Workforce'],['Portal',C.kind==='ctpa'?'C/TPA':'Employer','Management access'],['Status',pretty(ctx?.subscription?.status||data?.subscription?.status||'active'),'Subscription status']])}<div class="notice" style="margin-top:14px">This page is intentionally NON-DOT. DOT MIS and agency-specific reporting do not appear in the Workforce portal.</div></div></div>`;
  if(p==='billing')return `${metrics([['Invoices',(data.invoices||[]).length,'Sent invoices'],['Outstanding',(data.outstanding||[]).length,'Balances due'],['Paid / Closed',(data.history||[]).length,'Invoice history'],['Surface','NON-DOT','Workforce billing']])}<div style="height:14px"></div>${table('Invoices',data.invoices||[],COLS.invoices,invoiceButtons)}`;
  if(p==='branding')return `<div class="panel"><div class="panel-head"><div><h2>Portal Branding</h2><p>Branding used for your Workforce experience.</p></div></div><div style="padding:16px">${metrics([['Portal Name',data.branding?.portal_name||'screenings4u Workforce'],['Primary Color',data.branding?.primary_color||'Default'],['Accent Color',data.branding?.accent_color||'Default'],['Custom Domain',data.branding?.custom_domain||'Not configured']])}</div></div>`;
  if(p==='company')return `<div class="panel"><div class="panel-head"><div><h2>${esc(data.employer?.legal_name||ctx?.membership?.organization_name||'Company')}</h2><p>NON-DOT Workforce company profile.</p></div></div><div style="padding:16px">${metrics([['Status',pretty(data.employer?.status||'active')],['State',data.employer?.state||'—'],['Phone',data.employer?.phone||'—'],['Plan',ctx?.subscription?.plan_name||'—']])}</div></div><div style="height:14px"></div>${table('Company Contacts',data.contacts||[],COLS.contacts)}`;
  return '<div class="panel"><div class="empty">No records available.</div></div>';
}

function managementActions(p){
  if(C.kind==='self')return;
  if(p==='people')addAction('Add Employee / Driver',()=>formModal('Add Employee / NON-DOT Driver',employeeFields(data.employers||[]),{},async v=>invoke(apiName(),{action:'save_employee',employee:{...v,safety_sensitive:v.safety_sensitive==='true'}})));
  if(p==='programs')addAction('Add NON-DOT Program',()=>formModal('Add NON-DOT Program',programFields(data.employers||[]),{},async v=>invoke(apiName(),{action:'save_program',program:v})));
  if(p==='pools')addAction('Add NON-DOT Pool',()=>formModal('Add NON-DOT Random Testing Pool',poolFields(data.employers||[],data.programs||[]),{},async v=>invoke(apiName(),{action:'save_pool',pool:v})));
  if(p==='testing')addAction('Create Testing Order',()=>formModal('Create NON-DOT Testing Order',[
    ...(C.kind==='ctpa'?[{name:'employer_id',label:'Employer',type:'select',required:true,options:(data.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.id}))}]:[]),
    {name:'employee_id',label:'Employee / NON-DOT Driver',type:'select',required:true,options:(data.employees||[]).map(x=>({value:x.id,label:personName(x)=== '—'?x.id:personName(x)}))},
    {name:'program_id',label:'NON-DOT Program',type:'select',required:true,options:(data.programs||[]).map(x=>({value:x.id,label:x.name||x.id}))},
    {name:'reason',label:'Reason',type:'select',options:['pre_employment','random','reasonable_suspicion','post_accident','return_to_work','follow_up','other'].map(x=>({value:x,label:pretty(x)}))},
    {name:'test_type',label:'Test type',type:'select',options:[{value:'drug',label:'Drug'},{value:'alcohol',label:'Alcohol'},{value:'drug_and_alcohol',label:'Drug + Alcohol'}]}
  ],{},async v=>invoke(apiName(),{action:'create_testing',testing:v})));
  if(C.kind==='employer'&&p==='locations')addAction('Add Location',()=>formModal('Add Location',locationFields,{},async v=>invoke(apiName(),{action:'save_location',location:v})));
  }
function subtitleFor(p){
  const common={
    dashboard:C.kind==='self'?'Your secure NON-DOT Workforce self-service dashboard.':C.kind==='ctpa'?'Manage customer Employers and their NON-DOT workforce programs, pools, testing, results, and compliance.':'Manage your company’s NON-DOT workforce program, employees / drivers, testing, and compliance.',
    employers:'Manage customer Employer accounts under your NON-DOT Workforce C/TPA program.',
    company:'Review your company profile and Workforce contacts.',
    people:'Manage Employees and NON-DOT Drivers participating in your Workforce program.',
    programs:'Create and manage company-policy NON-DOT testing programs. These programs are not DOT-regulated.',
    pools:'Manage NON-DOT random testing pools, rates, and selection schedules.',
    selections:'Review NON-DOT random selection events.',
    testing:'Create and track NON-DOT testing orders under company policy.',
    results:'Review NON-DOT testing results available to this account.',
    compliance:'Track company-policy NON-DOT compliance cases and follow-up tasks.',
    documents:'Review documents associated with the NON-DOT Workforce program.',
    consents:'Review and complete company-policy consents and acknowledgments.',
    reports:'Review reporting available for the NON-DOT Workforce program.',
    notifications:'Review Workforce notifications and delivery activity.',
    billing:'Review NON-DOT Workforce invoices and balances.',
    services:'Purchase screenings4u NON-DOT testing services for your Employees and NON-DOT Drivers.',
    team:'Review portal users and roles.',
    locations:'Manage Workforce locations.',
    branding:'Review Workforce portal branding.',
    integrations:'Review Workforce integrations available to this account.',
    'audit-history':'Review account activity recorded for the Workforce portal.',
    profile:'Review your NON-DOT Workforce profile.',
    'my-testing':'Review NON-DOT testing assigned to you.',
    'my-results':'Review NON-DOT testing results available to you.',
    training:'Review your Workforce training records.',
    credentials:'Review credentials maintained for your NON-DOT Driver profile.'
  };
  return common[p]||'Manage NON-DOT Workforce information for this portal.';
}
async function refresh(){
  if(page()==='services'){const q=new URLSearchParams(location.search);if(q.get('checkout')==='return'&&q.get('session_id')){const sid=q.get('session_id');history.replaceState({},'',location.pathname);setTimeout(async()=>{try{const st=await invokeMain({action:'status',session_id:sid});if(String(st.payment_status)==='paid'||String(st.status)==='complete'){await brandedMessage('Payment received','Your payment is complete and the testing request is being linked to your Workforce account.','success');await refresh()}else await brandedMessage('Payment processing','Stripe is still confirming this payment. Your purchase will appear here when processing finishes.')}catch(err){await brandedMessage('Payment status unavailable',err.message||String(err))}},80)}}
  try{
    data=await load();
    if($('#actions'))$('#actions').innerHTML='';
    const p=norm(page());
    if($('#subtitle'))$('#subtitle').textContent=subtitleFor(p);
    if($('#content'))$('#content').innerHTML=C.kind==='self'?renderSelf(p):renderMgmt(p);
    managementActions(p);bindRows();
    $$('[data-cancel-testing]').forEach(b=>b.onclick=async()=>{const ok=await confirmBox('Cancel Testing Order','Cancel this NON-DOT testing order? Completed testing history is not removed.');if(!ok)return;try{await invoke(apiName(),{action:'cancel_testing',id:b.dataset.cancelTesting});notice('Testing order cancelled.','good');await refresh()}catch(err){notice(err.message||String(err))}});
    $$('[data-consent]').forEach(b=>b.onclick=()=>formModal('Complete Consent / Acknowledgment',[{name:'acknowledged_name',label:'Type your full name',required:true},{name:'accepted',label:'I acknowledge and accept',type:'select',options:[{value:'true',label:'Yes'}]}],{},async v=>invoke(apiName(),{action:'complete_consent_assignment',assignment_id:b.dataset.consent,acknowledged_name:v.acknowledged_name,accepted:v.accepted==='true'})));
  }catch(err){notice(err.message||String(err));if($('#content'))$('#content').innerHTML='<div class="panel"><div class="empty">Unable to load this page.</div></div>'}
  finally{document.body.classList.remove('loading')}
}
async function boot(){
  try{
    ctx=await access();
    if(ctx.requires_workspace_selection){location.replace('/workspace.html');return}
    if(ctx.membership?.id)localStorage.setItem(storageKey(),ctx.membership.id);
    if(ctx.subscription?.id)localStorage.setItem(subKey(),ctx.subscription.id);
    shell(ctx);window.portalCtx=ctx;await refresh();
  }catch(err){
    const msg=String(err?.message||err||'');
    if(/unauthorized|session|jwt|sign in/i.test(msg)){location.replace('/login.html');return}
    document.body.className='';
    document.body.innerHTML=`<main class="login-page"><section class="login-card"><img class="login-logo" src="/assets/img/logo.png" alt="screenings4u"><h1>Portal unavailable</h1><p>${esc(msg||'This NON-DOT Workforce portal could not be loaded.')}</p><a class="btn primary" href="/login.html">Return to sign in</a></section></main>`;
  }
}
boot();
})();
