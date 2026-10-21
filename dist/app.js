/* All state stays in this tab. No external libraries, fonts, or services. */
(() => {
  'use strict';
  const { Lab, hex, fromHex, match, cross, PIGMENTS, pigmentInfo } = BeetleSim;
  const $ = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lab, habitat = '#8fa967', habitatName = 'Meadow', mode = 'natural';
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
  let jarParents = Array.from({ length: ROWS }, () => [null, null]);
  let activeJar = 0, crossChannel = -1, lastFamilies = Array(ROWS).fill(null), familyRecords = [], lastUpdatedRows = [];
  let suppressClickUntil = 0, touchDrag = null;
  const settings = () => ({ habitat: fromHex(habitat), pressure: Number($('pressure').value) / 100, mutationRate: Number($('mutation').value) / 100 });
  const announce = message => { $('announcement').textContent = message; };
  const format = n => Math.round(n);
  function beetleSVG(color, label = '') {
    return `<svg viewBox="0 0 60 76" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><g fill="none" stroke="#29382b" stroke-width="2.1" stroke-linecap="round"><path d="M18 28 10 21 5 23M16 39 6 37 2 42M19 50 10 57 5 55M42 28 50 21 55 23M44 39 54 37 58 42M41 50 50 57 55 55M24 13 19 5 14 3M36 13 41 5 46 3"/></g><ellipse cx="30" cy="18" rx="9" ry="10" fill="#344334"/><path d="M18 23Q30 15 42 23L43 30H17Z" fill="${hex(color.map(v => v * .7))}" stroke="#29382b" stroke-width="1.2"/><path d="M30 26C15 22 11 32 13 45C14 58 23 66 30 68C38 65 46 58 47 44C49 31 44 23 30 26Z" fill="${hex(color)}" stroke="#344334" stroke-width="1.4"/><path d="M30 27V66" fill="none" stroke="#283c2c" stroke-opacity=".55" stroke-width="1.2"/><path d="M20 31Q15 38 18 46" fill="none" stroke="#fff" stroke-opacity=".28" stroke-linecap="round" stroke-width="3"/><circle cx="26" cy="16" r="1.2" fill="#dddcc0"/><circle cx="34" cy="16" r="1.2" fill="#dddcc0"/><path d="M37 49Q40 44 39 36" fill="none" stroke="#192d24" stroke-opacity=".1" stroke-width="4" stroke-linecap="round"/></svg>`;
  }

  function alleleLabel(pair) { return pair.map(key => PIGMENTS[key].symbol).join('/'); }
  function carrierDescription(b) {
    const info = pigmentInfo(b.pigments);
    if (studentMode) return PIGMENTS[info.visible].name + ' beetle';
    return `${PIGMENTS[info.visible].name}${info.hidden ? `; carries hidden ${PIGMENTS[info.hidden].name.toLowerCase()}` : '; two matching color alleles'}`;
  }
  function jarMarkup(pair, row) {
    return `<div class="jar-column jar-row ${row === activeJar ? 'active' : ''} ${pair.every(Boolean) ? 'ready' : ''}" data-jar="${row}"><button class="jar-title" data-action="inspect" aria-label="Inspect row ${row + 1} jar" aria-pressed="${row === activeJar}">ROW ${row + 1} · JAR</button><div class="jar-vessel"><div class="jar-lid"></div><div class="jar-glass">${pair.map((id, slot) => {
      const b = lab.population.find(item => item.id === id);
      return `<button class="parent-drop ${b ? 'occupied' : ''}" data-slot="${slot}" aria-label="Row ${row + 1} parent ${slot ? 'B' : 'A'}${b ? `, beetle ${lab.population.indexOf(b) + 1}, ${carrierDescription(b)}, click to remove` : ', drop a beetle or click to add the selected beetle'}">${b ? beetleSVG(b.color) : '<span class="slot-plus">+</span>'}<span class="slot-letter">${b && !studentMode ? alleleLabel(b.pigments) : slot ? 'B' : 'A'}</span></button>`;
    }).join('')}</div></div><button class="row-breed" data-action="breed-row" ${pair.every(Boolean) ? '' : 'disabled'}>Breed row ${row + 1} →</button><button class="jar-odds teacher-only" data-action="inspect">${lastFamilies[row] ? `Review gen ${lastFamilies[row].generation} cross` : 'See offspring odds'}</button></div>`;
  }
  function createGrid() {
    $('beetle-grid').innerHTML = Array.from({ length: ROWS }, (_, row) => `<div class="population-row ${lastUpdatedRows.includes(row) ? 'row-updated' : ''}" data-population-row="${row}"><div class="jar-holder">${jarMarkup(jarParents[row], row)}</div><div class="row-population"><div class="row-meta"><strong>Population ${row + 1}</strong><span class="row-generation">Generation ${lab.rowGenerations[row]}</span><span>8 beetles</span></div><div class="row-beetles">${lab.population.slice(row * ROW_SIZE, (row + 1) * ROW_SIZE).map((b, col) => `<button class="beetle ${lastUpdatedRows.includes(row) ? 'newborn' : ''}" draggable="false" style="--tilt:${[-8, 5, -3, 9, -6, 4, 7, -4][col]}deg" data-id="${b.id}" data-row="${row}" aria-pressed="false" aria-label="Beetle ${row * ROW_SIZE + col + 1}, row ${row + 1}, ${carrierDescription(b)}${studentMode ? '' : `, camouflage ${format(match(b.color, fromHex(habitat)) * 100)} percent`}">${beetleSVG(b.color)}${b.mutations && !studentMode ? '<i class="mutation-dot" title="Inherited a mutation" aria-hidden="true"></i>' : ''}</button>`).join('')}</div></div></div>`).join('');
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
    if (studentMode) { $('genetics-content').innerHTML = ''; return; }
    const pair = jarParents[activeJar], draft = pair.filter(Boolean);
    const family = draft.length ? null : lastFamilies[activeJar];
    const parents = draft.length === 2 ? pair.map(id => lab.population.find(b => b.id === id)) : family?.parents;
    $('genetics-jar').textContent = 'Row ' + (activeJar + 1);
    if (!parents) {
      $('genetics-content').innerHTML = `<p class="genetics-empty">${draft.length ? 'One parent is ready. Add a second beetle to reveal their offspring possibilities.' : 'Put two parents in this row’s jar. Only this row will get their eight offspring; empty rows stay exactly as they are.'}</p><p class="genetics-footnote">Colors can be hidden: a green beetle may carry blue, yellow, or red. Select a beetle to inspect its two color alleles, or try the carrier cross above.</p>`;
      return;
    }
    const prediction = cross(parents[0], parents[1]), channel = crossChannel;
    const percentage = n => (n * 100).toFixed(1).replace(/\.0$/, '') + '%';
    const pigmentMode = channel < 0;
    const copiesA = pigmentMode ? parents[0].pigments : parents[0].genes[channel];
    const copiesB = pigmentMode ? parents[1].pigments : parents[1].genes[channel];
    const label = v => pigmentMode ? `${PIGMENTS[v].symbol} · ${PIGMENTS[v].name}` : v;
    const cell = (av, bv) => {
      if (!pigmentMode) return `<strong>${(av + bv) / 2}</strong><small>(${av} + ${bv}) ÷ 2</small>`;
      const info = pigmentInfo([av, bv]);
      return `<i class="punnett-color" style="background:${hex(PIGMENTS[info.visible].color)}"></i><strong>${PIGMENTS[info.visible].name}</strong><small>${alleleLabel([av, bv])}${info.hidden ? ` · carries ${PIGMENTS[info.hidden].name.toLowerCase()}` : ''}</small>`;
    };
    $('genetics-content').innerHTML = `<div class="cross-parents">${parents.map((b, i) => `<div>${beetleSVG(b.color)}<p><strong>Parent ${i ? 'B' : 'A'} · ${alleleLabel(b.pigments)}</strong><span>${carrierDescription(b)}</span></p></div>`).join('<span class="cross-plus">×</span>')}<p class="cross-context">${family ? `The pair that made row ${activeJar + 1}, generation ${family.generation}.` : `Eight babies for row ${activeJar + 1}. Other rows stay unchanged.`}</p></div><div class="possibility-layout"><div class="punnett-block"><label for="gene-channel">What is inherited? <select id="gene-channel"><option value="-1" ${pigmentMode ? 'selected' : ''}>Color & hidden alleles</option>${['Red shade', 'Green shade', 'Blue shade'].map((name, i) => `<option value="${i}" ${i === channel ? 'selected' : ''}>${name}</option>`).join('')}</select></label><table class="punnett"><caption>Each cell is a 25% chance, before mutation.</caption><thead><tr><th>A ↓ / B →</th>${copiesB.map(v => `<th scope="col">${label(v)}</th>`).join('')}</tr></thead><tbody>${copiesA.map(av => `<tr><th scope="row">${label(av)}</th>${copiesB.map(bv => `<td>${cell(av, bv)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="color-possibilities"><p class="possibility-heading">Chance for each baby’s visible color</p><div class="pigment-chances">${prediction.pigmentChances.map(o => `<div><i style="background:${hex(PIGMENTS[o.pigment].color)}"></i><span>${PIGMENTS[o.pigment].name}</span><strong>${percentage(o.probability)}</strong><span class="chance-bar" style="--chance:${o.probability * 100}%;--pigment:${hex(PIGMENTS[o.pigment].color)}"></span></div>`).join('')}</div><p class="hidden-explanation">A hidden allele still passes to a baby with a 50% chance. It can show when the other parent also passes a compatible allele.</p><details class="shade-options"><summary>See all 256 color + shade combinations</summary><div class="possibility-dots" role="img" aria-label="256 equally likely color and shade transmissions before mutation.">${prediction.combinations.map(color => `<i style="background:${hex(color)}" title="${hex(color).toUpperCase()}"></i>`).join('')}</div></details></div></div><p class="genetics-footnote">Eight babies are independent draws, so a 25% chance does not promise exactly two babies. In this teaching model, Green masks Yellow, Blue, and Red; Yellow masks Blue and Red; Blue masks Red. Dominance decides which color shows; the habitat decides camouflage. Mutation can randomly introduce any of the four color alleles.</p>`;
  }

  function assignParent(row, slot, id) {
    if (presetError || busy || !lab.population.some(b => b.id === id)) return;
    if (jarParents[row][1 - slot] === id) { announce('A jar needs two different beetles. Choose another parent.'); return; }
    if (mode !== 'breeding') setMode('breeding');
    pause(); activeJar = row; jarParents[row][slot] = id;
    renderSelection(); renderButtons();
    announce(`Beetle added to row ${row + 1} jar. ${jarParents[row].filter(Boolean).length} of two parents ready.`);
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
      svg += `<text x="${x(g)}" y="133" text-anchor="middle">R${g}</text>`;
    }
    // Event markers use a contrasting dashed stroke and remain part of the CSV.
    events.filter(e => e.type === 'habitat').slice(-30).forEach(e => {
      svg += `<line x1="${x(e.generation)}" y1="${top}" x2="${x(e.generation)}" y2="${bottom}" stroke="#b18d52" stroke-dasharray="3 3"><title>Habitat changed at generation ${e.generation}</title></line>`;
    });
    if (history.length > 1) {
      const path = sampled.map((h, i) => `${i ? 'L' : 'M'}${x(h.generation).toFixed(2)},${y(h.match).toFixed(2)}`).join(' ');
      svg += `<path d="${path} L${x(lab.generation)},${bottom} L${left},${bottom} Z" fill="#eff3e5"/><path d="${path}" fill="none" stroke="#78914e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else svg += '<text x="370" y="60" text-anchor="middle" class="chart-empty">Every round adds to the story.</text>';
    const last = history[history.length - 1];
    svg += `<circle cx="${x(last.generation)}" cy="${y(last.match)}" r="4" fill="#78914e" stroke="#fffef9" stroke-width="2"/>`;
    $('history-chart').innerHTML = svg;
    $('history-chart').setAttribute('aria-label', `Average camouflage after each round: round 0, ${format(history[0].match)} percent; round ${last.generation}, ${format(last.match)} percent. ${events.filter(e => e.type === 'habitat').length} habitat changes.`);
    const count = Math.min(7, history.length);
    const indices = Array.from({ length: count }, (_, i) => count === 1 ? 0 : Math.round(i * (history.length - 1) / (count - 1)));
    $('color-timeline').innerHTML = indices.map(i => `<span class="color-sample" style="flex:1"><i style="background:${hex(history[i].mean)}" title="Average color ${hex(history[i].mean)}"></i>Round ${history[i].generation}</span>`).join('');
  }
  function renderStats() {
    const stats = lab.stats(fromHex(habitat));
    $('generation').textContent = String(lab.generation).padStart(2, '0');
    $('match').textContent = format(stats.match) + '%';
    $('diversity').textContent = stats.diversity.toFixed(1) + '%';
    $('average-hex').textContent = hex(stats.mean).toUpperCase();
    $('average-swatch').style.background = hex(stats.mean);
    $('board-label').textContent = 'ROUND ' + lab.generation;
    const previous = history.length > 1 ? history[history.length - 2] : null;
    if (previous && previous.habitat === habitat) {
      const delta = stats.match - previous.match;
      $('match-change').textContent = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} points this round`;
    } else $('match-change').textContent = lab.generation ? 'Measured in this habitat' : 'Our starting point';
  }
  function renderButtons() {
    const manual = mode === 'breeding';
    const counts = jarCounts();
    $('student-natural').hidden = !studentMode || !manual;
    $('play').disabled = manual;
    $('speed').disabled = manual;
    $('step').disabled = busy || (manual && !counts.ready);
    $('play').querySelector('span').textContent = playing ? 'Pause' : lab.generation ? 'Keep evolving' : 'Start evolving';
    $('play').querySelector('svg').innerHTML = playing ? '<path d="M5 4h3v12H5ZM12 4h3v12h-3Z" fill="currentColor" stroke="none"/>' : '<path d="m6 3 11 7-11 7Z" fill="currentColor" stroke="none"/>';
    $('step').querySelector('span').textContent = manual ? 'Breed ready rows' : 'Next generation';
    $('state-pill').innerHTML = `<i></i>${busy ? manual ? 'New families hatching' : 'The bird is feeding' : playing ? 'Evolution in progress' : manual ? `${counts.ready}/${ROWS} rows ready` : lab.generation ? 'Paused · take a closer look' : 'Ready to explore'}`;
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
    document.querySelectorAll('[data-action="breed-row"]').forEach(b => b.disabled = busy || !jarParents[Number(b.closest('[data-jar]').dataset.jar)].every(Boolean));
    $('carrier-demo').disabled = busy || lab.population.filter(b => b.pigments.includes('green') && b.pigments.includes('blue')).length < 2;
    $('jar-status').textContent = manual ? `${counts.ready} row${counts.ready === 1 ? '' : 's'} ready · only complete jars breed. Empty or unfinished rows stay unchanged.` : 'Each row is its own population. Natural selection stays within rows; a jar replaces only its own row.';
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
    $('parent-tray').hidden = mode !== 'breeding';
    if (mode === 'breeding') {
      $('parent-tray').innerHTML = '<strong>One jar → one family.</strong> Each row holds eight beetles. A complete jar replaces only that row; empty rows keep their beetles, genes, and generation.';
    }
    $('board-instruction').textContent = mode === 'breeding' ? 'Drag two parents into a row’s jar' : 'Drag to breed · click to inspect';
    renderJars(); renderGenetics();
  }

  function renderInspector() {
    if (studentMode) {
      const b = lab.population.find(item => item.id === inspected);
      $('inspector').innerHTML = b ? `<div class="gene-card">${beetleSVG(b.color)}<p><strong>${PIGMENTS[pigmentInfo(b.pigments).visible].name} beetle</strong><span>Drag it into a jar, or select it and click a + slot. Only that jar’s row will get the offspring.</span></p></div>` : '<span class="inspect-icon" aria-hidden="true">⌕</span><p><strong>Observe. Predict. Try it.</strong><span>Select a beetle to choose a parent for a row.</span></p>';
      return;
    }
    const b = lab.population.find(item => item.id === inspected);
    if (!b) { $('inspector').innerHTML = '<span class="inspect-icon" aria-hidden="true">⌕</span><p><strong>Visible color is only part of the story.</strong><span>Select a beetle to discover the color it carries.</span></p>'; return; }
    const index = lab.population.indexOf(b) + 1, row = Math.floor((index - 1) / ROW_SIZE), info = pigmentInfo(b.pigments);
    $('inspector').innerHTML = `<div class="gene-card">${beetleSVG(b.color, `Beetle ${index}`)}<div class="gene-details"><div class="gene-heading"><strong>Beetle ${index} · Row ${row + 1}</strong><small>${format(match(b.color, fromHex(habitat)) * 100)}% match</small></div><p class="carrier-detail"><strong>Shows ${PIGMENTS[info.visible].name} · ${alleleLabel(b.pigments)}</strong><span>${info.hidden ? `Carries hidden ${PIGMENTS[info.hidden].name.toLowerCase()}. It can pass this allele to offspring.` : 'Both color alleles match. No different color is hidden here.'}</span></p><details><summary>Shade genes</summary><div class="gene-values">${b.genes.map((pair, i) => `<span>${['R', 'G', 'B'][i]} ${pair[0]} / ${pair[1]}</span>`).join('')}</div></details><p class="lineage">${b.parents.length ? `Parents: IDs ${b.parents.join(' & ')} · ${b.pigmentMutations} color-allele mutations` : 'Starting population'} · Row generation ${lab.rowGenerations[row]}</p></div></div>`;
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
        $('habitat-caption').textContent = `The bird has eaten ${index} of ${victims.length} beetles. ${plan.breeders.length} survivors will breed within their own rows.`;
        stageTimer = setTimeout(visit, bite);
      }, travel);
    }
    stageTimer = setTimeout(visit, 40);
  }

  function advance(onlyRow = null) {
    const pairs = jarParents.map((pair, row) => pair.every(Boolean) && (onlyRow === null || row === onlyRow) ? pair.slice() : []);
    if (presetError || busy || (mode === 'breeding' && !pairs.some(p => p.length))) return;
    const plan = mode === 'breeding' ? lab.planRows({ pairs, mutationRate: settings().mutationRate }) : lab.plan(settings());
    busy = true; renderButtons();
    $('habitat-caption').textContent = mode === 'natural' ? 'The bird is feeding. Four survivors in each row will breed within their own population.' : `Breeding ${plan.updatedRows.map(r => 'row ' + (r + 1)).join(', ')}. Other populations stay unchanged…`;
    function finish() {
      if (plan.mode === 'natural') lastFamilies = Array(ROWS).fill(null);
      else plan.families.forEach(f => { lastFamilies[f.row] = f; familyRecords.push(f); });
      lab.commit(plan); lastUpdatedRows = plan.updatedRows;
      const livingIds = new Set(lab.population.map(b => b.id));
      jarParents = jarParents.map((pair, row) => plan.updatedRows.includes(row) ? [null, null] : pair.map(id => livingIds.has(id) ? id : null));
      inspected = livingIds.has(inspected) ? inspected : null; busy = false;
      record(plan.mutations); createGrid(); render();
      const newborns = plan.updatedRows.flatMap(row => lab.population.slice(row * ROW_SIZE, (row + 1) * ROW_SIZE));
      const colorMutations = newborns.reduce((sum, b) => sum + b.pigmentMutations, 0);
      $('habitat-caption').textContent = `${plan.updatedRows.length} row${plan.updatedRows.length === 1 ? '' : 's'} advanced · ${newborns.length} offspring ${studentMode ? '' : `· ${colorMutations} color-allele mutations`}`;
      addObservation(`<strong>Round ${lab.generation}</strong> · ${plan.mode === 'breeding' ? `Rows ${plan.updatedRows.map(r => r + 1).join(', ')} received eight offspring each. All other rows stayed unchanged.` : 'Each row’s four survivors produced its next eight beetles.'}${studentMode ? '' : ` ${colorMutations} random color-allele mutations.`}`);
      announce(`Round ${lab.generation}. ${newborns.length} new beetles in ${plan.updatedRows.length} rows. Other rows are unchanged.`); schedule();
    }
    if (mode === 'natural') animatePredation(plan, finish); else stageTimer = setTimeout(finish, reducedMotion ? 70 : 600);
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
      button.setAttribute('aria-label', `Beetle ${i + 1}, row ${Math.floor(i / ROW_SIZE) + 1}, ${carrierDescription(b)}${studentMode ? '' : `, camouflage ${format(match(b.color, rgb) * 100)} percent`}`);
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
    if (presetError || busy || mode === next) return;
    pause(); mode = next; selected = [];
    if (next === 'natural') jarParents = Array.from({ length: ROWS }, () => [null, null]);
    $('natural-mode').classList.toggle('active', mode === 'natural');
    $('breed-mode').classList.toggle('active', mode === 'breeding');
    $('natural-mode').setAttribute('aria-pressed', String(mode === 'natural'));
    $('breed-mode').setAttribute('aria-pressed', String(mode === 'breeding'));
    $('mode-hint').textContent = mode === 'natural' ? 'Birds are more likely to spot beetles that stand out.' : 'Each jar fills only its own row with eight offspring. Empty rows do not change.';
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
    cancel(); ROWS = startPreset.rows; lab = new Lab(startPreset.seed, ROWS * ROW_SIZE, ROW_SIZE, startPreset.scenario); selected = []; inspected = null;
    history = []; observations = []; events = []; mode = startPreset.mode;
    jarParents = Array.from({ length: ROWS }, () => [null, null]);
    lastFamilies = Array(ROWS).fill(null); familyRecords = []; lastUpdatedRows = []; activeJar = 0; crossChannel = -1;
    habitat = startPreset.habitat; habitatName = ({ '#8fa967': 'Meadow', '#b17b56': 'Dry leaves', '#7785a1': 'Dusk' })[habitat] || 'Custom';
    $('pressure').value = startPreset.pressure; $('mutation').value = startPreset.mutation; $('speed').value = String(startPreset.speed);
    $('bird-animation').checked = startPreset.bird;
    $('natural-mode').classList.toggle('active', mode === 'natural'); $('breed-mode').classList.toggle('active', mode === 'breeding');
    $('natural-mode').setAttribute('aria-pressed', String(mode === 'natural')); $('breed-mode').setAttribute('aria-pressed', String(mode === 'breeding'));
    $('mode-hint').textContent = mode === 'natural' ? 'Birds are more likely to spot beetles that stand out.' : 'Each jar fills only its own row with eight offspring. Empty rows do not change.';
    updateSliders(); record(); createGrid(); changeHabitat(habitat, habitatName);
    document.querySelector('.population-tag').textContent = lab.size + ' beetles';
    render();
    $('habitat-caption').textContent = 'A little variation is where the story begins.';
    addObservation(studentMode ? '<strong>A fresh start.</strong> Observe the colors and predict what the next offspring might look like.' : `<strong>A fresh start.</strong> ${ROWS} separate row populations, with hidden colors and random mutation.`);
    announce('Experiment reset. All row generations are zero. Notes are kept.');
  }
  function downloadCSV() {
    const quote = value => {
      // Keep student notes as text when opened in spreadsheet software.
      let s = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    let rows = [['Leaf & Lineage experiment', 'Seed', startPreset.seed], ['Student notes', $('notes').value], [], ['round', 'habitat', 'habitat_hex', 'mode', 'selection_strength', 'mutation_rate_per_copy', 'average_red', 'average_green', 'average_blue', 'average_color', 'camouflage_percent_at_birth', 'color_diversity_percent', 'mutated_gene_copies']];
    history.forEach(h => rows.push([h.generation, h.habitatName, h.habitat, h.mode, h.pressure, h.mutationRate, ...h.mean.map(v => v.toFixed(3)), hex(h.mean), h.match.toFixed(3), h.diversity.toFixed(3), h.mutations]));
    rows.push([], ['Events after generation', 'type', 'detail']);
    events.forEach(e => rows.push([e.generation, e.type, e.detail]));
    rows.push([], ['Jar families', 'row_generation', 'row', 'parent_a_id', 'parent_b_id', 'round', 'parent_a_color_alleles', 'parent_b_color_alleles']);
    familyRecords.forEach(f => rows.push(['Family', f.generation, f.row + 1, f.parents[0].id, f.parents[1].id, f.round, f.parents[0].pigments.join('/'), f.parents[1].pigments.join('/')]));
    rows.push([], ['Current generation beetles', 'id', 'red_copy_1', 'red_copy_2', 'green_copy_1', 'green_copy_2', 'blue_copy_1', 'blue_copy_2', 'parent_a_id', 'parent_b_id', 'mutated_gene_copies', 'row', 'row_generation', 'color_allele_a', 'color_allele_b', 'visible_color', 'hidden_color', 'color_allele_mutations']);
    lab.population.forEach((b, i) => rows.push([i + 1, b.id, ...b.genes.flat(), b.parents[0] ?? '', b.parents[1] ?? '', b.mutations, Math.floor(i / ROW_SIZE) + 1, lab.rowGenerations[Math.floor(i / ROW_SIZE)], ...b.pigments, pigmentInfo(b.pigments).visible, pigmentInfo(b.pigments).hidden || '', b.pigmentMutations]));
    if (studentMode) {
      rows = [['Leaf & Lineage observations'], ['Student notes', $('notes').value], [], ['round', 'row', 'row_generation', 'beetle_id', 'visible_color', 'hex_color']];
      lab.population.forEach((b, i) => { const row = Math.floor(i / ROW_SIZE); rows.push([lab.generation, row + 1, lab.rowGenerations[row], b.id, PIGMENTS[pigmentInfo(b.pigments).visible].name, hex(b.color)]); });
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
    const beetle = lab.population.find(b => b.id === inspected);
    $('habitat-caption').textContent = studentMode ? 'Parent selected. Drag it to a row’s jar, or click an empty + slot.' : `Beetle ${lab.population.indexOf(beetle) + 1} · ${carrierDescription(beetle)} · Alleles ${alleleLabel(beetle.pigments)}`;
    announce(`Selected beetle ${lab.population.findIndex(b => b.id === inspected) + 1}. Drag it to a jar, or click an empty jar slot to add it. Only the chosen jar’s row will be replaced.`);
  });
  $('beetle-grid').addEventListener('click', event => {
    const columnEl = event.target.closest('[data-jar]'), slotEl = event.target.closest('[data-slot]');
    if (!columnEl || busy) return;
    activeJar = Number(columnEl.dataset.jar);
    if (event.target.closest('[data-action="breed-row"]')) { if (mode !== 'breeding') setMode('breeding'); advance(activeJar); return; }
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
    const carriers = lab.population.filter(b => b.pigments.includes('green') && b.pigments.includes('blue'));
    if (busy || carriers.length < 2) return;
    if (mode !== 'breeding') setMode('breeding');
    jarParents[activeJar] = carriers.slice(0, 2).map(b => b.id);
    $('mutation').value = 0; updateSliders(); crossChannel = -1;
    renderSelection(); renderButtons();
    announce('Two green parents carrying blue are ready. Each baby has a 25 percent chance to show blue, without mutation.');
  });
  $('clear-jars').addEventListener('click', () => { jarParents = Array.from({ length: ROWS }, () => [null, null]); renderSelection(); renderButtons(); announce('Parent jars cleared.'); });
  $('genetics-content').addEventListener('change', event => { if (event.target.id === 'gene-channel') { crossChannel = Number(event.target.value); renderGenetics(); $('gene-channel').focus({ preventScroll: true }); } });
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
  function setupClassroom() {
    if (studentMode) {
      document.querySelector('.brand').href = location.href;
      document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); $('lab').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); });
      document.querySelector('.intro-copy').textContent = 'Choose parents. Follow the generations. Discover what the next beetles might look like.';
      $('classroom-badge').hidden = false;
      $('classroom-badge').textContent = 'CLASSROOM INVESTIGATION';
      $('guide').innerHTML = `<button id="student-guide-close" class="dialog-close" aria-label="Close instructions">×</button><p class="eyebrow">YOUR INVESTIGATION</p><h2 id="guide-title">Observe, predict, and experiment.</h2><p>Each row is a separate population. Drag two beetles into that row’s jar, or select a beetle then click a + slot. Press Breed row to replace only that population with its offspring. Other rows stay the same.</p><p>Use Start evolving to observe the bird selecting survivors. After choosing parents yourself, Let bird choose returns to natural selection. Your teacher has already set up the starting conditions.</p><p>Describe which colors appear, what surprises you, and what you predict will happen next. Save data keeps your notes and observations. Start over returns to the same class preset.</p>`;
      $('student-guide-close').addEventListener('click', () => $('guide').close());
    }
    $('reset-student').addEventListener('click', reset);
    $('download-student').addEventListener('click', downloadCSV);
    $('student-natural').addEventListener('click', () => setMode('natural'));
    function formPreset() {
      return LeafPresets.validate({ seed: Number($('class-seed').value), rows: Number($('class-rows').value), habitat: $('class-habitat').value, pressure: Number($('class-pressure').value), mutation: Number($('class-mutation').value), mode: $('class-mode').value, bird: $('class-bird').checked, speed: Number($('class-speed').value), scenario: $('class-scenario').value });
    }
    function fillForm(preset) {
      for (const field of ['seed','rows','habitat','pressure','mutation','mode','speed','scenario']) $('class-' + field).value = String(preset[field]);
      $('class-bird').checked = preset.bird;
    }
    function createLink() {
      try {
        const preset = formPreset(), code = LeafPresets.encode(preset), url = new URL(location.href);
        url.search = ''; url.hash = 'lab=' + code;
        $('student-link').value = url.href; $('student-code').value = code;
        $('student-preview').href = url.href; $('student-preview').hidden = false;
        $('classroom-message').textContent = 'Ready. This student link hides the odds, carried genes, dominance hierarchy, and difficulty controls.';
        $('copy-student-link').disabled = false;
      } catch (error) { $('classroom-message').textContent = error.message; }
    }
    $('classroom-open').addEventListener('click', () => {
      pause();
      fillForm({ ...startPreset, rows: ROWS, habitat, pressure: Number($('pressure').value), mutation: Number($('mutation').value), mode, bird: $('bird-animation').checked, speed: Number($('speed').value) });
      $('classroom-dialog').showModal(); createLink();
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
