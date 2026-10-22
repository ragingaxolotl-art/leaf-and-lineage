'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Lab, phenotype, fromHex, cross, hex, colorInfo, PIGMENTS, habitatAt, survivalChance, match, random, distance2, localSurvival, gridDistance, adjacentSlots, appearance, APPEARANCES, mateWeight, habitatAffinity } = require('../dist/simulation.js');
const config = { habitat: fromHex('#8fa967'), pressure: .8, mutationRate: .03 };
const emptyJars = lab => Array.from({ length: lab.rows }, () => []);
// Inject predictable hunt rolls only in tests; the browser uses fresh randomness.
const trial = (...args) => { const lab = new Lab(...args); lab.survivalRng = random((args[0] ?? 42) ^ 0x51f15e); return lab; };

const recipes = (a, b, strengthA = 7, strengthB = 0) => Array.from({length:6},(_,i)=> i<3 ? [a>>i&1,b>>i&1] : [strengthA>>(i-3)&1,strengthB>>(i-3)&1]);

test('the same starting seed and explicitly injected hunt rolls reproduce test trials', () => {
  const a = trial(42, 24, 8, 'warm'), b = trial(42, 24, 8, 'warm');
  assert.deepEqual(a.population, b.population);
  for (let g = 0; g < 15; g++) { a.commit(a.plan(config)); b.commit(b.plan(config)); }
  assert.deepEqual(a.population, b.population);
  assert.deepEqual(a.rowGenerations, [15, 15, 15]);
});
test('habitat measurements never change existing genes or colors', () => {
  const lab = trial(7), before = structuredClone(lab.population);
  assert.notEqual(lab.stats([20, 160, 30]).match, lab.stats([160, 20, 200]).match);
  assert.deepEqual(lab.population, before);
});
test('without mutation a child inherits one copy of each shade and color gene from each parent', () => {
  const lab = trial(1), [a, b] = lab.population;
  a.genes = [[10, 20], [30, 40], [50, 60]];
  b.genes = [[100, 120], [130, 140], [150, 160]];
  a.switches = Array.from({length:6},()=>[0,1]); b.switches = Array.from({length:6},(_,i)=>i%2?[1,1]:[0,0]);
  for (let i = 0; i < 300; i++) {
    const child = lab.offspring(a, b, 0);
    child.genes.forEach((pair, locus) => { assert.ok(a.genes[locus].includes(pair[0])); assert.ok(b.genes[locus].includes(pair[1])); });
    child.switches.forEach((pair,locus)=>{assert.ok(a.switches[locus].includes(pair[0]));assert.ok(b.switches[locus].includes(pair[1]));});
    for(const side of [0,1]) { const parent=side?b:a; assert.ok([0,1].some(copy=>child.switches.every((pair,i)=>pair[side]===parent.switches[i][copy]))); }
    assert.equal(child.mutations, 0); assert.equal(child.colorMutations, 0);
    assert.deepEqual(child.color, phenotype(child.genes, child.switches));
  }
});
test('green parents can produce contrasting offspring without mutation from real hidden recipes', () => {
  const lab=trial(42),[a,b]=lab.population;
  a.switches=recipes(0,2); b.switches=recipes(0,2);
  assert.equal(colorInfo(a.switches).visible,'green');
  assert.deepEqual(colorInfo(a.switches).alleles,['green','red']);
  const prediction=cross(a,b);
  assert.deepEqual(prediction.recipeChances,[{pigment:'green',probability:.75},{pigment:'red',probability:.25}]);
  assert.equal(prediction.pigmentChances.reduce((n,o)=>n+o.probability,0),1);
  const children=Array.from({length:12000},()=>lab.offspring(a,b,0));
  const count=children.filter(c=>colorInfo(c.switches).visible==='red').length;
  assert.ok(count>2800&&count<3200,`red offspring: ${count}/12000`);
  assert.ok(children.every(c=>c.mutations===0));
});
test('hidden recipes can pass through green descendants and reappear in grandchildren',()=>{
  const lab=trial(75),[a,b]=lab.population;
  a.switches=b.switches=recipes(0,2);
  const child=Array.from({length:100},()=>lab.offspring(a,b,0)).find(c=>colorInfo(c.switches).visible==='green'&&colorInfo(c.switches).alleles.includes('red'));
  assert.ok(child);
  const grandchildren=Array.from({length:1000},()=>lab.offspring(child,a,0));
  assert.ok(grandchildren.some(c=>colorInfo(c.switches).visible==='red'));
  grandchildren.forEach(c=>c.switches.forEach((pair,i)=>{assert.ok(child.switches[i].includes(pair[0]));assert.ok(a.switches[i].includes(pair[1]));}));
});
test('teacher probabilities match the four linked recipe crosses and all shade transmissions',()=>{
  const lab=trial(7),[a,b]=lab.population;
  a.switches=recipes(2,4,6,3);b.switches=recipes(1,6,2,7);
  const counts={};
  for(const av of [0,1])for(const bv of [0,1]){
    const switches=a.switches.map((pair,i)=>[pair[av],b.switches[i][bv]]);
    const family=colorInfo(switches).visible;counts[family]=(counts[family]||0)+1;
  }
  const prediction=cross(a,b);
  assert.equal(prediction.totalTransmissions,256);
  assert.equal(prediction.pigmentChances.reduce((sum,c)=>sum+c.probability,0),1);
  prediction.recipeChances.forEach(p=>assert.equal(p.probability,counts[p.pigment]/4));
  const expectedAppearances=new Map();prediction.outcomes.forEach(o=>expectedAppearances.set(appearance(o.color),(expectedAppearances.get(appearance(o.color))||0)+o.probability));
  prediction.pigmentChances.forEach(o=>assert.equal(o.probability,expectedAppearances.get(o.pigment)));
  assert.ok(Math.abs(prediction.colors.reduce((sum,c)=>sum+c.probability,0)-1)<1e-12);
  prediction.mean.forEach((v,i)=>assert.ok(Math.abs(v-prediction.outcomes.reduce((sum,o)=>sum+o.color[i]*o.probability,0))<1e-12));
  for(let i=0;i<500;i++){ const child=lab.offspring(a,b,0);assert.ok(prediction.colors.some(o=>o.color===hex(child.color))); }
});
test('every color can be hidden or expressed, and no family has fixed dominance',()=>{
  const families=Object.keys(PIGMENTS);
  for(let a=0;a<8;a++)for(let b=0;b<8;b++){
    const highA=colorInfo(recipes(a,b,7,0)),highB=colorInfo(recipes(a,b,0,7));
    assert.equal(highA.visible,families[a]);assert.equal(highB.visible,families[b]);
    assert.deepEqual(highA.alleles,[families[a],families[b]]);
    assert.equal(colorInfo(recipes(a,b,3,3)).visible,families[a],'equal expression uses parent A copy');
  }
  const counts=Array(8).fill(0);
  for(let a=0;a<8;a++)for(let b=0;b<8;b++)for(let sa=0;sa<8;sa++)for(let sb=0;sb<8;sb++)counts[families.indexOf(colorInfo(recipes(a,b,sa,sb)).visible)]++;
  assert.ok(counts.every(n=>n===512),'uniform recipes and strengths give every family exactly equal representation');
});
test('lost copies do not reappear without mutation, while mutation changes transmitted copies',()=>{
  const lab=trial(3),[a,b]=lab.population;
  a.genes=b.genes=[[128,128],[128,128],[128,128]];
  a.switches=b.switches=Array.from({length:6},()=>[0,0]);
  const before=structuredClone([a,b]);
  const plain=Array.from({length:100},()=>lab.offspring(a,b,0));
  assert.ok(plain.every(c=>colorInfo(c.switches).visible==='green'));
  const mutated=Array.from({length:100},()=>lab.offspring(a,b,1));
  assert.ok(mutated.every(c=>c.mutations===18&&c.colorMutations===12));
  assert.ok(mutated.every(c=>colorInfo(c.switches).visible==='mixed'));
  assert.deepEqual([a,b],before);
  for(let g=0;g<50;g++)lab.commit(lab.plan({...config,mutationRate:1}));
  assert.ok(lab.living().flatMap(c=>c.genes.flat()).every(v=>Number.isInteger(v)&&v>=0&&v<=255));
  assert.ok(lab.living().flatMap(c=>c.switches.flat()).every(v=>v===0||v===1));
});
test('one complete jar replaces exactly its row and increments only its row generation', () => {
  const lab = trial(42), before = lab.population.slice(), pairs = emptyJars(lab);
  pairs[2] = [before[0].id,before[1].id];
  const plan = lab.planRows({pairs,mutationRate:0});
  assert.deepEqual(lab.population,before);
  assert.deepEqual(plan.updatedRows,[2]);
  assert.equal(plan.families[0].row,2);
  plan.children.forEach((b,i)=> {
    if (i>=16&&i<24) { assert.deepEqual(b.parents,pairs[2]); assert.ok(cross(before[0],before[1]).colors.some(c=>c.color===hex(b.color))); }
    else assert.equal(b,before[i]);
  });
  lab.commit(plan);
  assert.equal(lab.generation,1);
  assert.deepEqual(lab.rowGenerations,[0,0,1,0,0,0]);
  const next = emptyJars(lab); next[0]=lab.population.slice(0,2).map(b=>b.id);
  lab.commit(lab.planRows({pairs:next,mutationRate:0}));
  assert.deepEqual(lab.rowGenerations,[1,0,1,0,0,0]);
});
test('empty jars do nothing, consume no randomness and retain all beetle identities', () => {
  const a = trial(42), b = trial(42), before=a.population.slice(), id=a.nextId;
  a.commit(a.planRows({pairs:emptyJars(a),mutationRate:1}));
  assert.equal(a.generation,0);assert.equal(a.nextId,id);
  a.population.forEach((item,i)=>assert.equal(item,before[i]));
  assert.deepEqual(a.plan(config),b.plan(config));
});
test('incomplete, duplicate and stale parents are rejected before any row is generated', () => {
  const a = trial(42), b = trial(42);
  for (const bad of [[1],[1,1],[1,99999]]) {
    const pairs=emptyJars(a);pairs[0]=[1,2];pairs[4]=bad;
    assert.throws(()=>a.planRows({pairs,mutationRate:0}));
  }
  assert.throws(()=>a.planRows({pairs:[],mutationRate:0}));
  assert.deepEqual(a.plan(config),b.plan(config));
});
test('bird-mode offspring use the shared pool of living survivors across every row',()=>{
  const lab=trial(42);
  for(let generation=0;generation<30;generation++){
    const old=lab.population.slice(), before=lab.rowGenerations.slice(), plan=lab.plan(config);
    const survivorIds=new Set(plan.breeders.map(b=>b.id));
    assert.equal(plan.eaten,old.filter(Boolean).length-plan.breeders.length);
    for(let row=0;row<6;row++){
      const oldIds=new Set(old.slice(row*8,row*8+8).filter(Boolean).map(b=>b.id));
      assert.equal(plan.survivorCounts[row],plan.breeders.filter(b=>oldIds.has(b.id)).length);
    }
    if(plan.breeders.length>=2){
      assert.equal(plan.births.length,48);
      plan.births.forEach(c=>{assert.ok(c.parents.every(id=>survivorIds.has(id)));assert.notEqual(c.parents[0],c.parents[1]);c.parents.forEach((id,i)=>assert.equal(c.parentRows[i],Math.floor(old.findIndex(b=>b?.id===id)/8)));});
      assert.equal(plan.crossRowBirths,plan.births.filter(c=>c.parentRows[0]!==c.parentRows[1]).length);
    }else assert.deepEqual(plan.children.filter(Boolean),plan.breeders);
    lab.commit(plan);
    assert.equal(lab.population.length,48);
    assert.equal(new Set(lab.living().map(b=>b.id)).size,lab.size);
    before.forEach((g,row)=>assert.equal(lab.rowGenerations[row],g+(plan.updatedRows.includes(row)?1:0)));
  }
});
test('two survivors from different rows can repopulate the whole board together',()=>{
  const lab=trial(42,24),parents=[lab.population[2],lab.population[17]];let rolls=0;
  lab.survivalRng=()=>[3,18].includes(++rolls)?0:.999;lab.rng=()=>.25;
  const plan=lab.plan({...config,mutationRate:0});
  assert.deepEqual(plan.breeders,parents);assert.deepEqual(plan.survivorCounts,[1,0,1]);
  assert.equal(plan.births.length,24);assert.equal(plan.crossRowBirths,24);
  plan.births.forEach(c=>{assert.deepEqual(new Set(c.parents),new Set(parents.map(b=>b.id)));assert.deepEqual(new Set(c.parentRows),new Set([0,2]));});
  lab.commit(plan);assert.equal(lab.size,24);assert.deepEqual(lab.rowGenerations,[1,1,1]);
});
test('a shared survivor pair refills empty rows, while a lone survivor does not invent a partner',()=>{
  const lab=trial(42,24),parents=lab.population.slice(0,2);lab.population.fill(null);lab.population[0]=parents[0];lab.population[1]=parents[1];lab.survivalRng=()=>0;
  const plan=lab.plan({...config,mutationRate:0});assert.equal(plan.births.length,24);assert.deepEqual(plan.updatedRows,[0,1,2]);assert.equal(plan.crossRowBirths,0);
  lab.population[0]=null;const lone=lab.plan(config);assert.equal(lone.births.length,0);assert.equal(lone.children[1],parents[1]);assert.equal(lone.children.filter(Boolean).length,1);
});
test('each insect uses exactly one roll, with no quota or rerolls',()=>{
  const lab=trial(9,8),rolls=[.1,.8,.69,.7,.5,.9,0,.99];let calls=0;
  lab.survivalRng=()=>rolls[calls++];
  const survivors=lab.select([0,0,0],0);
  assert.equal(calls,8);
  assert.deepEqual(survivors.map(b=>b.id),[1,3,5,7]);
  lab.survivalRng=()=>0;assert.equal(lab.select([0,0,0],0).length,8);
  lab.survivalRng=()=>.999;assert.equal(lab.select([0,0,0],0).length,0);
});
test('survivor counts vary between trials instead of fixing how many the bird eats',()=>{
  const counts=new Set();
  for(let seed=1;seed<=200;seed++)counts.add(trial(seed,8).select(config.habitat,0).length);
  assert.ok(counts.size>=5,`Survivor counts: ${[...counts]}`);
});
test('contrast changes an individual chance; zero selection gives every color 70%',()=>{
  assert.equal(survivalChance([0,0,0],[0,0,0],0),.7);
  assert.equal(survivalChance([255,255,255],[0,0,0],0),.7);
  assert.ok(Math.abs(survivalChance([0,0,0],[0,0,0],1)-.9)<1e-12);
  assert.ok(survivalChance([255,255,255],[0,0,0],1)<.101);
  const count=pressure=>{
    let matching=0;
    for(let seed=1;seed<=100;seed++){
      const lab=trial(seed);lab.population.forEach((b,i)=>b.color=i<24?[0,0,0]:[255,255,255]);
      matching+=lab.select([0,0,0],pressure).filter(b=>b.color[0]===0).length;
    }
    return matching;
  };
  const neutral=count(0),selected=count(1);
  assert.ok(neutral>1500&&neutral<1850,`Neutral matching survivors ${neutral}/2400`);
  assert.ok(selected>neutral+350,`Selected matching survivors ${selected}/2400`);
});
test('zero survivors leaves an empty row, with no fabricated breeders or offspring',()=>{
  const lab=trial(42,8);lab.survivalRng=()=>.999;
  const plan=lab.plan(config);
  assert.equal(plan.breeders.length,0);assert.equal(plan.eaten,8);assert.equal(plan.births.length,0);
  lab.commit(plan);assert.equal(lab.size,0);assert.ok(lab.population.every(b=>b===null));
  assert.deepEqual(lab.rowGenerations,[1]);
  assert.deepEqual(lab.stats(config.habitat),{count:0,mean:[0,0,0],match:0,diversity:0});
  const next=lab.plan(config);assert.deepEqual(next.updatedRows,[]);lab.commit(next);assert.equal(lab.generation,1);
});
test('a single survivor stays on the same leaf without producing offspring',()=>{
  const lab=trial(42,8),original=lab.population[5];let calls=0;
  lab.survivalRng=()=>calls++===5?0:.999;
  const plan=lab.plan(config);assert.equal(calls,8);assert.equal(plan.births.length,0);
  assert.equal(plan.children[5],original);assert.equal(plan.children.filter(Boolean).length,1);
  lab.commit(plan);assert.equal(lab.size,1);
});
test('saved jar parents produce successive broods of the original pair',()=>{
  const lab=trial(3,16),parents=lab.population.slice(0,2),saved=structuredClone(parents),archive=new Map(parents.map(b=>[b.id,b]));
  const pairs=[[parents[0].id,parents[1].id],[]],otherRow=lab.population.slice(8);
  for(let brood=0;brood<10;brood++){
    const plan=lab.planRows({pairs,mutationRate:0,parentArchive:archive});
    assert.equal(plan.births.length,8);assert.ok(plan.births.every(b=>JSON.stringify(b.parents)===JSON.stringify(pairs[0])));
    lab.commit(plan);assert.deepEqual(lab.population.slice(8),otherRow);
  }
  assert.deepEqual(parents,saved);assert.equal(lab.generation,10);
  assert.throws(()=>lab.planRows({pairs,mutationRate:0}));
});
test('a saved pair can repopulate an empty row when breeding is allowed',()=>{
  const lab=trial(42,8),parents=lab.population.slice(0,2),archive=new Map(parents.map(b=>[b.id,b]));
  lab.survivalRng=()=>.999;lab.commit(lab.plan(config));assert.equal(lab.size,0);
  lab.commit(lab.planRows({pairs:[parents.map(b=>b.id)],mutationRate:0,parentArchive:archive}));
  assert.equal(lab.size,8);assert.ok(lab.living().every(b=>b.parents.every(id=>archive.has(id))));
});
test('Neapolitan uses the third directly behind each leaf, repeating for every row',()=>{
  const habitats=[[0,0,0],[255,255,255],[255,0,255]];
  const expected=[0,0,0,1,1,2,2,2];
  for(let slot=0;slot<24;slot++)assert.equal(habitatAt(habitats,slot,8),habitats[expected[slot%8]]);
  const lab=trial(7,16);lab.population.forEach(b=>b.color=[0,0,0]);lab.survivalRng=()=>.5;
  assert.deepEqual(lab.select(habitats,1).map(b=>b.id),[1,2,3,9,10,11]);
  lab.population.forEach((b,i)=>b.color=habitatAt(habitats,i));
  assert.equal(lab.stats(habitats).match,100);assert.equal(lab.select(habitats,1).length,16);
});
test('selection improves camouflage across trials compared with drift', () => {
  let selected=0,neutral=0,selectedDistance=0,neutralDistance=0;
  for(let seed=1;seed<=30;seed++) for(const pressure of [0,.95]) {
    const lab=trial(seed);
    for(let g=0;g<30;g++)lab.commit(lab.plan({...config,pressure}));
    const meanDistance=lab.living().reduce((sum,b)=>sum+distance2(b.color,config.habitat),0)/lab.size;
    if(pressure){selected+=lab.stats(config.habitat).match;selectedDistance+=meanDistance;}else{neutral+=lab.stats(config.habitat).match;neutralDistance+=meanDistance;}
  }
  assert.ok(selected>neutral,`Selected camouflage ${selected/30}; neutral ${neutral/30}`);
  assert.ok(selectedDistance<neutralDistance*.75,`Selected color distance ${selectedDistance/30}; neutral ${neutralDistance/30}`);
});
test('classroom scenarios carry inherited possibilities while initially looking green',()=>{
  for(let rows=1;rows<=6;rows++)for(const scenario of ['blue','warm']) {
    const lab=trial(17,rows*8,8,scenario);
    assert.equal(lab.population.length,rows*8);
    assert.ok(lab.population.every(b=>colorInfo(b.switches).visible==='green'));
    const chances=cross(lab.population[0],lab.population[1]).pigmentChances;
    assert.ok(chances.some(c=>(scenario==='blue'?c.pigment==='blue':['red','yellow'].includes(c.pigment))&&c.probability>0));
    assert.equal(chances.some(c=>c.pigment===(scenario==='blue'?'red':'blue')),false);
  }
});

