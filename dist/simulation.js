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
  const match = (color, habitat) => Math.exp(-4 * distance2(color, habitat));
  const habitatAt = (habitat, slot, rowSize = 8) => Array.isArray(habitat[0]) ? habitat[Math.min(habitat.length - 1, Math.floor(((slot % rowSize) + .5) / rowSize * habitat.length))] : habitat;
  const survivalChance = (color, habitat, pressure) => (1 - pressure) * .7 + pressure * (.1 + .8 * match(color, habitat) ** 2);
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
      this.seed = seed; this.capacity = size; this.rowSize = rowSize; this.rows = size / rowSize;
      this.rng = random(seed); this.survivalRng = Math.random; this.generation = 0; this.nextId = 1;
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
    get size() { return this.living().length; }
    living() { return this.population.filter(Boolean); }
    row(row) { return this.population.slice(row * this.rowSize, (row + 1) * this.rowSize).filter(Boolean); }
    rollSurvival(beetle, habitat, pressure) {
      const slot = this.population.indexOf(beetle);
      if (slot < 0) throw new Error('Only a living beetle can take a survival roll.');
      return this.survivalRng() < survivalChance(beetle.color, habitatAt(habitat, slot, this.rowSize), pressure);
    }
    select(habitat, pressure, pool = this.living()) {
      // Fresh survival randomness is separate from the seeded starting beetles.
      // One independent roll per living insect. No fixed quota or rerolls.
      return pool.filter(b => this.rollSurvival(b, habitat, pressure));
    }
    plan({ habitat, pressure, mutationRate, survivors }) {
      const living = this.living();
      if (survivors !== undefined && (!Array.isArray(survivors) || new Set(survivors).size !== survivors.length || survivors.some(b => !living.includes(b)))) throw new Error('Survivors must be distinct living beetles.');
      // The animated hunt supplies its completed rolls; never roll them again.
      const breeders = survivors === undefined ? this.select(habitat, pressure) : survivors.slice();
      const children = Array(this.capacity).fill(null), births = [], updatedRows = [];
      const survivorCounts = Array(this.rows).fill(0), unableRows = [];
      const parentRows = new Map(this.population.flatMap((b, slot) => b ? [[b.id, Math.floor(slot / this.rowSize)]] : []));
      breeders.forEach(b => survivorCounts[parentRows.get(b.id)]++);
      let crossRowBirths = 0;
      if (breeders.length >= 2) {
        // All surviving beetles share one mating pool. Row and habitat position
        // affect survival, but do not restrict which two survivors can breed.
        for (let row = 0; row < this.rows; row++) updatedRows.push(row);
        for (let slot = 0; slot < this.capacity; slot++) {
          const a = Math.floor(this.rng() * breeders.length);
          let b = Math.floor(this.rng() * (breeders.length - 1)); if (b >= a) b++;
          const child = this.offspring(breeders[a], breeders[b], mutationRate);
          child.parentRows = [parentRows.get(breeders[a].id), parentRows.get(breeders[b].id)];
          if (child.parentRows[0] !== child.parentRows[1]) crossRowBirths++;
          children[slot] = child; births.push(child);
        }
      } else {
        // Fewer than two survivors on the whole board cannot make offspring.
        // A lone survivor keeps its original leaf; an empty board stays empty.
        for (let row = 0; row < this.rows; row++) if (this.row(row).length) { updatedRows.push(row); unableRows.push(row); }
        breeders.forEach(b => { children[this.population.indexOf(b)] = b; });
      }
      return { breeders, children, births, updatedRows, survivorCounts, eaten: living.length - breeders.length, unableRows, crossRowBirths, families: [], mutations: births.reduce((n, b) => n + b.mutations, 0), mode: 'natural' };
    }
    planRows({ pairs, mutationRate, parentArchive = new Map() }) {
      if (!Array.isArray(pairs) || pairs.length !== this.rows) throw new Error('Each row needs one jar.');
      const parentById = id => this.living().find(b => b.id === id) || parentArchive.get(id);
      pairs.forEach(ids => {
        if (!Array.isArray(ids) || (ids.length !== 0 && ids.length !== 2)) throw new Error('Choose two parents or leave this row alone.');
        if (ids.length && (ids[0] === ids[1] || ids.some(id => !parentById(id)))) throw new Error('Choose two different living beetles.');
      });
      const children = this.population.slice(), families = [], breeders = new Map(), updatedRows = [], births = [];
      let mutations = 0;
      pairs.forEach((ids, row) => {
        if (!ids.length) return; // Preserve every existing beetle and its genes in an empty row.
        const parents = ids.map(parentById);
        parents.forEach(b => breeders.set(b.id, b)); updatedRows.push(row);
        families.push({ row, parents, generation: this.rowGenerations[row] + 1, round: this.generation + 1 });
        for (let i = 0; i < this.rowSize; i++) {
          const child = this.offspring(parents[0], parents[1], mutationRate);
          children[row * this.rowSize + i] = child; births.push(child); mutations += child.mutations;
        }
      });
      return { breeders: Array.from(breeders.values()), children, births, families, updatedRows, mutations, mode: 'breeding' };
    }
    commit(plan) {
      if (!plan.updatedRows.length) return;
      this.population = plan.children; this.generation++;
      plan.updatedRows.forEach(row => this.rowGenerations[row]++);
    }
    stats(habitat) {
      const living = this.living(), count = living.length;
      if (!count) return { count: 0, mean: [0, 0, 0], match: 0, diversity: 0 };
      const mean = [0, 1, 2].map(i => living.reduce((n, b) => n + b.color[i], 0) / count);
      const camouflage = this.population.reduce((n, b, slot) => n + (b ? match(b.color, habitatAt(habitat, slot, this.rowSize)) : 0), 0);
      return { count, mean, match: 100 * camouflage / count, diversity: 100 * Math.sqrt(living.reduce((n, b) => n + distance2(b.color, mean), 0) / count) };
    }

  }
  const api = { Lab, random, phenotype, shadeMean, hex, fromHex, match, distance2, cross, PIGMENTS, PATHWAYS, colorInfo, activePathways, habitatAt, survivalChance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BeetleSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
