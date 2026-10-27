/* Classroom copy sharing with legacy swap recovery. Server receipts + local checkpoints make retries safe. */
(async function(){
'use strict';
await globalThis.PatternLabReady;
const A=PatternLabApp,G=PatternGenetics,B=PatternBeetles,$=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false,room=null;
const capabilityScope=G.checksum(location.hash||'teacher');
const key=p=>'pattern-trade-capability-'+capabilityScope+'-'+p.code+'-'+p.role;
const randomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
function token(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function render(){
 const s=A.getState(),p=s.pendingTrade,select=$('trade-beetle'),old=select.value;
 const eligible=Object.values(s.beetles).filter(b=>!G.container(s,b.id)?.startsWith('jar-')&&!PatternFieldLife.away(s,b.id));
 select.innerHTML=eligible.map(b=>`<option value="${b.id}">${esc(b.name||b.id)} · Gen ${b.lineageGeneration}${s.collection.includes(b.id)?' · kept':''}</option>`).join('');
 select.value=p?.outgoing||(s.beetles[old]?old:eligible[0]?.id||'');select.disabled=!!p||busy;
 for(const id of ['trade-create','trade-join'])$(id).disabled=!!p||busy||!eligible.length||A.isBlocked();
 $('trade-active').hidden=!p;$('trade-join-code').disabled=!!p||busy;
 if(!p)return;
 $('trade-accept').textContent=p.mode==='copy'?'Share copies with both students':'Confirm legacy swap';
 $('trade-code').value=p.code.slice(0,4)+'-'+p.code.slice(4);
 $('trade-accept').hidden=p.role!=='host'||room?.code!==p.code||room.status!=='offered';
 $('trade-accept').disabled=busy;$('trade-cancel').disabled=busy;$('trade-check').disabled=busy;
 if(room?.code===p.code){const incoming=p.role==='host'?room.guest:room.host,own=s.beetles[p.outgoing];
  $('trade-preview').innerHTML=`<figure>${B.draw(own,'trade-own')}<figcaption>${p.mode==='copy'?'You keep':'You offer'} ${esc(own.name||own.id)}</figcaption></figure>`+(incoming?`<figure>${B.draw(G.validatePacket(incoming).beetle,'trade-incoming')}<figcaption>You receive ${p.mode==='copy'?'a copy of ':''}this beetle</figcaption></figure>`:'<p>Waiting for your classmate’s offer…</p>');
 }else $('trade-preview').innerHTML='';
}
async function request(action,p){
 if(!A.storage())throw Error('Device saving is unavailable. Use Save tank file before trading.');
 const cfg=globalThis.PatternSharingConfig,cap=await A.storage().getToken(key(p));
 if(!cfg?.url)throw Error('Online trading is not configured.');
 if(!cap)throw Error('Return to the original device and browser to collect or cancel this trade.');
 const beetle=['create','join'].includes(action)?G.packet(A.getState().beetles[p.outgoing],{anonymous:true}):undefined;
 const response=await fetch(cfg.url.replace(/pattern-sumo$/,'pattern-trade'),{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey},body:JSON.stringify({action,code:p.code,token:cap,beetle,mode:p.mode||'swap'}),signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'The trade service could not respond.');return data.room;
}
async function apply(value){
 room=value;const p=A.getState().pendingTrade;if(!p||p.code!==room.code)return;if((room.mode||'swap')!==(p.mode||'swap'))throw Error('These screens use different trade rules. Refresh both screens and create a new sharing code.');
 if(room.status==='complete'){
  const b=await A.tradeComplete(p.role==='host'?room.guest:room.host);await A.storage().removeToken(key(p));
  $('trade-status').textContent='Trade complete! Your new beetle '+(b?.id||'')+' is '+(b&&A.getState().collection.includes(b.id)?'in your Keep tank.':'in the tank or nursery.')+' '+(p.mode==='copy'?'You kept your original beetle. Both students now have both offered beetles.':'Your offered beetle moved to your classmate.');
  A.toast(p.mode==='copy'?'Copies shared. Your original beetle stays with you.':'Trade complete. Exact genes and appearance received.');
 }else if(['cancelled','expired'].includes(room.status)){
  await A.tradeCancel();await A.storage().removeToken(key(p));$('trade-status').textContent='Trade '+room.status+'. Your original beetle stays with you.';
 }else $('trade-status').textContent=room.status==='open'?'Code ready. Share this trade code with one classmate. Your offered beetle stays protected until sharing finishes.':p.role==='host'?'Your classmate’s offer is here. Preview both beetles, then confirm sharing or cancel.':'Your offer is sent. Wait for the code creator to confirm, or cancel before they confirm.';
 render();
}
async function read(p){try{return await request('read',p);}catch(e){if(/unavailable/.test(e.message)){return request(p.role==='host'?'create':'join',p);}throw e;}}
async function check(){if(busy||document.hidden||!A.getState().pendingTrade)return;busy=true;render();try{await apply(await read(A.getState().pendingTrade));}catch(e){$('trade-status').textContent=e.message+' Your beetle stays protected. Use Check trade to retry.';}finally{busy=false;render();}}
async function begin(role){if(busy||A.isBlocked())return;const s=A.getState(),b=s.beetles[$('trade-beetle').value];if(!b)return;
 const code=role==='host'?randomCode():$('trade-join-code').value.toUpperCase().replace(/[-\s]/g,'');
 if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)){A.toast('Enter the full eight-character trade code.');return;}
 const info={code,role,outgoing:b.id,fingerprint:G.fingerprint(b),mode:'copy'};busy=true;let started=false,createdToken=false;
 try{
  if(await A.storage().getToken(key(info)))throw Error('This trade is already saved here. Return to its original tank.');await A.storage().setToken(key(info),token());createdToken=true;
  await A.tradeBegin(info);started=true;render();
  $('trade-status').textContent='Protecting your offered beetle and connecting…';await apply(await request(role==='host'?'create':'join',A.getState().pendingTrade));
 }catch(e){
  if(!started&&createdToken)await A.storage().removeToken(key(info));
  $('trade-status').textContent=e.message+(started?' Your beetle is protected. Check trade to retry, or Cancel trade to keep it.':'');
  // A definitive join rejection cannot have committed this guest offer.
  if(started&&/different sharing rules|code is taken/i.test(e.message)){await A.tradeCancel();await A.storage().removeToken(key(info));room=null;}
  else if(started&&role==='guest'&&/already has a partner|expired|unavailable|no longer open|Use another screen/.test(e.message)){await A.tradeCancel();await A.storage().removeToken(key(info));}
 }finally{busy=false;render();}
}
$('trade-create').onclick=()=>begin('host');$('trade-join').onclick=()=>begin('guest');$('trade-check').onclick=check;
$('trade-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('trade-code').value);A.toast('Trade code copied.');}catch{$('trade-code').select();A.toast('Select and copy this trade code.');}};
$('trade-accept').onclick=async()=>{if(busy)return;const p=A.getState().pendingTrade;if(!p)return;busy=true;render();try{await apply(await request('accept',p));}catch(e){$('trade-status').textContent=e.message+' Check trade to recover the result.';}finally{busy=false;render();}};
$('trade-cancel').onclick=async()=>{
 if(busy)return;const p=A.getState().pendingTrade;if(!p)return;busy=true;render();
 try{
  // Establish/recover the offer before cancellation, avoiding a lost-create response race.
  const current=await read(p);
  if(['complete','cancelled','expired'].includes(current.status))await apply(current);else await apply(await request('cancel',p));
 }catch(e){$('trade-status').textContent=e.message+' Keep this tank and retry; the offered beetle is still protected.';}
 finally{busy=false;render();}
};
window.addEventListener('pattern-state',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
render();setInterval(check,2500);if(A.getState().pendingTrade)check();
})();