test('a restart keeps seeded beetles but uses fresh survival rolls from the ongoing random source',()=>{
  const original=Math.random;let calls=0;
  try{
    Math.random=()=>calls++<8 ? .1 : .9;
    const first=new Lab(42,8),restart=new Lab(42,8);
    assert.deepEqual(first.population,restart.population);
    assert.equal(calls,0,'constructing starting beetles must not consume survival rolls');
    assert.equal(first.select(config.habitat,0).length,8);
    assert.equal(restart.select(config.habitat,0).length,0);
    assert.equal(calls,16,'each insect gets its own fresh roll across restarts');
    assert.equal(first.select(config.habitat,0).length,0);
    assert.equal(calls,24,'a later hunt rolls every insect again');
  }finally{Math.random=original;}
});

test('individual hunt rolls are deferred until checked and completed survivors are not rolled twice',()=>{
  const lab=trial(42,16);let calls=0;lab.survivalRng=()=>calls++%2? .9:.1;
  const survivors=[];
  assert.equal(calls,0);
  for(const beetle of lab.living()){
    const before=calls;if(lab.rollSurvival(beetle,config.habitat,0))survivors.push(beetle);
    assert.equal(calls,before+1);
  }
  const plan=lab.plan({...config,survivors});
  assert.equal(calls,16,'making offspring must not reroll completed survival checks');
  assert.deepEqual(plan.breeders,survivors);assert.equal(plan.eaten,8);assert.equal(plan.births.length,16);
  assert.throws(()=>lab.plan({...config,survivors:[survivors[0],survivors[0]]}));
  assert.throws(()=>lab.plan({...config,survivors:[{id:999}]}));
});
test('red backgrounds give red beetles a meaningful advantage and favor red over repeated trials',()=>{
  const habitat=[255,0,0],redChance=survivalChance([190,95,76],habitat,.8),greenChance=survivalChance([122,156,80],habitat,.8);
  assert.ok(redChance>greenChance+.15);
  let red=0,green=0,neutralRed=0;
  for(let seed=1;seed<=40;seed++)for(const pressure of [0,.8]){
    const lab=trial(seed);
    for(let generation=0;generation<50;generation++)lab.commit(lab.plan({habitat,pressure,mutationRate:.03}));
    assert.ok(lab.size);
    const fraction=color=>lab.living().filter(b=>colorInfo(b.switches).visible===color).length/lab.size;
    if(pressure){red+=fraction('red');green+=fraction('green');}else neutralRed+=fraction('red');
  }
  assert.ok(red>green+4,`red=${red/40}, green=${green/40}`);
  assert.ok(red>neutralRed+10,`selected red=${red/40}, neutral red=${neutralRed/40}`);
});


