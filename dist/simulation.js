/* Leaf & Lineage — original, dependency-free teaching model. */
(function (root) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(255, n));
  // Original teaching model: interacting inherited switches, with no color ranking.
  const PATHWAYS = [
    { name: 'Yellow', effect: [87, 22, -15] },
    { name: 'Red', effect: [68, -61, -4] },
    { name: 'Blue', effect: [-19, -27, 102] }
  ];
  const familyKeys = ['green', 'yellow', 'red', 'orange', 'blue', 'teal', 'purple', 'mixed'];
  const PIGMENTS = Object.fromEntries(familyKeys.map((key, mask) => [key, {
    name: key[0].toUpperCase() + key.slice(1),
    color: [122, 156, 80].map((v, channel) => clamp(v + PATHWAYS.reduce((sum, pathway, i) => sum + (mask & (1 << i) ? pathway.effect[channel] : 0), 0)))
  }]));
  function random(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const shadeMean = genes => genes.map(pair => (pair[0] + pair[1]) / 2);
  const activePathways = switches => PATHWAYS.map((_, i) => switches.slice(i * 2, i * 2 + 2).every(pair => pair[0] === 1 && pair[1] === 1));
  function colorInfo(switches) {
    const active = activePathways(switches);
    return { visible: familyKeys[active.reduce((mask, on, i) => mask | (on ? 1 << i : 0), 0)], active };
  }
  function phenotype(genes, switches) {
    const shade = shadeMean(genes);
    const base = PIGMENTS[colorInfo(switches).visible].color;
    return base.map((v, i) => clamp(v + (shade[i] - 128) * .25));
  }
  const hex = rgb => '#' + rgb.map(v => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
  const fromHex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const distance2 = (a, b) => a.reduce((sum, v, i) => sum + ((v - b[i]) / 255) ** 2, 0) / 3;
  const match = (color, habitat) => Math.exp(-10 * distance2(color, habitat));
  function cross(a, b) {
    const loci = a.genes.map((pair, i) => pair.flatMap(av => b.genes[i].map(bv => ({ a: av, b: bv, value: (av + bv) / 2 }))));
    const homozygous = a.switches.map((pair, i) => (pair[0] + pair[1]) / 2 * (b.switches[i][0] + b.switches[i][1]) / 2);
    const pathwayChances = PATHWAYS.map((pathway, i) => ({ name: pathway.name, probability: homozygous[i * 2] * homozygous[i * 2 + 1] }));
    const pigmentChances = familyKeys.map((pigment, mask) => ({ pigment, probability: pathwayChances.reduce((p, pathway, i) => p * (mask & (1 << i) ? pathway.probability : 1 - pathway.probability), 1) })).filter(o => o.probability > 0);
    const outcomes = [], counts = new Map();
    for (const outcome of pigmentChances) for (const r of loci[0]) for (const g of loci[1]) for (const blue of loci[2]) {
      const base = PIGMENTS[outcome.pigment].color;
      const color = [r.value, g.value, blue.value].map((v, i) => clamp(base[i] + (v - 128) * .25));
      const probability = outcome.probability / 64, key = hex(color);
      outcomes.push({ color, probability }); counts.set(key, (counts.get(key) || 0) + probability);
    }
    return { loci, pathwayChances, pigmentChances, outcomes,
      totalTransmissions: 4 ** 9,
      colors: Array.from(counts, ([color, probability]) => ({ color, probability })),
      mean: [0, 1, 2].map(i => outcomes.reduce((sum, o) => sum + o.color[i] * o.probability, 0))
    };
  }
  class Lab {
    constructor(seed = 42, size = 48, rowSize = 8, scenario = 'mixed') {
      if (size % rowSize || rowSize < 4) throw new Error('Rows need at least four beetles and a whole number of populations.');
      this.seed = seed; this.size = size; this.rowSize = rowSize; this.rows = size / rowSize;
      this.rng = random(seed); this.generation = 0; this.nextId = 1;
      this.rowGenerations = Array(this.rows).fill(0);
      this.population = Array.from({ length: size }, (_, index) => {
        const base = [55 + this.rng() * 155, 65 + this.rng() * 140, 35 + this.rng() * 150];
        const genes = base.map(v => [clamp(Math.round(v + (this.rng() - .5) * 90)), clamp(Math.round(v + (this.rng() - .5) * 90))]);
        const switches = Array.from({ length: 6 }, () => [Number(this.rng() < .65), Number(this.rng() < .65)]);
        // These presets look green, but retain different combinations of ancestral switches.
        if (index < 2 || scenario !== 'mixed') {
          switches.forEach((pair, i) => { const varied = scenario === 'blue' ? i >= 4 : scenario === 'warm' ? i < 4 : true; pair.splice(0, 2, 0, varied ? 1 : 0); });
        }
        return this.beetle(genes, switches);
      });
    }
    beetle(genes, switches, parents = [], mutations = 0, colorMutations = 0) {
      return { id: this.nextId++, genes, switches, color: phenotype(genes, switches), parents, mutations, colorMutations };
    }
    offspring(a, b, mutationRate) {
      let mutations = 0, colorMutations = 0;
      const inheritShade = pair => {
        let value = pair[this.rng() < .5 ? 0 : 1];
        if (this.rng() < mutationRate) {
          const offset = (1 + Math.floor(this.rng() * 36)) * (this.rng() < .5 ? -1 : 1);
          const changed = clamp(value + offset);
          if (changed !== value) mutations++;
          value = changed;
        }
        return value;
      };
      const inheritSwitch = pair => {
        let value = pair[this.rng() < .5 ? 0 : 1];
        if (this.rng() < mutationRate) { value = 1 - value; mutations++; colorMutations++; }
        return value;
      };
      const genes = a.genes.map((pair, i) => [inheritShade(pair), inheritShade(b.genes[i])]);
      const switches = a.switches.map((pair, i) => [inheritSwitch(pair), inheritSwitch(b.switches[i])]);
      return this.beetle(genes, switches, [a.id, b.id], mutations, colorMutations);
    }
    select(habitat, pressure, pool = this.population) {
      const remaining = pool.slice(), survivors = [];
      while (survivors.length < Math.max(2, Math.floor(pool.length / 2))) {
        const weights = remaining.map(b => (1 - pressure) + pressure * (.015 + match(b.color, habitat) ** 2));
        let draw = this.rng() * weights.reduce((a, b) => a + b, 0), index = weights.length - 1;
        for (let i = 0; i < weights.length; i++) { draw -= weights[i]; if (draw <= 0) { index = i; break; } }
        survivors.push(remaining.splice(index, 1)[0]);
      }
      return survivors;
    }
    plan({ habitat, pressure, mutationRate }) {
      const children = [], breeders = [];
      for (let row = 0; row < this.rows; row++) {
        const pool = this.population.slice(row * this.rowSize, (row + 1) * this.rowSize);
        const parents = this.select(habitat, pressure, pool); breeders.push(...parents);
        for (let i = 0; i < this.rowSize; i++) {
          const a = Math.floor(this.rng() * parents.length);
          let b = Math.floor(this.rng() * (parents.length - 1)); if (b >= a) b++;
          children.push(this.offspring(parents[a], parents[b], mutationRate));
        }
      }
      return { breeders, children, updatedRows: Array.from({ length: this.rows }, (_, i) => i), families: [], mutations: children.reduce((n, b) => n + b.mutations, 0), mode: 'natural' };
    }
    planRows({ pairs, mutationRate }) {
      if (!Array.isArray(pairs) || pairs.length !== this.rows) throw new Error('Each row needs one jar.');
      pairs.forEach(ids => {
        if (!Array.isArray(ids) || (ids.length !== 0 && ids.length !== 2)) throw new Error('Choose two parents or leave this row alone.');
        if (ids.length && (ids[0] === ids[1] || ids.some(id => !this.population.some(b => b.id === id)))) throw new Error('Choose two different living beetles.');
      });
      const children = this.population.slice(), families = [], breeders = new Map(), updatedRows = [];
      let mutations = 0;
      pairs.forEach((ids, row) => {
        if (!ids.length) return; // Preserve every existing beetle and its genes in an empty row.
        const parents = ids.map(id => this.population.find(b => b.id === id));
        parents.forEach(b => breeders.set(b.id, b)); updatedRows.push(row);
        families.push({ row, parents, generation: this.rowGenerations[row] + 1, round: this.generation + 1 });
        for (let i = 0; i < this.rowSize; i++) {
          const child = this.offspring(parents[0], parents[1], mutationRate);
          children[row * this.rowSize + i] = child; mutations += child.mutations;
        }
      });
      return { breeders: Array.from(breeders.values()), children, families, updatedRows, mutations, mode: 'breeding' };
    }
    commit(plan) {
      if (!plan.updatedRows.length) return;
      this.population = plan.children; this.generation++;
      plan.updatedRows.forEach(row => this.rowGenerations[row]++);
    }
    stats(habitat) {
      const mean = [0, 1, 2].map(i => this.population.reduce((n, b) => n + b.color[i], 0) / this.size);
      return { mean, match: 100 * this.population.reduce((n, b) => n + match(b.color, habitat), 0) / this.size, diversity: 100 * Math.sqrt(this.population.reduce((n, b) => n + distance2(b.color, mean), 0) / this.size) };
    }
  }
  const api = { Lab, random, phenotype, shadeMean, hex, fromHex, match, distance2, cross, PIGMENTS, PATHWAYS, colorInfo, activePathways };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BeetleSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
