document.addEventListener('DOMContentLoaded',()=>document.body.classList.remove('loading'));
(async()=>{
  const C=window.PORTAL_CONFIG;
  const sb=window.supabase.createClient(C.workforceUrl,C.workforceKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await sb.auth.getSession();
  if(!session){location.replace('/login.html');return}

  const qs=new URLSearchParams(location.search);
  const membershipId=qs.get('membership_id')||qs.get('id')||'';
  const subscriptionId=qs.get('subscription_id')||'';
  const body={requested_portal_code:C.portalCode};
  if(membershipId)body.membership_id=membershipId;
  if(subscriptionId)body.subscription_id=subscriptionId;

  const r=await fetch(`${C.workforceUrl}/functions/v1/workforce-session-context`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':C.workforceKey},
    body:JSON.stringify(body)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok){document.getElementById('msg').textContent=d.error||d.reason||'Unable to load workspace.';return}

  if(d.requires_workspace_selection){
    const rows=d.workspaces||[];
    document.getElementById('msg').textContent='Choose the subscription plan you want to use.';
    document.getElementById('choices').innerHTML=rows.map(w=>{
      const href=`/workspace.html?membership_id=${encodeURIComponent(w.membership_id||'')}&subscription_id=${encodeURIComponent(w.subscription_id||'')}`;
      return `<a class="card workspace-choice" style="display:block;margin:8px 0" href="${href}"><strong>${w.plan_name||w.plan_code||'Workforce Plan'}</strong></a>`;
    }).join('');
    return;
  }

  if(d.membership?.id)localStorage.setItem(`s4u_${C.portalCode}_membership`,d.membership.id);
  if(d.subscription?.id)localStorage.setItem(`s4u_${C.portalCode}_subscription`,d.subscription.id);
  location.replace('/dashboard.html');
})();