test('neighbor protection grows with contrast and fades as neighbors become alike',()=>{
  const hidden=[0,0,0],mild=[80,80,80],obvious=[255,255,255];
  const alone=localSurvival(hidden,hidden,1),uniform=localSurvival(hidden,hidden,1,[hidden,hidden,hidden,hidden]);
  assert.equal(alone.neighborBoost,0);assert.equal(uniform.neighborBoost,0);
  assert.ok(Math.abs(uniform.chance-.9)<1e-12,'ordinary camouflage remains when the extra boost disappears');
  const subtle=localSurvival(hidden,hidden,1,[mild]);
  const one=localSurvival(hidden,hidden,1,[obvious,hidden,hidden,hidden]);
  const two=localSurvival(hidden,hidden,1,[obvious,obvious,hidden,hidden]);
  const all=localSurvival(hidden,hidden,1,[obvious,obvious,obvious,obvious]);
  assert.ok(all.neighborBoost>subtle.neighborBoost);
  assert.ok(all.neighborBoost>two.neighborBoost&&two.neighborBoost>one.neighborBoost&&one.neighborBoost>uniform.neighborBoost);
  assert.ok(all.chance>.95&&all.chance<.96,'even maximum local protection still permits a beetle to be eaten');
  const poor=localSurvival(obvious,hidden,1,[obvious,obvious]);
  assert.equal(poor.neighborBoost,0);assert.ok(poor.chance<.101,'a uniform but contrasting population remains exposed');
});
test('neighbor protection vanishes with selection off and never guarantees survival',()=>{
  for(const color of [[0,0,0],[128,128,128],[255,255,255]])for(const pressure of [0,.25,.8,1]){
    const odds=localSurvival(color,[0,0,0],pressure,[[255,0,0],[255,255,255]]);
    assert.ok(odds.neighborBoost>=0);assert.ok(odds.chance>=odds.baseChance&&odds.chance<1);
    assert.ok(odds.neighborBoost<=(1-odds.baseChance)*.6+1e-12);
    if(!pressure){assert.equal(odds.chance,.7);assert.equal(odds.neighborBoost,0);}
  }
});
test('local protection uses all eight adjacent living leaves, including diagonals, without row wrapping',()=>{
  const lab=trial(42,24);lab.population.forEach(b=>b.color=[0,0,0]);
  const center=lab.population[11];assert.equal(lab.survivalDetails(center,[0,0,0],1).neighborCount,8);
  lab.population[23].color=[255,255,255];
  assert.equal(lab.survivalDetails(center,[0,0,0],1).neighborBoost,0,'distant leaves do not count');
  lab.population[2].color=[255,255,255];assert.ok(lab.survivalDetails(center,[0,0,0],1).neighborBoost>0,'diagonal neighbors count');
  lab.population[2]=null;const empty=lab.survivalDetails(center,[0,0,0],1);
  assert.equal(empty.neighborCount,7);assert.equal(empty.neighborBoost,0,'empty leaves cannot offer protection');
  lab.population[8].color=[255,255,255];const edge=lab.survivalDetails(lab.population[7],[0,0,0],1);
  assert.equal(edge.neighborCount,3);assert.equal(edge.neighborBoost,0,'the next row is not the right-hand neighbor');
  lab.population[14].color=[255,255,255];assert.ok(lab.survivalDetails(lab.population[7],[0,0,0],1).neighborBoost>0);
});
test('Neapolitan neighbor comparisons stay on the same habitat color',()=>{
  const habitats=[[0,0,0],[255,255,255],[255,0,255]],lab=trial(42,8);
  lab.population.forEach((b,i)=>b.color=habitatAt(habitats,i));
  for(const b of lab.living()){const odds=lab.survivalDetails(b,habitats,1);assert.equal(odds.neighborBoost,0);assert.ok(Math.abs(odds.chance-.9)<1e-12);}
  assert.equal(lab.survivalDetails(lab.population[2],habitats,1).neighborCount,1);
  assert.equal(lab.survivalDetails(lab.population[3],habitats,1).neighborCount,1);
  lab.population[1].color=[255,255,255];
  assert.ok(lab.survivalDetails(lab.population[2],habitats,1).neighborBoost>0);
  assert.equal(lab.survivalDetails(lab.population[3],habitats,1).neighborBoost,0);
  lab.population.forEach(b=>b.color=[0,0,0]);
  lab.living().forEach(b=>assert.equal(lab.survivalDetails(b,habitats,1).neighborBoost,0));
});
test('actual rolls include local protection without forecasting outcomes or changing odds during a hunt',()=>{
  const lab=trial(42,8);lab.population.forEach(b=>b.color=[255,255,255]);lab.population[3].color=[0,0,0];let calls=0;
  lab.survivalRng=()=>{calls++;return .93;};
  const odds=lab.living().map(b=>lab.survivalDetails(b,[0,0,0],1));
  assert.equal(calls,0,'inspecting probabilities must not roll any outcomes');
  assert.ok(odds[3].baseChance<.93&&odds[3].chance>.93);
  assert.deepEqual(lab.select([0,0,0],1).map(b=>b.id),[lab.population[3].id]);
  assert.equal(calls,8,'every insect gets one draw');
  assert.deepEqual(lab.living().map(b=>lab.survivalDetails(b,[0,0,0],1)),odds);
  assert.deepEqual(lab.select([0,0,0],1,lab.living().reverse()).map(b=>b.id),[lab.population[3].id]);
  assert.equal(calls,16);
});


