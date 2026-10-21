'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Lab, phenotype, fromHex, cross, hex, colorInfo, PIGMENTS, habitatAt, survivalChance, match, random, distance2 } = require('../dist/simulation.js');
const config = { habitat: fromHex('#8fa967'), pressure: .8, mutationRate: .03 };
const emptyJars = lab => Array.from({ length: lab.rows }, () => []);
// Inject predictable hunt rolls only in tests; the browser uses fresh randomness.
const trial = (...args) => { const lab = new Lab(...args); lab.survivalRng = random((args[0] ?? 42) ^ 0x51f15e); return lab; };

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
    assert.equal(child.mutations, 0); assert.equal(child.colorMutations, 0);
    assert.deepEqual(child.color, phenotype(child.genes, child.switches));
  }
});
test('similar green parents can produce rare contrasting offspring at zero mutation', () => {
  const lab = trial(42), [a,b] = lab.population;
  assert.equal(colorInfo(a.switches).visible,'green');
  assert.equal(colorInfo(b.switches).visible,'green');
  const prediction=cross(a,b);
  prediction.pathwayChances.forEach(p=>assert.equal(p.probability,1/16));
  assert.equal(prediction.pigmentChances.find(p=>p.pigment==='red').probability,225/4096);
  const children=Array.from({length:12000},()=>lab.offspring(a,b,0));
  for(const family of ['yellow','red','blue']) {
    const count=children.filter(c=>colorInfo(c.switches).visible===family).length;
    assert.ok(count>540&&count<780,`${family} offspring: ${count}/12000`);
  }
  assert.ok(children.every(c=>c.mutations===0));
});
test('inherited copies can pass through a green descendant and produce contrasting grandchildren',()=>{
  const lab=trial(75),[a,b]=lab.population;
  const child=Array.from({length:100},()=>lab.offspring(a,b,0)).find(c=>colorInfo(c.switches).visible==='green'&&c.switches.every(pair=>pair[0]!==pair[1]));
  assert.ok(child);
  const grandchildren=Array.from({length:1000},()=>lab.offspring(child,a,0));
  assert.ok(grandchildren.some(c=>colorInfo(c.switches).visible==='red'));
  assert.ok(grandchildren.some(c=>colorInfo(c.switches).visible==='yellow'));
  grandchildren.forEach(c=>c.switches.forEach((pair,i)=>{assert.ok(child.switches[i].includes(pair[0]));assert.ok(a.switches[i].includes(pair[1]));}));
});
test('teacher probabilities match exhaustive inheritance of all six interacting genes',()=>{
  const lab=trial(7),[a,b]=lab.population;
  a.switches=[[0,1],[1,1],[0,1],[1,0],[0,0],[1,1]];
  b.switches=[[1,1],[0,1],[1,0],[0,1],[1,1],[0,1]];
  const counts={};
  const visit=(locus,switches)=>{
    if(locus===6){const family=colorInfo(switches).visible;counts[family]=(counts[family]||0)+1;return;}
    for(const av of a.switches[locus])for(const bv of b.switches[locus])visit(locus+1,[...switches,[av,bv]]);
  };
  visit(0,[]);
  const prediction=cross(a,b);
  assert.equal(prediction.totalTransmissions,262144);
  assert.equal(prediction.pigmentChances.reduce((sum,c)=>sum+c.probability,0),1);
  prediction.pigmentChances.forEach(p=>assert.equal(p.probability,counts[p.pigment]/4096));
  assert.ok(Math.abs(prediction.colors.reduce((sum,c)=>sum+c.probability,0)-1)<1e-12);
  prediction.mean.forEach((v,i)=>assert.ok(Math.abs(v-prediction.outcomes.reduce((sum,o)=>sum+o.color[i]*o.probability,0))<1e-12));
});
test('pathways combine without a fixed dominance ranking',()=>{
  const switches=Array.from({length:6},()=>[1,1]);
  assert.equal(colorInfo(switches).visible,'mixed');
  assert.deepEqual(colorInfo(switches).active,[true,true,true]);
  switches[4]=[0,0];
  assert.equal(colorInfo(switches).visible,'orange');
  switches[0]=[0,0];switches[4]=[1,1];
  assert.equal(colorInfo(switches).visible,'purple');
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
    assert.ok(chances.some(c=>c.pigment===(scenario==='blue'?'blue':'red')&&c.probability>0));
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
