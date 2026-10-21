'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Lab, phenotype, fromHex, cross, hex } = require('../dist/simulation.js');
const config = { habitat: fromHex('#8fa967'), pressure: .8, mutationRate: .03 };

test('fixed seed reproduces the initial population and later generations', () => {
  const a = new Lab(42), b = new Lab(42);
  for (let g = 0; g < 15; g++) { a.commit(a.plan(config)); b.commit(b.plan(config)); }
  assert.deepEqual(a.population, b.population);
  assert.equal(a.generation, 15);
});
test('changing the habitat changes match, never the current genes or colors', () => {
  const lab = new Lab(7), before = structuredClone(lab.population);
  const green = lab.stats([20, 160, 30]), purple = lab.stats([160, 20, 200]);
  assert.notEqual(green.match, purple.match);
  assert.deepEqual(lab.population, before);
});
test('without mutation every offspring receives one existing allele per locus from each parent', () => {
  const lab = new Lab(1);
  const a = lab.population[0], b = lab.population[1];
  a.genes = [[10, 20], [30, 40], [50, 60]];
  b.genes = [[100, 120], [130, 140], [150, 160]];
  for (let i = 0; i < 200; i++) {
    const child = lab.offspring(a, b, 0);
    child.genes.forEach((pair, locus) => {
      assert.ok(a.genes[locus].includes(pair[0]));
      assert.ok(b.genes[locus].includes(pair[1]));
    });
    assert.equal(child.mutations, 0);
    assert.deepEqual(child.color, phenotype(child.genes));
  }
});
test('selection is more likely to retain matching beetles, but zero pressure ignores color', () => {
  const count = pressure => {
    let retained = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const lab = new Lab(seed);
      lab.population.forEach((b, i) => { b.color = i < 24 ? [0, 0, 0] : [255, 255, 255]; });
      retained += lab.select([0, 0, 0], pressure).filter(b => b.color[0] === 0).length;
    }
    return retained;
  };
  const neutral = count(0), strong = count(1);
  assert.ok(neutral > 1050 && neutral < 1350, `Neutral matching survivors: ${neutral}/2400`);
  assert.ok(strong > neutral + 650, `Strong matching survivors: ${strong}/2400`);
});
test('random mutation introduces variation and keeps all alleles within bounds', () => {
  const lab = new Lab(3);
  const a = lab.population[0], b = lab.population[1];
  a.genes = b.genes = [[128, 128], [128, 128], [128, 128]];
  const children = Array.from({length: 100}, () => lab.offspring(a, b, 1));
  assert.ok(children.every(c => c.mutations === 6));
  assert.ok(children.flatMap(c => c.genes.flat()).some(v => v < 128));
  assert.ok(children.flatMap(c => c.genes.flat()).some(v => v > 128));
  for (let i = 0; i < 100; i++) lab.commit(lab.plan({ ...config, mutationRate: 1 }));
  assert.ok(lab.population.flatMap(c => c.genes.flat()).every(v => Number.isInteger(v) && v >= 0 && v <= 255));
});
test('manual breeding uses exactly the chosen parents; invalid choices are rejected', () => {
  const lab = new Lab(1), ids = lab.population.slice(0, 2).map(b => b.id);
  const plan = lab.plan({ ...config, parentIds: ids });
  assert.equal(plan.breeders.length, 2);
  assert.equal(plan.children.length, 48);
  assert.ok(plan.children.every(c => c.parents.every(id => ids.includes(id))));
  assert.throws(() => lab.plan({ ...config, parentIds: [ids[0], ids[0]] }));
  assert.throws(() => lab.plan({ ...config, parentIds: [99999, ids[0]] }));
});
test('population remains 48, survivor parents are from the preceding generation, and IDs are unique', () => {
  const lab = new Lab(42);
  for (let generation = 0; generation < 100; generation++) {
    const before = structuredClone(lab.population), oldIds = new Set(before.map(b => b.id));
    const plan = lab.plan(config);
    assert.equal(plan.breeders.length, 24);
    assert.equal(new Set(plan.breeders.map(b => b.id)).size, 24);
    assert.ok(plan.breeders.every(b => oldIds.has(b.id)));
    assert.ok(plan.children.every(b => b.parents.every(id => plan.breeders.some(p => p.id === id))));
    assert.deepEqual(lab.population, before);
    lab.commit(plan);
    assert.equal(lab.population.length, 48);
    assert.equal(new Set(lab.population.map(b => b.id)).size, 48);
    assert.equal(lab.generation, generation + 1);
  }
});
test('selection improves camouflage across independent trials relative to drift', () => {
  let selected = 0, neutral = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (const pressure of [0, .95]) {
      const lab = new Lab(seed);
      for (let g = 0; g < 30; g++) lab.commit(lab.plan({ ...config, pressure }));
      if (pressure) selected += lab.stats(config.habitat).match;
      else neutral += lab.stats(config.habitat).match;
    }
  }
  assert.ok(selected > neutral + 300, `Selected ${selected / 30}, neutral ${neutral / 30}`);
});

