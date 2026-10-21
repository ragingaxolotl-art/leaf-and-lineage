'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Lab, phenotype, fromHex, cross, hex, colorInfo, PIGMENTS } = require('../dist/simulation.js');
const config = { habitat: fromHex('#8fa967'), pressure: .8, mutationRate: .03 };
const emptyJars = lab => Array.from({ length: lab.rows }, () => []);

test('same seed and presets reproduce starting and subsequent populations', () => {
  const a = new Lab(42, 24, 8, 'warm'), b = new Lab(42, 24, 8, 'warm');
  assert.deepEqual(a.population, b.population);
  for (let g = 0; g < 15; g++) { a.commit(a.plan(config)); b.commit(b.plan(config)); }
  assert.deepEqual(a.population, b.population);
  assert.deepEqual(a.rowGenerations, [15, 15, 15]);
});
test('habitat measurements never change existing genes or colors', () => {
  const lab = new Lab(7), before = structuredClone(lab.population);
  assert.notEqual(lab.stats([20, 160, 30]).match, lab.stats([160, 20, 200]).match);
  assert.deepEqual(lab.population, before);
});
test('without mutation a child inherits one copy of each shade and color gene from each parent', () => {
  const lab = new Lab(1), [a, b] = lab.population;
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
  const lab = new Lab(42), [a,b] = lab.population;
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
  const lab=new Lab(75),[a,b]=lab.population;
  const child=Array.from({length:100},()=>lab.offspring(a,b,0)).find(c=>colorInfo(c.switches).visible==='green'&&c.switches.every(pair=>pair[0]!==pair[1]));
  assert.ok(child);
  const grandchildren=Array.from({length:1000},()=>lab.offspring(child,a,0));
  assert.ok(grandchildren.some(c=>colorInfo(c.switches).visible==='red'));
  assert.ok(grandchildren.some(c=>colorInfo(c.switches).visible==='yellow'));
  grandchildren.forEach(c=>c.switches.forEach((pair,i)=>{assert.ok(child.switches[i].includes(pair[0]));assert.ok(a.switches[i].includes(pair[1]));}));
});
test('teacher probabilities match exhaustive inheritance of all six interacting genes',()=>{
  const lab=new Lab(7),[a,b]=lab.population;
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
  const lab=new Lab(3),[a,b]=lab.population;
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
  assert.ok(lab.population.flatMap(c=>c.genes.flat()).every(v=>Number.isInteger(v)&&v>=0&&v<=255));
  assert.ok(lab.population.flatMap(c=>c.switches.flat()).every(v=>v===0||v===1));
});
test('one complete jar replaces exactly its row and increments only its row generation', () => {
  const lab = new Lab(42), before = lab.population.slice(), pairs = emptyJars(lab);
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
  const a = new Lab(42), b = new Lab(42), before=a.population.slice(), id=a.nextId;
  a.commit(a.planRows({pairs:emptyJars(a),mutationRate:1}));
  assert.equal(a.generation,0);assert.equal(a.nextId,id);
  a.population.forEach((item,i)=>assert.equal(item,before[i]));
  assert.deepEqual(a.plan(config),b.plan(config));
});
test('incomplete, duplicate and stale parents are rejected before any row is generated', () => {
  const a = new Lab(42), b = new Lab(42);
  for (const bad of [[1],[1,1],[1,99999]]) {
    const pairs=emptyJars(a);pairs[0]=[1,2];pairs[4]=bad;
    assert.throws(()=>a.planRows({pairs,mutationRate:0}));
  }
  assert.throws(()=>a.planRows({pairs:[],mutationRate:0}));
  assert.deepEqual(a.plan(config),b.plan(config));
});
test('natural selection takes four survivors per row and never mixes row parentage', () => {
  const lab = new Lab(42);
  for(let generation=0;generation<30;generation++) {
    const old=lab.population.slice(),plan=lab.plan(config);
    assert.equal(plan.breeders.length,24);
    for(let row=0;row<6;row++) {
      const ids=new Set(old.slice(row*8,row*8+8).map(b=>b.id));
      const survivors=plan.breeders.filter(b=>ids.has(b.id));
      assert.equal(survivors.length,4);
      const survivorIds=new Set(survivors.map(b=>b.id));
      plan.children.slice(row*8,row*8+8).forEach(c=>{assert.ok(c.parents.every(id=>survivorIds.has(id)));assert.notEqual(c.parents[0],c.parents[1]);});
    }
    lab.commit(plan);
    assert.equal(lab.population.length,48);
    assert.equal(new Set(lab.population.map(b=>b.id)).size,48);
    assert.deepEqual(lab.rowGenerations,Array(6).fill(generation+1));
  }
});
test('contrast affects survival under selection while zero pressure is neutral', () => {
  const count = pressure => {
    let retained=0;
    for(let seed=1;seed<=100;seed++) {
      const lab=new Lab(seed);lab.population.forEach((b,i)=>b.color=i<24?[0,0,0]:[255,255,255]);
      retained+=lab.select([0,0,0],pressure).filter(b=>b.color[0]===0).length;
    }
    return retained;
  };
  const neutral=count(0),strong=count(1);
  assert.ok(neutral>1050&&neutral<1350,`${neutral} neutral matching survivors`);
  assert.ok(strong>neutral+650,`${strong} selected matching survivors`);
});
test('selection improves camouflage across trials compared with drift', () => {
  let selected=0,neutral=0;
  for(let seed=1;seed<=30;seed++) for(const pressure of [0,.95]) {
    const lab=new Lab(seed);
    for(let g=0;g<30;g++)lab.commit(lab.plan({...config,pressure}));
    if(pressure)selected+=lab.stats(config.habitat).match;else neutral+=lab.stats(config.habitat).match;
  }
  assert.ok(selected/30 > neutral/30 + 5,`Selected ${selected/30}; neutral ${neutral/30}`);
});
test('classroom scenarios carry inherited possibilities while initially looking green',()=>{
  for(let rows=1;rows<=6;rows++)for(const scenario of ['blue','warm']) {
    const lab=new Lab(17,rows*8,8,scenario);
    assert.equal(lab.population.length,rows*8);
    assert.ok(lab.population.every(b=>colorInfo(b.switches).visible==='green'));
    const chances=cross(lab.population[0],lab.population[1]).pigmentChances;
    assert.ok(chances.some(c=>c.pigment===(scenario==='blue'?'blue':'red')&&c.probability>0));
    assert.equal(chances.some(c=>c.pigment===(scenario==='blue'?'red':'blue')),false);
  }
});