test('camouflage treats every hue symmetrically and handles neutral colors',()=>{
  const colors=[[0,0,0],[255,255,255],[128,128,128],[127,128,128],...Object.values(PIGMENTS).map(p=>p.color)];
  const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const color of colors){
    assert.equal(match(color,color),1);assert.ok(Math.abs(survivalChance(color,color,1)-.9)<1e-12);
    for(const habitat of colors){
      const score=match(color,habitat);assert.ok(Number.isFinite(score)&&score>0&&score<=1);
      assert.ok(Math.abs(score-match(habitat,color))<1e-12);
      const neighbors=[[30,60,200],[240,90,20]],odds=localSurvival(color,habitat,.8,neighbors);
      for(const order of permutations){
        const turn=c=>order.map(i=>c[i]);
        assert.ok(Math.abs(match(turn(color),turn(habitat))-score)<1e-12);
        assert.ok(Math.abs(localSurvival(turn(color),turn(habitat),.8,neighbors.map(turn)).chance-odds.chance)<1e-12);
      }
    }
  }
});
test('the nearest reference family wins across primary and secondary background colors',()=>{
  const targets={red:[255,0,0],yellow:[255,255,0],green:[0,255,0],teal:[0,255,255],blue:[0,0,255],purple:[255,0,255]};
  for(const [family,background] of Object.entries(targets)){
    const ranked=Object.keys(PIGMENTS).sort((a,b)=>match(PIGMENTS[b].color,background)-match(PIGMENTS[a].color,background));
    assert.equal(ranked[0],family,`${family} background favored ${ranked[0]}`);
  }
  assert.ok(PIGMENTS.teal.color[1]>PIGMENTS.teal.color[0]+80&&PIGMENTS.teal.color[2]>PIGMENTS.teal.color[0]+80);
});
test('Dry leaves gives matching warm colors a clear advantage over green at normal strength',()=>{
  const habitat=fromHex('#b17b56'),green=survivalChance(PIGMENTS.green.color,habitat,.8);
  assert.ok(green<.5);
  assert.ok(survivalChance(PIGMENTS.red.color,habitat,.8)>green+.3);
  assert.ok(survivalChance(PIGMENTS.orange.color,habitat,.8)>green+.25);
  let greenCount=0,warmCount=0;
  for(let seed=1;seed<=20;seed++){
    const lab=trial(seed);for(let g=0;g<50;g++)lab.commit(lab.plan({habitat,pressure:.8,mutationRate:.03}));
    assert.ok(lab.size);
    greenCount+=lab.living().filter(b=>colorInfo(b.switches).visible==='green').length/lab.size;
    warmCount+=lab.living().filter(b=>['red','orange'].includes(colorInfo(b.switches).visible)).length/lab.size;
  }
  assert.ok(warmCount>greenCount+2,`warm=${warmCount/20}, green=${greenCount/20}`);
});
test('selection improves matching over neutral drift for all eight reference color environments',()=>{
  for(const [family,{color:habitat}] of Object.entries(PIGMENTS)){
    let selected=0,neutral=0;
    for(let seed=1;seed<=12;seed++)for(const pressure of [0,.8]){
      const lab=trial(seed);for(let g=0;g<40;g++)lab.commit(lab.plan({habitat,pressure,mutationRate:.03}));
      assert.ok(lab.size,`${family} trial became empty`);
      if(pressure)selected+=lab.stats(habitat).match;else neutral+=lab.stats(habitat).match;
    }
    assert.ok(selected>neutral+60,`${family}: selected=${selected/12}, neutral=${neutral/12}`);
  }
});


