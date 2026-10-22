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
 {id:'E',loci:[cat('leg','Leg framework',['runner','sturdy','shovel','jumper','paddle','hooked','spiny','longfoot']),num('legLength','Leg length',.55,1.5),num('femur','Thigh thickness',.7,2.4),num('tibia','Shin width',.7,2),num('foot','Foot length',.5,1.8),num('joint','Joint angle',-.4,.4),num('legSpread','Leg spread',.7,1.4),num('claw','Claw curve'),num('spines','Spine density'),num('legHair','Leg hair density'),num('hind','Hind-leg emphasis'),num('motor','Motor speed'),num('stride','Stride drive'),{...num('strength','Strength breeding value'),model:'quantitative'}]}
];
// All behavior and sumo measurements are continuous game traits, not species claims.
chromosomes.push({id:'F',loci:[num('tracking','Opponent tracking'),num('reaction','Reaction speed'),num('focus','Attention focus'),num('pushDrive','Pushing instinct'),num('wander','Wandering instinct'),num('turnRate','Turning agility'),num('tactics','Ring tactics (game intelligence)'),num('edgeSense','Edge awareness'),num('brace','Bracing instinct'),num('lateralBalance','Sideways balance'),num('grip','Foot grip'),num('endurance','Endurance'),num('recovery','Recovery'),num('mass','Body mass'),num('acceleration','Acceleration'),num('centerDrive','Center preference'),num('curiosity','Curiosity'),num('sociality','Social approach'),num('caution','Caution'),num('persistence','Persistence')]});
chromosomes.push({id:'G',loci:[num('bodyLength','Body length',.78,1.3),num('headWidth','Head width',.65,1.4),num('horn','Horn length'),num('jaw','Jaw size'),num('gloss','Shell gloss'),num('metallic','Metallic sheen'),num('ridges','Shell ridge count',0,10),num('ridgeHeight','Shell ridge relief'),num('pronotum','Neck shield width',.75,1.3),num('gait','Gait rhythm')]});
// Neutral modifiers preserve existing founders. Log2 scale makes each selected step proportional.
chromosomes.push({id:'H',loci:[num('bodyGrowth','Body growth modifier',-3,2),num('antennaGrowth','Antenna growth modifier',-2,2),num('legGrowth','Leg growth modifier',-1.5,1.5),num('hornGrowth','Horn growth modifier',-2,3),num('headGrowth','Head growth modifier',-1,1),num('jawGrowth','Jaw growth modifier',-1,2),cat('hornCount','Horn number',['single','double','triple']),cat('hornShape','Horn framework',['spike','curved','forked'])]});
chromosomes.push({id:'I',loci:[color('legColor','Leg color'),color('thoraxColor','Thorax color')]});
// Chromosome J: invented game adaptations. N suppresses the rare spring/gland structure.
const abilityNames={lift:'Horn lift',jump:'Spring jump',puff:'Bombardier puff'};
const abilityFactors=['Power','Reach','Control','Efficiency','Recovery','Instinct'];
chromosomes.push({id:'J',loci:[cat('jumpGate','Spring-joint suppressor',['N','n']),cat('puffGate','Puff-gland suppressor',['N','n']),...Object.entries(abilityNames).flatMap(([key,name])=>abilityFactors.map(f=>num(key+f,name+' · '+({Control:'aim / landing control',Recovery:'recovery speed',Instinct:'use instinct'}[f]||f.toLowerCase()))))]});
const abilityKeys=new Set(chromosomes[9].loci.map(l=>l.key));
const neutralAbilities=()=>({id:'J',copies:[0,1].map(()=>chromosomes[9].loci.map(l=>l.type==='number'?.5:{value:'N',expression:.5}))});
const growthKeys=new Set(chromosomes[7].loci.filter(l=>l.type==='number').map(l=>l.key));
const neutralGrowth=()=>({id:'H',copies:[0,1].map(()=>chromosomes[7].loci.map(l=>l.type==='number'?0:{value:l.values[0],expression:.5}))});
const loci=chromosomes.flatMap(c=>c.loci), byKey=Object.fromEntries(loci.map(l=>[l.key,l]));
// Continuous anatomy and behavior use bounded quantitative breeding values.
// Pigment, markings, finish and categorical frameworks retain Mendelian surprises.
const quantitativeKeys=new Set([...chromosomes[9].loci.filter(l=>l.type==='number').map(l=>l.key),...growthKeys,'bodyWidth',...chromosomes.filter(c=>['D','E','F'].includes(c.id)).flatMap(c=>c.loci.filter(l=>l.type==='number').map(l=>l.key)),'bodyLength','headWidth','horn','jaw','pronotum','gait']);
for(const l of loci)if(quantitativeKeys.has(l.key))l.model='quantitative';
const clueGroups=[
 {key:'speed',words:['Dew','Bramble','Echo'],min:.25,max:1.95},
 {key:'strength',words:['Moss','Quartz','Cinder'],min:0,max:1},
 {key:'endurance',words:['Willow','Flint','Reed'],min:0,max:1},
 {key:'focus',words:['Sable','Loom','Pollen'],min:0,max:1},
 {key:'tactics',words:['Pebble','Thistle','Lichen'],min:0,max:1}
];
// No trait keys, numeric tiers or deciphering legend are rendered in student tags.
function observationTags(b){const p=phenotype(b);return clueGroups.map(g=>g.words[Math.min(2,Math.floor(clamp((p[g.key]-g.min)/(g.max-g.min))*3))]);}

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
function neutralColors(b){const body=b.genome[0].copies.map(c=>clone(c[0]));return {id:'I',copies:body.map(a=>[clone(a),clone(a)])};}
function founder(id,r=Math.random,index=0){
 const b={id,name:'',parents:[],sourceJarId:null,broodId:null,lineageGeneration:0,genome:chromosomes.slice(0,7).map(c=>({id:c.id,copies:[c.loci.map(l=>randomAllele(l,r)),c.loci.map(l=>randomAllele(l,r))]})),developmentSeed:Math.floor(r()*4294967296),mutations:[]};
 b.genome.push(neutralGrowth());
 setCopies(b,'horn',expressed(b,'horn')*.12);
 // Coherent founders expose readable forms while retaining latent alternatives.
 const form=chromosomes[3].loci[0].values[index%13],leg=chromosomes[4].loci[0].values[index%8];
 setCopies(b,'antenna',{value:form,expression:.8},{value:pick(chromosomes[3].loci[0].values,r),expression:.25});
 setCopies(b,'leg',{value:leg,expression:.8},{value:pick(chromosomes[4].loci[0].values,r),expression:.25});
 setCopies(b,'antennaLength',index===0?.1:.35+r()*1.1,.3+r()*1.3);
 setCopies(b,'plain',{value:index%5===0?'S':'s',expression:.5},{value:'s',expression:.5});
 setCopies(b,'layers',{value:index%3===0?'T':'t',expression:.5},{value:'t',expression:.5});
 setCopies(b,'hairGate',{value:form==='plume'?'h':pick(['H','h'],r),expression:.5},{value:'h',expression:.5});
 if(index<2){setCopies(b,'plain',{value:'S',expression:.5},{value:'s',expression:.5});setCopies(b,'layers',{value:'T',expression:.5},{value:'t',expression:.5});setCopies(b,'body',{rgb:[91,146,101],expression:.8},{rgb:[215,169,64],expression:.3});}
 b.genome.push(neutralColors(b));b.genome.push(neutralAbilities());
 // Separate deterministic stream preserves all pre-existing founder DNA and population seeds.
 const ar=seeded(b.developmentSeed^0x6a09e667);
 for(const key of ['jumpGate','puffGate']){const roll=ar();if(roll<.002)setCopies(b,key,{value:'n',expression:.5});else if(roll<.027)setCopies(b,key,{value:'N',expression:.5},{value:'n',expression:.5});}
 for(const l of chromosomes[9].loci)if(l.type==='number')setCopies(b,l.key,.25+ar()*.5,.25+ar()*.5);
 return b;
}
function copies(b,key){const ci=chromosomes.findIndex(c=>c.loci.some(l=>l.key===key)),li=chromosomes[ci].loci.findIndex(l=>l.key===key);return (b.genome[ci]||(ci===7?neutralGrowth():ci===8?neutralColors(b):ci===9?neutralAbilities():null)).copies.map(c=>c[li]);}
function expressed(b,key){const l=byKey[key],[a,c]=copies(b,key);if(l.type==='number')return (a+c)/2;if(l.type==='category')return a.expression>=c.expression?a.value:c.value;return a.expression===c.expression?a.rgb.map((v,i)=>Math.round((v+c.rgb[i])/2)):(a.expression>c.expression?a.rgb.slice():c.rgb.slice());}
function phenotype(b){
 const p=Object.fromEntries(loci.map(l=>[l.key,expressed(b,l.key)]));
 p.visibleLayers=copies(b,'plain').some(a=>a.value==='S')?0:copies(b,'layers').some(a=>a.value==='T')?1:2;
 p.hairs=copies(b,'hairGate').some(a=>a.value==='H')?0:p.hairDensity;
 p.speed=Number((.25+1.7*(.6*p.motor+.4*p.stride)*(.85+.15*(p.legLength-.55)/.95)).toFixed(2));
 for(const part of ['body','antenna','leg','horn','head','jaw'])p[part+'Factor']=2**p[part+'Growth'];
 p.size=Math.sqrt(p.bodyWidth*p.bodyLength)*p.bodyFactor;
 p.visibleHorns=p.horn>.008?{single:1,double:2,triple:3}[p.hornCount]:0;
 p.visibleLegColor=p.legColor.map(v=>Math.round(v*p.appendageShade*.7+14));
 p.visibleThoraxColor=p.thoraxColor.map(v=>Math.round(v*p.appendageShade*.7+14));
 p.canJump=copies(b,'jumpGate').every(a=>a.value==='n');p.canPuff=copies(b,'puffGate').every(a=>a.value==='n');
 p.strengthIndex=Math.round(1+99*p.strength);
 return p;
}
// Student measurement allowlist: expressed model traits only, never strength or gene copies.
const studentTraits=[
 {key:'size',label:'Overall body size',unit:'relative body scale (sqrt(length × width))',group:'Body and legs',min:Math.sqrt(.72*.78)/8,max:5.2},
 {key:'speed',label:'Walking speed',unit:'body lengths / second',group:'Movement',min:.25,max:1.95},
 ...['endurance','recovery','grip','acceleration','turnRate'].map(key=>({key,label:{endurance:'Stamina',recovery:'Recovery',grip:'Foot grip',acceleration:'Acceleration',turnRate:'Turning agility'}[key],unit:'model index (0–1)',group:'Movement',min:0,max:1})),
 ...['bodyLength','bodyWidth','headWidth','legLength','femur','foot','horn','jaw','antennaLength','shaftWidth','segments','branchLength','hairLength','gloss','metallic'].map(key=>({key,label:byKey[key].label,unit:key==='segments'?'segments (rounded)':key==='antennaLength'?'body lengths':key==='bodyLength'||key==='bodyWidth'||key==='headWidth'||key==='legLength'||key==='femur'||key==='foot'||key==='shaftWidth'?'relative model scale':'model index (0–1)',group:['antennaLength','shaftWidth','segments','branchLength','hairLength'].includes(key)?'Antennae':'Body and legs',min:byKey[key].min,max:byKey[key].max})),
 {key:'visibleHorns',label:'Visible horns',unit:'horns',group:'Body and legs',min:0,max:3},
 {key:'visibleLayers',label:'Visible pattern colors',unit:'colors',group:'Shell and patterns',min:0,max:2},
 ...['R','G','B'].map((channel,i)=>({key:'body'+channel,label:'Body color · '+['red','green','blue'][i]+' channel',unit:'RGB channel (0–255)',group:'Shell and patterns',min:0,max:255})),
 ...['leg','thorax'].flatMap(part=>['R','G','B'].map((channel,i)=>({key:part+channel,label:(part==='leg'?'Leg':'Thorax')+' color · '+['red','green','blue'][i]+' channel',unit:'RGB channel (0–255)',group:'Shell and patterns',min:0,max:255}))),
 ...['tracking','reaction','focus','pushDrive','wander','tactics','edgeSense','brace','lateralBalance','mass','centerDrive','curiosity','sociality','caution','persistence'].map(key=>({key,label:byKey[key].label,unit:'model index (0–1)',group:'Behavior and contest',min:0,max:1}))
];
const dimensionFactors={bodyLength:'body',bodyWidth:'body',headWidth:'head',legLength:'leg',horn:'horn',jaw:'jaw',antennaLength:'antenna'};
for(const t of studentTraits){const part=dimensionFactors[t.key];if(part){const l=byKey[part+'Growth'];t.min*=2**l.min;t.max*=2**l.max;t.unit='relative model scale';}}
function measurements(b){
 const p=phenotype(b);return Object.fromEntries(studentTraits.map(t=>[t.key,t.key==='segments'?Math.round(p.segments):/^(body|leg|thorax)[RGB]$/.test(t.key)?(t.key.startsWith('body')?p.body:t.key.startsWith('leg')?p.visibleLegColor:p.visibleThoraxColor)['RGB'.indexOf(t.key.slice(-1))]:p[t.key]*(dimensionFactors[t.key]?p[dimensionFactors[t.key]+'Factor']:1)]));
}
function validateMeasurements(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||![studentTraits.length,studentTraits.length-6].includes(Object.keys(m).length))throw Error('Invalid archived trait measurements.');
 for(const t of studentTraits){if(!Object.hasOwn(m,t.key)&&/^(leg|thorax)[RGB]$/.test(t.key)&&Object.keys(m).length===studentTraits.length-6)continue;if(!Object.hasOwn(m,t.key)||!Number.isFinite(m[t.key])||m[t.key]<t.min||m[t.key]>t.max)throw Error('Invalid archived trait measurement.');}
}
function mutate(a,l,rate,r){
 if(['jumpGate','puffGate'].includes(l.key))rate*=.01;
 if(growthKeys.has(l.key))rate*=.15;else if(['hornCount','hornShape'].includes(l.key))rate*=.02;
 if(r()>=rate)return {allele:clone(a),changed:false};
 if(growthKeys.has(l.key)){const large=r()<.01,delta=(r()<.5?-1:1)*(large?.5+r()*.35:.01+r()*.04),value=clamp(a+delta,l.min,l.max);return {allele:value,changed:value!==a};}
 if(l.model==='quantitative'){const span=l.max-l.min,large=r()<.05,delta=(r()<.5?-1:1)*span*(large?.24+r()*.32:.008+r()*.05),value=clamp(a+delta,l.min,l.max);return {allele:value,changed:value!==a};}
 if(l.type==='number'){const span=l.max-l.min,delta=(r()<.5?-1:1)*span*(.04+r()*.12);return {allele:clamp(a+delta,l.min,l.max),changed:true};}
 if(l.type==='color'){const v=clone(a),channel=Math.floor(r()*3);v.rgb[channel]=clamp(v.rgb[channel]+(r()<.5?-1:1)*(8+Math.floor(r()*40)),0,255);v.expression=clamp(v.expression+(r()-.5)*.3);return {allele:v,changed:true};}
 const alternatives=l.key==='hornCount'?(a.value==='single'?['double']:a.value==='triple'?['double']:['single','triple']):l.values.filter(v=>v!==a.value);return {allele:{value:pick(alternatives,r),expression:clamp(a.expression+(r()-.5)*.3)},changed:true};
}
function gamete(b,rate,r){
 const mutations=[];
 const chromosomesOut=chromosomes.map((c,ci)=>{let side=r()<.5?0:1;const cross=r()<.35?1+Math.floor(r()*(c.loci.length-1)):-1;return c.loci.map((l,i)=>{if(i===cross)side=1-side;// Quantitative records summarize many small effects. Other loci transmit
 // actual parental copies and retain chromosome linkage.
 const inherited=l.model==='quantitative'?clamp(expressed(b,l.key)+.035*(growthKeys.has(l.key)?1:l.max-l.min)*(r()+r()-1),l.min,l.max):(b.genome[ci]||(ci===7?neutralGrowth():ci===8?neutralColors(b):ci===9?neutralAbilities():null)).copies[side][i];const m=mutate(inherited,l,rate,r);if(m.changed)mutations.push(l.key);return m.allele;});});
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
 for(const {jar,count} of allocations){const choices=pairs(jar.members);for(let n=0;n<count;n++){let [a,b]=pick(choices,r);if(r()<.5)[a,b]=[b,a];const id='B'+state.nextId++;const child=baby(state.beetles[a],state.beetles[b],id,{rate:state.settings.mutation,rng:r,jarId:jar.id,broodId});child.arrivedRound=state.round+1;state.beetles[id]=child;newborns.push(id);}}
 for(let i=newborns.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[newborns[i],newborns[j]]=[newborns[j],newborns[i]];}
 for(const id of newborns)(state.tank.length<48?state.tank:state.nursery).push(id);
 state.round++;state.store=null;cleanup(state);state.history.push({broodId,total,allocations:allocations.map(a=>({jarId:a.jar.id,count:a.count,parents:a.jar.members.slice()})),offspring:newborns.slice()});
 return state.history[state.history.length-1];
}
function createState(seed=42){const r=seeded(seed),s={version:'PL2',round:0,nextId:17,seed,store:null,settings:{mutation:.005,showStats:false,backdrop:'moss',allowBackdrop:true,allowSumo:true,broods:2},beetles:{},retired:{},cleanupExcluded:[],tradeLocks:[],tradeReceipts:[],tank:[],nursery:[],collection:[],keepLayout:{},tankLayout:{},jars:[{id:'jar-1',active:true,members:[]},{id:'jar-2',active:false,members:[]}],history:[],matchHistory:[],notes:''};for(let i=0;i<16;i++){const id='B'+(i+1);s.beetles[id]=founder(id,r,i);s.tank.push(id);}return s;}
function container(s,id){if(s.tank.includes(id))return 'tank';if(s.nursery.includes(id))return 'nursery';if(s.collection.includes(id))return 'collection';return s.jars.find(j=>j.members.includes(id))?.id||null;}
// Retired beetles retain only family labels, never a playable genome.
function record(s,id){return s.beetles[id]||s.retired?.[id];}
function excludeFromCleanup(s,id,excluded){
 if(!s.beetles[id]||typeof excluded!=='boolean')throw Error('Choose a living beetle and an on/off cleanup choice.');
 s.cleanupExcluded=s.cleanupExcluded||[];s.cleanupExcluded=s.cleanupExcluded.filter(x=>x!==id);if(excluded)s.cleanupExcluded.push(id);
}
function retire(s,id,reason='released'){
 const b=s.beetles[id];if(!b)return false;
 if(reason!=='traded'&&(s.cleanupExcluded||[]).includes(id))return false;
 if((s.tradeLocks||[]).includes(id))throw Error('Finish or cancel this beetle’s trade first.');
 s.retired=s.retired||{};s.retired[id]={id:b.id,name:b.name,parents:b.parents.slice(),sourceJarId:b.sourceJarId,broodId:b.broodId,lineageGeneration:b.lineageGeneration,reason,arrivedRound:b.arrivedRound??(b.broodId?Number(b.broodId.split('-')[1]):0),origin:b.provenance?'imported':b.parents.length?'bred':'founder',measurementVersion:2,measurements:measurements(b),appearance:appearance(b)};
 for(const list of [s.tank,s.nursery,s.collection,...s.jars.map(j=>j.members)]){const i=list.indexOf(id);if(i>=0)list.splice(i,1);}
 s.cleanupExcluded=(s.cleanupExcluded||[]).filter(x=>x!==id);
 delete s.beetles[id];delete s.keepLayout?.[id];delete s.tankLayout?.[id];return true;
}
function cleanup(s,{all=false,broods=s.settings.broods??2,ids=null}={}){
 const removed=[],reviewed=ids===null?null:new Set(ids);
 for(const id of [...s.tank,...s.nursery]){const b=s.beetles[id];if((reviewed&&!reviewed.has(id))||(s.tradeLocks||[]).includes(id)||(s.cleanupExcluded||[]).includes(id))continue;
  const arrival=b.arrivedRound??(b.broodId?Number(b.broodId.split('-')[1]):0);
  if(all||arrival<s.round-broods+1){retire(s,id,all?'released':'older brood');removed.push(id);}
 }
 while(s.tank.length<48&&s.nursery.length)s.tank.push(s.nursery.shift());
 return removed;
}
function fingerprint(b){const genome=clone(b.genome);if(genome.length===10&&JSON.stringify(genome[9])===JSON.stringify(neutralAbilities()))genome.pop();if(genome.length===9&&JSON.stringify(genome[8])===JSON.stringify(neutralColors(b)))genome.pop();if(genome.length===8&&JSON.stringify(genome[7])===JSON.stringify(neutralGrowth()))genome.pop();return checksum(JSON.stringify(genome)+'|'+b.developmentSeed);}
function finishTrade(s,{code,outgoing,fingerprint:expected,incoming}){
 if(s.tradeReceipts.includes(code))return null;
 const data=validatePacket(incoming),b=s.beetles[outgoing];
 if(!b||fingerprint(b)!==expected)throw Error('Open the original tank to collect this trade. Your receipt is safe.');
 const kept=s.collection.includes(outgoing),position=clone(s.keepLayout[outgoing]||null);
 s.tradeLocks=s.tradeLocks.filter(id=>id!==outgoing);retire(s,outgoing,'traded');
 const received=importPacket(s,data);if(kept){move(s,received.id,'collection');if(position)s.keepLayout[received.id]=position;}
 s.tradeReceipts.push(code);return received;
}
function move(s,id,target){
 if(!s.beetles[id])throw Error('This beetle is missing.');
 const current=container(s,id);if(current===target)return;if((s.tradeLocks||[]).includes(id))throw Error('Finish or cancel this beetle’s trade first.');
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
   for(const c of chromosomes.slice(5,7))b.genome.push({id:c.id,copies:[c.loci.map(l=>randomAllele(l,r)),c.loci.map(l=>randomAllele(l,r))]});
   for(const [key,value] of Object.entries({bodyLength:1,headWidth:1,horn:0,jaw:0,gloss:0,metallic:0,ridges:0,ridgeHeight:0,pronotum:1,gait:.5}))setCopies(b,key,value);
   b.upgradeNote='Behavior and sumo traits initialized deterministically during the v1-to-v2 upgrade; the original five chromosome pairs were preserved.';
  }
  if(Array.isArray(b.genome)&&b.genome.length===7)b.genome.push(neutralGrowth());
  if(Array.isArray(b.genome)&&b.genome.length===8)b.genome.push(neutralColors(b));
  if(Array.isArray(b.genome)&&b.genome.length===9)b.genome.push(neutralAbilities());
 }
 // Older archives already measured both dimensions, so overall size needs no guessed genes.
 for(const b of Object.values(s.retired||{})){if(b.appearance?.traits){for(const key of ['legColor','thoraxColor'])if(!Object.hasOwn(b.appearance.traits,key))b.appearance.traits[key]=clone(b.appearance.traits.body);}const m=b.measurements;if(m&&b.measurementVersion===undefined){if(!Object.hasOwn(m,'size')&&Number.isFinite(m.bodyWidth)&&Number.isFinite(m.bodyLength))m.size=Math.sqrt(m.bodyWidth*m.bodyLength);m.visibleHorns=m.horn>.05?1:0;b.measurementVersion=2;}}
 if(s.cleanupExcluded===undefined)s.cleanupExcluded=Object.values(s.beetles).filter(b=>typeof b.name==='string'&&b.name.trim()).map(b=>b.id);
 if(s.store===undefined)s.store=null;
 s.retired=s.retired||{};s.tradeLocks=s.tradeLocks||[];s.tradeReceipts=s.tradeReceipts||[];
 if(s.settings&&s.settings.broods===undefined)s.settings.broods=2;
 s.version='PL2';if(s.settings&&s.settings.allowSumo===undefined)s.settings.allowSumo=true;s.keepLayout=s.keepLayout||{};s.tankLayout=s.tankLayout||{};s.matchHistory=s.matchHistory||[];
 return s;
}
function validate(s){
 s=upgradeState(s);
 if(!s||s.version!=='PL2'||!s.settings||typeof s.beetles!=='object'||!Array.isArray(s.jars)||s.jars.length!==2)throw Error('This is not a Pattern Lab save.');
 if(!Number.isInteger(s.nextId)||s.nextId<1||!Number.isInteger(s.round)||s.round<0||!Array.isArray(s.history)||s.history.length!==s.round||!Number.isInteger(s.seed)||s.seed<1||s.seed>2147483647||typeof s.notes!=='string'||s.notes.length>10000)throw Error('Invalid brood record.');
 if(!Number.isFinite(s.settings.mutation)||s.settings.mutation<0||s.settings.mutation>.1||!['moss','sand','bark','night'].includes(s.settings.backdrop)||typeof s.settings.showStats!=='boolean'||typeof s.settings.allowBackdrop!=='boolean')throw Error('Invalid settings.');
 if(![1,2].includes(s.settings.broods))throw Error('Choose one or two broods to keep.');
 if(s.store!==null&&(!s.store||typeof s.store!=='object'||Array.isArray(s.store)||!Number.isInteger(s.store.round)||s.store.round<0||s.store.round>s.round||!Number.isInteger(s.store.seed)||s.store.seed<0||s.store.seed>4294967295||!Array.isArray(s.store.claimed)||s.store.claimed.length>2||new Set(s.store.claimed).size!==s.store.claimed.length||s.store.claimed.some(i=>!Number.isInteger(i)||i<0||i>4)))throw Error('Invalid beetle store record.');
 // An older client may advance a brood without clearing the stock record. Preserve its tank.
 if(s.store&&s.store.round<s.round)s.store=null;
 if(typeof s.settings.allowSumo!=='boolean'||!Array.isArray(s.matchHistory)||s.matchHistory.length>100)throw Error('Invalid sumo records.');
 for(const m of s.matchHistory){
  if(!m||!['SUMO2','SUMO3','SUMO4','SUMO5','SUMO6'].includes(m.version)||!Number.isInteger(m.seed)||m.seed<0||m.seed>4294967295||!Number.isFinite(m.seconds)||m.seconds<0||m.seconds>60.1||![null,0,1].includes(m.winner)||!['Ring-out','Both centers crossed the line','Time limit — draw','Closest to center','Center tie'].includes(m.reason)||!Array.isArray(m.fighters)||m.fighters.length!==2||!Array.isArray(m.events)||m.events.length>120)throw Error('Invalid saved match.');
  if(m.centerDistances!==undefined&&(!Array.isArray(m.centerDistances)||m.centerDistances.length!==2||m.centerDistances.some(d=>!Number.isFinite(d)||d<0||d>1000)))throw Error('Invalid center distances.');
  for(const f of m.fighters){if(!f||typeof f.id!=='string'||f.id.length>80||typeof f.name!=='string'||f.name.length>40||['wanderingSeconds','contactSeconds','sidePushes','rearPushes','frontPushes'].some(k=>!Number.isFinite(f[k])||f[k]<0||f[k]>120))throw Error('Invalid fighter record.');}
  for(const e of m.events)if(!e||!Number.isFinite(e.time)||e.time<0||e.time>60.1||![0,1].includes(e.attacker)||![0,1].includes(e.defender)||e.attacker===e.defender||!['front','side','rear'].includes(e.side))throw Error('Invalid contact record.');
  if(m.abilities!==undefined){if(!Array.isArray(m.abilities)||m.abilities.length>120)throw Error('Invalid adaptation record.');for(const e of m.abilities)if(!e||!Number.isFinite(e.time)||e.time<0||e.time>60.1||![0,1].includes(e.actor)||!['lift','jump','puff'].includes(e.move)||typeof e.hit!=='boolean')throw Error('Invalid adaptation event.');}
  if(m.participants!==undefined){if(!Array.isArray(m.participants)||m.participants.length!==2)throw Error('Invalid replay data.');m.participants.forEach(validatePacket);}
 }
 const ids=Object.keys(s.beetles);
 if(!s.retired||typeof s.retired!=='object'||Array.isArray(s.retired)||Object.keys(s.retired).length>200000)throw Error('Invalid retired family records.');
 if(s.pendingTrade!=null&&(!s.pendingTrade||!['host','guest'].includes(s.pendingTrade.role)||typeof s.pendingTrade.code!=='string'||!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(s.pendingTrade.code)||!s.beetles[s.pendingTrade.outgoing]||s.tradeLocks[0]!==s.pendingTrade.outgoing||fingerprint(s.beetles[s.pendingTrade.outgoing])!==s.pendingTrade.fingerprint))throw Error('Invalid pending trade.');
 if(!Array.isArray(s.tradeLocks)||s.tradeLocks.length>1||s.tradeLocks.some(id=>!s.beetles[id])||!Array.isArray(s.tradeReceipts)||s.tradeReceipts.length>10000||s.tradeReceipts.some(c=>typeof c!=='string'||!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(c)))throw Error('Invalid trade records.');
 for(const [id,b] of Object.entries(s.retired)){if(s.beetles[id]||b.id!==id||!/^B[1-9]\d*$/.test(id)||Number(id.slice(1))>=s.nextId||typeof b.name!=='string'||b.name.length>40||!Array.isArray(b.parents)||![0,2].includes(b.parents.length)||new Set(b.parents).size!==b.parents.length||!Number.isInteger(b.lineageGeneration)||b.lineageGeneration<0||!['released','older brood','traded'].includes(b.reason)||b.genome!==undefined)throw Error('Invalid retired beetle.');}
 for(const b of Object.values(s.retired)){if(b.measurements!==undefined)validateMeasurements(b.measurements);if(b.appearance!==undefined)validateAppearance(b.appearance);if(b.origin!==undefined&&!['imported','bred','founder'].includes(b.origin))throw Error('Invalid measurement origin.');if(b.arrivedRound!==undefined&&(!Number.isInteger(b.arrivedRound)||b.arrivedRound<0||b.arrivedRound>s.round))throw Error('Invalid archived arrival round.');}
 const family=Object.assign({},s.retired,s.beetles);
 for(const [id,b] of Object.entries(family)){
  if(!Array.isArray(b.parents)||b.parents.some(p=>!family[p]||p===id||family[p].lineageGeneration>=b.lineageGeneration)||b.parents.length===2&&(b.lineageGeneration!==1+Math.max(...b.parents.map(p=>family[p].lineageGeneration))||!['jar-1','jar-2'].includes(b.sourceJarId)||!/^brood-[1-9]\d*$/.test(b.broodId)))throw Error('Invalid family record.');
 }
 if(!Array.isArray(s.cleanupExcluded)||s.cleanupExcluded.length>3000||new Set(s.cleanupExcluded).size!==s.cleanupExcluded.length||s.cleanupExcluded.some(id=>!s.beetles[id]))throw Error('Invalid cleanup exclusions.');
 if(ids.length>3000)throw Error('This save is too large (3,000 live beetles maximum).');
 for(const [i,j] of s.jars.entries())if(j.id!=='jar-'+(i+1)||typeof j.active!=='boolean'||!Array.isArray(j.members)||j.members.length>4)throw Error('Invalid jar.');
 if(![s.tank,s.nursery,s.collection].every(Array.isArray)||s.tank.length>48||s.collection.length>10)throw Error('Invalid tank capacity.');
 for(const layout of [s.keepLayout,s.tankLayout])if(layout!==undefined){if(!layout||typeof layout!=='object'||Array.isArray(layout)||Object.keys(layout).length>3000)throw Error('Invalid Keep tank layout.');for(const [id,v] of Object.entries(layout))if(!s.beetles[id]||!v||!Number.isFinite(v.x)||v.x<0||v.x>1||!Number.isFinite(v.y)||v.y<0||v.y>1||!Number.isFinite(v.angle))throw Error('Invalid Keep tank position.');}
 const all=[...s.tank,...s.nursery,...s.collection,...s.jars.flatMap(j=>j.members)];
 if(all.length!==ids.length||new Set(all).size!==ids.length||all.some(id=>!s.beetles[id]))throw Error('A beetle has a missing or duplicate container.');
 for(const id of ids){const b=s.beetles[id];if(b.id!==id||!/^B[1-9]\d*$/.test(id)||Number(id.slice(1))>=s.nextId||typeof b.name!=='string'||b.name.length>40||!Number.isInteger(b.lineageGeneration)||b.lineageGeneration<0||!Number.isInteger(b.developmentSeed)||b.developmentSeed<0||b.developmentSeed>4294967295||!Array.isArray(b.parents)||![0,2].includes(b.parents.length)||new Set(b.parents).size!==b.parents.length||!Array.isArray(b.mutations)||b.mutations.some(k=>!byKey[k])||!Array.isArray(b.genome)||b.genome.length!==chromosomes.length)throw Error('Invalid beetle record.');
  if(b.arrivedRound!==undefined&&(!Number.isInteger(b.arrivedRound)||b.arrivedRound<0||b.arrivedRound>s.round))throw Error('Invalid arrival round.');
  if(b.parents.some(p=>!family[p]||p===id||family[p].lineageGeneration>=b.lineageGeneration)||b.parents.length===2&&(b.lineageGeneration!==1+Math.max(...b.parents.map(p=>family[p].lineageGeneration))||!['jar-1','jar-2'].includes(b.sourceJarId)||!/^brood-[1-9]\d*$/.test(b.broodId)))throw Error('Invalid family record.');
  for(let ci=0;ci<chromosomes.length;ci++){const c=chromosomes[ci],g=b.genome[ci];if(g.id!==c.id||!Array.isArray(g.copies)||g.copies.length!==2)throw Error('Invalid chromosome.');for(const cp of g.copies){if(!Array.isArray(cp)||cp.length!==c.loci.length)throw Error('Invalid gene copies.');c.loci.forEach((l,i)=>{const a=cp[i];if(l.type==='number'){if(!Number.isFinite(a)||a<l.min||a>l.max)throw Error('Invalid numeric gene.');}else{if(!a||!Number.isFinite(a.expression)||a.expression<0||a.expression>1)throw Error('Invalid expression gene.');if(l.type==='category'&&!l.values.includes(a.value))throw Error('Invalid shape gene.');if(l.type==='color'&&(!Array.isArray(a.rgb)||a.rgb.length!==3||a.rgb.some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('Invalid color gene.');}});}}
 }
 for(const [i,h] of s.history.entries()){
  if(h.broodId!=='brood-'+(i+1)||!Number.isInteger(h.total)||h.total<10||h.total>20||!Array.isArray(h.allocations)||h.allocations.length<1||h.allocations.length>2||new Set(h.allocations.map(a=>a.jarId)).size!==h.allocations.length||!Array.isArray(h.offspring)||h.offspring.length!==h.total||new Set(h.offspring).size!==h.total||h.offspring.some(id=>!family[id]||family[id].broodId!==h.broodId))throw Error('Invalid saved brood.');
  if(h.allocations.reduce((n,a)=>n+a.count,0)!==h.total)throw Error('Invalid brood allocation.');
  for(const a of h.allocations)if(!['jar-1','jar-2'].includes(a.jarId)||!Number.isInteger(a.count)||a.count<1||!Array.isArray(a.parents)||a.parents.length<2||a.parents.length>4||new Set(a.parents).size!==a.parents.length||a.parents.some(id=>!family[id])||h.offspring.filter(id=>family[id].sourceJarId===a.jarId).length!==a.count||h.offspring.some(id=>family[id].sourceJarId===a.jarId&&family[id].parents.some(p=>!a.parents.includes(p))))throw Error('Invalid saved parent group.');
 }
 // A newly selected one-brood setting applies at the next birth, not on file restore.
 cleanup(s,{broods:2});return s;
}
function forecast(s,jar,n=240){if(jar.members.length<2)return null;const r=seeded(713),choices=pairs(jar.members),out={layers:[0,0,0],antennae:{},legs:{},speed:0,strength:0};for(let i=0;i<n;i++){let [a,b]=pick(choices,r);if(r()<.5)[a,b]=[b,a];const p=phenotype(baby(s.beetles[a],s.beetles[b],'preview',{rate:s.settings.mutation,rng:r}));out.layers[p.visibleLayers]++;out.antennae[p.antenna]=(out.antennae[p.antenna]||0)+1;out.legs[p.leg]=(out.legs[p.leg]||0)+1;out.speed+=p.speed;out.strength+=p.strengthIndex;}out.n=n;return out;}
const visualKeys=loci.filter(l=>!abilityKeys.has(l.key)&&!['tracking','reaction','focus','pushDrive','wander','turnRate','tactics','edgeSense','brace','lateralBalance','grip','endurance','recovery','mass','acceleration','centerDrive','curiosity','sociality','caution','persistence','strength','motor','stride'].includes(l.key)).map(l=>l.key);
function appearance(b){const p=phenotype(b);return {developmentSeed:b.developmentSeed,traits:Object.fromEntries([...visualKeys,'visibleLayers','hairs'].map(k=>[k,clone(p[k])]))};}
function validateAppearance(a){if(!a||!Number.isInteger(a.developmentSeed)||a.developmentSeed<0||a.developmentSeed>4294967295||!a.traits||Object.keys(a.traits).length!==visualKeys.length+2)throw Error('Invalid appearance record.');for(const key of visualKeys){const l=byKey[key],v=a.traits[key];if(l.type==='number'&&(!Number.isFinite(v)||v<l.min||v>l.max)||l.type==='category'&&!l.values.includes(v)||l.type==='color'&&(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isInteger(x)||x<0||x>255)))throw Error('Invalid appearance trait.');}if(![0,1,2].includes(a.traits.visibleLayers)||!Number.isFinite(a.traits.hairs)||a.traits.hairs<0||a.traits.hairs>1)throw Error('Invalid appearance layer.');return a;}
function visualPhenotype(b){if(b.genome)return phenotype(b);const p=clone(validateAppearance(b.appearance).traits);for(const part of ['body','antenna','leg','horn','head','jaw'])p[part+'Factor']=2**p[part+'Growth'];p.visibleHorns=p.horn>.008?{single:1,double:2,triple:3}[p.hornCount]:0;return p;}
function checksum(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);}
function validConfig(c){
 if(!c||c.v!==1)throw Error('This class link uses an unsupported version.');
 if(!Number.isInteger(c.seed)||c.seed<1||c.seed>2147483647)throw Error('Population seed must be a whole number from 1 to 2147483647.');
 if(!Number.isFinite(c.mutation)||c.mutation<0||c.mutation>.1)throw Error('Mutation must be from 0 to 10 percent per gene copy.');
 if(!['moss','sand','bark','night'].includes(c.backdrop)||typeof c.stats!=='boolean'||typeof c.environment!=='boolean'||![.5,1,2,5,10].includes(c.speed))throw Error('This class link contains unsupported settings.');
 if(c.broods!==undefined&&![1,2].includes(c.broods))throw Error('Choose one or two broods to keep.');
 if(c.sumo!==undefined&&typeof c.sumo!=='boolean')throw Error('Invalid sumo permission.');
 return c;
}
function encodeConfig(c){const data=btoa(JSON.stringify(validConfig(c))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return 'PL1.'+data+'.'+checksum(data);}
function decodeConfig(code){try{const a=code.split('.');if(a.length!==3||a[0]!=='PL1'||checksum(a[1])!==a[2])throw Error('This class link is incomplete or damaged. Ask for the full link.');return validConfig(JSON.parse(atob(a[1].replace(/-/g,'+').replace(/_/g,'/'))));}catch(e){throw Error(e.message||'This class link could not be read.');}}
function validatePacket(input){
 if(!input||input.format!=='PatternLabBeetle'||![1,2,3].includes(input.version)||!input.beetle)throw Error('Choose a Pattern Lab beetle JSON file.');
 const source=clone(input.beetle);
 if(typeof source.id!=='string'||source.id.length>80||typeof source.name!=='string'||source.name.length>40||!Array.isArray(source.parents)||![0,2].includes(source.parents.length)||source.parents.some(x=>typeof x!=='string'||x.length>80))throw Error('Invalid beetle identity.');
 const specimen={...source,id:'B1',parents:[],sourceJarId:null,broodId:null};delete specimen.arrivedRound;
 const state=createState(1);state.beetles={B1:specimen};state.nextId=2;state.tank=['B1'];state.jars.forEach(j=>j.members=[]);
 if(source.genome?.length===5)state.version='PL1';
 validate(state);
 return {format:'PatternLabBeetle',version:3,beetle:{...state.beetles.B1,id:source.id,parents:source.parents},model:'Invented teaching genetics; sumo traits are game measurements.'};
}
function packet(b,{anonymous=false}={}){
 const specimen=clone(b);
 if(anonymous){specimen.name='';specimen.parents=[];specimen.sourceJarId=null;specimen.broodId=null;delete specimen.provenance;delete specimen.upgradeNote;}
 return validatePacket({format:'PatternLabBeetle',version:3,beetle:specimen});
}
function importPacket(s,input){
 const data=validatePacket(input),b=clone(data.beetle),source=clone(b);
 if(Object.keys(s.beetles).length>=3000)throw Error('Save this experiment and start a new tank before importing more beetles.');
 b.id='B'+s.nextId++;b.arrivedRound=s.round;b.parents=[];b.sourceJarId=null;b.broodId=null;
 b.provenance={sourceId:source.id,parents:source.parents,generation:source.lineageGeneration};
 s.beetles[b.id]=b;if(b.name.trim())excludeFromCleanup(s,b.id,true);(s.tank.length<48?s.tank:s.nursery).push(b.id);return b;
}
// One persistent selection per breeding round; separate randomness never changes offspring rolls.
function ensureStore(s,{rng=Math.random}={}){if(s.store===null||s.store===undefined){s.store={round:s.round,seed:Math.floor(rng()*4294967296),claimed:[]};return true;}return false;}
function storeStock(s){if(!s.store||s.store.round!==s.round)throw Error('Open the current beetle store first.');const r=seeded(s.store.seed);return Array.from({length:5},(_,i)=>founder('Store-'+s.round+'-'+(i+1),r,Math.floor(r()*104)));}
function takeStoreBeetle(s,index){
 if(!Number.isInteger(index)||index<0||index>4)throw Error('Choose one of the five store beetles.');
 if(!s.store||s.store.round!==s.round)throw Error('Open the current beetle store first.');
 if(s.store.claimed.includes(index))throw Error('That beetle already joined your tank.');
 if(s.store.claimed.length>=2)throw Error('You have chosen two beetles. Breed a new round for fresh arrivals.');
 const candidate=storeStock(s)[index],b=importPacket(s,packet(candidate));s.store.claimed.push(index);return b;
}
const api={abilityNames,abilityFactors,abilityKeys,neutralAbilities,ensureStore,storeStock,takeStoreBeetle,appearance,validateAppearance,visualPhenotype,growthKeys,studentTraits,measurements,chromosomes,loci,byKey,quantitativeKeys,observationTags,antennaNames,legNames,seeded,clone,founder,setCopies,copies,expressed,phenotype,gamete,baby,pairs,breedRound,createState,container,record,retire,cleanup,excludeFromCleanup,fingerprint,finishTrade,move,validate,upgradeState,packet,validatePacket,importPacket,forecast,clamp,checksum,validConfig,encodeConfig,decodeConfig};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternGenetics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
