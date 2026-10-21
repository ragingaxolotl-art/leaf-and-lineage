/* Leaf & Lineage — original, dependency-free teaching model. */
(function (root) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(255, n));
  const PIGMENTS = {
    green: { name: 'Green', symbol: 'G', rank: 4, color: [122, 156, 80] },
    yellow: { name: 'Yellow', symbol: 'Y', rank: 3, color: [209, 178, 65] },
    blue: { name: 'Blue', symbol: 'B', rank: 2, color: [103, 129, 182] },
    red: { name: 'Red', symbol: 'R', rank: 1, color: [190, 95, 76] }
  };
  const pigmentKeys = Object.keys(PIGMENTS);
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
  function pigmentInfo(pair) {
    const ordered = pair.slice().sort((a, b) => PIGMENTS[b].rank - PIGMENTS[a].rank);
    return { visible: ordered[0], hidden: ordered[0] === ordered[1] ? null : ordered[1] };
  }
  function phenotype(genes, pigments) {
    const shade = shadeMean(genes);
    if (!pigments) return shade;
    const base = PIGMENTS[pigmentInfo(pigments).visible].color;
    return base.map((v, i) => clamp(v + (shade[i] - 128) * .25));
  }
  const hex = rgb => '#' + rgb.map(v => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
  const fromHex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const distance2 = (a, b) => a.reduce((sum, v, i) => sum + ((v - b[i]) / 255) ** 2, 0) / 3;
  const match = (color, habitat) => Math.exp(-10 * distance2(color, habitat));
  function cross(a, b) {
    const loci = a.genes.map((pair, i) => pair.flatMap(av => b.genes[i].map(bv => ({ a: av, b: bv, value: (av + bv) / 2 }))));
    const pigmentOutcomes = a.pigments.flatMap(av => b.pigments.map(bv => ({ a: av, b: bv, ...pigmentInfo([av, bv]) })));
    const combinations = [], counts = new Map(), pigmentCounts = new Map();
    pigmentOutcomes.forEach(p => pigmentCounts.set(p.visible, (pigmentCounts.get(p.visible) || 0) + 1));
    for (const p of pigmentOutcomes) for (const r of loci[0]) for (const g of loci[1]) for (const blue of loci[2]) {
      const color = phenotype([[r.a, r.b], [g.a, g.b], [blue.a, blue.b]], [p.a, p.b]);
      combinations.push(color);
      const key = hex(color); counts.set(key, (counts.get(key) || 0) + 1);
    }
    return {
      loci, pigmentOutcomes, combinations,
      colors: Array.from(counts, ([color, count]) => ({ color, count, probability: count / combinations.length })),
      pigmentChances: Array.from(pigmentCounts, ([pigment, count]) => ({ pigment, probability: count / 4 })),
      mean: [0, 1, 2].map(i => combinations.reduce((sum, c) => sum + c[i], 0) / combinations.length)
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
        const pigments = [0, 1].map(() => pigmentKeys[Math.floor(this.rng() * pigmentKeys.length)]);
        // Two known carriers make the first classroom cross easy to find.
        if (index < 2 || scenario === 'blue') pigments.splice(0, 2, 'green', 'blue');
        if (scenario === 'warm') pigments.splice(0, 2, 'green', index % 2 ? 'red' : 'yellow');
        return this.beetle(genes, pigments);
      });
    }
    beetle(genes, pigments, parents = [], mutations = 0, pigmentMutations = 0) {
      return { id: this.nextId++, genes, pigments, color: phenotype(genes, pigments), parents, mutations, pigmentMutations };
    }
    offspring(a, b, mutationRate) {
      let mutations = 0, pigmentMutations = 0;
      const inherit = pair => {
        let value = pair[this.rng() < .5 ? 0 : 1];
        if (this.rng() < mutationRate) {
          const offset = (1 + Math.floor(this.rng() * 36)) * (this.rng() < .5 ? -1 : 1);
          const changed = clamp(value + offset);
          if (changed !== value) mutations++;
          value = changed;
        }
        return value;
      };
      const genes = a.genes.map((pair, i) => [inherit(pair), inherit(b.genes[i])]);
      const pigments = [a, b].map(parent => {
        let allele = parent.pigments[this.rng() < .5 ? 0 : 1];
        if (this.rng() < mutationRate) {
          const alternatives = pigmentKeys.filter(key => key !== allele);
          allele = alternatives[Math.floor(this.rng() * alternatives.length)];
          mutations++; pigmentMutations++;
        }
        return allele;
      });
      return this.beetle(genes, pigments, [a.id, b.id], mutations, pigmentMutations);
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
  const api = { Lab, random, phenotype, shadeMean, hex, fromHex, match, distance2, cross, PIGMENTS, pigmentInfo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BeetleSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
