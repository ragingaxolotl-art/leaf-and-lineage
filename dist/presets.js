/* Portable classroom starting conditions. These codes contain no student data. */
(function (root) {
  'use strict';
  const release = '20261021-8';
  const defaults = { seed: 42, rows: 6, habitat: '#8fa967', pressure: 80, mutation: 3, mode: 'natural', bird: true, speed: 1, scenario: 'mixed', activities: 'both', allowEnvironment: false, showStats: false, layout: 'solid', habitats: ['#8fa967', '#b17b56', '#7785a1'] };
  function validate(p) {
    const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    if (p && !integer(p.mutation, 0, 20)) throw new Error('Mutation per gene copy must be a whole number from 0 to 20%.');
    if (!p || !integer(p.seed, 1, 2147483647) || !integer(p.rows, 1, 6) || !color(p.habitat) || !integer(p.pressure, 0, 100) || !integer(p.mutation, 0, 20) || !['natural', 'breeding'].includes(p.mode) || typeof p.bird !== 'boolean' || ![.5, 1, 2, 4].includes(p.speed) || !['mixed', 'blue', 'warm'].includes(p.scenario) || !['bird', 'breeding', 'both'].includes(p.activities) || typeof p.allowEnvironment !== 'boolean' || typeof p.showStats !== 'boolean' || !['solid','neapolitan'].includes(p.layout) || !Array.isArray(p.habitats) || p.habitats.length !== 3 || !p.habitats.every(color) || (p.activities === 'bird' && p.mode !== 'natural') || (p.activities === 'breeding' && p.mode !== 'breeding')) throw new Error('This class code has invalid starting conditions. Ask your teacher for the complete link.');
    return { seed: p.seed, rows: p.rows, habitat: p.habitat.toLowerCase(), pressure: p.pressure, mutation: p.mutation, mode: p.mode, bird: p.bird, speed: p.speed, scenario: p.scenario, activities: p.activities, allowEnvironment: p.allowEnvironment, showStats: p.showStats, layout: p.layout, habitats: p.habitats.map(c => c.toLowerCase()) };
  }
  function permits(p, activity) { return p.activities === 'both' || p.activities === activity; }
  function checksum(s) { let n = 2166136261; for (const c of s) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
  function encode(p) {
    const v = validate(p), a = [v.seed, v.rows, v.habitat, v.pressure, v.mutation, v.mode === 'breeding' ? 1 : 0, v.bird ? 1 : 0, v.speed, v.scenario, ['bird','breeding','both'].indexOf(v.activities), v.allowEnvironment ? 1 : 0, v.showStats ? 1 : 0, v.layout === 'neapolitan' ? 1 : 0, v.habitats];
    const payload = btoa(JSON.stringify(a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'LL4.' + payload + '.' + checksum(payload);
  }
  function decode(input) {
    let code = String(input).trim();
    if (/^https?:\/\//i.test(code)) { const url = new URL(code); code = new URLSearchParams(url.hash.slice(1)).get('lab') || ''; }
    if (code.length > 400) throw new Error('The class code is too long.');
    const parts = code.split('.'), version = ['LL1','LL2','LL3','LL4'].indexOf(parts[0]) + 1;
    if (parts.length !== 3 || checksum(parts[1]) !== parts[2]) throw new Error('This class code is incomplete or mistyped. Ask your teacher for the complete link.');
    if (!version) throw new Error('This class link needs a newer version of the lab. Try Reload latest lab below.');
    let a; try { a = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { throw new Error('This class code could not be read.'); }
    if (!Array.isArray(a) || a.length !== [9,11,12,14][version - 1] || ![0,1].includes(a[5]) || ![0,1].includes(a[6]) || (version >= 2 && (![0,1,2].includes(a[9]) || ![0,1].includes(a[10]))) || (version >= 3 && ![0,1].includes(a[11])) || (version >= 4 && ![0,1].includes(a[12]))) throw new Error('This class code has an unsupported format.');
    return validate({ seed: a[0], rows: a[1], habitat: a[2], pressure: a[3], mutation: a[4], mode: a[5] ? 'breeding' : 'natural', bird: !!a[6], speed: a[7], scenario: a[8], activities: version >= 2 ? ['bird','breeding','both'][a[9]] : 'both', allowEnvironment: version >= 2 ? !!a[10] : false, showStats: version >= 3 ? !!a[11] : false, layout: version >= 4 && a[12] ? 'neapolitan' : 'solid', habitats: version >= 4 ? a[13] : defaults.habitats });
  }
  function studentLink(p, href) {
    const url = new URL(href);
    // A new release gets its own document URL, so an older cached page cannot
    // reject a code created by the current lab. The preset itself is unchanged.
    url.search = ''; url.searchParams.set('v', release); url.hash = 'lab=' + encode(p);
    return url.href;
  }
  const api = { defaults, validate, encode, decode, permits, release, studentLink };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LeafPresets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
