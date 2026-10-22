(function(root){
'use strict';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const num=(key,label,min=0,max=1)=>({key,label,type:'number',min,max});
const cat=(key,label,values)=>({key,label,type:'category',values});
const color=(key,label)=>({key,label,type:'color'});
const chromosomes=[
 {id:'A',loci:[color('body','Body color'),cat('plain','Pattern suppressor',['S','s']),num('density','Mark density'),num('radius','Mark size'),num('softness','Soft edges'),num('symmetry','Pattern symmetry'),num('jitter','Mark irregularity'),num('bodyWidth','Body width',.72,1.3)]},
 {id:'B',loci:[color('primary','First pattern color'),cat('layers','Second-color gate',['T','t']),cat('shape','Mark shape',['spot','mottle','stripe','speckle']),num('frontBias','Front / back placement',-1,1),num('edgeBias','Center / edge placement',-1,1),num('cluster','Clustering'),num('patternStretch','Mark stretch',.5,1.8)]},
 {id:'C',loci:[color('secondary','Second pattern color'),num('secondaryDensity','Second-layer density'),num('secondarySize','Second-layer size'),num('secondaryBias','Second-layer placement',-1,1),num('appendageShade','Appendage brightness',.35,1),num('banding','Appendage bands')]},
 {id:'D',loci:[cat('antenna','Antenna framework',['thread','bead','bristle','club','knob','saw','comb','doublecomb','fan','plates','elbow','plume','aristate']),num('antennaLength','Antenna length',.05,3),num('shaftWidth','Antenna width',.7,3.5),num('segments','Antenna segments',4,16),num('beadRoundness','Bead roundness'),num('curve','Antenna curve',-.5,.7),num('elbow','Elbow angle',0,85),num('tip','Tip enlargement'),num('branches','Branch count',2,14),num('branchLength','Branch length'),num('plateWidth','Fan / plate width'),cat('hairGate','Hair suppressor',['H','h']),num('hairDensity','Fine hair density'),num('hairLength','Fine hair length'),num('spread','Antenna spread',.15,1)]},
 {id:'E',loci:[cat('leg','Leg framework',['runner','sturdy','shovel','jumper','paddle','hooked','spiny','longfoot']),num('legLength','Leg length',.55,1.5),num('femur','Thigh thickness',.7,2.4),num('tibia','Shin width',.7,2),num('foot','Foot length',.5,1.8),num('joint','Joint angle',-.4,.4),num('legSpread','Leg spread',.7,1.4),num('claw','Claw curve'),num('spines','Spine density'),num('legHair','Leg hair density'),num('hind','Hind-leg emphasis'),num('motor','Motor speed'),num('stride','Stride drive'),num('strength','Strength')]}
];
// All behavior and sumo measurements are continuous game traits, not species claims.
chromosomes.push({id:'F',loci:[num('tracking','Opponent tracking'),num('reaction','Reaction speed'),num('focus','Attention focus'),num('pushDrive','Pushing instinct'),num('wander','Wandering instinct'),num('turnRate','Turning agility'),num('tactics','Ring tactics (game intelligence)'),num('edgeSense','Edge awareness'),num('brace','Bracing instinct'),num('lateralBalance','Sideways balance'),num('grip','Foot grip'),num('endurance','Endurance'),num('recovery','Recovery'),num('mass','Body mass'),num('acceleration','Acceleration'),num('centerDrive','Center preference'),num('curiosity','Curiosity'),num('sociality','Social approach'),num('caution','Caution'),num('persistence','Persistence')]});
chromosomes.push({id:'G',loci:[num('bodyLength','Body length',.78,1.3),num('headWidth','Head width',.65,1.4),num('horn','Horn length'),num('jaw','Jaw size'),num('gloss','Shell gloss'),num('metallic','Metallic sheen'),num('ridges','Shell ridge count',0,10),num('ridgeHeight','Shell ridge relief'),num('pronotum','Neck shield width',.75,1.3),num('gait','Gait rhythm')]});
const loci=chromosomes.flatMap(c=>c.loci), byKey=Object.fromEntries(loci.map(l=>[l.key,l]));
const antennaNames={thread:'Threadlike',bead:'Beaded',bristle:'Tapering bristle',club:'Gradual club',knob:'Knob-tipped',saw:'Sawtoothed',comb:'Single comb',doublecomb:'Double comb',fan:'Broad fan',plates:'Leaf-plate fan',elbow:'Elbowed',plume:'Hairy plume',aristate:'Side bristle'};
const legNames={runner:'Slender runner',sturdy:'Sturdy walker',shovel:'Shovel forelegs',jumper:'Enlarged hind thighs',paddle:'Hairy paddles',hooked:'Hooked graspers',spiny:'Spiny legs',longfoot:'Long-toed legs'};
const clone=x=>JSON.parse(JSON.stringify(x));
function seeded(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const pick=(a,r)=>a[Math.min(a.length-1,Math.floor(r()*a.length))];
const palette=[[89,139,88],[198,87,75],[83,126,185],[211,178,71],[146,87,168],[51,160,155],[225,149,78],[227,204,175],[65,62,83]];
function randomAllele(l,r){
 if(l.type==='number')return l.min+(l.max-l.min)*r();
 if(l.type==='category')return {value:pick(l.values,r),expression:r()};
 return {rgb:pick(palette,r).map(v=>Math.round(clamp(v+(r()-.5)*32,0,255))),expression:r()};
}
function setCopies(b,key,a,c=a){const ci=chromosomes.findIndex(x=>x.loci.some(l=>l.key===key)),li=chromosomes[ci].loci.findIndex(l=>l.key===key);b.genome[ci].copies[0][li]=clone(a);b.genome[ci].copies[1][li]=clone(c);}
function founder(id,r=Math.random,index=0){
 const b={id,name:'',parents:[],sourceJarId:null,broodId:null,lineageGeneration:0,genome:chromosomes.map(c=>({id:c.id,copies:[c.loci.map(l=>randomAllele(l,r)),c.loci.map(l=>randomAllele(l,r))]})),developmentSeed:Math.floor(r()*4294967296),mutations:[]};
 // Coherent founders expose readable forms while retaining latent alternatives.
 const form=chromosomes[3].loci[0].values[index%13],leg=chromosomes[4].loci[0].values[index%8];
 setCopies(b,'antenna',{value:form,expression:.8},{value:pick(chromosomes[3].loci[0].values,r),expression:.25});
 setCopies(b,'leg',{value:leg,expression:.8},{value:pick(chromosomes[4].loci[0].values,r),expression:.25});
 setCopies(b,'antennaLength',index===0?.1:.35+r()*1.1,.3+r()*1.3);
 setCopies(b,'plain',{value:index%5===0?'S':'s',expression:.5},{value:'s',expression:.5});
 setCopies(b,'layers',{value:index%3===0?'T':'t',expression:.5},{value:'t',expression:.5});
 setCopies(b,'hairGate',{value:form==='plume'?'h':pick(['H','h'],r),expression:.5},{value:'h',expression:.5});
 if(index<2){setCopies(b,'plain',{value:'S',expression:.5},{value:'s',expression:.5});setCopies(b,'layers',{value:'T',expression:.5},{value:'t',expression:.5});setCopies(b,'body',{rgb:[91,146,101],expression:.8},{rgb:[215,169,64],expression:.3});}
 return b;
}
function copies(b,key){const ci=chromosomes.findIndex(c=>c.loci.some(l=>l.key===key)),li=chromosomes[ci].loci.findIndex(l=>l.key===key);return b.genome[ci].copies.map(c=>c[li]);}
function expressed(b,key){const l=byKey[key],[a,c]=copies(b,key);if(l.type==='number')return (a+c)/2;if(l.type==='category')return a.expression>=c.expression?a.value:c.value;return a.expression===c.expression?a.rgb.map((v,i)=>Math.round((v+c.rgb[i])/2)):(a.expression>c.expression?a.rgb.slice():c.rgb.slice());}
function phenotype(b){
 const p=Object.fromEntries(loci.map(l=>[l.key,expressed(b,l.key)]));
 p.visibleLayers=copies(b,'plain').some(a=>a.value==='S')?0:copies(b,'layers').some(a=>a.value==='T')?1:2;
 p.hairs=copies(b,'hairGate').some(a=>a.value==='H')?0:p.hairDensity;
 p.speed=Number((.25+1.7*(.6*p.motor+.4*p.stride)*(.85+.15*(p.legLength-.55)/.95)).toFixed(2));
 p.strengthIndex=Math.round(1+99*p.strength);
 return p;
}
function mutate(a,l,rate,r){
 if(r()>=rate)return {allele:clone(a),changed:false};
 if(l.type==='number'){const span=l.max-l.min,delta=(r()<.5?-1:1)*span*(.04+r()*.12);return {allele:clamp(a+delta,l.min,l.max),changed:true};}
 if(l.type==='color'){const v=clone(a),channel=Math.floor(r()*3);v.rgb[channel]=clamp(v.rgb[channel]+(r()<.5?-1:1)*(8+Math.floor(r()*40)),0,255);v.expression=clamp(v.expression+(r()-.5)*.3);return {allele:v,changed:true};}
 const alternatives=l.values.filter(v=>v!==a.value);return {allele:{value:pick(alternatives,r),expression:clamp(a.expression+(r()-.5)*.3)},changed:true};
}
function gamete(b,rate,r){
 const mutations=[];
 const chromosomesOut=chromosomes.map((c,ci)=>{let side=r()<.5?0:1;const cross=r()<.35?1+Math.floor(r()*(c.loci.length-1)):-1;return c.loci.map((l,i)=>{if(i===cross)side=1-side;const m=mutate(b.genome[ci].copies[side][i],l,rate,r);if(m.changed)mutations.push(l.key);return m.allele;});});
 return {chromosomes:chromosomesOut,mutations};
}
function baby(a,b,id,{rate=.005,rng=Math.random,jarId=null,broodId=null}={}){
 if(a.id===b.id)throw Error('Choose two different parents.');
 const x=gamete(a,rate,rng),y=gamete(b,rate,rng);
 return {id,name:'',parents:[a.id,b.id],sourceJarId:jarId,broodId,lineageGeneration:1+Math.max(a.lineageGeneration,b.lineageGeneration),genome:chromosomes.map((c,i)=>({id:c.id,copies:[x.chromosomes[i],y.chromosomes[i]]})),developmentSeed:Math.floor(rng()*4294967296),mutations:[...x.mutations,...y.mutations]};
}
function pairs(ids){const a=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)a.push([ids[i],ids[j]]);return a;}
function breedRound(state,opts={}){
 const r=opts.rng||Math.random,active=state.jars.filter(j=>j.active&&j.members.length>=2);
 if(!active.length)throw Error('Add at least two beetles to an active jar.');
 if(active.length>2)throw Error('Use at most two jars.');
 for(const jar of active){if(jar.members.length>4||new Set(jar.members).size!==jar.members.length||jar.members.some(id=>!state.beetles[id]))throw Error('This jar has invalid parents.');}
 if(new Set(active.flatMap(j=>j.members)).size!==active.reduce((n,j)=>n+j.members.length,0))throw Error('A beetle can be in only one jar.');
 const total=10+Math.min(10,Math.floor(r()*11)),broodId='brood-'+(state.round+1),extra=Math.floor(r()*active.length);
 const allocations=active.map((jar,i)=>({jar,count:Math.floor(total/active.length)+(total%active.length&&i===extra?1:0)}));
 const newborns=[];
 for(const {jar,count} of allocations){const choices=pairs(jar.members);for(let n=0;n<count;n++){let [a,b]=pick(choices,r);if(r()<.5)[a,b]=[b,a];const id='B'+state.nextId++;const child=baby(state.beetles[a],state.beetles[b],id,{rate:state.settings.mutation,rng:r,jarId:jar.id,broodId});state.beetles[id]=child;newborns.push(id);}}
 for(let i=newborns.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[newborns[i],newborns[j]]=[newborns[j],newborns[i]];}
 for(const id of newborns)(state.tank.length<48?state.tank:state.nursery).push(id);
 state.round++;state.history.push({broodId,total,allocations:allocations.map(a=>({jarId:a.jar.id,count:a.count,parents:a.jar.members.slice()})),offspring:newborns.slice()});
 return state.history[state.history.length-1];
}
function createState(seed=42){const r=seeded(seed),s={version:'PL2',round:0,nextId:17,seed,settings:{mutation:.005,showStats:false,backdrop:'moss',allowBackdrop:true},beetles:{},tank:[],nursery:[],collection:[],keepLayout:{},jars:[{id:'jar-1',active:true,members:[]},{id:'jar-2',active:false,members:[]}],history:[],notes:''};for(let i=0;i<16;i++){const id='B'+(i+1);s.beetles[id]=founder(id,r,i);s.tank.push(id);}return s;}
function container(s,id){if(s.tank.includes(id))return 'tank';if(s.nursery.includes(id))return 'nursery';if(s.collection.includes(id))return 'collection';return s.jars.find(j=>j.members.includes(id))?.id||null;}
function move(s,id,target){
 if(!s.beetles[id])throw Error('This beetle is missing.');
 const current=container(s,id);if(current===target)return;
 const jar=s.jars.find(j=>j.id===target);
 if(jar&&jar.members.length>=4)throw Error('That jar is full. Remove a parent first.');
 if(target==='collection'&&s.collection.length>=10)throw Error('The Keep tank holds 10 favorites. Move one out before adding another.');
 if(target==='tank'&&s.tank.length>=48)throw Error('The tank is full. Use the nursery or collection.');
 if(!jar&&!['tank','nursery','collection'].includes(target))throw Error('Unknown container.');
 for(const list of [s.tank,s.nursery,s.collection,...s.jars.map(j=>j.members)]){const i=list.indexOf(id);if(i>=0)list.splice(i,1);}
 (jar?jar.members:s[target]).push(id);
}
function upgradeState(s){
 if(!s||!['PL1','PL2'].includes(s.version)||!s.beetles)return s;
 for(const b of Object.values(s.beetles)){
  if(Array.isArray(b.genome)&&b.genome.length===5&&b.genome.every((g,i)=>g.id===chromosomes[i].id)){
   const r=seeded(parseInt(checksum(JSON.stringify(b.genome)+b.developmentSeed),36));
   for(const c of chromosomes.slice(5))b.genome.push({id:c.id,copies:[c.loci.map(l=>randomAllele(l,r)),c.loci.map(l=>randomAllele(l,r))]});
   for(const [key,value] of Object.entries({bodyLength:1,headWidth:1,horn:0,jaw:0,gloss:0,metallic:0,ridges:0,ridgeHeight:0,pronotum:1,gait:.5}))setCopies(b,key,value);
   b.upgradeNote='Behavior and sumo traits initialized deterministically during the v1-to-v2 upgrade; the original five chromosome pairs were preserved.';
  }
 }
 s.version='PL2';s.keepLayout=s.keepLayout||{};s.matchHistory=s.matchHistory||[];
 return s;
}
function validate(s){
 s=upgradeState(s);
 if(!s||s.version!=='PL2'||!s.settings||typeof s.beetles!=='object'||!Array.isArray(s.jars)||s.jars.length!==2)throw Error('This is not a Pattern Lab save.');
 if(!Number.isInteger(s.nextId)||s.nextId<1||!Number.isInteger(s.round)||s.round<0||!Array.isArray(s.history)||s.history.length!==s.round||!Number.isInteger(s.seed)||s.seed<1||s.seed>2147483647||typeof s.notes!=='string'||s.notes.length>10000)throw Error('Invalid brood record.');
 if(!Number.isFinite(s.settings.mutation)||s.settings.mutation<0||s.settings.mutation>.1||!['moss','sand','bark','night'].includes(s.settings.backdrop)||typeof s.settings.showStats!=='boolean'||typeof s.settings.allowBackdrop!=='boolean')throw Error('Invalid settings.');
 const ids=Object.keys(s.beetles);if(ids.length>3000)throw Error('This save is too large (3,000 beetles maximum).');
 for(const [i,j] of s.jars.entries())if(j.id!=='jar-'+(i+1)||typeof j.active!=='boolean'||!Array.isArray(j.members)||j.members.length>4)throw Error('Invalid jar.');
 if(![s.tank,s.nursery,s.collection].every(Array.isArray)||s.tank.length>48||s.collection.length>10)throw Error('Invalid tank capacity.');
 if(s.keepLayout!==undefined){if(!s.keepLayout||typeof s.keepLayout!=='object'||Array.isArray(s.keepLayout)||Object.keys(s.keepLayout).length>3000)throw Error('Invalid Keep tank layout.');for(const [id,v] of Object.entries(s.keepLayout))if(!s.beetles[id]||!v||!Number.isFinite(v.x)||v.x<0||v.x>1||!Number.isFinite(v.y)||v.y<0||v.y>1||!Number.isFinite(v.angle))throw Error('Invalid Keep tank position.');}
 const all=[...s.tank,...s.nursery,...s.collection,...s.jars.flatMap(j=>j.members)];
 if(all.length!==ids.length||new Set(all).size!==ids.length||all.some(id=>!s.beetles[id]))throw Error('A beetle has a missing or duplicate container.');
 for(const id of ids){const b=s.beetles[id];if(b.id!==id||!/^B[1-9]\d*$/.test(id)||Number(id.slice(1))>=s.nextId||typeof b.name!=='string'||b.name.length>40||!Number.isInteger(b.lineageGeneration)||b.lineageGeneration<0||!Number.isInteger(b.developmentSeed)||b.developmentSeed<0||b.developmentSeed>4294967295||!Array.isArray(b.parents)||![0,2].includes(b.parents.length)||new Set(b.parents).size!==b.parents.length||!Array.isArray(b.mutations)||b.mutations.some(k=>!byKey[k])||!Array.isArray(b.genome)||b.genome.length!==chromosomes.length)throw Error('Invalid beetle record.');
  if(b.parents.some(p=>!s.beetles[p]||p===id||s.beetles[p].lineageGeneration>=b.lineageGeneration)||b.parents.length===2&&(b.lineageGeneration!==1+Math.max(...b.parents.map(p=>s.beetles[p].lineageGeneration))||!['jar-1','jar-2'].includes(b.sourceJarId)||!/^brood-[1-9]\d*$/.test(b.broodId)))throw Error('Invalid family record.');
  for(let ci=0;ci<chromosomes.length;ci++){const c=chromosomes[ci],g=b.genome[ci];if(g.id!==c.id||!Array.isArray(g.copies)||g.copies.length!==2)throw Error('Invalid chromosome.');for(const cp of g.copies){if(!Array.isArray(cp)||cp.length!==c.loci.length)throw Error('Invalid gene copies.');c.loci.forEach((l,i)=>{const a=cp[i];if(l.type==='number'){if(!Number.isFinite(a)||a<l.min||a>l.max)throw Error('Invalid numeric gene.');}else{if(!a||!Number.isFinite(a.expression)||a.expression<0||a.expression>1)throw Error('Invalid expression gene.');if(l.type==='category'&&!l.values.includes(a.value))throw Error('Invalid shape gene.');if(l.type==='color'&&(!Array.isArray(a.rgb)||a.rgb.length!==3||a.rgb.some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('Invalid color gene.');}});}}
 }
 for(const [i,h] of s.history.entries()){
  if(h.broodId!=='brood-'+(i+1)||!Number.isInteger(h.total)||h.total<10||h.total>20||!Array.isArray(h.allocations)||h.allocations.length<1||h.allocations.length>2||new Set(h.allocations.map(a=>a.jarId)).size!==h.allocations.length||!Array.isArray(h.offspring)||h.offspring.length!==h.total||new Set(h.offspring).size!==h.total||h.offspring.some(id=>!s.beetles[id]||s.beetles[id].broodId!==h.broodId))throw Error('Invalid saved brood.');
  if(h.allocations.reduce((n,a)=>n+a.count,0)!==h.total)throw Error('Invalid brood allocation.');
  for(const a of h.allocations)if(!['jar-1','jar-2'].includes(a.jarId)||!Number.isInteger(a.count)||a.count<1||!Array.isArray(a.parents)||a.parents.length<2||a.parents.length>4||new Set(a.parents).size!==a.parents.length||a.parents.some(id=>!s.beetles[id])||h.offspring.filter(id=>s.beetles[id].sourceJarId===a.jarId).length!==a.count||h.offspring.some(id=>s.beetles[id].sourceJarId===a.jarId&&s.beetles[id].parents.some(p=>!a.parents.includes(p))))throw Error('Invalid saved parent group.');
 }
 return s;
}
function forecast(s,jar,n=240){if(jar.members.length<2)return null;const r=seeded(713),choices=pairs(jar.members),out={layers:[0,0,0],antennae:{},legs:{},speed:0,strength:0};for(let i=0;i<n;i++){let [a,b]=pick(choices,r);if(r()<.5)[a,b]=[b,a];const p=phenotype(baby(s.beetles[a],s.beetles[b],'preview',{rate:s.settings.mutation,rng:r}));out.layers[p.visibleLayers]++;out.antennae[p.antenna]=(out.antennae[p.antenna]||0)+1;out.legs[p.leg]=(out.legs[p.leg]||0)+1;out.speed+=p.speed;out.strength+=p.strengthIndex;}out.n=n;return out;}
function checksum(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);}
function validConfig(c){
 if(!c||c.v!==1)throw Error('This class link uses an unsupported version.');
 if(!Number.isInteger(c.seed)||c.seed<1||c.seed>2147483647)throw Error('Population seed must be a whole number from 1 to 2147483647.');
 if(!Number.isFinite(c.mutation)||c.mutation<0||c.mutation>.1)throw Error('Mutation must be from 0 to 10 percent per gene copy.');
 if(!['moss','sand','bark','night'].includes(c.backdrop)||typeof c.stats!=='boolean'||typeof c.environment!=='boolean'||![.5,1,2,5,10].includes(c.speed))throw Error('This class link contains unsupported settings.');
 return c;
}
function encodeConfig(c){const data=btoa(JSON.stringify(validConfig(c))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return 'PL1.'+data+'.'+checksum(data);}
function decodeConfig(code){try{const a=code.split('.');if(a.length!==3||a[0]!=='PL1'||checksum(a[1])!==a[2])throw Error('This class link is incomplete or damaged. Ask for the full link.');return validConfig(JSON.parse(atob(a[1].replace(/-/g,'+').replace(/_/g,'/'))));}catch(e){throw Error(e.message||'This class link could not be read.');}}
function validatePacket(input){
 if(!input||input.format!=='PatternLabBeetle'||![1,2].includes(input.version)||!input.beetle)throw Error('Choose a Pattern Lab beetle JSON file.');
 const source=clone(input.beetle);
 if(typeof source.id!=='string'||source.id.length>80||typeof source.name!=='string'||source.name.length>40||!Array.isArray(source.parents)||source.parents.length>2||source.parents.some(x=>typeof x!=='string'||x.length>80))throw Error('Invalid beetle identity.');
 const specimen={...source,id:'B1',parents:[],sourceJarId:null,broodId:null};
 const state=createState(1);state.beetles={B1:specimen};state.nextId=2;state.tank=['B1'];state.jars.forEach(j=>j.members=[]);
 if(source.genome?.length===5)state.version='PL1';
 validate(state);
 return {format:'PatternLabBeetle',version:2,beetle:{...state.beetles.B1,id:source.id,parents:source.parents},model:'Invented teaching genetics; sumo traits are game measurements.'};
}
function packet(b,{anonymous=false}={}){
 const specimen=clone(b);
 if(anonymous){specimen.name='';specimen.parents=[];specimen.sourceJarId=null;specimen.broodId=null;delete specimen.provenance;delete specimen.upgradeNote;}
 return validatePacket({format:'PatternLabBeetle',version:2,beetle:specimen});
}
function importPacket(s,input){
 const data=validatePacket(input),b=clone(data.beetle),source=clone(b);
 if(Object.keys(s.beetles).length>=3000)throw Error('Save this experiment and start a new tank before importing more beetles.');
 b.id='B'+s.nextId++;b.parents=[];b.sourceJarId=null;b.broodId=null;
 b.provenance={sourceId:source.id,parents:source.parents,generation:source.lineageGeneration};
 s.beetles[b.id]=b;(s.tank.length<48?s.tank:s.nursery).push(b.id);return b;
}
const api={chromosomes,loci,byKey,antennaNames,legNames,seeded,clone,founder,setCopies,copies,expressed,phenotype,gamete,baby,pairs,breedRound,createState,container,move,validate,upgradeState,packet,validatePacket,importPacket,forecast,clamp,checksum,validConfig,encodeConfig,decodeConfig};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternGenetics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
