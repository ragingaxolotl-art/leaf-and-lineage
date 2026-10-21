/* All state stays in this tab. No external libraries, fonts, or services. */
(() => {
  'use strict';
  const { Lab, hex, fromHex, match, cross } = BeetleSim;
  const $ = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lab, habitat = '#8fa967', habitatName = 'Meadow', mode = 'natural';
  let selected = [], inspected = null, playing = false, busy = false;
  let stageTimer, playTimer, history = [], observations = [], events = [];
  const COLUMNS = 8;
  let jarParents = Array.from({ length: COLUMNS }, () => [null, null]);
  let activeJar = 0, crossChannel = 0, lastFamilies = [], familyRecords = [];
  let suppressClickUntil = 0, touchDrag = null;
  const settings = () => ({ habitat: fromHex(habitat), pressure: Number($('pressure').value) / 100, mutationRate: Number($('mutation').value) / 100 });
  const announce = message => { $('announcement').textContent = message; };
  const format = n => Math.round(n);
  function beetleSVG(color, label = '') {
    return `<svg viewBox="0 0 60 76" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><g fill="none" stroke="#29382b" stroke-width="2.1" stroke-linecap="round"><path d="M18 28 10 21 5 23M16 39 6 37 2 42M19 50 10 57 5 55M42 28 50 21 55 23M44 39 54 37 58 42M41 50 50 57 55 55M24 13 19 5 14 3M36 13 41 5 46 3"/></g><ellipse cx="30" cy="18" rx="9" ry="10" fill="#344334"/><path d="M18 23Q30 15 42 23L43 30H17Z" fill="${hex(color.map(v => v * .7))}" stroke="#29382b" stroke-width="1.2"/><path d="M30 26C15 22 11 32 13 45C14 58 23 66 30 68C38 65 46 58 47 44C49 31 44 23 30 26Z" fill="${hex(color)}" stroke="#344334" stroke-width="1.4"/><path d="M30 27V66" fill="none" stroke="#283c2c" stroke-opacity=".55" stroke-width="1.2"/><path d="M20 31Q15 38 18 46" fill="none" stroke="#fff" stroke-opacity=".28" stroke-linecap="round" stroke-width="3"/><circle cx="26" cy="16" r="1.2" fill="#dddcc0"/><circle cx="34" cy="16" r="1.2" fill="#dddcc0"/><path d="M37 49Q40 44 39 36" fill="none" stroke="#192d24" stroke-opacity=".1" stroke-width="4" stroke-linecap="round"/></svg>`;
  }
  function createGrid() {
    $('beetle-grid').innerHTML = lab.population.map((b, i) => `<button class="beetle ${lastFamilies.length ? 'family-child newborn' : ''}" draggable="false" style="--tilt:${[-8, 5, -3, 9, -6, 4, 7, -4][i % 8]}deg" data-id="${b.id}" data-column="${i % COLUMNS}" aria-pressed="false" aria-label="Beetle ${i + 1}, column ${i % COLUMNS + 1}, color ${hex(b.color)}, camouflage ${format(match(b.color, fromHex(habitat)) * 100)} percent">${beetleSVG(b.color)}${b.mutations ? '<i class="mutation-dot" title="Inherited a mutation" aria-hidden="true"></i>' : ''}</button>`).join('');
    renderSelection();
  }
  const jarCounts = () => ({ ready: jarParents.filter(p => p.every(Boolean)).length, partial: jarParents.filter(p => p.filter(Boolean).length === 1).length });
  function renderJars() {
    $('jar-rail').innerHTML = jarParents.map((pair, column) => `<div class="jar-column ${column === activeJar ? 'active' : ''} ${pair.every(Boolean) ? 'ready' : ''}" data-jar="${column}"><button class="jar-title" data-action="inspect" aria-label="Inspect jar ${column + 1}" aria-pressed="${column === activeJar}">JAR ${column + 1}${pair.every(Boolean) ? '<i aria-hidden="true">✓</i>' : ''}</button><div class="jar-vessel"><div class="jar-lid"></div><div class="jar-glass">${pair.map((id, slot) => {
      const b = lab.population.find(item => item.id === id);
      return `<button class="parent-drop ${b ? 'occupied' : ''}" data-slot="${slot}" aria-label="Jar ${column + 1} parent ${slot ? 'B' : 'A'}${b ? `, beetle ${lab.population.indexOf(b) + 1}, click to remove` : ', drop a beetle or click to add the selected beetle'}">${b ? beetleSVG(b.color) : '<span class="slot-plus">+</span>'}<span class="slot-letter">${slot ? 'B' : 'A'}</span></button>`;
    }).join('')}</div></div><button class="jar-odds" data-action="inspect">${pair.every(Boolean) ? 'See color odds ↗' : lastFamilies[column] ? `Gen ${lab.generation} family ↗` : '↓ six offspring'}</button></div>`).join('');
  }
  function renderGenetics() {
    const pair = jarParents[activeJar], draft = pair.filter(Boolean);
    const family = draft.length ? null : lastFamilies[activeJar];
    const parents = draft.length === 2 ? pair.map(id => lab.population.find(b => b.id === id)) : family?.parents;
    $('genetics-jar').textContent = 'Jar ' + (activeJar + 1);
    if (!parents) {
      $('genetics-content').innerHTML = `<p class="genetics-empty">${draft.length ? 'One parent is in this jar. Add a second beetle to see their possible babies.' : 'Drag two beetles into this jar. Or select a beetle on a leaf, then click a + slot above its future family.'}</p><p class="genetics-footnote">Every baby gets one gene copy from each parent. Empty jars use a random pair from their own column when you breed.</p>`;
      return;
    }
    const prediction = cross(parents[0], parents[1]), channel = crossChannel;
    const names = ['Red', 'Green', 'Blue'], percentage = n => (n * 100).toFixed(1).replace(/\.0$/, '') + '%';
    $('genetics-content').innerHTML = `<div class="cross-parents">${parents.map((b, i) => `<div>${beetleSVG(b.color)}<p><strong>Parent ${i ? 'B' : 'A'}</strong><span>${hex(b.color).toUpperCase()} · ID ${b.id}</span></p></div>`).join('<span class="cross-plus">×</span>')}<p class="cross-context">${family ? `The pair that produced column ${activeJar + 1} in generation ${lab.generation}.` : `This pair will produce all six beetles in column ${activeJar + 1}.`}</p></div><div class="possibility-layout"><div class="punnett-block"><label for="gene-channel">Follow one color gene <select id="gene-channel">${names.map((name, i) => `<option value="${i}" ${i === channel ? 'selected' : ''}>${name}</option>`).join('')}</select></label><table class="punnett"><caption>Each cell has a 25% chance before mutation.</caption><thead><tr><th>A ↓ / B →</th>${parents[1].genes[channel].map(v => `<th scope="col">${v}</th>`).join('')}</tr></thead><tbody>${parents[0].genes[channel].map(av => `<tr><th scope="row">${av}</th>${parents[1].genes[channel].map(bv => `<td><strong>${(av + bv) / 2}</strong><small>(${av} + ${bv}) ÷ 2</small></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="color-possibilities"><p class="possibility-heading">64 equally likely gene combinations</p><div class="possibility-dots" role="img" aria-label="64 possible inherited gene combinations, each with a one in 64 chance before mutation. ${prediction.colors.length} different visible colors.">${prediction.combinations.map(color => `<i style="background:${hex(color)}" title="${hex(color).toUpperCase()}: combined chance ${percentage(prediction.colors.find(c => c.color === hex(color)).probability)}"></i>`).join('')}</div><div class="expected-color"><i style="background:${hex(prediction.mean)}"></i><p><strong>Expected average: ${hex(prediction.mean).toUpperCase()}</strong><span>${prediction.colors.length} possible visible ${prediction.colors.length === 1 ? 'color' : 'colors'} before mutation.</span></p></div><div class="color-odds">${prediction.colors.slice().sort((a, b) => b.count - a.count).slice(0, 4).map(o => `<span><i style="background:${o.color}"></i>${o.color.toUpperCase()} <strong>${percentage(o.probability)}</strong></span>`).join('')}</div></div></div><p class="genetics-footnote">Each dot is one of 64 equally likely combinations. Repeated colors add their chances together. Six babies are six independent draws, so their colors may differ from these percentages. Mutation can introduce other shades.</p>`;
  }
  function assignParent(column, slot, id) {
    if (busy || !lab.population.some(b => b.id === id)) return;
    if (jarParents[column][1 - slot] === id) { announce('A jar needs two different beetles. Choose another parent.'); return; }
    if (mode !== 'breeding') setMode('breeding');
    pause(); activeJar = column; jarParents[column][slot] = id;
    renderSelection(); renderButtons();
    announce(`Beetle added to jar ${column + 1}. ${jarParents[column].filter(Boolean).length} of two parents ready.`);
  }
  function addObservation(message) {
    observations.unshift(message);
    observations = observations.slice(0, 3);
    $('observations').innerHTML = observations.map(item => `<li>${item}</li>`).join('');
  }
  function record(mutations = 0) {
    history.push({ generation: lab.generation, ...lab.stats(fromHex(habitat)), habitat, habitatName, mode, pressure: settings().pressure, mutationRate: settings().mutationRate, mutations });
  }
  function renderChart() {
    const width = 700, left = 27, right = 11, top = 11, bottom = 112;
    const maxGen = Math.max(10, lab.generation);
    const x = gen => left + gen / maxGen * (width - left - right);
    const y = score => bottom - score / 100 * (bottom - top);
    const sampled = history.filter((h, i) => i === 0 || i === history.length - 1 || i % Math.max(1, Math.ceil(history.length / 180)) === 0);
    let svg = [0, 50, 100].map(n => `<line x1="${left}" y1="${y(n)}" x2="${width - right}" y2="${y(n)}" stroke="#e7ebdd" stroke-dasharray="3 5"/><text x="0" y="${y(n) + 3}">${n}</text>`).join('');
    for (let i = 0; i <= 4; i++) {
      const g = Math.round(maxGen * i / 4);
      svg += `<text x="${x(g)}" y="133" text-anchor="middle">G${g}</text>`;
    }
    // Event markers use a contrasting dashed stroke and remain part of the CSV.
    events.filter(e => e.type === 'habitat').slice(-30).forEach(e => {
      svg += `<line x1="${x(e.generation)}" y1="${top}" x2="${x(e.generation)}" y2="${bottom}" stroke="#b18d52" stroke-dasharray="3 3"><title>Habitat changed at generation ${e.generation}</title></line>`;
    });
    if (history.length > 1) {
      const path = sampled.map((h, i) => `${i ? 'L' : 'M'}${x(h.generation).toFixed(2)},${y(h.match).toFixed(2)}`).join(' ');
      svg += `<path d="${path} L${x(lab.generation)},${bottom} L${left},${bottom} Z" fill="#eff3e5"/><path d="${path}" fill="none" stroke="#78914e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else svg += '<text x="370" y="60" text-anchor="middle" class="chart-empty">Every generation adds to the story.</text>';
    const last = history[history.length - 1];
    svg += `<circle cx="${x(last.generation)}" cy="${y(last.match)}" r="4" fill="#78914e" stroke="#fffef9" stroke-width="2"/>`;
    $('history-chart').innerHTML = svg;
    $('history-chart').setAttribute('aria-label', `Average camouflage at birth: generation 0, ${format(history[0].match)} percent; generation ${last.generation}, ${format(last.match)} percent. ${events.filter(e => e.type === 'habitat').length} habitat changes.`);
    const count = Math.min(7, history.length);
    const indices = Array.from({ length: count }, (_, i) => count === 1 ? 0 : Math.round(i * (history.length - 1) / (count - 1)));
    $('color-timeline').innerHTML = indices.map(i => `<span class="color-sample" style="flex:1"><i style="background:${hex(history[i].mean)}" title="Average color ${hex(history[i].mean)}"></i>Gen ${history[i].generation}</span>`).join('');
  }
  function renderStats() {
    const stats = lab.stats(fromHex(habitat));
    $('generation').textContent = String(lab.generation).padStart(2, '0');
    $('match').textContent = format(stats.match) + '%';
    $('diversity').textContent = stats.diversity.toFixed(1) + '%';
    $('average-hex').textContent = hex(stats.mean).toUpperCase();
    $('average-swatch').style.background = hex(stats.mean);
    $('board-label').textContent = 'GENERATION ' + lab.generation;
    const previous = history.length > 1 ? history[history.length - 2] : null;
    if (previous && previous.habitat === habitat) {
      const delta = stats.match - previous.match;
      $('match-change').textContent = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} points this generation`;
    } else $('match-change').textContent = lab.generation ? 'Measured in this habitat' : 'Our starting point';
  }
  function renderButtons() {
    const manual = mode === 'breeding';
    const counts = jarCounts();
    $('play').disabled = manual;
    $('speed').disabled = manual;
    $('step').disabled = busy || (manual && (!counts.ready || counts.partial));
    $('play').querySelector('span').textContent = playing ? 'Pause' : lab.generation ? 'Keep evolving' : 'Start evolving';
    $('play').querySelector('svg').innerHTML = playing ? '<path d="M5 4h3v12H5ZM12 4h3v12h-3Z" fill="currentColor" stroke="none"/>' : '<path d="m6 3 11 7-11 7Z" fill="currentColor" stroke="none"/>';
    $('step').querySelector('span').textContent = manual ? 'Breed jar families' : 'Next generation';
    $('state-pill').innerHTML = `<i></i>${busy ? manual ? 'New families hatching' : 'The bird is feeding' : playing ? 'Evolution in progress' : manual ? `${counts.ready}/8 jars ready` : lab.generation ? 'Paused · take a closer look' : 'Ready to explore'}`;
    $('state-pill').classList.toggle('running', playing || busy);
    $('pressure').disabled = manual || busy;
    $('mutation').disabled = busy;
    $('natural-mode').disabled = busy;
    $('breed-mode').disabled = busy;
    document.querySelectorAll('[data-habitat]').forEach(b => b.disabled = busy);
    $('habitat-color').disabled = busy;
    $('bird-animation').disabled = busy;
    $('fill-jars').disabled = busy || !jarParents[activeJar].every(Boolean);
    $('clear-jars').disabled = busy || !jarParents.some(p => p.some(Boolean));
    document.querySelectorAll('.beetle, .jar-column button').forEach(b => b.disabled = busy);
    $('jar-status').textContent = manual ? counts.partial ? `${counts.partial} jar${counts.partial === 1 ? ' needs' : 's need'} a second parent. Complete or clear it before breeding.` : counts.ready ? `${counts.ready} chosen ${counts.ready === 1 ? 'pair' : 'pairs'} · ${8 - counts.ready} random column pairs · six offspring per jar` : 'Drag two parents into a jar to start. Empty jars will choose random parents from their own columns.' : 'Drag to a jar to start breeding, or select a beetle and click a + slot. The bird visits in natural selection mode.';
  }
  function renderSelection() {
    selected = jarParents.flat().filter(Boolean);
    document.querySelectorAll('.beetle').forEach(button => {
      const id = Number(button.dataset.id);
      button.classList.toggle('selected', selected.includes(id));
      button.classList.toggle('inspected', id === inspected);
      button.classList.toggle('family-focus', Number(button.dataset.column) === activeJar && lastFamilies.length > 0);
      button.setAttribute('aria-pressed', String(selected.includes(id) || id === inspected));
      button.querySelector('.parent-label')?.remove();
    });
    $('parent-tray').hidden = mode !== 'breeding';
    if (mode === 'breeding') {
      $('parent-tray').innerHTML = '<strong>One jar → one family.</strong> Each column holds six siblings. You can use the same parent in different jars, but each jar needs two different parents.';
    }
    $('board-instruction').textContent = mode === 'breeding' ? 'Drag parents into the jars above' : 'Drag to breed · click to inspect';
    renderJars(); renderGenetics();
  }
  function renderInspector() {
    const b = lab.population.find(item => item.id === inspected);
    if (!b) {
      $('inspector').innerHTML = '<span class="inspect-icon" aria-hidden="true">⌕</span><p><strong>Every beetle has a story.</strong><span>Click one on a leaf to explore its color genes.</span></p>';
      return;
    }
    const index = lab.population.indexOf(b) + 1;
    $('inspector').innerHTML = `<div class="gene-card">${beetleSVG(b.color, `Beetle ${index}`)}<div class="gene-details"><div class="gene-heading"><strong>Beetle ${index}</strong><small>${hex(b.color).toUpperCase()} · ${format(match(b.color, fromHex(habitat)) * 100)}% match</small></div><div class="gene-values">${b.genes.map((pair, i) => `<span>${['R', 'G', 'B'][i]} ${pair[0]} / ${pair[1]}</span>`).join('')}</div><p class="lineage">${b.parents.length ? `Parents: IDs ${b.parents.join(' & ')} · ${b.mutations} mutated gene ${b.mutations === 1 ? 'copy' : 'copies'}` : 'Starting population · two copies of each color gene'}</p></div></div>`;
  }
  function render() { renderStats(); renderButtons(); renderInspector(); renderChart(); renderGenetics(); }
  function pause() { playing = false; clearTimeout(playTimer); if (lab) renderButtons(); }
  function cancel() { pause(); clearTimeout(stageTimer); busy = false; $('bird-head').hidden = true; $('bird-head').classList.remove('pecking'); touchDrag?.ghost?.remove(); touchDrag = null; clearDropTargets(); }
  function schedule() {
    clearTimeout(playTimer);
    if (playing) playTimer = setTimeout(advance, 1900 / Number($('speed').value));
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
    const bird = $('bird-head'), board = $('lineage-board');
    const rate = Math.sqrt(Number($('speed').value)), travel = 110 / rate, bite = 95 / rate;
    let index = 0;
    bird.hidden = false; bird.classList.remove('pecking');
    bird.style.transition = 'none'; bird.style.transform = `translate(-185px, ${$('jar-rail').offsetHeight}px)`;
    function visit() {
      if (index >= victims.length) {
        bird.classList.remove('pecking'); bird.style.transition = 'transform 180ms ease-in';
        bird.style.transform = `translate(${board.clientWidth + 50}px, ${$('jar-rail').offsetHeight}px)`;
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
        $('habitat-caption').textContent = `The bird has eaten ${index} of ${victims.length} beetles. The 24 survivors will breed.`;
        stageTimer = setTimeout(visit, bite);
      }, travel);
    }
    stageTimer = setTimeout(visit, 40);
  }
  function advance() {
    const counts = jarCounts();
    if (busy || (mode === 'breeding' && (!counts.ready || counts.partial))) return;
    const plan = mode === 'breeding' ? lab.planColumns({ pairs: jarParents.map(p => p.filter(Boolean)), mutationRate: settings().mutationRate }) : lab.plan(settings());
    busy = true; renderButtons();
    $('habitat-caption').textContent = mode === 'natural' ? 'The bird is looking for food. Camouflage helps, but chance matters too.' : 'Each jar is mixing its parents’ genes into six new offspring…';
    announce(mode === 'natural' ? 'The bird will eat 24 beetles; the survivors reproduce.' : 'Eight families are hatching. Each column has its own pair of parents.');
    function finish() {
      lastFamilies = plan.families || [];
      if (lastFamilies.length) familyRecords.push(...lastFamilies.map(f => ({ ...f, generation: lab.generation + 1 })));
      lab.commit(plan);
      jarParents = Array.from({ length: COLUMNS }, () => [null, null]);
      selected = []; inspected = null; busy = false;
      record(plan.mutations);
      createGrid(); render();
      const mutatedBeetles = plan.children.filter(b => b.mutations > 0).length;
      $('habitat-caption').textContent = `${lastFamilies.length ? '8 families · 6 siblings per column' : '48 new offspring · 24 surviving breeders'} · ${mutatedBeetles} beetles with mutations`;
      addObservation(`<strong>Gen ${lab.generation}</strong> · ${format(lab.stats(fromHex(habitat)).match)}% average camouflage. ${lastFamilies.length ? 'Eight pairs produced eight columns of siblings.' : 'The bird ate 24 beetles; the survivors reproduced.'} ${plan.mutations} mutated gene ${plan.mutations === 1 ? 'copy' : 'copies'}.`);
      announce(`Generation ${lab.generation}. ${format(lab.stats(fromHex(habitat)).match)} percent average camouflage. ${mutatedBeetles} offspring have mutations.`);
      schedule();
    }
    if (mode === 'natural') animatePredation(plan, finish);
    else stageTimer = setTimeout(finish, reducedMotion ? 70 : 600);
  }
  function changeHabitat(value, name) {
    habitat = value.toLowerCase(); habitatName = name;
    $('habitat-color').value = habitat;
    $('habitat-hex').textContent = habitat.toUpperCase();
    $('habitat-name').textContent = name;
    document.documentElement.style.setProperty('--habitat', habitat);
    const rgb = fromHex(habitat), brightness = .299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2];
    document.documentElement.style.setProperty('--habitat-ink', brightness < 110 ? '#fffce1' : '#203923');
    document.querySelectorAll('[data-habitat]').forEach(button => {
      const active = button.dataset.habitat === habitat;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    // Update accessible scores without recreating beetles or moving keyboard focus.
    document.querySelectorAll('.beetle').forEach((button, i) => {
      const b = lab.population[i];
      button.setAttribute('aria-label', `Beetle ${i + 1}, color ${hex(b.color)}, camouflage ${format(match(b.color, rgb) * 100)} percent`);
    });
    renderStats(); renderInspector(); renderChart();
  }
  function habitatEvent(value, name) {
    if (busy || habitat === value.toLowerCase()) return;
    changeHabitat(value, name);
    events.push({ generation: lab.generation, type: 'habitat', detail: `Habitat changed to ${name} (${habitat})` });
    renderChart();
    addObservation(`<strong>Habitat changed.</strong> Existing beetles keep their genes. Watch the next generations.`);
    $('habitat-caption').textContent = 'A new habitat. The same beetles. What will happen next?';
    announce('Habitat changed to ' + name + '. Beetle genes are unchanged.');
  }
  function setMode(next) {
    if (busy || mode === next) return;
    pause(); mode = next; selected = [];
    if (next === 'natural') jarParents = Array.from({ length: COLUMNS }, () => [null, null]);
    $('natural-mode').classList.toggle('active', mode === 'natural');
    $('breed-mode').classList.toggle('active', mode === 'breeding');
    $('natural-mode').setAttribute('aria-pressed', String(mode === 'natural'));
    $('breed-mode').setAttribute('aria-pressed', String(mode === 'breeding'));
    $('mode-hint').textContent = mode === 'natural' ? 'Birds are more likely to spot beetles that stand out.' : 'Each jar makes six siblings in its column. Empty jars use a random pair from that column.';
    events.push({ generation: lab.generation, type: 'mode', detail: `Changed to ${mode} mode` });
    renderSelection(); renderButtons();
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
    cancel(); lab = new Lab(42, 48); selected = []; inspected = null;
    history = []; observations = []; events = []; mode = 'natural';
    jarParents = Array.from({ length: COLUMNS }, () => [null, null]);
    lastFamilies = []; familyRecords = []; activeJar = 0; crossChannel = 0;
    habitat = '#8fa967'; habitatName = 'Meadow';
    $('pressure').value = 80; $('mutation').value = 3; $('speed').value = '1';
    $('bird-animation').checked = true;
    $('natural-mode').classList.add('active'); $('breed-mode').classList.remove('active');
    $('natural-mode').setAttribute('aria-pressed', 'true'); $('breed-mode').setAttribute('aria-pressed', 'false');
    $('mode-hint').textContent = 'Birds are more likely to spot beetles that stand out.';
    updateSliders(); record(); createGrid(); changeHabitat('#8fa967', 'Meadow');
    render();
    $('habitat-caption').textContent = 'A little variation is where the story begins.';
    addObservation('<strong>A fresh start.</strong> 48 beetles, each with a different mix of color genes.');
    announce('Experiment reset to generation zero. Notes are kept.');
  }
  function downloadCSV() {
    const quote = value => {
      // Keep student notes as text when opened in spreadsheet software.
      let s = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = [['Leaf & Lineage experiment', 'Seed', 42], ['Student notes', $('notes').value], [], ['generation', 'habitat', 'habitat_hex', 'mode', 'selection_strength', 'mutation_rate_per_copy', 'average_red', 'average_green', 'average_blue', 'average_color', 'camouflage_percent_at_birth', 'color_diversity_percent', 'mutated_gene_copies']];
    history.forEach(h => rows.push([h.generation, h.habitatName, h.habitat, h.mode, h.pressure, h.mutationRate, ...h.mean.map(v => v.toFixed(3)), hex(h.mean), h.match.toFixed(3), h.diversity.toFixed(3), h.mutations]));
    rows.push([], ['Events after generation', 'type', 'detail']);
    events.forEach(e => rows.push([e.generation, e.type, e.detail]));
    rows.push([], ['Jar families', 'generation', 'column', 'parent_a_id', 'parent_b_id', 'chosen_or_random', 'parent_a_genes_R1_R2_G1_G2_B1_B2', 'parent_b_genes_R1_R2_G1_G2_B1_B2']);
    familyRecords.forEach(f => rows.push(['Family', f.generation, f.column + 1, f.parents[0].id, f.parents[1].id, f.chosen ? 'chosen' : 'random', f.parents[0].genes.flat().join('/'), f.parents[1].genes.flat().join('/')]));
    rows.push([], ['Current generation beetles', 'id', 'red_copy_1', 'red_copy_2', 'green_copy_1', 'green_copy_2', 'blue_copy_1', 'blue_copy_2', 'parent_a_id', 'parent_b_id', 'mutated_gene_copies', 'column']);
    lab.population.forEach((b, i) => rows.push([i + 1, b.id, ...b.genes.flat(), b.parents[0] ?? '', b.parents[1] ?? '', b.mutations, i % COLUMNS + 1]));
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `leaf-and-lineage-generation-${lab.generation}.csv`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Experiment data and your notes downloaded as CSV.');
  }
  $('beetle-grid').addEventListener('click', event => {
    const button = event.target.closest('.beetle');
    if (!button || busy || performance.now() < suppressClickUntil) return;
    pause(); inspected = Number(button.dataset.id);
    renderSelection(); renderInspector(); renderButtons();
    const beetle = lab.population.find(b => b.id === inspected);
    $('habitat-caption').textContent = `Beetle ${lab.population.indexOf(beetle) + 1} · ${beetle.genes.map((pair, i) => `${['R', 'G', 'B'][i]} ${pair[0]}/${pair[1]}`).join(' · ')} · Two copies of each gene`;
    announce(`Selected beetle ${lab.population.findIndex(b => b.id === inspected) + 1}. Drag it to a jar, or click an empty jar slot to add it. Gene copies are shown in Field notes.`);
  });
  $('jar-rail').addEventListener('click', event => {
    const columnEl = event.target.closest('[data-jar]'), slotEl = event.target.closest('[data-slot]');
    if (!columnEl || busy) return;
    activeJar = Number(columnEl.dataset.jar);
    if (slotEl) {
      const slot = Number(slotEl.dataset.slot);
      if (jarParents[activeJar][slot]) jarParents[activeJar][slot] = null;
      else if (inspected) assignParent(activeJar, slot, inspected);
      else announce('First select a beetle on a leaf, then click the empty slot. You can also drag a beetle into it.');
    }
    renderSelection(); renderButtons();
    const focusSelector = slotEl ? `[data-slot="${slotEl.dataset.slot}"]` : '[data-action="inspect"]';
    $('jar-rail').querySelector(`[data-jar="${activeJar}"] ${focusSelector}`).focus({ preventScroll: true });
  });
  $('fill-jars').addEventListener('click', () => {
    if (busy || !jarParents[activeJar].every(Boolean)) return;
    const pair = jarParents[activeJar].slice();
    jarParents = Array.from({ length: COLUMNS }, () => pair.slice());
    renderSelection(); renderButtons(); announce('The same pair is in all eight jars. Compare eight samples of six siblings.');
  });
  $('clear-jars').addEventListener('click', () => { jarParents = Array.from({ length: COLUMNS }, () => [null, null]); renderSelection(); renderButtons(); announce('Parent jars cleared.'); });
  $('genetics-content').addEventListener('change', event => { if (event.target.id === 'gene-channel') { crossChannel = Number(event.target.value); renderGenetics(); $('gene-channel').focus({ preventScroll: true }); } });
  function clearDropTargets() { document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); }
  function dropInto(target, id) {
    const jar = target?.closest('[data-jar]');
    if (!jar) return;
    const column = Number(jar.dataset.jar), slot = target.closest('[data-slot]');
    assignParent(column, slot ? Number(slot.dataset.slot) : jarParents[column].findIndex(id => !id) === 0 ? 0 : 1, id);
  }
  $('beetle-grid').addEventListener('dragstart', event => event.preventDefault());
  // Pointer capture gives mouse, pen, and touch the same drag behavior.
  $('beetle-grid').addEventListener('pointerdown', event => {
    const button = event.target.closest('.beetle');
    if (!button || busy || event.button !== 0) return;
    touchDrag = { id: Number(button.dataset.id), startX: event.clientX, startY: event.clientY, pointer: event.pointerId, ghost: null };
  });
  $('beetle-grid').addEventListener('pointermove', event => {
    if (!touchDrag || touchDrag.pointer !== event.pointerId) return;
    if (!touchDrag.ghost && Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY) < 7) return;
    event.preventDefault();
    if (!touchDrag.ghost) {
      pause(); $('beetle-grid').setPointerCapture(event.pointerId);
      touchDrag.ghost = document.createElement('div'); touchDrag.ghost.className = 'drag-preview';
      touchDrag.ghost.innerHTML = beetleSVG(lab.population.find(b => b.id === touchDrag.id).color);
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
  const openGuide = () => { pause(); $('guide').showModal(); };
  $('help-open').addEventListener('click', openGuide);
  $('match-help').addEventListener('click', openGuide);
  $('help-close').addEventListener('click', () => $('guide').close());
  $('guide').addEventListener('click', event => { if (event.target === $('guide')) { const r = $('guide').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('guide').close(); } });
  // A hidden tab never keeps consuming cycles; resuming remains the student's choice.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  reset();
})();