test('mating includes diagonals, second rings, and decreasing farther-ring chances without wrapping',()=>{
  const lab=trial(42),counts=Array(8).fill(0);
  assert.equal(gridDistance(7,8),7);assert.equal(gridDistance(9,18),1);assert.equal(gridDistance(9,27),2);
  for(let round=0;round<160;round++){
    const plan=lab.plan({...config,survivors:lab.living(),mutationRate:0});
    assert.equal(plan.nearbyBirths+plan.fartherBirths,lab.capacity);
    plan.births.forEach((child,slot)=>{
      assert.equal(child.parentSlots[0],slot,'a surviving parent retains its own leaf');
      assert.equal(child.dispersalDistance,0);
      assert.equal(child.mateDistance,gridDistance(...child.parentSlots));
      assert.notEqual(child.parents[0],child.parents[1]);counts[child.mateDistance]++;
    });
  }
  assert.ok(counts[1]>counts[2]*1.6&&counts[2]>counts[3]*1.6,JSON.stringify(counts));
  assert.ok(counts[3]>counts[4]&&counts[4]>counts[5]&&counts[5]>counts[6]&&counts[6]>counts[7]);
  assert.ok(counts[7]>0,'distant mates remain possible');
});
test('vacant leaves use nearest survivors and allow reproduction across habitat boundaries',()=>{
  const lab=trial(2,24),survivors=[lab.population[0],lab.population[23]],habitat=['#8fa967','#b17b56','#7785a1'].map(fromHex);
  const plan=lab.plan({...config,habitat,survivors});
  plan.births.forEach((child,slot)=>{
    const nearest=Math.min(...[0,23].map(parent=>gridDistance(slot,parent)));
    assert.equal(child.dispersalDistance,nearest);assert.equal(gridDistance(slot,child.parentSlots[0]),nearest);
    assert.deepEqual(new Set(child.parents),new Set(survivors.map(b=>b.id)));
  });
  assert.equal(plan.crossHabitatBirths,24);
});
test('Dusk and Neapolitan favor local colors without forcing a sorted board',()=>{
  const habitat=['#8fa967','#b17b56','#7785a1'].map(fromHex);
  assert.ok(survivalChance(PIGMENTS.blue.color,habitat[2],.8)>survivalChance(PIGMENTS.green.color,habitat[2],.8)+.4);
  const bands=Array.from({length:3},()=>({n:0,green:0,blue:0,warm:0,match:0,shuffled:0}));
  for(let seed=1;seed<=16;seed++){
    const lab=trial(seed);for(let g=0;g<60;g++)lab.commit(lab.plan({habitat,pressure:.8,mutationRate:.03}));
    lab.population.forEach((b,slot)=>{if(!b)return;const r=bands[Math.floor(((slot%8)+.5)/8*3)],family=appearance(b.color);
      r.n++;r.green+=family==='green';r.blue+=family==='blue';r.warm+=['red','orange','yellow'].includes(family);r.match+=match(b.color,habitatAt(habitat,slot));r.shuffled+=habitat.reduce((n,bg)=>n+match(b.color,bg),0)/3;
    });
  }
  bands.forEach(r=>{for(const key of ['green','blue','warm','match','shuffled'])r[key]/=r.n;});
  assert.ok(bands[0].green>bands[1].green+.15&&bands[0].green>bands[2].green+.15,JSON.stringify(bands));
  assert.ok(bands[2].blue>bands[1].blue+.2&&bands[2].blue>bands[0].blue+.2,JSON.stringify(bands));
  assert.ok(bands[1].warm>bands[0].warm+.2&&bands[1].warm>bands[2].warm+.2,JSON.stringify(bands));
  assert.ok(bands[1].match>.65,JSON.stringify(bands));
  assert.ok(bands.reduce((n,r)=>n+r.match-r.shuffled,0)>.5,JSON.stringify(bands));
});


