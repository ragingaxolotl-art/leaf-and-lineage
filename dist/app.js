/* All state stays in this tab. No external libraries, fonts, or services. */
(() => {
  'use strict';
  const { Lab, hex, fromHex, match, cross, PIGMENTS, colorInfo, habitatAt, survivalChance } = BeetleSim;
  const $ = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lab, habitat = '#8fa967', habitatName = 'Meadow', habitatLayout = 'solid', habitatColors = ['#8fa967','#b17b56','#7785a1'], mode = 'natural';
  let selected = [], inspected = null, playing = false, busy = false;
  let stageTimer, playTimer, history = [], observations = [], events = [];
  let startPreset = { ...LeafPresets.defaults }, studentMode = false, presetError = '';
  const incomingParams = new URLSearchParams(location.hash.slice(1));
  const incomingCode = incomingParams.get('lab');
  if (location.hash.startsWith('#lab=')) {
    studentMode = true;
    try { startPreset = LeafPresets.decode(incomingCode); } catch (error) { presetError = error.message; }
  }
  window.addEventListener('hashchange', () => {
    if (studentMode || location.hash.startsWith('#lab=')) location.reload();
  });
  let ROWS = startPreset.rows;
  const ROW_SIZE = 8;
  document.documentElement.classList.toggle('student-view', studentMode);
  document.documentElement.classList.toggle('student-stats', studentMode && startPreset.showStats);
  let jarParents = Array.from({ length: ROWS }, () => [null, null]);
  let parentArchive = new Map(), lastHunt = null, newbornIds = new Set();
  const parentById = id => lab.population.find(b => b?.id === id) || parentArchive.get(id);
  const habitatModel = () => habitatLayout === 'neapolitan' ? habitatColors.map(fromHex) : fromHex(habitat);
  const beetleHabitat = slot => habitatAt(habitatModel(), slot, ROW_SIZE);
  let activeJar = 0, lastFamilies = Array(ROWS).fill(null), familyRecords = [], lastUpdatedRows = [];
  let suppressClickUntil = 0, touchDrag = null;
  const showDetails = () => !studentMode || startPreset.showStats;
  const canBreed = () => !studentMode || LeafPresets.permits(startPreset, 'breeding');
  const canBird = () => !studentMode || LeafPresets.permits(startPreset, 'bird');
  const canEnvironment = () => !studentMode || startPreset.allowEnvironment;
  const settings = () => ({ habitat: habitatModel(), pressure: Number($('pressure').value) / 100, mutationRate: Number($('mutation').value) / 100 });
  const announce = message => { $('announcement').textContent = message; };
  const format = n => Math.round(n);
  function beetleSVG(color, label = '') {
    return `<svg viewBox="0 0 60 76" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><g fill="none" stroke="#29382b" stroke-width="2.1" stroke-linecap="round"><path d="M18 28 10 21 5 23M16 39 6 37 2 42M19 50 10 57 5 55M42 28 50 21 55 23M44 39 54 37 58 42M41 50 50 57 55 55M24 13 19 5 14 3M36 13 41 5 46 3"/></g><ellipse cx="30" cy="18" rx="9" ry="10" fill="#344334"/><path d="M18 23Q30 15 42 23L43 30H17Z" fill="${hex(color.map(v => v * .7))}" stroke="#29382b" stroke-width="1.2"/><path d="M30 26C15 22 11 32 13 45C14 58 23 66 30 68C38 65 46 58 47 44C49 31 44 23 30 26Z" fill="${hex(color)}" stroke="#344334" stroke-width="1.4"/><path d="M30 27V66" fill="none" stroke="#283c2c" stroke-opacity=".55" stroke-width="1.2"/><path d="M20 31Q15 38 18 46" fill="none" stroke="#fff" stroke-opacity=".28" stroke-linecap="round" stroke-width="3"/><circle cx="26" cy="16" r="1.2" fill="#dddcc0"/><circle cx="34" cy="16" r="1.2" fill="#dddcc0"/><path d="M37 49Q40 44 39 36" fill="none" stroke="#192d24" stroke-opacity=".1" stroke-width="4" stroke-linecap="round"/></svg>`;
  }

  const alleleLabel = switches => switches.map(pair => pair.join('/')).join(' · ');
  const carrierDescription = b => PIGMENTS[colorInfo(b.switches).visible].name + ' beetle';
  function jarMarkup(pair, row) {
    return `<div class="jar-column jar-row ${row === activeJar ? 'active' : ''} ${pair.every(Boolean) ? 'ready' : ''}" data-jar="${row}"><button class="jar-title" data-action="inspect" aria-label="Inspect row ${row + 1} jar" aria-pressed="${row === activeJar}">ROW ${row + 1} · JAR</button><div class="jar-vessel"><div class="jar-lid"></div><div class="jar-glass">${pair.map((id, slot) => {
      const b = parentById(id);
      return `<button class="parent-drop ${b ? 'occupied' : ''}" data-slot="${slot}" aria-label="Row ${row + 1} parent ${slot ? 'B' : 'A'}${b ? `, beetle ID ${b.id}, ${carrierDescription(b)}, saved original parent, click to remove` : ', drop a beetle or click to add the selected beetle'}">${b ? beetleSVG(b.color) : '<span class="slot-plus">+</span>'}<span class="slot-letter">${slot ? 'B' : 'A'}</span></button>`;
    }).join('')}</div></div><button class="row-breed" data-action="breed-row" ${pair.every(Boolean) ? '' : 'disabled'}>Breed row ${row + 1} →</button><button class="jar-odds details-only" data-action="inspect">${lastFamilies[row] ? `Review gen ${lastFamilies[row].generation} cross` : 'See offspring odds'}</button></div>`;
  }
  function createGrid() {
    $('beetle-grid').innerHTML = Array.from({ length: ROWS }, (_, row) => {
      const count = lab.row(row).length;
      const beetles = lab.population.slice(row * ROW_SIZE, (row + 1) * ROW_SIZE).map((b, col) => {
        const slot = row * ROW_SIZE + col;
        if (!b) return '<span class="empty-leaf" role="img" aria-label="Empty leaf"></span>';
        return `<button class="beetle ${newbornIds.has(b.id) ? 'newborn' : ''}" draggable="false" style="--tilt:${[-8,5,-3,9,-6,4,7,-4][col]}deg" data-id="${b.id}" data-index="${slot}" data-row="${row}" aria-pressed="false" aria-label="Beetle ID ${b.id}, row ${row + 1}, ${carrierDescription(b)}${showDetails() ? `, camouflage ${format(match(b.color, beetleHabitat(slot)) * 100)} percent` : ''}">${beetleSVG(b.color)}${b.mutations && showDetails() ? '<i class="mutation-dot" title="Inherited a mutation" aria-hidden="true"></i>' : ''}</button>`;
      }).join('');
      return `<div class="population-row ${lastUpdatedRows.includes(row) ? 'row-updated' : ''}" data-population-row="${row}"><div class="jar-holder">${jarMarkup(jarParents[row], row)}</div><div class="row-population"><div class="row-meta"><strong>Population ${row + 1}</strong><span class="row-generation">Generation ${lab.rowGenerations[row]}</span><span class="row-size">${count} beetle${count === 1 ? '' : 's'}</span></div><div class="row-beetles">${beetles}</div>${count < 2 ? `<p class="row-warning">${count ? 'One survivor: needs a second parent to reproduce.' : 'No living beetles in this row.'}</p>` : ''}</div></div>`;
    }).join('');
    renderSelection();
  }
  const jarCounts = () => ({ ready: jarParents.filter(p => p.every(Boolean)).length, partial: jarParents.filter(p => p.filter(Boolean).length === 1).length });
  function renderJars() {
    document.querySelectorAll('.population-row').forEach((el, row) => {
      el.querySelector('.jar-holder').innerHTML = jarMarkup(jarParents[row], row);
      el.querySelector('.row-generation').textContent = 'Generation ' + lab.rowGenerations[row];
      el.classList.toggle('active-population', row === activeJar);
    });
  }
  function renderGenetics() {
    if (!showDetails() || !canBreed()) { $('genetics-content').innerHTML = ''; return; }
    const pair = jarParents[activeJar], draft = pair.filter(Boolean);
    const family = draft.length ? null : lastFamilies[activeJar];
    const parents = draft.length === 2 ? pair.map(id => parentById(id)) : family?.parents;
    $('genetics-jar').textContent = 'Row ' + (activeJar + 1);
    if (!parents) {
      $('genetics-content').innerHTML = `<p class="genetics-empty">${draft.length ? 'Add a second parent.' : 'Choose two parents for this row. Their offspring inherit actual gene copies; other rows stay unchanged.'}</p><p class="genetics-footnote">Several genes work together to make a color. Pieces inherited from earlier generations can recombine into a contrasting color, even with no mutation. There is no ranking of green, yellow, red, and blue.</p>`;
      return;
    }
    const prediction = cross(...parents), percentage = n => (n * 100).toFixed(2).replace(/\.?0+$/, '') + '%';
    $('genetics-content').innerHTML = `<div class="cross-parents">${parents.map((b, i) => `<div>${beetleSVG(b.color)}<p><strong>Parent ${i ? 'B' : 'A'}</strong><span>${carrierDescription(b)}</span></p></div>`).join('<span class="cross-plus">×</span>')}<p class="cross-context">${family ? `Parents of row ${activeJar + 1}, generation ${family.generation}.` : `Eight offspring for row ${activeJar + 1}.`}</p></div><div class="pigment-chances">${prediction.pigmentChances.map(o => `<div><i style="background:${hex(PIGMENTS[o.pigment].color)}"></i><span>${PIGMENTS[o.pigment].name}</span><strong>${percentage(o.probability)}</strong><span class="chance-bar" style="--chance:${o.probability * 100}%;--pigment:${hex(PIGMENTS[o.pigment].color)}"></span></div>`).join('')}</div><p class="genetics-footnote">Expected offspring, before mutation. Each parent passes one copy of each of nine genes. Six interacting color genes form three pathways; the other three affect shade. A pathway needs two matching gene pairs, so an unusual combination can be rare. These are independent draws, not guaranteed proportions in eight babies.</p><details class="shade-options"><summary>See inherited pathway copies</summary>${parents.map((b, i) => `<p>Parent ${i ? 'B' : 'A'}: ${alleleLabel(b.switches)}</p>`).join('')}<p>Pairs 1–2: yellow pathway · 3–4: red · 5–6: blue. A pathway is active only when both pairs are 1/1. Pathways combine; no color masks another.</p></details>`;
  }

  function assignParent(row, slot, id) {
    if (!canBreed() || presetError || busy || !lab.population.some(b => b?.id === id)) return;
    if (jarParents[row][1 - slot] === id) { announce('A jar needs two different beetles. Choose another parent.'); return; }
    if (mode !== 'breeding') setMode('breeding');
    pause(); activeJar = row; parentArchive.set(id, lab.population.find(b => b?.id === id)); jarParents[row][slot] = id;
    renderSelection(); renderButtons();
    announce(`Beetle added to row ${row + 1} jar. ${jarParents[row].filter(Boolean).length} of two parents ready.`);
  }
  function addObservation(message) {
    observations.unshift(message);
    observations = observations.slice(0, 3);
    $('observations').innerHTML = observations.map(item => `<li>${item}</li>`).join('');
  }
  function record(mutations = 0, hunt = null) {
    history.push({ generation: lab.generation, ...lab.stats(habitatModel()), habitat, habitatName, habitatLayout, habitatColors: habitatColors.slice(), habitatKey: JSON.stringify(habitatModel()), survivors: hunt?.survivors ?? null, eaten: hunt?.eaten ?? null, mode, pressure: settings().pressure, mutationRate: settings().mutationRate, mutations });
  }
  function renderChart() {
    const width = 700, left = 27, right = 11, top = 11, bottom = 112;
    const maxGen = Math.max(10, lab.generation);
    const x = gen => left + gen / maxGen * (width - left - right);
    const y = score => bottom - score / 100 * (bottom - top);
    const measured = history.filter(h => h.count);
    const sampled = measured.filter((h, i) => i === 0 || i === measured.length - 1 || i % Math.max(1, Math.ceil(history.length / 180)) === 0);
    let svg = [0, 50, 100].map(n => `<line x1="${left}" y1="${y(n)}" x2="${width - right}" y2="${y(n)}" stroke="#e7ebdd" stroke-dasharray="3 5"/><text x="0" y="${y(n) + 3}">${n}</text>`).join('');
    for (let i = 0; i <= 4; i++) {
      const g = Math.round(maxGen * i / 4);
      svg += `<text x="${x(g)}" y="133" text-anchor="middle">R${g}</text>`;
    }
    // Event markers use a contrasting dashed stroke and remain part of the CSV.
    events.filter(e => e.type === 'habitat').slice(-30).forEach(e => {
      svg += `<line x1="${x(e.generation)}" y1="${top}" x2="${x(e.generation)}" y2="${bottom}" stroke="#b18d52" stroke-dasharray="3 3"><title>Habitat changed at generation ${e.generation}</title></line>`;
    });
    if (measured.length > 1) {
      const path = sampled.map((h, i) => `${i ? 'L' : 'M'}${x(h.generation).toFixed(2)},${y(h.match).toFixed(2)}`).join(' ');
      svg += `<path d="${path} L${x(lab.generation)},${bottom} L${left},${bottom} Z" fill="#eff3e5"/><path d="${path}" fill="none" stroke="#78914e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else svg += '<text x="370" y="60" text-anchor="middle" class="chart-empty">Every round adds to the story.</text>';
    const last = measured[measured.length - 1];
    svg += `<circle cx="${x(last.generation)}" cy="${y(last.match)}" r="4" fill="#78914e" stroke="#fffef9" stroke-width="2"/>`;
    $('history-chart').innerHTML = svg;
    $('history-chart').setAttribute('aria-label', `Average camouflage after each round: round 0, ${format(history[0].match)} percent; round ${last.generation}, ${format(last.match)} percent. ${events.filter(e => e.type === 'habitat').length} habitat changes.${!lab.size ? ' No living beetles remain after round ' + lab.generation + '.' : ''}`);
    const count = Math.min(7, history.length);
    const indices = Array.from({ length: count }, (_, i) => count === 1 ? 0 : Math.round(i * (history.length - 1) / (count - 1)));
    $('color-timeline').innerHTML = indices.map(i => `<span class="color-sample" style="flex:1"><i style="background:${history[i].count ? hex(history[i].mean) : 'transparent'}" title="${history[i].count ? 'Average color ' + hex(history[i].mean) : 'No living beetles'}"></i>Round ${history[i].generation}${history[i].count ? '' : ' · empty'}</span>`).join('');
  }
  function renderStats() {
    const stats = lab.stats(habitatModel());
    $('generation').textContent = String(lab.generation).padStart(2, '0');
    $('match').textContent = stats.count ? format(stats.match) + '%' : '—';
    $('diversity').textContent = stats.count ? stats.diversity.toFixed(1) + '%' : '—';
    $('average-hex').textContent = stats.count ? hex(stats.mean).toUpperCase() : '—';
    document.querySelector('.population-tag').textContent = lab.size + ' beetles';
    $('average-swatch').style.background = hex(stats.mean);
    $('board-label').textContent = 'ROUND ' + lab.generation;
    $('experiment-settings').hidden = !studentMode || !showDetails();
    if (studentMode && showDetails()) {
      $('experiment-settings').innerHTML = `<h3>Experiment conditions</h3><dl><div><dt>Habitat</dt><dd>${habitatName} · ${habitatLayout === 'neapolitan' ? habitatColors.join(' / ') : habitat.toUpperCase()}</dd></div><div><dt>Current activity</dt><dd>${mode === 'natural' ? 'Natural selection' : 'Breeding'}</dd></div><div><dt>Selection strength</dt><dd>${$('pressure').value}%${mode === 'breeding' ? ' · bird selection inactive' : ''}</dd></div><div><dt>Mutation per copy</dt><dd>${$('mutation').value}%</dd></div><div><dt>Population seed</dt><dd>${startPreset.seed}</dd></div><div><dt>Population size</dt><dd>${ROWS} row${ROWS === 1 ? '' : 's'} · ${lab.size} beetles</dd></div><div><dt>Animation speed</dt><dd>${$('speed').value}×</dd></div><div><dt>Bird animation</dt><dd>${$('bird-animation').checked ? 'On' : 'Off'}</dd></div></dl>`;
    }
    const previous = history.length > 1 ? history[history.length - 2] : null;
    if (!stats.count) $('match-change').textContent = 'No living beetles to measure';
    else if (previous && previous.habitatKey === JSON.stringify(habitatModel())) {
      const delta = stats.match - previous.match;
      $('match-change').textContent = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} points this round`;
    } else $('match-change').textContent = lab.generation ? 'Measured in this habitat' : 'Our starting point';
  }
  function renderButtons() {
    const manual = mode === 'breeding';
    const counts = jarCounts();
    $('student-natural').hidden = !studentMode || !canBird() || !manual;
    $('student-breeding').hidden = !studentMode || !canBreed() || manual;
    $('student-natural').disabled = busy; $('student-breeding').disabled = busy;
    const ready = manual ? counts.ready > 0 : lab.size > 0;
    $('play').hidden = false; $('play').disabled = !playing && !ready;
    $('speed').disabled = false;
    $('step').disabled = busy || !ready;
    $('play').querySelector('span').textContent = playing ? 'Pause' : 'Play';
    $('play').querySelector('svg').innerHTML = playing ? '<path d="M5 4h3v12H5ZM12 4h3v12h-3Z" fill="currentColor" stroke="none"/>' : '<path d="m6 3 11 7-11 7Z" fill="currentColor" stroke="none"/>';
    $('step').querySelector('span').textContent = 'Next generation';
    $('state-pill').innerHTML = `<i></i>${!lab.size && mode === 'natural' ? 'Population empty · start over' : busy ? manual ? 'New families hatching' : 'Survival rolls in progress' : playing ? 'Evolution in progress' : manual ? `${counts.ready}/${ROWS} rows ready` : lab.generation ? 'Paused · take a closer look' : 'Ready to explore'}`;
    $('state-pill').classList.toggle('running', playing || busy);
    $('pressure').disabled = manual || busy;
    $('mutation').disabled = busy;
    $('natural-mode').disabled = busy;
    $('breed-mode').disabled = busy;
    document.querySelectorAll('[data-habitat],[data-student-habitat]').forEach(b => b.disabled = busy);
    $('habitat-color').disabled = busy;
    $('bird-animation').disabled = busy; $('neapolitan-mode').disabled = busy; $('student-neapolitan').disabled = busy || !canEnvironment();
    $('fill-jars').disabled = busy || !jarParents[activeJar].every(Boolean);
    $('clear-jars').disabled = busy || !jarParents.some(p => p.some(Boolean));
    document.querySelectorAll('.beetle, .jar-column button').forEach(b => b.disabled = busy);
    document.querySelectorAll('[data-action="breed-row"]').forEach(b => b.disabled = busy || !jarParents[Number(b.closest('[data-jar]').dataset.jar)].every(Boolean));
    $('carrier-demo').disabled = busy || lab.living().filter(b => b.switches.every(pair => pair[0] !== pair[1])).length < 2;
    document.documentElement.classList.toggle('bird-only', !canBreed());
    $('beetle-grid').setAttribute('aria-label', `${ROWS} independent row populations, up to eight beetles each${canBreed() ? ', one parent jar per row' : ''}`);
    $('student-environment').hidden = !studentMode || !canEnvironment();
    document.querySelectorAll('[data-student-habitat],#student-habitat-color').forEach(b => b.disabled = busy || !canEnvironment());
    $('jar-status').textContent = !canBreed() ? 'Each beetle gets its own survival roll against the background under its leaf.' : manual ? `${counts.ready} row${counts.ready === 1 ? '' : 's'} ready · complete jars keep their original parents for repeated broods. Empty or unfinished jars leave their rows unchanged.` : 'Each row is its own population. Natural selection stays within rows; a jar replaces only its own row.';
  }
  function renderSelection() {
    selected = jarParents.flat().filter(Boolean);
    document.querySelectorAll('.beetle').forEach(button => {
      const id = Number(button.dataset.id);
      button.classList.toggle('selected', selected.includes(id));
      button.classList.toggle('inspected', id === inspected);
      button.classList.toggle('family-focus', Number(button.dataset.row) === activeJar);
      button.setAttribute('aria-pressed', String(selected.includes(id) || id === inspected));
      button.querySelector('.parent-label')?.remove();
    });
    $('parent-tray').hidden = mode !== 'breeding' || !canBreed();
    if (mode === 'breeding') {
      $('parent-tray').innerHTML = '<strong>Parents stay in the jar.</strong> Next generation makes one brood. Play keeps making broods from the original pair. Replace or remove a parent to change the pair.';
    }
    $('board-instruction').textContent = !canBreed() ? 'Watch which beetles survive' : mode === 'breeding' ? 'Drag two parents into a row’s jar' : 'Drag to breed · click to inspect';
    renderJars(); renderGenetics();
  }

  function renderInspector() {
    const b = lab.population.find(item => item?.id === inspected);
    if (!b) { $('inspector').innerHTML = '<span class="inspect-icon" aria-hidden="true">⌕</span><p><strong>Observe. Predict. Try it.</strong><span>Select a beetle to take a closer look.</span></p>'; return; }
    const row = Math.floor(lab.population.indexOf(b) / ROW_SIZE);
    const slot = lab.population.indexOf(b);
    const instruction = canBreed() ? 'Drag it into a jar, or select it and click a + slot.' : 'Describe its color and watch what happens in the next generation.';
    $('inspector').innerHTML = `<div class="gene-card">${beetleSVG(b.color)}<div class="gene-details"><strong>${carrierDescription(b)}</strong><p>${instruction}</p>${!showDetails() ? '' : `<p class="survival-info">This leaf: ${hex(beetleHabitat(slot)).toUpperCase()} · survival chance ${format(survivalChance(b.color, beetleHabitat(slot), settings().pressure) * 100)}%${mode === 'breeding' ? ' (bird inactive)' : ''}</p><details><summary>Inherited genes and family</summary><div class="gene-values">${b.switches.map((pair, i) => `<span>Color ${i + 1}: ${pair.join(' / ')}</span>`).join('')}${b.genes.map((pair, i) => `<span>Shade ${i + 1}: ${pair.join(' / ')}</span>`).join('')}</div><p class="lineage">${b.parents.length ? `Parents: IDs ${b.parents.join(' & ')} · ${b.colorMutations} color-switch mutations` : 'Starting population'} · Row generation ${lab.rowGenerations[row]}</p></details>`}</div></div>`;
  }

  function render() { renderStats(); renderButtons(); renderInspector(); renderChart(); renderGenetics(); }
  function pause() { playing = false; clearTimeout(playTimer); if (lab) renderButtons(); }
  function cancel() { pause(); clearTimeout(stageTimer); busy = false; $('bird-head').hidden = true; $('bird-head').classList.remove('pecking'); touchDrag?.ghost?.remove(); touchDrag = null; clearDropTargets(); }
  function schedule() {
    clearTimeout(playTimer);
    if (playing) playTimer = setTimeout(() => advance(), 1900 / Number($('speed').value));
  }
  function animatePredation(plan, done) {
    const breeders = new Set(plan.breeders.map(b => b.id));
    const victims = Array.from(document.querySelectorAll('.beetle')).filter(b => !breeders.has(Number(b.dataset.id)));
    document.querySelectorAll('.beetle').forEach(b => b.classList.toggle('survivor', breeders.has(Number(b.dataset.id))));
    if (reducedMotion || !$('bird-animation').checked) {
      victims.forEach(b => b.classList.add('eaten'));
      stageTimer = setTimeout(done, reducedMotion ? 70 : 350);
      return;
    }
    if (!victims.length) { stageTimer = setTimeout(done, reducedMotion ? 70 : 350); return; }
    const bird = $('bird-head'), board = $('lineage-board');
    const rate = Math.sqrt(Number($('speed').value)), travel = 110 / rate, bite = 95 / rate;
    let index = 0;
    bird.hidden = false; bird.classList.remove('pecking');
    bird.style.transition = 'none'; bird.style.transform = `translate(-185px, 0px)`;
    function visit() {
      if (index >= victims.length) {
        bird.classList.remove('pecking'); bird.style.transition = 'transform 180ms ease-in';
        bird.style.transform = `translate(${board.clientWidth + 50}px, 0px)`;
        stageTimer = setTimeout(() => { bird.hidden = true; done(); }, 190);
        return;
      }
      const target = victims[index], box = target.getBoundingClientRect(), origin = board.getBoundingClientRect();
      const x = box.left - origin.left + box.width / 2, y = box.top - origin.top + box.height / 2;
      bird.classList.remove('pecking');
      bird.style.transition = `transform ${travel}ms ease-in-out`;
      bird.style.transform = `translate(${x - 151}px, ${y - 59}px)`;
      stageTimer = setTimeout(() => {
        bird.classList.add('pecking'); target.classList.add('eaten'); index++;
        $('habitat-caption').textContent = `The bird has eaten ${index} of ${victims.length} beetles. ${plan.breeders.length} beetles survived their own rolls.`;
        stageTimer = setTimeout(visit, bite);
      }, travel);
    }
    stageTimer = setTimeout(visit, 40);
  }

  function advance(onlyRow = null) {
    if (mode === 'breeding' ? !canBreed() : !canBird()) return;
    const pairs = jarParents.map((pair, row) => pair.every(Boolean) && (onlyRow === null || row === onlyRow) ? pair.slice() : []);
    if (presetError || busy || (mode === 'breeding' && !pairs.some(p => p.length))) return;
    const plan = mode === 'breeding' ? lab.planRows({ pairs, mutationRate: settings().mutationRate, parentArchive }) : lab.plan(settings());
    if (!plan.updatedRows.length) { pause(); return; }
    busy = true; renderButtons();
    $('habitat-caption').textContent = mode === 'natural' ? 'Each beetle rolls independently against the color under its own leaf.' : `Breeding ${plan.updatedRows.map(r => 'row ' + (r + 1)).join(', ')}. Other populations stay unchanged…`;
    function finish() {
      if (plan.mode === 'natural') lastFamilies = Array(ROWS).fill(null);
      else plan.families.forEach(f => { lastFamilies[f.row] = f; familyRecords.push(f); });
      lab.commit(plan); lastUpdatedRows = plan.updatedRows; newbornIds = new Set(plan.births.map(b => b.id));
      const livingIds = new Set(lab.living().map(b => b.id));
      jarParents = jarParents.map(pair => pair.map(id => livingIds.has(id) || parentArchive.has(id) ? id : null));
      inspected = livingIds.has(inspected) ? inspected : null; busy = false;
      if (plan.mode === 'natural') lastHunt = { round: lab.generation, survivors: plan.breeders.length, eaten: plan.eaten };
      if (mode === 'natural' && !lab.size) { playing = false; clearTimeout(playTimer); }
      record(plan.mutations, plan.mode === 'natural' ? lastHunt : null); createGrid(); render();
      const newborns = plan.births;
      const colorMutations = newborns.reduce((sum, b) => sum + b.colorMutations, 0);
      $('habitat-caption').textContent = `${plan.updatedRows.length} row${plan.updatedRows.length === 1 ? '' : 's'} advanced · ${newborns.length} offspring ${!showDetails() ? '' : `· ${colorMutations} color-switch mutations`}`;
      $('bird-report').hidden = !lastHunt;
      if (lastHunt) $('bird-report').textContent = `Last bird round ${lastHunt.round}: ${lastHunt.survivors} survived · ${lastHunt.eaten} eaten. Each beetle had its own roll.`;
      if (plan.mode === 'natural') $('habitat-caption').textContent = `${plan.breeders.length} survived · ${plan.eaten} eaten · ${newborns.length} offspring${plan.unableRows.length ? ` · ${plan.unableRows.length} row(s) had fewer than two parents` : ''}`;
      addObservation(`<strong>Round ${lab.generation}</strong> · ${plan.mode === 'breeding' ? `Rows ${plan.updatedRows.map(r => r + 1).join(', ')} received eight offspring each. All other rows stayed unchanged.` : `${plan.breeders.length} survived and ${plan.eaten} were eaten. ${plan.unableRows.length ? 'Rows with fewer than two survivors cannot reproduce; a lone survivor remains alive.' : 'Surviving parents reproduced within their rows.'}`}${!showDetails() ? '' : ` ${colorMutations} random color-switch mutations.`}`);
      announce(`Round ${lab.generation}. ${newborns.length} new beetles in ${plan.updatedRows.length} rows. Other rows are unchanged.`); schedule();
    }
    if (mode === 'natural') animatePredation(plan, finish); else stageTimer = setTimeout(finish, reducedMotion ? 70 : 600);
  }

  function changeHabitat(value, name, layout = 'solid') {
    habitat = value.toLowerCase(); habitatLayout = layout; habitatName = layout === 'neapolitan' ? 'Neapolitan' : name;
    document.documentElement.classList.toggle('tri-habitat', layout === 'neapolitan');
    habitatColors.forEach((color, i) => document.documentElement.style.setProperty('--habitat-' + i, color));
    $('neapolitan-key').hidden = layout !== 'neapolitan';
    $('neapolitan-key').innerHTML = habitatColors.map((color, i) => `<span><i style="background:${color}"></i>${['Left · columns 1–3','Middle · columns 4–5','Right · columns 6–8'][i]}${showDetails() ? ' · ' + color.toUpperCase() : ''}</span>`).join('');
    [$('neapolitan-mode'),$('student-neapolitan')].forEach(b => b.setAttribute('aria-pressed', String(layout === 'neapolitan')));
    $('habitat-color').value = habitat;
    $('habitat-hex').textContent = habitat.toUpperCase();
    $('habitat-name').textContent = habitatName;
    $('student-habitat-color').value = habitat;
    document.documentElement.style.setProperty('--habitat', habitat);
    const rgb = fromHex(habitat), brightness = .299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2];
    document.documentElement.style.setProperty('--habitat-ink', brightness < 110 ? '#fffce1' : '#203923');
    document.querySelectorAll('[data-habitat],[data-student-habitat]').forEach(button => {
      const active = layout === 'solid' && (button.dataset.habitat || button.dataset.studentHabitat) === habitat;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    // Update accessible scores without recreating beetles or moving keyboard focus.
    document.querySelectorAll('.beetle').forEach(button => {
      const i = Number(button.dataset.index), b = lab.population[i];
      button.setAttribute('aria-label', `Beetle ${i + 1}, row ${Math.floor(i / ROW_SIZE) + 1}, ${carrierDescription(b)}${showDetails() ? `, camouflage ${format(match(b.color, beetleHabitat(i)) * 100)} percent` : ''}`);
    });
    renderStats(); renderInspector(); renderChart();
  }
  function habitatEvent(value, name, layout = 'solid') {
    if (!canEnvironment() || busy || (habitat === value.toLowerCase() && habitatLayout === layout)) return;
    changeHabitat(value, name, layout);
    events.push({ generation: lab.generation, type: 'habitat', detail: `Habitat changed to ${habitatName} (${layout === 'neapolitan' ? habitatColors.join('/') : habitat})` });
    renderChart();
    addObservation(`<strong>Habitat changed.</strong> Existing beetles keep their genes. Watch the next generations.`);
    $('habitat-caption').textContent = layout === 'neapolitan' ? 'Three color zones. Each beetle rolls against the background in its own column.' : 'A new habitat. The same beetles. What will happen next?';
    announce('Habitat changed to ' + name + '. Beetle genes are unchanged.');
  }
  function setMode(next) {
    if (presetError || busy || mode === next || (next === 'breeding' ? !canBreed() : !canBird())) return;
    pause(); mode = next; selected = [];
    // Saved jar parents remain available when switching activities.
    $('natural-mode').classList.toggle('active', mode === 'natural');
    $('breed-mode').classList.toggle('active', mode === 'breeding');
    $('natural-mode').setAttribute('aria-pressed', String(mode === 'natural'));
    $('breed-mode').setAttribute('aria-pressed', String(mode === 'breeding'));
    $('mode-hint').textContent = mode === 'natural' ? 'Birds are more likely to spot beetles that stand out.' : 'Each jar fills only its own row with eight offspring. Empty rows do not change.';
    events.push({ generation: lab.generation, type: 'mode', detail: `Changed to ${mode} mode` });
    renderSelection(); renderStats(); renderButtons();
    announce(mode === 'breeding' ? 'Breeding jars mode. Drag two parents into a jar, or select a beetle then click an empty slot.' : 'Natural selection mode. The bird eats beetles that do not survive.');
  }
  function updateSliders() {
    const p = Number($('pressure').value);
    $('pressure-value').textContent = (p === 0 ? 'Off' : p <= 35 ? 'Gentle' : p < 75 ? 'Moderate' : 'Strong') + ' · ' + p + '%';
    $('mutation-value').textContent = $('mutation').value + '%';
    $('pressure').setAttribute('aria-valuetext', $('pressure-value').textContent);
    $('mutation').setAttribute('aria-valuetext', $('mutation').value + ' percent per inherited gene copy');
  }
  function reset() {
    cancel(); ROWS = startPreset.rows; lab = new Lab(startPreset.seed, ROWS * ROW_SIZE, ROW_SIZE, startPreset.scenario); selected = []; inspected = null;
    history = []; observations = []; events = []; mode = startPreset.mode;
    jarParents = Array.from({ length: ROWS }, () => [null, null]);
    lastFamilies = Array(ROWS).fill(null); familyRecords = []; lastUpdatedRows = []; activeJar = 0; parentArchive = new Map(); lastHunt = null; newbornIds = new Set(); $('bird-report').hidden = true;
    habitat = startPreset.habitat; habitatLayout = startPreset.layout; habitatColors = startPreset.habitats.slice(); habitatName = ({ '#8fa967': 'Meadow', '#b17b56': 'Dry leaves', '#7785a1': 'Dusk' })[habitat] || 'Custom';
    $('pressure').value = startPreset.pressure; $('mutation').value = startPreset.mutation; $('speed').value = String(startPreset.speed);
    $('bird-animation').checked = startPreset.bird;
    $('natural-mode').classList.toggle('active', mode === 'natural'); $('breed-mode').classList.toggle('active', mode === 'breeding');
    $('natural-mode').setAttribute('aria-pressed', String(mode === 'natural')); $('breed-mode').setAttribute('aria-pressed', String(mode === 'breeding'));
    $('mode-hint').textContent = mode === 'natural' ? 'Birds are more likely to spot beetles that stand out.' : 'Each jar fills only its own row with eight offspring. Empty rows do not change.';
    updateSliders(); record(); createGrid(); changeHabitat(habitat, habitatName, habitatLayout);
    document.querySelector('.population-tag').textContent = lab.size + ' beetles';
    render();
    $('habitat-caption').textContent = habitatLayout === 'neapolitan' ? 'Three color zones. Each beetle rolls against the background in its own column.' : 'A little variation is where the story begins.';
    addObservation(studentMode ? '<strong>A fresh start.</strong> Observe the colors and predict what the next offspring might look like.' : `<strong>A fresh start.</strong> ${ROWS} separate row populations, with inherited color combinations and random mutation.`);
    announce('Experiment reset. All row generations are zero. Notes are kept.');
  }
  function downloadCSV() {
    const quote = value => {
      // Keep student notes as text when opened in spreadsheet software.
      let s = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    let rows = [['Leaf & Lineage experiment', 'Seed', startPreset.seed], ['Student notes', $('notes').value], [], ['round', 'habitat', 'habitat_hex', 'mode', 'selection_strength', 'mutation_rate_per_copy', 'average_red', 'average_green', 'average_blue', 'average_color', 'camouflage_percent_at_birth', 'color_diversity_percent', 'mutated_gene_copies', 'living_beetles', 'survivors', 'eaten', 'habitat_layout', 'habitat_thirds']];
    history.forEach(h => rows.push([h.generation, h.habitatName, h.habitat, h.mode, h.pressure, h.mutationRate, ...h.mean.map(v => h.count ? v.toFixed(3) : ''), h.count ? hex(h.mean) : '', h.count ? h.match.toFixed(3) : '', h.count ? h.diversity.toFixed(3) : '', h.mutations, h.count, h.survivors, h.eaten, h.habitatLayout, h.habitatColors.join('/')]));
    rows.push([], ['Events after generation', 'type', 'detail']);
    events.forEach(e => rows.push([e.generation, e.type, e.detail]));
    rows.push([], ['Jar families', 'row_generation', 'row', 'parent_a_id', 'parent_b_id', 'round', 'parent_a_inherited_switches', 'parent_b_inherited_switches']);
    familyRecords.forEach(f => rows.push(['Family', f.generation, f.row + 1, f.parents[0].id, f.parents[1].id, f.round, alleleLabel(f.parents[0].switches), alleleLabel(f.parents[1].switches)]));
    rows.push([], ['Current generation beetles', 'id', 'red_copy_1', 'red_copy_2', 'green_copy_1', 'green_copy_2', 'blue_copy_1', 'blue_copy_2', 'parent_a_id', 'parent_b_id', 'mutated_gene_copies', 'row', 'row_generation', 'inherited_color_switches', 'visible_color', 'color_switch_mutations', 'leaf_background', 'survival_chance']);
    lab.population.forEach((b, i) => { if (!b) return; rows.push([i + 1, b.id, ...b.genes.flat(), b.parents[0] ?? '', b.parents[1] ?? '', b.mutations, Math.floor(i / ROW_SIZE) + 1, lab.rowGenerations[Math.floor(i / ROW_SIZE)], alleleLabel(b.switches), colorInfo(b.switches).visible, b.colorMutations, hex(beetleHabitat(i)), survivalChance(b.color, beetleHabitat(i), settings().pressure)]); });
    if (!showDetails()) {
      rows = [['Leaf & Lineage observations'], ['Student notes', $('notes').value], [], ['round', 'row', 'row_generation', 'beetle_id', 'visible_color', 'hex_color', 'leaf_background']];
      lab.population.forEach((b, i) => { if (!b) return; const row = Math.floor(i / ROW_SIZE); rows.push([lab.generation, row + 1, lab.rowGenerations[row], b.id, PIGMENTS[colorInfo(b.switches).visible].name, hex(b.color), hex(beetleHabitat(i))]); });
    }
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `leaf-and-lineage-round-${lab.generation}.csv`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Experiment data and your notes downloaded as CSV.');
  }
  $('beetle-grid').addEventListener('click', event => {
    const button = event.target.closest('.beetle');
    if (!button || busy || performance.now() < suppressClickUntil) return;
    pause(); inspected = Number(button.dataset.id);
    renderSelection(); renderInspector(); renderButtons();
    const beetle = lab.population.find(b => b?.id === inspected);
    $('habitat-caption').textContent = !showDetails() ? canBreed() ? 'Parent selected. Drag it to a row’s jar, or click an empty + slot.' : 'Beetle selected. Describe its color, then observe the next generation.' : `Beetle ${lab.population.indexOf(beetle) + 1} · ${carrierDescription(beetle)} · Inherited color genes ${alleleLabel(beetle.switches)}`;
    announce(`Selected beetle ${lab.population.findIndex(b => b?.id === inspected) + 1}. ${canBreed() ? 'Drag it to a jar, or click an empty jar slot to add it. Only that row will be replaced.' : 'Observe its color and compare the next generation.'}`);
  });
  $('beetle-grid').addEventListener('click', event => {
    const columnEl = event.target.closest('[data-jar]'), slotEl = event.target.closest('[data-slot]');
    if (!columnEl || busy) return;
    activeJar = Number(columnEl.dataset.jar);
    if (event.target.closest('[data-action="breed-row"]')) { pause(); if (mode !== 'breeding') setMode('breeding'); advance(activeJar); return; }
    if (slotEl) {
      const slot = Number(slotEl.dataset.slot);
      if (jarParents[activeJar][slot]) jarParents[activeJar][slot] = null;
      else if (inspected) assignParent(activeJar, slot, inspected);
      else announce('First select a beetle on a leaf, then click the empty slot. You can also drag a beetle into it.');
    }
    renderSelection(); renderButtons();
    const focusSelector = slotEl ? `[data-slot="${slotEl.dataset.slot}"]` : '[data-action="inspect"]';
    $('beetle-grid').querySelector(`[data-jar="${activeJar}"] ${focusSelector}`).focus({ preventScroll: true });
  });
  $('fill-jars').addEventListener('click', () => {
    if (busy || !jarParents[activeJar].every(Boolean)) return;
    const pair = jarParents[activeJar].slice();
    jarParents = Array.from({ length: ROWS }, () => pair.slice());
    renderSelection(); renderButtons(); announce(`The same pair is in all ${ROWS} jars. Each row will get its own eight offspring.`);
  });
  $('carrier-demo').addEventListener('click', () => {
    const carriers = lab.living().filter(b => b.switches.every(pair => pair[0] !== pair[1]));
    if (busy || carriers.length < 2) return;
    if (mode !== 'breeding') setMode('breeding');
    carriers.slice(0, 2).forEach(b => parentArchive.set(b.id, b)); jarParents[activeJar] = carriers.slice(0, 2).map(b => b.id);
    $('mutation').value = 0; updateSliders();
    renderSelection(); renderButtons();
    announce('Two green parents with varied inherited genes are ready. Unusual combinations can make contrasting offspring without mutation.');
  });
  $('clear-jars').addEventListener('click', () => { pause(); parentArchive.clear(); jarParents = Array.from({ length: ROWS }, () => [null, null]); renderSelection(); renderButtons(); announce('Parent jars cleared.'); });
  function clearDropTargets() { document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); }
  function dropInto(target, id) {
    const jar = target?.closest('[data-jar]');
    if (!jar) return;
    const row = Number(jar.dataset.jar), slot = target.closest('[data-slot]');
    assignParent(row, slot ? Number(slot.dataset.slot) : jarParents[row].findIndex(id => !id) === 0 ? 0 : 1, id);
  }
  $('beetle-grid').addEventListener('dragstart', event => event.preventDefault());
  // Pointer capture gives mouse, pen, and touch the same drag behavior.
  $('beetle-grid').addEventListener('pointerdown', event => {
    const button = event.target.closest('.beetle');
    if (!canBreed() || !button || busy || event.button !== 0) return;
    touchDrag = { id: Number(button.dataset.id), startX: event.clientX, startY: event.clientY, pointer: event.pointerId, ghost: null };
  });
  $('beetle-grid').addEventListener('pointermove', event => {
    if (!touchDrag || touchDrag.pointer !== event.pointerId) return;
    if (!touchDrag.ghost && Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY) < 7) return;
    event.preventDefault();
    if (!touchDrag.ghost) {
      pause(); $('beetle-grid').setPointerCapture(event.pointerId);
      touchDrag.ghost = document.createElement('div'); touchDrag.ghost.className = 'drag-preview';
      touchDrag.ghost.innerHTML = beetleSVG(lab.population.find(b => b?.id === touchDrag.id).color);
      document.body.appendChild(touchDrag.ghost);
    }
    touchDrag.ghost.style.left = event.clientX + 'px'; touchDrag.ghost.style.top = event.clientY + 'px';
    const bounds = $('board-scroll').getBoundingClientRect();
    if (event.clientX < bounds.left + 30) $('board-scroll').scrollLeft -= 12;
    else if (event.clientX > bounds.right - 30) $('board-scroll').scrollLeft += 12;
    if (event.clientY < 55) window.scrollBy(0, -14);
    else if (event.clientY > innerHeight - 55) window.scrollBy(0, 14);
    clearDropTargets(); document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-jar]')?.classList.add('drop-target');
  }, { passive: false });
  function finishTouch(event, cancelled = false) {
    if (!touchDrag) return;
    if (touchDrag.ghost) {
      if (!cancelled) dropInto(document.elementFromPoint(event.clientX, event.clientY), touchDrag.id);
      touchDrag.ghost.remove(); suppressClickUntil = performance.now() + 350;
    }
    touchDrag = null; clearDropTargets();
  }
  $('beetle-grid').addEventListener('pointerup', event => finishTouch(event));
  $('beetle-grid').addEventListener('pointercancel', event => finishTouch(event, true));
  $('play').addEventListener('click', () => {
    if (playing) pause();
    else { playing = true; renderButtons(); if (!busy) advance(); }
  });
  $('step').addEventListener('click', () => { pause(); advance(); });
  $('speed').addEventListener('change', () => { if (!busy) schedule(); });
  $('reset').addEventListener('click', reset);
  document.querySelectorAll('[data-habitat]').forEach(button => button.addEventListener('click', () => habitatEvent(button.dataset.habitat, button.dataset.name)));
  $('habitat-color').addEventListener('input', event => habitatEvent(event.target.value, 'Custom'));
  $('natural-mode').addEventListener('click', () => setMode('natural'));
  $('breed-mode').addEventListener('click', () => setMode('breeding'));
  ['pressure', 'mutation'].forEach(id => {
    $(id).addEventListener('input', updateSliders);
    $(id).addEventListener('change', () => events.push({ generation: lab.generation, type: 'setting', detail: `${id} changed to ${$(id).value}%` }));
  });
  $('download').addEventListener('click', downloadCSV);
  function setupClassroom() {
    if (studentMode) {
      document.querySelector('.brand').href = location.href;
      document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); $('lab').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); });
      document.querySelector('.intro-copy').textContent = canBreed() ? 'Choose parents. Follow the generations. Discover what the next beetles might look like.' : 'Watch the bird. Follow the generations. Discover which colors survive.';
      $('download-student').textContent = startPreset.showStats ? 'Save full data' : 'Save observations';
      $('classroom-badge').hidden = false;
      $('classroom-badge').textContent = startPreset.showStats ? 'CLASSROOM INVESTIGATION · FULL STATS' : 'CLASSROOM INVESTIGATION';
      $('guide').innerHTML = `<button id="student-guide-close" class="dialog-close" aria-label="Close instructions">×</button><p class="eyebrow">YOUR INVESTIGATION</p><h2 id="guide-title">Observe, predict, and experiment.</h2><p>Each row has room for eight beetles. Next generation advances once; Play keeps going until you pause.</p>${canBreed() ? '<p>Drag two beetles into a row’s jar, or select a beetle then click a + slot. The jar keeps the original parents. Each step replaces only that row with a new brood of their offspring. Play keeps repeating that pair until you replace or remove a parent.</p>' : ''}${canBird() ? '<p>Use Play or Next generation to watch the bird select survivors. Each insect gets its own survival roll against the color behind its leaf. With at least two survivors a row produces eight offspring; one survivor remains alone, and zero survivors leaves an empty row.</p>' : ''}${canBreed() && canBird() ? '<p>Choose Bird mode or Breeding mode to switch activities.</p>' : ''}${canEnvironment() ? '<p>You can change the environment whenever a generation is not in progress. Existing beetles keep their colors. Neapolitan is another environment choice: three continuous vertical color bands across the leaf area. Each column uses its own background for survival rolls.</p>' : ''}${startPreset.showStats ? '<h3>Read the results</h3><p>Average camouflage is a 0–100% similarity score, not a survival probability. Diversity measures color spread. The chart combines all rows after each round; each row also tracks its own generation.</p><p>Select a beetle and open Inherited genes and family to see its gene copies and parents. In an allowed breeding activity, a complete jar shows offspring probabilities before mutation. Each baby is an independent draw. Full data downloads include settings, measurements, gene copies, parentage, and your notes.</p><p>This invented teaching model combines six color genes into three pathways, plus three shade genes. A pathway activates when both of its pairs are 1/1. Gene interactions can produce contrasting offspring even with no mutation. The mutation rate applies to each of 18 inherited copies. It does not target the habitat.</p>' : ''}<p>Color genes come from parents and can be passed on again. Different combinations sometimes produce surprising offspring. Record what you notice and save your observations. Start over returns to the class preset.</p>`;
      $('student-guide-close').addEventListener('click', () => $('guide').close());
    }
    $('reset-student').addEventListener('click', reset);
    $('download-student').addEventListener('click', downloadCSV);
    $('student-natural').addEventListener('click', () => setMode('natural'));
    $('student-breeding').addEventListener('click', () => setMode('breeding'));
    document.querySelectorAll('[data-student-habitat]').forEach(button => button.addEventListener('click', () => habitatEvent(button.dataset.studentHabitat, button.dataset.name)));
    $('student-neapolitan').addEventListener('click', () => habitatEvent(habitat, 'Neapolitan', 'neapolitan'));
    $('neapolitan-mode').addEventListener('click', () => habitatEvent(habitat, 'Neapolitan', 'neapolitan'));
    $('student-habitat-color').addEventListener('input', event => habitatEvent(event.target.value, 'Custom')); 
    function formPreset() {
      return LeafPresets.validate({ seed: Number($('class-seed').value), rows: Number($('class-rows').value), habitat: $('class-habitat').value, pressure: Number($('class-pressure').value), mutation: Number($('class-mutation').value), mode: $('class-activities').value === 'both' ? $('class-mode').value : $('class-activities').value === 'bird' ? 'natural' : 'breeding', activities: $('class-activities').value, allowEnvironment: $('class-environment').checked, showStats: $('class-stats').checked, layout: $('class-layout').value, habitats: [0,1,2].map(i => $('class-habitat-' + i).value), bird: $('class-bird').checked, speed: Number($('class-speed').value), scenario: $('class-scenario').value });
    }
    function fillForm(preset) {
      for (const field of ['seed','rows','habitat','pressure','mutation','mode','speed','scenario','activities','layout']) $('class-' + field).value = String(preset[field]);
      preset.habitats.forEach((color, i) => $('class-habitat-' + i).value = color);
      $('class-tri-colors').hidden = preset.layout !== 'neapolitan';
      $('class-bird').checked = preset.bird; $('class-environment').checked = preset.allowEnvironment; $('class-stats').checked = preset.showStats;
      $('class-mode').disabled = preset.activities !== 'both';
      if (preset.activities !== 'both') $('class-mode').value = preset.activities === 'bird' ? 'natural' : 'breeding';
    }
    function createLink() {
      try {
        const preset = formPreset(), code = LeafPresets.encode(preset), url = new URL(location.href);
        url.search = ''; url.hash = 'lab=' + code;
        $('student-link').value = url.href; $('student-code').value = code;
        $('student-preview').href = url.href; $('student-preview').hidden = false;
        $('classroom-message').textContent = preset.showStats ? 'Ready. Students can see all stats, charts, genetic details, offspring odds for allowed breeding, and full data downloads. Activity and environment permissions still apply.' : 'Ready. Stats and genetics stay simplified. This link includes the activity choices and environment permission.';
        $('copy-student-link').disabled = false;
      } catch (error) { $('classroom-message').textContent = error.message; }
    }
    $('classroom-open').addEventListener('click', () => {
      pause();
      fillForm({ ...startPreset, rows: ROWS, habitat, layout: habitatLayout, habitats: habitatColors.slice(), pressure: Number($('pressure').value), mutation: Number($('mutation').value), mode, bird: $('bird-animation').checked, speed: Number($('speed').value) });
      $('classroom-dialog').showModal(); createLink();
    });
    $('class-layout').addEventListener('change', () => { $('class-tri-colors').hidden = $('class-layout').value !== 'neapolitan'; });
    $('class-activities').addEventListener('change', () => {
      const activities = $('class-activities').value; $('class-mode').disabled = activities !== 'both';
      if (activities !== 'both') $('class-mode').value = activities === 'bird' ? 'natural' : 'breeding';
    });
    $('classroom-close').addEventListener('click', () => $('classroom-dialog').close());
    $('create-student-link').addEventListener('click', createLink);
    $('apply-classroom').addEventListener('click', () => {
      try { startPreset = formPreset(); reset(); $('classroom-dialog').close(); } catch (error) { $('classroom-message').textContent = error.message; }
    });
    $('copy-student-link').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('student-link').value); $('classroom-message').textContent = 'Student link copied. Paste it into your class assignment.'; }
      catch { $('student-link').focus(); $('student-link').select(); $('classroom-message').textContent = 'Select and copy the link from the box.'; }
    });
    $('load-class-code').addEventListener('click', () => {
      try { fillForm(LeafPresets.decode($('import-class-code').value)); createLink(); }
      catch (error) { $('classroom-message').textContent = error.message; }
    });
    $('classroom-dialog').addEventListener('input', event => {
      if (event.target.matches('input,select') && !['student-link','student-code','import-class-code'].includes(event.target.id)) {
        $('student-link').value = ''; $('student-code').value = ''; $('student-preview').hidden = true; $('copy-student-link').disabled = true;
        $('classroom-message').textContent = 'Starting conditions changed. Create a new student link to include them.';
      }
    });
  }
  const openGuide = () => { pause(); $('guide').showModal(); };
  $('help-open').addEventListener('click', openGuide);
  $('match-help').addEventListener('click', openGuide);
  $('help-close')?.addEventListener('click', () => $('guide').close());
  $('guide').addEventListener('click', event => { if (event.target === $('guide')) { const r = $('guide').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('guide').close(); } });
  // A hidden tab never keeps consuming cycles; resuming remains the student's choice.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  setupClassroom();
  reset();
  if (!studentMode && new URLSearchParams(location.search).get('teacher') === '1') $('classroom-open').click();
  if (presetError) {
    $('classroom-error').textContent = presetError;
    $('classroom-error').hidden = false;
    $('lab').hidden = true;
    $('play').disabled = true; $('step').disabled = true;
    document.querySelectorAll('.beetle,.jar-column button').forEach(b => b.disabled = true);
    $('reset-student').disabled = true;
  }
})();
