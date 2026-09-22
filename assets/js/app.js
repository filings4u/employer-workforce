(()=>{'use strict';
const C=window.PORTAL_CONFIG;
const sb=window.supabase.createClient(C.workforceUrl,C.workforceKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLowerCase().replaceAll('-','_');
const pretty=v=>String(v??'—').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const fmt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)};
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
const statusClass=v=>/active|complete|completed|paid|eligible|final|negative|acknowledged|available|enabled/i.test(String(v))?'good':/cancel|inactive|terminated|positive|suspended|overdue|failed|closed/i.test(String(v))?'bad':'warn';
const badge=v=>`<span class="badge ${statusClass(v)}">${esc(pretty(v))}</span>`;
const page=()=>location.pathname.split('/').pop()?.replace('.html','')||'dashboard';
const storageKey=()=>`s4u_${C.portalCode}_membership`;
const subscriptionKey=()=>`s4u_${C.portalCode}_subscription`;
const stored=()=>localStorage.getItem(storageKey())||'';
const storedSubscription=()=>localStorage.getItem(subscriptionKey())||'';
const saveMid=v=>{if(v)localStorage.setItem(storageKey(),v)};
const saveSubscription=v=>{if(v)localStorage.setItem(subscriptionKey(),v)};
const cfgPage=id=>C.pages.find(x=>x.id===id)||{id,label:pretty(id),icon:'•'};

async function getSession(){const {data:{session},error}=await sb.auth.getSession();if(error)throw error;return session}
async function invoke(name,body={}){
  const s=await getSession();if(!s)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const r=await fetch(`${C.workforceUrl}/functions/v1/${name}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':C.workforceKey},body:JSON.stringify(name==='workforce-session-context'?body:{portal_code:C.portalCode,membership_id:stored()||undefined,subscription_id:storedSubscription()||undefined,...body})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error)throw Object.assign(new Error(d.error||`Request failed (${r.status}).`),{status:r.status,payload:d});
  return d;
}
async function access(){const b={requested_portal_code:C.portalCode,requested_page:page()};if(stored())b.membership_id=stored();if(storedSubscription())b.subscription_id=storedSubscription();return invoke('workforce-session-context',b)}

function shell(ctx){
  const current=page();
  const allowed=Array.isArray(ctx.navigation)&&ctx.navigation.length?ctx.navigation:C.pages;const links=allowed.map(n=>{const id=String(n.id||'').replaceAll('_','-'),fallback=cfgPage(id),label=n.label||fallback.label,icon=n.icon||fallback.icon,href=n.href||`/${id}.html`;return `<a href="${esc(href)}" class="${current===id?'active':''}"><span class="ico">${esc(icon)}</span><span>${esc(label)}</span></a>`}).join('');
  document.body.className='';
  document.body.innerHTML=`<div class="app"><aside class="side" id="side"><div class="brand"><img class="brand-logo brand-logo-ready" src="/assets/img/logo.png" alt="${esc(C.label)}"></div><nav class="nav"><div class="nav-title">${esc(ctx.membership?.organization_name||C.label)}</div>${links}</nav><div class="side-foot"><div style="font-size:9px;color:#9fb3c7">Portal</div><div style="font-size:11px;font-weight:800;color:#fff;margin-top:3px">${esc(C.domain)}</div></div></aside><main class="main"><header class="top"><div class="top-left"><button class="menu" id="menu">☰</button><span class="crumb">${esc(C.label)} / ${esc(cfgPage(current).label)}</span></div><div class="top-right"><span class="pill">${esc(C.kind==='self'?'Self Service':'Management')}</span>${C.agency?`<span class="pill">${esc(C.agency)}</span>`:''}<button class="signout" id="logout">Sign out</button></div></header><div class="content"><div id="error"></div><section class="hero"><span class="hero-kicker">${esc(C.label)}</span><h1>${esc(cfgPage(current).label)}</h1><p id="subtitle">Loading portal workspace.</p><div class="hero-actions" id="actions"></div></section><section class="section" id="content"><div class="panel"><div class="loading-msg">Loading…</div></div></section></div></main></div>`;
  $('#menu').onclick=()=>$('#side').classList.toggle('open');
  $('#logout').onclick=async()=>{localStorage.removeItem(storageKey());localStorage.removeItem(subscriptionKey());await sb.auth.signOut();location.replace('/login.html')};
}
function metric(label,value,note=''){return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`}
function read(o,keys){for(const k of keys){let v=o;for(const p of k.split('.'))v=v?.[p];if(v!==undefined&&v!==null&&v!=='')return v}return'—'}
const dateCell=v=>fmt(v),moneyCell=v=>money(v),badgeCell=v=>badge(v);
const COLS={
  employers:[['Employer',['legal_name','workforce_display_name']],['Status',['status'],badgeCell],['USDOT',['dot_number']],['Contact',['primary_contact_email']],['State',['state']]],
  employees:[['Name',['display_name','first_name']],['Employee #',['employee_number']],['Type',['workforce_worker_type'],badgeCell],['Position',['job_title']],['Status',['employment_status'],badgeCell]],
  programs:[['Program',['name']],['Type',['program_type'],badgeCell],['Agency',['dot_agency']],['Category',['regulatory_category']],['Status',['status'],badgeCell]],
  pools:[['Pool',['name']],['Type',['pool_type']],['Agency',['dot_agency']],['Drug Rate',['drug_random_rate']],['Status',['status'],badgeCell]],
  selections:[['Date',['selection_date','selected_at'],dateCell],['Type',['selection_type']],['Population',['population_size']],['Drug',['drug_selection_count','drug_selected']],['Status',['status'],badgeCell]],
  testing:[['Order',['order_number']],['Reason',['reason']],['Type',['test_type']],['Program',['programs.name','program_type']],['Status',['status'],badgeCell]],
  results:[['Order',['testing_orders.order_number','order_number']],['Result',['final_status','verified_result'],badgeCell],['Date',['result_date','finalized_at'],dateCell],['MRO',['mro_status'],badgeCell],['Status',['notification_status'],badgeCell]],
  compliance:[['Case',['case_number']],['Event',['event_type']],['Priority',['priority'],badgeCell],['Opened',['opened_at','created_at'],dateCell],['Status',['status'],badgeCell]],
  documents:[['File',['file_name','title']],['Type',['document_type']],['Uploaded',['uploaded_at','created_at'],dateCell],['Expires',['expires_at'],dateCell],['Access',['access_level'],badgeCell]],
  notifications:[['Subject',['subject','event_type']],['Channel',['channel']],['Status',['status'],badgeCell],['Queued',['queued_at'],dateCell]],
  invoices:[['Invoice',['invoice_number']],['Status',['status'],badgeCell],['Total',['total'],moneyCell],['Paid',['amount_paid'],moneyCell],['Due',['amount_due'],moneyCell]],
  credentials:[['Credential',['credential_type']],['Number',['credential_number']],['State',['issuing_state']],['Expires',['expires_at'],dateCell],['Status',['status'],badgeCell]],
  training:[['Training',['training_title','title']],['Provider',['provider']],['Status',['status'],badgeCell],['Completed',['completed_at'],dateCell],['Expires',['expires_at'],dateCell]],
  policies:[['Policy',['policy_name','ctpa_policy_documents.title']],['Status',['status'],badgeCell],['Distributed',['distributed_at'],dateCell],['Acknowledged',['acknowledged_at'],dateCell]],
  accidents:[['Occurred',['occurred_at'],dateCell],['Type',['accident_type']],['Required',['testing_required'],v=>badge(v===true?'required':v===false?'not required':'pending')],['Drug',['drug_test_required'],v=>badge(v===true?'required':'—')],['Alcohol',['alcohol_test_required'],v=>badge(v===true?'required':'—')]],
  members:[['User',['profiles.display_name','profiles.first_name','user_id']],['Role',['roles.name','roles.code']],['Status',['status'],badgeCell],['Primary',['is_primary'],v=>badge(v===true?'yes':'no')]],
  locations:[['Location',['name']],['Employer',['employer.legal_name','employer.dba_name']],['Type',['location_type']],['City',['city']],['State',['state']]],
  integrations:[['Integration',['name']],['Type',['integration_type']],['Provider',['provider']],['Status',['status'],badgeCell],['Last Sync',['last_sync_at'],dateCell]],
  audit:[['Action',['action']],['Resource',['resource_type']],['Actor',['actor_profile.display_name','actor_user_id']],['When',['event_at'],dateCell]]
};
function table(title,rows,cols){
  const body=rows.length?rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](read(r,c[1])):esc(read(r,c[1]))}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}"><div class="empty">No records available.</div></td></tr>`;
  return `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2></div><span class="badge">${rows.length} record${rows.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function modal(title,fields,onSave){
  const b=document.createElement('div');b.className='modal-backdrop';
  const fieldHtml=fields.map(f=>{const input=f.type==='select'?`<select name="${esc(f.name)}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(f.value??'')?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:`<input type="${esc(f.type||'text')}" name="${esc(f.name)}" value="${esc(f.value||'')}" ${f.required?'required':''}>`;return `<div class="field ${f.full?'full':''}"><label>${esc(f.label)}</label>${input}</div>`}).join('');
  b.innerHTML=`<form class="modal"><h2>${esc(title)}</h2><div class="modal-grid">${fieldHtml}</div><div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`;
  document.body.appendChild(b);b.querySelector('[data-cancel]').onclick=()=>b.remove();
  b.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const v=Object.fromEntries(new FormData(e.currentTarget).entries());await onSave(v);b.remove();await render(window.portalCtx)}catch(err){alert(err.message||String(err))}};
}
function setSubtitle(v){$('#subtitle').textContent=v}
function addAction(label,fn,secondary=false){const b=document.createElement('button');b.className=`btn ${secondary?'secondary':'primary'}`;b.textContent=label;b.onclick=fn;$('#actions').appendChild(b)}

