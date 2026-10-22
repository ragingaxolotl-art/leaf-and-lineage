import './genetics.js';
const G=(globalThis as any).PatternGenetics;
const origins=new Set(['https://ragingaxolotl-art.github.io','http://127.0.0.1:8001','http://localhost:8001','null']);
const base=Deno.env.get('SUPABASE_URL')!;
function envKeys(name:string):string[]{try{return Object.values(JSON.parse(Deno.env.get(name)||'{}')).filter(x=>typeof x==='string') as string[];}catch{return [];}}
const publishable=[...envKeys('SUPABASE_PUBLISHABLE_KEYS'),Deno.env.get('SUPABASE_ANON_KEY')].filter(Boolean);
const secret=envKeys('SUPABASE_SECRET_KEYS')[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function randomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>alphabet[x%32]).join('');}
async function rpc(name:string,body:unknown){
 const headers:Record<string,string>={'Content-Type':'application/json',apikey:secret};if(secret.startsWith('eyJ'))headers.Authorization='Bearer '+secret;
 const response=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body)}),value=await response.json();
 if(!response.ok){const e:any=new Error(value.message||'The room service is unavailable.');e.code=value.code;throw e;}return value;
}
function cleanPacket(input:any,model:string='SUMO5'){
 const raw=input?.beetle;if(!raw)throw Error('Choose a beetle before sharing.');
 const packet=G.validatePacket({format:'PatternLabBeetle',version:2,beetle:{id:'B1',name:'',parents:[],sourceJarId:null,broodId:null,lineageGeneration:raw.lineageGeneration,developmentSeed:raw.developmentSeed,genome:raw.genome,mutations:Array.isArray(raw.mutations)?raw.mutations:[]}});
 const genome=packet.beetle.genome,body=genome[0].copies.map((cp:any[])=>cp[0]),colors=genome[8];
 const neutralColors=colors&&colors.copies.every((cp:any[],i:number)=>cp.every((a:any)=>JSON.stringify(a)===JSON.stringify(body[i])));
 if(neutralColors)genome.pop();
 const h=genome[7],neutralGrowth=h&&h.copies.every((cp:any[])=>cp.every((a:any,i:number)=>i<6?a===0:a.value===(i===6?'single':'spike')&&a.expression===.5));
 if(!['SUMO5','SUMO5X10'].includes(model)&&(!neutralGrowth||!neutralColors))throw Error('This beetle needs the latest battle rules. Refresh both screens.');
 if(neutralGrowth&&neutralColors){genome.pop();packet.version=2;}
 if(JSON.stringify(packet).length>24000)throw Error('This beetle file is too large.');return packet;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, content-type'};
 if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'This website is not allowed to use these rooms.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Use a room action.'},405);
 if(!publishable.includes(req.headers.get('apikey')||''))return reply({error:'This lab is not authorized.'},401);
 try{
  if(Number(req.headers.get('content-length')||0)>48000)return reply({error:'Request too large.'},413);
  const text=await req.text();if(text.length>48000)return reply({error:'Request too large.'},413);
  const data=JSON.parse(text),action=data.action,model=data.model||'SUMO2';if(!['SUMO2','SUMO3','SUMO4','SUMO5','SUMO5X10'].includes(model))throw Error('Invalid battle model.');
  if(!['create','join','read','start','close'].includes(action))return reply({error:'Unknown room action.'},400);
  const token=data.token;if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return reply({error:'This device needs a fresh room connection.'},400);
  const tokenHash=await digest(token),ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0];
  const bucket=await digest(secret+'|'+action+'|'+(['create','join'].includes(action)?ip:tokenHash)+'|'+Math.floor(Date.now()/60000));
  const allowed=await rpc('pattern_sumo_rate',{p_bucket:bucket,p_limit:action==='create'?60:action==='join'?120:90});
  if(!allowed)return reply({error:'A few too many requests. Wait a minute, then try again.'},429);
  const beetle=['create','join'].includes(action)?cleanPacket(data.beetle,model):null;
  let code=action==='create'?randomCode():String(data.code||'').toUpperCase().replace(/[-\s]/g,'');
  if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code))return reply({error:'Enter the full eight-character room code.'},400);
  const seed=action==='start'?crypto.getRandomValues(new Uint32Array(1))[0]:null;
  let room;
  for(let attempt=0;attempt<3;attempt++){try{room=await rpc('pattern_sumo_exchange_versioned',{p_action:action,p_code:code,p_token_hash:tokenHash,p_beetle:beetle,p_seed:seed,p_model:model});break;}catch(e){if(action==='create'&&(e as any).code==='23505'){code=randomCode();continue;}throw e;}}
  if(!room)throw Error('Please create a new room.');
  return reply({room,role:action==='create'?'host':action==='join'?'guest':undefined});
 }catch(e){const message=e instanceof Error?e.message:'Could not complete that room action.';const allowed=/different battle rules|code is unavailable|room already|Only the|Wait for|Invalid |room service|fresh room|Choose |too large|new room|more matches|beetle|gene|chromosome|copy|model|trait|identity/i.test(message);return reply({error:allowed?message:'Could not complete that room action. Check the code and try again.'},400);}
});
