/* Leaf & Lineage — original, dependency-free educational model. */
(function (root) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(255, n));
  function random(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const phenotype = genes => genes.map(pair => (pair[0] + pair[1]) / 2);
  const hex = rgb => '#' + rgb.map(v => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
  const fromHex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const distance2 = (a, b) => a.reduce((sum, v, i) => sum + ((v - b[i]) / 255) ** 2, 0) / 3;
  const match = (color, habitat) => Math.exp(-10 * distance2(color, habitat));
  // Enumerate transmissions, including duplicate outcomes. Each combination is 1/64.
  function cross(a, b) {
    const loci = a.genes.map((pair, i) => pair.flatMap(av => b.genes[i].map(bv => ({ a: av, b: bv, value: (av + bv) / 2 }))));
    const combinations = [];
    for (const r of loci[0]) for (const g of loci[1]) for (const blue of loci[2]) combinations.push([r.value, g.value, blue.value]);
    const colors = new Map();
    combinations.forEach(color => { const key = hex(color); colors.set(key, (colors.get(key) || 0) + 1); });
    return { loci, combinations, colors: Array.from(colors, ([color, count]) => ({ color, count, probability: count / 64 })), mean: a.color.map((v, i) => (v + b.color[i]) / 2) };
  }
  class Lab {
    constructor(seed = 42, size = 48) {
      this.seed = seed; this.size = size; this.rng = random(seed);
      this.generation = 0; this.nextId = 1;
      // A diverse starting population. Each channel has two inherited alleles.
      this.population = Array.from({ length: size }, () => {
        const base = [55 + this.rng() * 155, 65 + this.rng() * 140, 35 + this.rng() * 150];
        const genes = base.map(v => [clamp(Math.round(v + (this.rng() - .5) * 90)), clamp(Math.round(v + (this.rng() - .5) * 90))]);
        return this.beetle(genes, [], 0);
      });
    }
    beetle(genes, parents, mutations) {
      return { id: this.nextId++, genes, color: phenotype(genes), parents, mutations };
    }
    offspring(a, b, mutationRate) {
      let mutations = 0;
      const inherit = pair => {
        let value = pair[this.rng() < .5 ? 0 : 1];
        if (this.rng() < mutationRate) {
          // Mutation direction is random, independent of the habitat.
          const offset = (1 + Math.floor(this.rng() * 36)) * (this.rng() < .5 ? -1 : 1);
          const changed = clamp(value + offset);
          if (changed !== value) mutations++;
          value = changed;
        }
        return value;
      };
      const genes = a.genes.map((pair, i) => [inherit(pair), inherit(b.genes[i])]);
      return this.beetle(genes, [a.id, b.id], mutations);
    }
    select(habitat, pressure) {
      const remaining = this.population.slice();
      const survivors = [];
      // Weighted sampling without replacement: camouflage helps but is no guarantee.
      while (survivors.length < Math.max(2, Math.floor(this.size / 2))) {
        const weights = remaining.map(b => (1 - pressure) + pressure * (.015 + match(b.color, habitat) ** 2));
        let draw = this.rng() * weights.reduce((a, b) => a + b, 0);
        let index = weights.length - 1;
        for (let i = 0; i < weights.length; i++) {
          draw -= weights[i];
          if (draw <= 0) { index = i; break; }
        }
        survivors.push(remaining.splice(index, 1)[0]);
      }
      return survivors;
    }
    plan({ habitat, pressure, mutationRate, parentIds = null }) {
      let breeders;
      if (parentIds) {
        breeders = parentIds.map(id => this.population.find(b => b.id === id));
        if (breeders.length !== 2 || !breeders[0] || !breeders[1] || breeders[0].id === breeders[1].id) {
          throw new Error('Choose two different beetles from this generation.');
        }
      } else breeders = this.select(habitat, pressure);
      const children = Array.from({ length: this.size }, () => {
        const a = Math.floor(this.rng() * breeders.length);
        let b = Math.floor(this.rng() * (breeders.length - 1));
        if (b >= a) b++;
        return this.offspring(breeders[a], breeders[b], mutationRate);
      });
      return { breeders, children, mutations: children.reduce((n, b) => n + b.mutations, 0), mode: parentIds ? 'breeding' : 'natural' };
    }
    planColumns({ pairs, mutationRate, columns = 8 }) {
      if (!Number.isInteger(columns) || columns < 1 || this.size % columns !== 0 || this.size / columns < 2 || !Array.isArray(pairs) || pairs.length !== columns) throw new Error('Each column needs one jar and at least two beetles.');
      // Validate every draft before drawing random numbers or creating children.
      pairs.forEach(ids => {
        if (!Array.isArray(ids) || (ids.length !== 0 && ids.length !== 2)) throw new Error('Put two parents in a jar, or leave it empty.');
        if (ids.length && (ids[0] === ids[1] || ids.some(id => !this.population.some(b => b.id === id)))) throw new Error('Choose two different beetles from this generation.');
      });
      const children = new Array(this.size), families = [], breeders = new Map();
      for (let column = 0; column < columns; column++) {
        const ownColumn = this.population.filter((_, i) => i % columns === column);
        let parents;
        if (pairs[column].length) parents = pairs[column].map(id => this.population.find(b => b.id === id));
        else {
          const first = Math.floor(this.rng() * ownColumn.length);
          let second = Math.floor(this.rng() * (ownColumn.length - 1));
          if (second >= first) second++;
          parents = [ownColumn[first], ownColumn[second]];
        }
        parents.forEach(b => breeders.set(b.id, b));
        families.push({ column, parents, chosen: pairs[column].length === 2, sourceGeneration: this.generation });
        for (let row = 0; row < this.size / columns; row++) {
          const child = this.offspring(parents[0], parents[1], mutationRate);
          child.column = column;
          children[row * columns + column] = child;
        }
      }
      return { breeders: Array.from(breeders.values()), children, families, mutations: children.reduce((n, b) => n + b.mutations, 0), mode: 'breeding' };
    }
    commit(plan) { this.population = plan.children; this.generation++; }
    stats(habitat) {
      const mean = [0, 1, 2].map(i => this.population.reduce((n, b) => n + b.color[i], 0) / this.size);
      return {
        mean,
        match: 100 * this.population.reduce((n, b) => n + match(b.color, habitat), 0) / this.size,
        diversity: 100 * Math.sqrt(this.population.reduce((n, b) => n + distance2(b.color, mean), 0) / this.size)
      };
    }
  }
  const api = { Lab, random, phenotype, hex, fromHex, match, distance2, cross };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeetleSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