async function ctpaData(p){
  if(p==='employers')return invoke('workforce-ctpa-employers',{action:'workspace'});
  if(p==='people'||p==='programs')return invoke('workforce-ctpa-employees-programs',{action:'workspace'});
  if(p==='pools')return invoke('workforce-ctpa-pools',{action:'workspace'});
  if(p==='testing')return invoke('workforce-ctpa-testing',{action:'workspace'});
  if(p==='compliance')return invoke('workforce-ctpa-compliance',{action:'workspace'});
  if(p==='documents')return invoke('workforce-ctpa-documents',{action:'workspace'});
  if(p==='notifications')return invoke('workforce-ctpa-notifications',{action:'workspace'});
  if(p==='team')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'staff'});
  if(p==='locations')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'locations'});
  if(p==='branding')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'branding'});
  if(p==='integrations')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'integrations'});
  if(p==='audit-history')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'audit'});
  if(p==='billing')return invoke('workforce-ctpa-admin',{action:'workspace',scope:'billing'});
  const scope={dashboard:'dashboard',employers:'all',selections:'selections',results:'results',reports:'reports'}[p]||'dashboard';
  return invoke('workforce-ctpa-portal',{action:'workspace',scope});
}
async function employerData(p){
  if(C.kind==='agency')return invoke('workforce-employer-management',{action:'agency_workspace',agency_code:C.agency});
  if(p==='testing')return invoke('workforce-employer-testing',{action:'list'}).catch(()=>invoke('workforce-employer-management',{action:'overview'}));
  if(p==='pools')return invoke('workforce-employer-pools',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'overview'}));
  if(p==='selections')return invoke('workforce-employer-pools',{action:'selection_history'}).catch(()=>invoke('workforce-employer-management',{action:'selection_history'}));
  if(p==='documents')return invoke('workforce-employer-documents',{action:'workspace'});
  if(p==='results')return invoke('workforce-employer-results',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'results'}));
  if(p==='notifications')return invoke('workforce-employer-notifications',{action:'workspace'}).catch(()=>invoke('workforce-employer-management',{action:'notifications'}));
  if(p==='consents')return invoke('workforce-employer-management',{action:'consent_workspace'});
  if(p==='locations')return invoke('workforce-employer-management',{action:'locations'});
  if(p==='branding')return invoke('workforce-employer-management',{action:'branding'});
  if(p==='audit-history')return invoke('workforce-employer-management',{action:'audit'});
  if(p==='integrations')return invoke('workforce-employer-management',{action:'entitlements'});
  const map={dashboard:'overview',company:'settings',people:'overview',programs:'overview',pools:'overview',selections:'selection_history',compliance:'compliance_detail',reports:'reports',billing:'subscription',team:'members','post-accident':'overview'};
  return invoke('workforce-employer-management',{action:map[p]||'overview'});
}
async function selfData(){return invoke('workforce-employee-portal',{action:'workspace',membership_id:stored()})}
async function serviceCatalog(){const r=await fetch(`${C.mainUrl}/functions/v1/portal-order-catalog`,{headers:{apikey:C.mainKey}});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'Unable to load services.');return d}

