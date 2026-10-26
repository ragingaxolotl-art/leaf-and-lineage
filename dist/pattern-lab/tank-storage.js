/* Large browser-local saves. No tank data is uploaded. */
(function(root){
'use strict';
function failure(message,code='SAVE_FAILED'){const e=new Error(message);e.code=code;return e;}
function openDatabase(factory=root.indexedDB){return new Promise((resolve,reject)=>{if(!factory)return reject(failure('This browser cannot open device saves. Use Save tank file.'));const req=factory.open('leaf-lineage-pattern-tanks',1);req.onupgradeneeded=()=>{for(const name of ['tanks','backups','tokens'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(failure('Close older lab tabs so device storage can open.'));req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};});}
function driver(db){
 const read=(store,key)=>new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const put=(store,key,value)=>new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||failure('Device save failed.'));});
 return {read,put,remove:(store,key)=>new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);}),
 commit(key,payload,expected,writer,snapshot){return new Promise((resolve,reject)=>{const tx=db.transaction(['tanks','backups'],'readwrite'),t=tx.objectStore('tanks'),b=tx.objectStore('backups');let result,error;function keepSnapshot(row){if(!snapshot)return;const prefix=key+':'+snapshot.kind+':';b.put({payload:snapshot.payload,revision:row.revision,updatedAt:Date.now(),reason:snapshot.reason,category:snapshot.kind},prefix+snapshot.id+':'+row.revision);const found=[],cursor=b.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(String(c.key).startsWith(prefix))found.push({key:c.key,at:c.value.updatedAt});c.continue();}else for(const item of found.sort((a,b)=>b.at-a.at).slice(10))b.delete(item.key);};}const r=t.get(key);r.onsuccess=()=>{const old=r.result,revision=old?.revision||0;if(revision!==expected){b.put({payload,updatedAt:Date.now(),reason:'Unsaved copy from another tab'},key+':conflict:'+writer);error=failure('Another tab saved a newer tank. This tab was preserved in Saved copies instead of overwriting it.','SAVE_CONFLICT');return;}if(old?.payload===payload){result=old;keepSnapshot(result);return;}const prev=b.get(key+':previous');prev.onsuccess=()=>{if(prev.result)b.put(prev.result,key+':older');if(old)b.put({...old,reason:'Previous successful save'},key+':previous');result={payload,revision:revision+1,updatedAt:Date.now()};t.put(result,key);keepSnapshot(result);};};tx.oncomplete=()=>error?reject(error):resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||failure('Device storage is full or unavailable. Download a tank file before leaving.'));});},
 list(key){return new Promise((resolve,reject)=>{const tx=db.transaction('backups','readonly'),items=[],r=tx.objectStore('backups').openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(String(c.key).startsWith(key+':'))items.push(c.value);c.continue();}};tx.oncomplete=()=>resolve(items);tx.onabort=()=>reject(tx.error);});}
 };
}
function session(backend,key,{legacy=root.localStorage,validate=x=>x,writer=Math.random().toString(36).slice(2)}={}){
 let revision=0,chain=Promise.resolve();
 const enqueue=fn=>{const task=chain.catch(()=>{}).then(fn);chain=task;return task;};
 const api={
 async load(){const row=await backend.read('tanks',key);if(row){revision=row.revision;return validate(JSON.parse(row.payload));}const old=legacy?.getItem(key);if(!old)return null;const value=validate(JSON.parse(old));try{const saved=await backend.commit(key,JSON.stringify(value),0,writer);revision=saved.revision;return value;}catch(e){if(e.code!=='SAVE_CONFLICT')throw e;const latest=await backend.read('tanks',key);revision=latest.revision;return validate(JSON.parse(latest.payload));}},
 save(state,{snapshot}={}){const payload=JSON.stringify(state);return enqueue(async()=>{const row=await backend.commit(key,payload,revision,writer,snapshot);revision=row.revision;return row;});},
 async copies(){const current=await backend.read('tanks',key),rows=await backend.list(key);try{const old=legacy?.getItem(key);if(old){validate(JSON.parse(old));rows.push({payload:old,updatedAt:0,legacy:true,reason:'Original save before storage upgrade'});}}catch{}return [current&&{...current,reason:'Latest successful save'},...rows].filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt);},
 async restore(state){const payload=JSON.stringify(state);return enqueue(async()=>{const row=await backend.read('tanks',key);revision=row?.revision||0;const saved=await backend.commit(key,payload,revision,writer);revision=saved.revision;return saved;});},
 async getToken(name){const v=await backend.read('tokens',name);if(v)return v;const old=legacy?.getItem(name);if(old)await backend.put('tokens',name,old);return old;},
 setToken:(name,value)=>backend.put('tokens',name,value),
 async removeToken(name){await backend.remove('tokens',name);try{legacy?.removeItem(name);}catch{}},
 rescue:state=>backend.put('backups',key+':manual:'+writer,{payload:JSON.stringify(state),updatedAt:Date.now(),reason:'Tank open before recovery'})
 };return api;
}
const api={session,driver,openDatabase,async open(key,options){return session(driver(await openDatabase()),key,options);}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternTankStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this);