test('shade genes can reach every sampled RGB target from every inherited recipe',()=>{
  const levels=[0,32,64,128,192,224,255];
  for(let mask=0;mask<8;mask++)for(const r of levels)for(const g of levels)for(const b of levels){
    const target=[r,g,b],base=Object.values(PIGMENTS)[mask].color;
    const genes=target.map((value,i)=>{const shade=value<=base[i]?128*value/base[i]:128+127*(value-base[i])/(255-base[i]);const encoded=Math.round(shade*2)/2;return [Math.floor(encoded),Math.ceil(encoded)];});
    const color=phenotype(genes,recipes(mask,mask));
    color.forEach((value,i)=>assert.ok(Math.abs(value-target[i])<=.5,`${mask}: ${color} versus ${target}`));
  }
  for(let mask=0;mask<8;mask++){
    assert.deepEqual(phenotype([[0,0],[0,0],[0,0]],recipes(mask,mask)),[0,0,0]);
    assert.deepEqual(phenotype([[255,255],[255,255],[255,255]],recipes(mask,mask)),[255,255,255]);
  }
});
test('visible color names and cross forecasts include inherited black, white, and gray shades',()=>{
  assert.equal(appearance([0,0,0]),'black');assert.equal(appearance([255,255,255]),'white');assert.equal(appearance([128,128,128]),'gray');
  for(const [family,{color}] of Object.entries(PIGMENTS))assert.equal(appearance(color),family);
  const lab=trial(1),[a,b]=lab.population;
  a.switches=b.switches=recipes(0,0);
  for(const value of [0,255]){
    a.genes=b.genes=[[value,value],[value,value],[value,value]];
    const family=value?'white':'black';assert.deepEqual(cross(a,b).pigmentChances,[{pigment:family,probability:1}]);
    for(let i=0;i<30;i++)assert.equal(appearance(lab.offspring(a,b,0).color),family);
  }
});
test('distance weight belongs to each beetle, including a sparse farther ring',()=>{
  for(let distance=1;distance<7;distance++)assert.ok(mateWeight(distance)>mateWeight(distance+1)&&mateWeight(distance+1)>0);
  const lab=trial(42),center=18,nearby=adjacentSlots(center,48),farther=20;
  const survivors=[lab.population[center],...nearby.map(i=>lab.population[i]),lab.population[farther]],counts=new Map();
  for(let i=0;i<2400;i++){
    const child=lab.plan({...config,pressure:0,mutationRate:0,survivors}).children[center];
    counts.set(child.parentSlots[1],(counts.get(child.parentSlots[1])||0)+1);
  }
  assert.ok(nearby.every(slot=>counts.get(slot)>counts.get(farther)*2),JSON.stringify([...counts]));
  const expectedFar=.25/(8+.25);assert.ok(Math.abs(counts.get(farther)/2400-expectedFar)<.015);
});
test('habitat crossing is symmetric and reduced continuously without blocking any partner',()=>{
  const backgrounds=['#8fa967','#b17b56','#7785a1','#000000','#ffffff'].map(fromHex);
  for(const a of backgrounds)for(const b of backgrounds){
    assert.ok(habitatAffinity(a,b)>=.05&&habitatAffinity(a,b)<=1);
    assert.equal(habitatAffinity(a,a),1);assert.equal(habitatAffinity(a,b),habitatAffinity(b,a));
  }
  assert.ok(habitatAffinity(backgrounds[0],backgrounds[1])<.1);
  const close=[...backgrounds[0]];close[0]++;assert.ok(habitatAffinity(backgrounds[0],close)>.99);
});