function dashboard(ctx,d){
  let m=[];
  if(C.kind==='self')m=[['Testing',(d.testing_orders||[]).length,'My testing orders'],['Results',(d.results||d.result_reports||[]).length,'My available results'],['Documents',(d.documents||[]).length,'My documents'],['Training',(d.training||[]).length,'My training records']];
  else if(C.kind==='ctpa')m=[['Employers',(d.employers||[]).length,'Managed employers'],['People',(d.employees||[]).length,'Covered people'],['Programs',(d.programs||[]).length,'Testing programs'],['Testing',(d.testing_orders||[]).length,'Testing orders']];
  else m=[['People',(d.employees||[]).length,'Company roster'],['Programs',(d.programs||[]).length,'Programs'],['Testing',(d.testing_orders||d.orders||[]).length,'Orders'],['Compliance',(d.compliance_cases||d.cases||[]).filter(x=>!['closed','resolved'].includes(norm(x.status))).length,'Open cases']];
  const navPages=(Array.isArray(ctx.navigation)&&ctx.navigation.length?ctx.navigation:C.pages).map(n=>({id:String(n.id||'').replaceAll('_','-'),label:n.label||cfgPage(String(n.id||'').replaceAll('_','-')).label}));const quick=navPages.filter(x=>!['dashboard','profile','company'].includes(x.id)).slice(0,6);
  return `<div class="metrics">${m.map(x=>metric(...x)).join('')}</div><div class="section"><div class="cards">${quick.map(x=>`<a class="card" href="/${x.id}.html"><strong>${esc(x.label)}</strong><span>Open ${esc(x.label.toLowerCase())}.</span></a>`).join('')}</div></div>`;
}
function profileView(d){const x=d.employee||d.employer||{};return `<div class="metrics">${metric('Name',x.legal_name||[x.first_name,x.last_name].filter(Boolean).join(' ')||'—')}${metric('Email',x.email||x.primary_contact_email||'—')}${metric('Phone',x.mobile||x.phone||'—')}${metric('Status',pretty(x.employment_status||x.status||'—'))}</div>`}
function pickManagementRows(p,d){
  if(C.kind==='ctpa'){
    if(p==='employers')return[d.employers||[],'employers'];
    if(p==='people')return[d.employees||[],'employees'];
    if(p==='programs')return[d.programs||[],'programs'];
    if(p==='pools')return[d.pools||[],'pools'];
    if(p==='selections')return[d.selection_members||d.selection_events||[],'selections'];
    if(p==='testing')return[d.orders||d.testing_orders||[],'testing'];
    if(p==='results')return[d.results||[],'results'];
    if(p==='compliance')return[d.compliance_cases||d.cases||[],'compliance'];
    if(p==='documents')return[d.documents||[],'documents'];
    if(p==='notifications')return[d.notifications||[],'notifications'];
    if(p==='billing')return[d.invoices||[],'invoices'];
  }
  if(C.kind==='agency'){
    if(['drivers','covered-workers','mariners'].includes(p))return[d.employees||[],'employees'];
    if(p==='programs')return[d.programs||[],'programs'];
    if(p==='randoms')return[d.selections||[],'selections'];
    if(p==='testing')return[d.testing_orders||[],'testing'];
    if(['post-accident','serious-marine-incident','toxicology'].includes(p))return[d.post_accident_events||[],'accidents'];
    if(p==='compliance')return[d.compliance_cases||[],'compliance'];
    if(p==='documents')return[d.documents||[],'documents'];
  }
  if(p==='people')return[d.employees||[],'employees'];
  if(p==='programs')return[d.programs||[],'programs'];
  if(p==='pools')return[d.pools||[],'pools'];
  if(p==='selections')return[d.selection_members||[],'selections'];
  if(p==='testing')return[d.orders||d.testing_orders||[],'testing'];
  if(p==='results')return[d.results||[],'results'];
  if(p==='compliance')return[d.cases||d.compliance_cases||[],'compliance'];
  if(p==='documents')return[d.documents||[],'documents'];
  if(p==='notifications')return[d.notifications||[],'notifications'];
  if(p==='billing')return[d.invoices||[],'invoices'];
  if(p==='team')return[d.members||[],'members'];
  return[[],null];
}