test('a cross has 64 equally likely transmissions, correct odds, and an expected mean', () => {
  const a = { genes: [[10, 40], [20, 50], [30, 60]] };
  const b = { genes: [[100, 160], [110, 170], [120, 180]] };
  a.color = phenotype(a.genes); b.color = phenotype(b.genes);
  const prediction = cross(a, b);
  assert.equal(prediction.combinations.length, 64);
  assert.equal(prediction.colors.reduce((sum, outcome) => sum + outcome.probability, 0), 1);
  assert.deepEqual(prediction.mean, a.color.map((v, i) => (v + b.color[i]) / 2));
  assert.deepEqual(prediction.loci[0].map(c => c.value), [55, 85, 70, 100]);
  prediction.mean.forEach((v, locus) => assert.equal(prediction.combinations.reduce((sum, c) => sum + c[locus], 0) / 64, v));
});
test('duplicate visible colors combine their probability, rather than becoming distinct outcomes', () => {
  const a = { genes: [[40, 40], [80, 80], [120, 120]], color: [40, 80, 120] };
  const prediction = cross(a, a);
  assert.equal(prediction.combinations.length, 64);
  assert.equal(prediction.colors.length, 1);
  assert.equal(prediction.colors[0].probability, 1);
});
test('each column has six siblings of its assigned pair, with independent inherited combinations', () => {
  const lab = new Lab(42);
  const pairs = Array.from({ length: 8 }, (_, i) => [lab.population[i].id, lab.population[i + 8].id]);
  const plan = lab.planColumns({ pairs, mutationRate: 0 });
  assert.equal(plan.families.length, 8);
  assert.equal(plan.children.length, 48);
  for (let column = 0; column < 8; column++) {
    const family = plan.families[column], children = plan.children.filter((_, i) => i % 8 === column);
    assert.equal(children.length, 6);
    const possible = new Set(cross(...family.parents).colors.map(c => c.color));
    children.forEach(b => {
      assert.deepEqual(b.parents, pairs[column]);
      assert.ok(possible.has(hex(b.color)));
      assert.equal(b.column, column);
      assert.equal(b.mutations, 0);
    });
  }
  assert.ok(plan.families.some((_, col) => new Set(plan.children.filter((_, i) => i % 8 === col).map(b => hex(b.color))).size > 1));
});
test('empty jars choose two distinct parents from their own column', () => {
  const lab = new Lab(15), before = structuredClone(lab.population);
  const pairs = Array.from({ length: 8 }, () => []);
  pairs[0] = [lab.population[6].id, lab.population[7].id];
  const plan = lab.planColumns({ pairs, mutationRate: .03 });
  for (let column = 1; column < 8; column++) {
    assert.notEqual(plan.families[column].parents[0].id, plan.families[column].parents[1].id);
    assert.ok(plan.families[column].parents.every(parent => before.findIndex(b => b.id === parent.id) % 8 === column));
    assert.equal(plan.families[column].chosen, false);
  }
  assert.equal(plan.families[0].chosen, true);
  assert.deepEqual(lab.population, before);
});
test('partial, duplicate, and stale jar parents are rejected before changing model state', () => {
  const lab = new Lab(42), beforeId = lab.nextId;
  const empty = () => Array.from({ length: 8 }, () => []);
  const partial = empty(); partial[2] = [1];
  const duplicate = empty(); duplicate[2] = [1, 1];
  const stale = empty(); stale[2] = [1, 99999];
  for (const pairs of [partial, duplicate, stale]) assert.throws(() => lab.planColumns({ pairs, mutationRate: 0 }));
  assert.equal(lab.nextId, beforeId);
  const comparison = new Lab(42);
  assert.deepEqual(lab.planColumns({ pairs: empty(), mutationRate: 0 }), comparison.planColumns({ pairs: empty(), mutationRate: 0 }));
});
test('reusing a pair across jars still generates separate offspring and does not mutate the parents', () => {
  const lab = new Lab(9), parents = lab.population.slice(0, 2), before = structuredClone(parents);
  const pairs = Array.from({ length: 8 }, () => parents.map(b => b.id));
  const plan = lab.planColumns({ pairs, mutationRate: 1 });
  assert.equal(new Set(plan.children.map(b => b.id)).size, 48);
  assert.ok(plan.children.every(b => b.mutations > 0));
  assert.deepEqual(parents, before);
  lab.commit(plan);
  assert.equal(lab.generation, 1);
  assert.equal(lab.population.length, 48);
});
