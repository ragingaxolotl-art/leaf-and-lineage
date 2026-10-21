'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Lab, phenotype, fromHex, cross, hex, pigmentInfo, PIGMENTS } = require('../dist/simulation.js');
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
test('without mutation a child inherits one shade copy and one color allele from each parent', () => {
  const lab = new Lab(1), [a, b] = lab.population;
  a.genes = [[10, 20], [30, 40], [50, 60]];
  b.genes = [[100, 120], [130, 140], [150, 160]];
  a.pigments = ['green', 'red']; b.pigments = ['blue', 'yellow'];
  for (let i = 0; i < 300; i++) {
    const child = lab.offspring(a, b, 0);
    child.genes.forEach((pair, locus) => { assert.ok(a.genes[locus].includes(pair[0])); assert.ok(b.genes[locus].includes(pair[1])); });
    assert.ok(a.pigments.includes(child.pigments[0])); assert.ok(b.pigments.includes(child.pigments[1]));
    assert.equal(child.mutations, 0); assert.equal(child.pigmentMutations, 0);
    assert.deepEqual(child.color, phenotype(child.genes, child.pigments));
  }
});
test('hidden colors follow the invented dominance rules and carrier crosses', () => {
  const lab = new Lab(3), [a,b] = lab.population;
  for (const hidden of ['blue', 'yellow', 'red']) {
    a.pigments = b.pigments = ['green', hidden];
    assert.deepEqual(pigmentInfo(a.pigments), { visible: 'green', hidden });
    const probabilities = Object.fromEntries(cross(a,b).pigmentChances.map(c => [c.pigment,c.probability]));
    assert.deepEqual(probabilities, { green: .75, [hidden]: .25 });
  }
  assert.deepEqual(pigmentInfo(['red','yellow']), {visible:'yellow',hidden:'red'});
  assert.deepEqual(pigmentInfo(['red','red']), {visible:'red',hidden:null});
});
test('actual independent offspring draws follow the carrier prediction without requiring exact sibling ratios', () => {
  const lab = new Lab(42), [a,b] = lab.population;
  const children = Array.from({length:4000}, () => lab.offspring(a,b,0));
  const blue = children.filter(c => pigmentInfo(c.pigments).visible === 'blue').length;
  assert.ok(blue > 900 && blue < 1100, `Blue offspring: ${blue}/4000`);
  assert.ok(children.every(c => c.pigments.every(p => ['green','blue'].includes(p))));
});
test('cross enumerates 256 transmissions, groups duplicate colors and calculates the actual expected mean', () => {
  const a = {genes:[[10,40],[20,50],[30,60]],pigments:['green','blue']};
  const b = {genes:[[100,160],[110,170],[120,180]],pigments:['green','red']};
  const prediction = cross(a,b);
  assert.equal(prediction.combinations.length,256);
  assert.equal(prediction.colors.reduce((sum,c)=>sum+c.probability,0),1);
  assert.equal(prediction.pigmentChances.reduce((sum,c)=>sum+c.probability,0),1);
  assert.deepEqual(prediction.loci[0].map(c=>c.value),[55,85,70,100]);
  prediction.mean.forEach((v,locus)=>assert.equal(v,prediction.combinations.reduce((sum,c)=>sum+c[locus],0)/256));
  const identical = {genes:[[128,128],[128,128],[128,128]],pigments:['red','red']};
  assert.equal(cross(identical,identical).colors.length,1);
  assert.equal(cross(identical,identical).colors[0].probability,1);
});
test('mutations can introduce yellow, blue or red, keep shade bounds, and leave parents unchanged', () => {
  const lab = new Lab(3), [a,b] = lab.population;
  a.genes = b.genes = [[128,128],[128,128],[128,128]];
  a.pigments = b.pigments = ['green','green'];
  const before = structuredClone([a,b]);
  const children = Array.from({length:200}, () => lab.offspring(a,b,1));
  assert.ok(children.every(c=>c.mutations === 8 && c.pigmentMutations === 2));
  assert.deepEqual(new Set(children.flatMap(c=>c.pigments)), new Set(['yellow','blue','red']));
  assert.ok(children.flatMap(c=>c.genes.flat()).some(v=>v<128));
  assert.ok(children.flatMap(c=>c.genes.flat()).some(v=>v>128));
  assert.deepEqual([a,b],before);
  for (let i=0;i<50;i++) lab.commit(lab.plan({...config,mutationRate:1}));
  assert.ok(lab.population.flatMap(c=>c.genes.flat()).every(v=>Number.isInteger(v)&&v>=0&&v<=255));
  assert.ok(lab.population.flatMap(c=>c.pigments).every(p=>PIGMENTS[p]));
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
test('classroom populations support one to six rows and hidden color starting scenarios', () => {
  for(let rows=1;rows<=6;rows++) {
    const blue=new Lab(17,rows*8,8,'blue'), warm=new Lab(17,rows*8,8,'warm');
    assert.equal(blue.population.length,rows*8);
    assert.ok(blue.population.every(b=>pigmentInfo(b.pigments).visible==='green'&&pigmentInfo(b.pigments).hidden==='blue'));
    assert.ok(warm.population.every(b=>pigmentInfo(b.pigments).visible==='green'&&['yellow','red'].includes(pigmentInfo(b.pigments).hidden)));
  }
});