function wireSelfActions(p,d,ctx){
  if(p==='consents'){
    const pending=(d.policies||[]).find(x=>!x.acknowledged_at);
    if(pending)addAction('Acknowledge Required Policy',()=>modal('Acknowledge Policy',[{name:'acknowledged_name',label:'Type your full name',required:true}],async v=>invoke('workforce-employee-portal',{action:'acknowledge_policy',membership_id:stored(),acknowledgment_id:pending.id,acknowledged_name:v.acknowledged_name})));
  }
  if(p==='credentials')addAction('Submit Credential',()=>modal('Submit Credential',[{name:'credential_type',label:'Credential type',required:true},{name:'credential_number',label:'Credential number'},{name:'issuing_state',label:'Issuing state'},{name:'expires_at',label:'Expiration date',type:'date'}],async v=>invoke('workforce-employee-portal',{action:'save_credential',membership_id:stored(),credential:v})));
}
function wireManagementActions(p,d,ctx){
  if(C.kind==='ctpa'&&p==='employers')addAction('Add Employer',()=>modal('Add Employer',[{name:'legal_name',label:'Legal company name',required:true},{name:'dba_name',label:'DBA name'},{name:'primary_contact_email',label:'Primary contact email',type:'email'},{name:'phone',label:'Phone'},{name:'state',label:'State'}],async v=>invoke('workforce-ctpa-employers',{action:'save_employer',employer:{...v,status:'active'}})));
  if(C.kind==='agency'){
    if(p==='agency-configuration'||['authorizations','contractors','random-plan','policy','anti-drug-plan','alcohol-misuse-plan','periodic-testing'].includes(p)){
      const r=(d.registrations||[])[0]||{},cfg=r.configuration||{};
      addAction('Edit Agency Configuration',()=>modal(`${C.agency} Configuration`,[{name:'account_identifier',label:'Agency account / identifier',value:r.account_identifier||''},{name:'employee_category',label:'Regulated category',value:r.employee_category||'general'},{name:'effective_date',label:'Effective date',type:'date',value:r.effective_date||new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_registration',agency_code:C.agency,registration:{agency_code:C.agency,...v,configuration:cfg,status:'active'}})));
    }
    if(p==='programs')addAction('Add Program',()=>modal(`Add ${C.agency} Program`,[{name:'name',label:'Program name',required:true},{name:'regulatory_category',label:'Regulatory category'},{name:'testing_method',label:'Testing method',value:'Urine / Breath'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)}],async v=>invoke('workforce-employer-management',{action:'save_agency_program',agency_code:C.agency,program:{dot_agency:C.agency,...v,status:'active'}})));
    if(['drivers','covered-workers','mariners'].includes(p))addAction('Add Covered Worker',()=>modal('Add Covered Worker',[{name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},{name:'employee_number',label:'Employee number'},{name:'email',label:'Email',type:'email'},{name:'job_title',label:'Safety-sensitive position'}],async v=>invoke('workforce-employer-management',{action:'save_employee',employee:{...v,dot_covered:true,dot_agency:C.agency,safety_sensitive:true,employment_status:'active'}})));
    return;
  }
  if(p==='people')addAction(C.surface==='dot'?'Add Driver / Employee':'Add Employee / Driver',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.dba_name||x.id}))});
    fields.push({name:'first_name',label:'First name',required:true},{name:'last_name',label:'Last name',required:true},{name:'employee_number',label:'Employee number'},{name:'email',label:'Email',type:'email'},{name:'job_title',label:'Job title'});
    if(C.surface==='workforce')fields.push({name:'workforce_worker_type',label:'Portal type',type:'select',value:'employee',options:[{value:'employee',label:'Employee'},{value:'driver',label:'NON-DOT Driver'}]});
    if(C.surface==='dot')fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal(C.surface==='workforce'?'Add Employee / Driver':'Add Employee',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-employees-programs',{action:'save_employee',employee:{...v,dot_covered:C.surface==='dot',employment_status:'active',safety_sensitive:C.surface==='dot'}});
      return invoke('workforce-employer-management',{action:'save_employee',employee:{...v,dot_covered:C.surface==='dot',employment_status:'active',safety_sensitive:C.surface==='dot'}});
    });
  });
  if(C.kind==='employer'&&p==='people'){
    const eligible=(d.employees||[]).filter(x=>x.email);
    if(eligible.length)addAction('Invite to Self-Service',()=>modal('Invite Employee / Driver',[{name:'employee_id',label:'Employee / Driver',type:'select',required:true,options:eligible.map(x=>({value:x.id,label:[x.first_name,x.last_name].filter(Boolean).join(' ')||x.email||x.id}))}],async v=>invoke('workforce-employer-management',{action:'invite_employee',employee:{id:v.employee_id}})),true);
  }
  if(p==='programs')addAction('Add Program',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.dba_name||x.id}))});
    fields.push({name:'name',label:'Program name',required:true},{name:'testing_method',label:'Testing method'},{name:'effective_date',label:'Effective date',type:'date',value:new Date().toISOString().slice(0,10)});
    if(C.surface==='dot')fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal('Add Program',fields,async v=>{
      const program={...v,program_type:C.surface==='dot'?'DOT':'NON_DOT',status:'active'};
      if(C.kind==='ctpa')return invoke('workforce-ctpa-employees-programs',{action:'save_program',program});
      return invoke('workforce-employer-management',{action:'save_program',program});
    });
  });
  if(p==='testing')addAction('Create Testing Order',()=>{
    const employees=d.employees||[],programs=d.programs||[],employers=d.employers||[];
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',required:true,options:employers.map(x=>({value:x.id,label:x.legal_name||x.id}))});
    fields.push({name:'employee_id',label:'Employee / Driver',type:'select',required:true,options:employees.map(x=>({value:x.id,label:[x.first_name,x.last_name].filter(Boolean).join(' ')||x.employee_number||x.id}))},{name:'program_id',label:'Program',type:'select',required:true,options:programs.map(x=>({value:x.id,label:x.name||x.id}))},{name:'reason',label:'Reason',type:'select',value:'pre_employment',options:(C.surface==='workforce'?['pre_employment','random','reasonable_suspicion','post_accident','return_to_work','other']:['pre_employment','reasonable_suspicion','post_accident','return_to_duty','follow_up','other']).map(x=>({value:x,label:pretty(x)}))},{name:'test_type',label:'Test type',type:'select',value:C.surface==='dot'?'drug_and_alcohol':'drug',options:[{value:'drug',label:'Drug'},{value:'alcohol',label:'Alcohol'},{value:'drug_and_alcohol',label:'Drug + Alcohol'}]});
    modal('Create Testing Order',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-testing',{action:'create',test:v});
      return invoke('workforce-employer-testing',{action:'create',test:v});
    });
  });
  if(p==='pools')addAction('Add Pool',()=>{
    const fields=[];
    if(C.kind==='ctpa')fields.push({name:'employer_id',label:'Client Employer',type:'select',options:(d.employers||[]).map(x=>({value:x.id,label:x.legal_name||x.id}))});
    fields.push({name:'name',label:'Pool name',required:true},{name:'pool_type',label:'Pool type',type:'select',value:C.kind==='ctpa'?'consortium':'employer',options:[{value:'employer',label:'Employer Pool'},{value:'consortium',label:'Consortium'}]},{name:'program_type',label:'Program type',type:'select',value:C.surface==='dot'?'DOT':'NON_DOT',options:[{value:'DOT',label:'DOT'},{value:'NON_DOT',label:'NON-DOT'}]});
    if(C.surface==='dot')fields.push({name:'dot_agency',label:'DOT Agency',type:'select',value:'FMCSA',options:['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(x=>({value:x,label:x}))});
    modal('Add Pool',fields,async v=>{
      if(C.kind==='ctpa')return invoke('workforce-ctpa-pools',{action:'save_pool',pool:v});
      return invoke('workforce-employer-pools',{action:'save_pool',pool:v});
    });
  });
}

async function render(ctx){
  $('#actions').innerHTML='';const p=page();let d;
  if(C.kind==='self')d=await selfData();else if(C.kind==='ctpa')d=await ctpaData(p);else d=await employerData(p);
  if(C.kind==='self')setSubtitle('View your own records and complete only the actions assigned to you.');
  else if(C.kind==='agency')setSubtitle(`${C.agency} company management workspace. Changes apply only to your company.`);
  else if(C.kind==='ctpa')setSubtitle('Manage employer customers, employees / drivers, NON-DOT programs, testing and compliance.');
  else setSubtitle('Manage your company, employees / drivers, NON-DOT programs, testing and compliance.');
  let html='';
  if(p==='dashboard')html=dashboard(ctx,d);
  else if(p==='order-services'){
    const cat=await serviceCatalog();
    const cards=(cat.services||[]).map(s=>{const href=(cat.seller?.checkout_base||'https://screenings4u.com/')+String(s.order_url||'');return `<article class="service"><h3>${esc(s.name)}</h3><p>${esc(s.description||s.category||'DOT service')}</p><div class="price">${s.amount==null?'Request quote':money(s.amount)}</div><div class="seller">Seller: ${esc(s.seller_legal_name||'screenings4u, LLC')}</div><a class="btn primary" href="${esc(href)}" target="_blank" rel="noopener">Order from screenings4u</a></article>`}).join('');
    html=`<div class="notice">Services on this page are sold by <strong>screenings4u, LLC</strong>. This portal remains the compliance-management system.</div><div class="section service-grid">${cards}</div>`;
  }
  else if(C.kind==='self'){
    if(p==='profile')html=profileView(d);
    else if(p==='my-testing')html=table('My Testing',d.testing_orders||[],COLS.testing);
    else if(p==='my-results')html=table('My Results',d.results||d.result_reports||[],COLS.results);
    else if(p==='documents')html=table('My Documents',d.documents||[],COLS.documents);
    else if(p==='credentials')html=table('My Credentials',d.credentials||[],COLS.credentials);
    else if(p==='training')html=table('Training Records',d.training||[],COLS.training)+`<div class="section"><a class="btn primary" href="https://training.screenings4u.com/" target="_blank" rel="noopener">Open Training Portal</a></div>`;
    else if(p==='consents')html=table('Consents & Acknowledgments',d.policies||[],COLS.policies);
    else if(p==='medical')html=`<div class="notice">Medical records are view-only here. Use Order Services to purchase a DOT physical from screenings4u, LLC.</div><div class="section">${table('Credentials',d.credentials||[],COLS.credentials)}</div>`;
    else html=dashboard(ctx,d);
    wireSelfActions(p,d,ctx);
  }
  else if(C.kind==='agency'){
    if(p==='company')html=profileView(d);
    else if(p==='agency-configuration'||['authorizations','contractors','random-plan','policy','anti-drug-plan','alcohol-misuse-plan','periodic-testing'].includes(p)){
      const r=(d.registrations||[])[0]||{};
      html=`<div class="panel"><div class="panel-head"><div><h2>${esc(C.agency)} Configuration</h2><p>${esc(d.agency?.primary_regulation||'Agency configuration')}</p></div></div><div style="padding:16px"><div class="metrics">${metric('Account',r.account_identifier||'—')}${metric('Category',pretty(r.employee_category||'—'))}${metric('Status',pretty(r.status||'Not configured'))}${metric('Effective',fmt(r.effective_date))}</div><div class="section notice">${esc(d.agency?.metadata?.covered_workforce||'Agency-specific employer configuration.')}</div></div></div>`;
    }
    else if(p==='mis-reports'||p==='reports')html=`<div class="metrics">${metric('Testing',(d.testing_orders||[]).length)}${metric('Programs',(d.programs||[]).length)}${metric('Random Events',(d.selections||[]).length)}${metric('Compliance',(d.compliance_cases||[]).length)}</div>`;
    else {const [rows,key]=pickManagementRows(p,d);html=key?table(cfgPage(p).label,rows,COLS[key]):`<div class="panel"><div class="empty">No records available.</div></div>`}
    wireManagementActions(p,d,ctx);
  }
  else {
    if(C.kind==='ctpa'&&p==='team')html=table('Team',d.members||[],COLS.members);
    else if(C.kind==='ctpa'&&p==='locations')html=table('Locations',d.locations||[],COLS.locations);
    else if(C.kind==='ctpa'&&p==='integrations')html=table('Integrations',d.integrations||[],COLS.integrations);
    else if(C.kind==='ctpa'&&p==='audit-history')html=table('Audit History',d.audit_events||[],COLS.audit);
    else if(C.kind==='ctpa'&&p==='branding')html=`<div class="panel"><div class="panel-head"><div><h2>Branding</h2><p>${d.can_manage?'Enterprise branding controls are enabled.':'Branding is view-only for this role.'}</p></div></div><div style="padding:16px"><div class="metrics">${metric('Portal Name',d.branding?.portal_name||'screenings4u Workforce')}${metric('Primary Color',d.branding?.primary_color||d.branding_defaults?.primary_color||'Default')}${metric('Accent Color',d.branding?.accent_color||d.branding_defaults?.accent_color||'Default')}</div></div></div>`;
    else if(C.kind==='ctpa'&&p==='billing')html=`<div class="metrics">${metric('Client Invoices',(d.invoices||[]).length)}${metric('Employers',(d.employers||[]).length)}${metric('Payments Ready',d.payments_ready?'Yes':'No')}${metric('Plan',d.subscription?.plans?.name||d.subscription?.plan_name||'—')}</div><div class="section">${table('Client Invoices',d.invoices||[],COLS.invoices)}</div>`;
    else if(p==='company')html=profileView(d);
    else if(p==='consents')html=table('Consent & Acknowledgment Forms',d.forms||[],[['Form',['title']],['Type',['form_type']],['Version',['version']],['Status',['status'],badgeCell]])+`<div class="section">${table('Assignments',d.assignments||[],[['Employee',['employees.first_name']],['Form',['employer_consent_forms.title']],['Status',['status'],badgeCell],['Sent',['sent_at'],dateCell],['Completed',['completed_at'],dateCell]])}</div>`;
    else if(p==='locations')html=table('Locations',d.locations||[],COLS.locations);
    else if(p==='audit-history')html=table('Audit History',d.audit_events||[],COLS.audit);
    else if(p==='branding')html=`<div class="panel"><div class="panel-head"><div><h2>Branding</h2><p>${d.can_edit?'Enterprise branding controls are available.':'Branding is inherited or not enabled for this plan.'}</p></div></div><div style="padding:16px">${metric('Portal Name',d.branding?.portal_name||'screenings4u Workforce')}${metric('Primary Color',d.branding?.primary_color||'Default')}${metric('Accent Color',d.branding?.accent_color||'Default')}</div></div>`;
    else if(p==='integrations')html=`<div class="panel"><div class="panel-head"><div><h2>Integrations</h2><p>Available according to the selected subscription.</p></div></div><div style="padding:16px">${Object.entries(d.entitlements||{}).filter(([,v])=>v===true).map(([k])=>`<span class="badge" style="margin:4px">${esc(pretty(k))}</span>`).join('')||'<div class="empty">No enabled integrations for this plan.</div>'}</div></div>`;
    else if(p==='reports')html=`<div class="metrics">${metric('Testing',(d.testing||d.testing_orders||[]).length)}${metric('Programs',(d.program_enrollment||d.programs||[]).length)}${metric('Pools',(d.pool_membership||d.pools||[]).length)}${metric('Compliance',(d.compliance||d.cases||[]).length)}</div>`;
    else if(p==='post-accident')html=`<div class="notice">Post-accident activity is managed through Testing and Compliance. DOT service purchases are available from Order Services.</div><div class="section">${table('Post-Accident Testing',(d.testing_orders||[]).filter(x=>norm(x.reason)==='post_accident'),COLS.testing)}</div>`;
    else {const [rows,key]=pickManagementRows(p,d);html=key?table(cfgPage(p).label,rows,COLS[key]):`<div class="panel"><div class="empty">No records available.</div></div>`}
    wireManagementActions(p,d,ctx);
  }
  $('#content').innerHTML=html||`<div class="panel"><div class="empty">No data available.</div></div>`;
}

async function init(){
  try{const s=await getSession();if(!s){location.replace('/login.html');return}const ctx=await access();if(ctx.requires_workspace_selection){location.replace('/workspace.html');return}if(!ctx.has_access)throw new Error(ctx.reason||'Portal access denied.');saveMid(ctx.membership?.id);saveSubscription(ctx.subscription?.id);window.portalCtx=ctx;shell(ctx);await render(ctx)}
  catch(e){if(e.status===401||e.message==='AUTH_REQUIRED'){await sb.auth.signOut();location.replace('/login.html');return}document.body.className='login-page';document.body.innerHTML=`<main class="login-card"><img class="login-logo" src="/assets/img/logo.png"><h1>Portal unavailable</h1><p>${esc(e.message||String(e))}</p><a class="btn primary" href="/login.html">Return to login</a></main>`}
}
window.Portal={invoke,sb};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
