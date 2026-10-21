/* Leaf & Lineage — original, dependency-free teaching model. */
(function (root) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(255, n));
  // Original teaching model: two inherited color recipes, with no fixed color ranking.
  const PATHWAYS = [{ name: 'Yellow' }, { name: 'Red' }, { name: 'Blue' }];
  const familyKeys = ['green', 'yellow', 'red', 'orange', 'blue', 'teal', 'purple', 'mixed'];
  // Three linked bits encode each color recipe; three encode its expression strength.
  // The yellow+blue combination has a true teal reference color.
  const palette = [[122,156,80], [209,178,65], [190,95,76], [255,117,61], [103,129,182], [65,165,160], [171,68,178], [255,90,163]];
  const PIGMENTS = Object.fromEntries(familyKeys.map((key, mask) => [key, {
    name: key[0].toUpperCase() + key.slice(1), color: palette[mask]
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
  function colorInfo(switches) {
    const masks = [0, 1].map(copy => switches.slice(0, 3).reduce((mask, pair, i) => mask | pair[copy] << i, 0));
    const strengths = [0, 1].map(copy => switches.slice(3).reduce((mask, pair, i) => mask | pair[copy] << i, 0));
    // Expression strength travels with the recipe. No color is inherently
    // dominant. Equal strengths express the copy inherited from parent A.
    const expressed = strengths[0] >= strengths[1] ? 0 : 1;
    const mask = masks[expressed];
    return { visible: familyKeys[mask], active: PATHWAYS.map((_, i) => Boolean(mask & (1 << i))), alleles: masks.map(value => familyKeys[value]), strengths, expressed };
  }
  const activePathways = switches => colorInfo(switches).active;
  function phenotype(genes, switches) {
    const shade = shadeMean(genes);
    const base = PIGMENTS[colorInfo(switches).visible].color;
    return base.map((v, i) => clamp(v + (shade[i] - 128) * .25));
  }
  const hex = rgb => '#' + rgb.map(v => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
  const fromHex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const distance2 = (a, b) => a.reduce((sum, v, i) => sum + ((v - b[i]) / 255) ** 2, 0) / 3;
  const match = (color, habitat) => {
    const lowA = Math.min(...color), lowB = Math.min(...habitat);
    const rangeA = Math.max(...color) - lowA, rangeB = Math.max(...habitat) - lowB;
    // The same channel-symmetric rule applies to every hue. A gray color has
    // no hue direction, and near-gray colors receive only a small hue penalty.
    const balance = rangeA && rangeB ? color.reduce((sum, value, i) => sum + ((value - lowA) / rangeA - (habitat[i] - lowB) / rangeB) ** 2, 0) / 3 * Math.min(rangeA, rangeB) / 255 : 0;
    return Math.exp(-4 * distance2(color, habitat) - 12 * balance);
  };
  const habitatAt = (habitat, slot, rowSize = 8) => Array.isArray(habitat[0]) ? habitat[Math.min(habitat.length - 1, Math.floor(((slot % rowSize) + .5) / rowSize * habitat.length))] : habitat;
  const gridDistance = (a, b, rowSize = 8) => Math.max(Math.abs(Math.floor(a / rowSize) - Math.floor(b / rowSize)), Math.abs(a % rowSize - b % rowSize));
  function adjacentSlots(slot, capacity, rowSize = 8) {
    const row = Math.floor(slot / rowSize), col = slot % rowSize, slots = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((!dr && !dc) || row + dr < 0 || row + dr >= capacity / rowSize || col + dc < 0 || col + dc >= rowSize) continue;
      slots.push((row + dr) * rowSize + col + dc);
    }
    return slots;
  }

  const survivalChance = (color, habitat, pressure) => (1 - pressure) * .7 + pressure * (.1 + .8 * match(color, habitat) ** 2);
  function localSurvival(color, habitat, pressure, neighborColors = []) {
    const camouflage = match(color, habitat), baseChance = survivalChance(color, habitat, pressure);
    // Average over all adjacent peers: protection fades as contrasting neighbors
    // disappear. Equal colors give exactly zero extra protection.
    const advantage = neighborColors.length ? neighborColors.reduce((sum, neighbor) => sum + Math.max(0, camouflage - match(neighbor, habitat)), 0) / neighborColors.length : 0;
    const neighborBoost = (1 - baseChance) * .6 * pressure * advantage;
    return { camouflage, baseChance, neighborBoost, chance: baseChance + neighborBoost, neighborCount: neighborColors.length };
  }

  function cross(a, b) {
    const loci = a.genes.map((pair, i) => pair.flatMap(av => b.genes[i].map(bv => ({ a: av, b: bv, value: (av + bv) / 2 }))));
    // The six color genes form one linked recipe: each parent transmits
    // either complete copy. Enumerate the four equally likely crosses.
    const familyCounts = new Map();
    for (const av of [0, 1]) for (const bv of [0, 1]) {
      const switches = a.switches.map((pair, i) => [pair[av], b.switches[i][bv]]);
      const family = colorInfo(switches).visible;
      familyCounts.set(family, (familyCounts.get(family) || 0) + .25);
    }
    const pigmentChances = familyKeys.filter(pigment => familyCounts.has(pigment)).map(pigment => ({ pigment, probability: familyCounts.get(pigment) }));
    const pathwayChances = PATHWAYS.map((pathway, i) => ({ name: pathway.name, probability: pigmentChances.reduce((sum, outcome) => sum + (familyKeys.indexOf(outcome.pigment) & (1 << i) ? outcome.probability : 0), 0) }));
    const outcomes = [], counts = new Map();
    for (const outcome of pigmentChances) for (const r of loci[0]) for (const g of loci[1]) for (const blue of loci[2]) {
      const base = PIGMENTS[outcome.pigment].color;
      const color = [r.value, g.value, blue.value].map((v, i) => clamp(base[i] + (v - 128) * .25));
      const probability = outcome.probability / 64, key = hex(color);
      outcomes.push({ color, probability }); counts.set(key, (counts.get(key) || 0) + probability);
    }
    return { loci, pathwayChances, pigmentChances, outcomes,
      totalTransmissions: 4 * 4 ** 3,
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
        const switches = Array.from({ length: 6 }, () => [Number(this.rng() < .5), Number(this.rng() < .5)]);
        // Green carriers retain another real recipe. Its expression is
        // weaker here, but a descendant can inherit two hidden copies.
        if (index < 2 || scenario !== 'mixed') {
          const hidden = scenario === 'blue' ? 4 : scenario === 'warm' ? (index % 2 ? 2 : 1) : (index % 2 ? 4 : 2);
          switches.forEach((pair, i) => pair.splice(0, 2, i < 3 ? 0 : 1, i < 3 ? hidden >> i & 1 : 0));
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
      const copies = [this.rng() < .5 ? 0 : 1, this.rng() < .5 ? 0 : 1];
      const inheritSwitch = (pair, copy) => {
        let value = pair[copy];
        if (this.rng() < mutationRate) { value = 1 - value; mutations++; colorMutations++; }
        return value;
      };
      const genes = a.genes.map((pair, i) => [inheritShade(pair), inheritShade(b.genes[i])]);
      const switches = a.switches.map((pair, i) => [inheritSwitch(pair, copies[0]), inheritSwitch(b.switches[i], copies[1])]);
      return this.beetle(genes, switches, [a.id, b.id], mutations, colorMutations);
    }
    get size() { return this.living().length; }
    living() { return this.population.filter(Boolean); }
    row(row) { return this.population.slice(row * this.rowSize, (row + 1) * this.rowSize).filter(Boolean); }
    survivalDetails(beetle, habitat, pressure) {
      const slot = this.population.indexOf(beetle);
      if (slot < 0) throw new Error('Only a living beetle can take a survival roll.');
      const background = habitatAt(habitat, slot, this.rowSize);
      const adjacent = adjacentSlots(slot, this.capacity, this.rowSize);
      const neighborColors = adjacent.filter(index => this.population[index] && habitatAt(habitat, index, this.rowSize).every((value, channel) => value === background[channel])).map(index => this.population[index].color);
      return localSurvival(beetle.color, background, pressure, neighborColors);
    }
    rollSurvival(beetle, habitat, pressure) {
      const odds = this.survivalDetails(beetle, habitat, pressure);
      return this.survivalRng() < odds.chance;
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
      let crossRowBirths = 0, crossHabitatBirths = 0, nearbyBirths = 0, fartherBirths = 0;
      const positions = new Map(breeders.map(b => [b.id, this.population.indexOf(b)]));
      const habitatKeys = new Map(breeders.map(b => [b.id, hex(habitatAt(habitat, positions.get(b.id), this.rowSize))]));
      // Group mates by distance ring. Each farther ring has half the total
      // weight of the preceding ring; choose uniformly within a chosen ring.
      const matingRings = new Map(breeders.map(first => {
        const groups = new Map();
        breeders.forEach(second => {
          if (first === second) return;
          const distance = gridDistance(positions.get(first.id), positions.get(second.id), this.rowSize);
          if (!groups.has(distance)) groups.set(distance, []);
          groups.get(distance).push(second);
        });
        return [first.id, Array.from(groups, ([distance, mates]) => ({ distance, mates, weight: .5 ** (distance - 1) })).sort((a,b) => a.distance - b.distance)];
      }));
      if (breeders.length >= 2) {
        for (let row = 0; row < this.rows; row++) updatedRows.push(row);
        for (let slot = 0; slot < this.capacity; slot++) {
          // Keep a survivor's descendant on its leaf. Refill a vacant leaf
          // from the nearest real survivor, choosing randomly between ties.
          const nearestDistance = Math.min(...breeders.map(b => gridDistance(slot, positions.get(b.id), this.rowSize)));
          const nearby = breeders.filter(b => gridDistance(slot, positions.get(b.id), this.rowSize) === nearestDistance);
          const first = nearby[Math.floor(this.rng() * nearby.length)];
          const rings = matingRings.get(first.id);
          let roll = this.rng() * rings.reduce((sum, ring) => sum + ring.weight, 0), chosenRing = rings[rings.length - 1];
          for (const ring of rings) { roll -= ring.weight; if (roll < 0) { chosenRing = ring; break; } }
          const second = chosenRing.mates[Math.floor(this.rng() * chosenRing.mates.length)];
          const child = this.offspring(first, second, mutationRate);
          child.parentRows = [parentRows.get(first.id), parentRows.get(second.id)];
          child.parentSlots = [positions.get(first.id), positions.get(second.id)];
          child.mateDistance = chosenRing.distance;
          child.dispersalDistance = nearestDistance;
          if (chosenRing.distance === 1) nearbyBirths++; else fartherBirths++;
          child.parentHabitats = [habitatKeys.get(first.id), habitatKeys.get(second.id)];
          if (child.parentHabitats[0] !== child.parentHabitats[1]) crossHabitatBirths++;
          if (child.parentRows[0] !== child.parentRows[1]) crossRowBirths++;
          children[slot] = child; births.push(child);
        }
      } else {
        // Fewer than two survivors on the whole board cannot make offspring.
        // A lone survivor keeps its original leaf; an empty board stays empty.
        for (let row = 0; row < this.rows; row++) if (this.row(row).length) { updatedRows.push(row); unableRows.push(row); }
        breeders.forEach(b => { children[this.population.indexOf(b)] = b; });
      }
      return { breeders, children, births, updatedRows, survivorCounts, eaten: living.length - breeders.length, unableRows, crossRowBirths, crossHabitatBirths, nearbyBirths, fartherBirths, families: [], mutations: births.reduce((n, b) => n + b.mutations, 0), mode: 'natural' };
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
  const api = { Lab, random, phenotype, shadeMean, hex, fromHex, match, distance2, cross, PIGMENTS, PATHWAYS, colorInfo, activePathways, habitatAt, survivalChance, localSurvival, gridDistance, adjacentSlots };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BeetleSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
