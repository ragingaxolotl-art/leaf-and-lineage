# Leaf & Lineage

[Teacher lab and classroom setup](https://ragingaxolotl-art.github.io/leaf-and-lineage/?teacher=1) · [Play the open lab](https://ragingaxolotl-art.github.io/leaf-and-lineage/)

An original beetle evolution and breeding simulation for school Chromebooks and modern browsers. No accounts, installation, database, build tools, analytics, external fonts, or paid services are required. All art is original SVG/CSS.

## Give students a configured link

1. Open **Classroom setup** in the teacher lab.
2. Choose 1–6 row populations, starting colors, habitat, population seed, selection strength, mutation rate, starting mode, bird animation, and speed.
3. Press **Create student link**, then **Copy student link**. Paste that complete link into the class assignment.
4. Use **Preview student view** to check it before sharing.

The link contains a preset code beginning `LL1.`. Students open directly into those starting conditions. Their view hides the odds, Punnett squares, carried genes, dominance hierarchy, mutation and selection settings, speed settings, teacher examples, and detailed genetics export. They can observe the bird, choose parents, breed a row, advance generations, record notes, and save visible observations. **Start over** restores the same class preset. No code entry or student account is required.

The teacher can paste an existing code or full student link under **Reuse an existing class code** to recover its setup. Changing a setup field invalidates the generated link until a new one is created. Incorrect codes display an error instead of silently starting a different experiment.

A code represents starting conditions, not a saved game or student work. The same seed and settings give everyone the same initial beetles; subsequent results depend on their choices. Codes contain no student information. This is a simplified classroom presentation, not an authenticated assessment lock: the public source and open teacher lab remain available.

## One jar fills only its row

Each row is a separate population of eight beetles, with its own generation counter and parent jar. Drag two living beetles into a jar, or select a beetle and click an empty + slot. Then press that jar's **Breed row** button. Only its eight beetles are replaced. Empty or unfinished jars leave their rows unchanged.

**Breed ready rows** advances all complete jars together. Parents may come from any row and may be reused in several jars; a pair requires two different living beetles. **Use pair in all jars** explicitly copies the active pair. References to parents that leave the board are cleared. The global **Round** counter counts completed steps; individual row generations can differ.

In natural selection, the bird eats four non-survivors per row. Each row's four survivors then produce its next eight offspring, with no automatic mixing between rows. Contrasting beetles are more likely to be eaten when selection is strong, but chance remains. The animation displays an outcome sampled before it begins. Reduced-motion preferences skip the moving bird. In student view, adding parents switches to breeding; **Let bird choose** returns to natural selection.

Use play/pause or step to control progress. Clicking a beetle pauses playback. An in-progress generation finishes when paused, and automatic playback stops when the tab is hidden. Reset cancels the current transition. Notes remain until the page is closed or reloaded; save observations before leaving.

On narrow screens, swipe sideways along a row. The jar stays aligned at its left. Mouse, trackpad, touch, pen, and the keyboard click alternative are supported.

## Hidden colors and random surprises — teacher reference

Each beetle carries two color alleles, one from each parent. This invented teaching hierarchy determines its visible color: **Green > Yellow > Blue > Red**. An allele can be carried without showing and inherited by a later generation. Dominance controls appearance, not survival quality.

For example, G/B × G/B produces G/G, G/B, B/G, or B/B with equal transmission chances: 75% green and 25% blue before mutation. Each baby is an independent draw, so a row of eight need not contain exactly two blue beetles. **Try a carrier cross** selects two existing green/blue carriers and sets mutation to zero in the teacher lab.

The teacher setup includes mixed colors, green beetles carrying blue, and green beetles carrying yellow or red. Offspring may reveal hidden colors. Separately, a mutation may change an inherited color allele to any of the other three colors, introducing yellow, red, blue, or green randomly. Mutation does not aim toward the habitat. At zero mutation, no color allele absent from the parents can appear.

Three diploid numeric shade genes make colors lighter, darker, or different in tone. Each allele is an integer from 0 to 255; one copy per locus comes from each parent. The visible RGB value is the color-family base plus one quarter of the shade-copy mean minus 128, clamped to 0–255. The four bases are green (122,156,80), yellow (209,178,65), blue (103,129,182), and red (190,95,76).

A mutation applies independently to eight inherited copies: two color alleles and six shade copies. Shade mutations shift by ±1–36 and stay within 0–255. Counts include copies whose values actually changed. The teacher's prediction enumerates 4 color transmissions × 4³ shade transmissions = 256 equally likely combinations before mutation. Duplicate visible colors are combined; the expected color averages all combinations. With dominance it need not equal the average of the two parent appearances.

Camouflage is `exp(-10 × d²)`, where `d²` is the mean squared normalized RGB distance to the habitat. This is a similarity score, not a survival probability or a full model of bird vision. Natural selection samples four survivors without replacement in each row, weighted by `(1-pressure) + pressure × (0.015 + camouflage²)`. Two distinct survivors are chosen uniformly for each baby. At zero pressure survival ignores color. Diversity measures RGB spread, and the teacher chart summarizes all rows after each round.

This model illustrates inheritance, recessive carriers, selection, mutation, and drift. It is not a claim about actual beetle color genetics. It omits linkage, sex, age, ecological feedback, and variable population sizes. The teacher field guide explains these limits and links to NHGRI genetics definitions.

## Run or download

Open **Leaf-and-Lineage.html** in a current browser for a self-contained offline version, where school device policy permits local HTML. Or keep all five files in `dist/` together and run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. A hosted copy is needed for links students can open on other devices. Offline copies still support codes, but their local file addresses are not shareable across devices.

## GitHub Pages

This repository publishes `dist/` on pushes to `main` through `.github/workflows/pages.yml`. In repository **Settings → Pages**, select **GitHub Actions** as the source. The workflow runs the model and preset tests before deployment.

For a simpler separate repository, upload the contents of `dist/` to its root and enable **Deploy from a branch → main → /(root)**. Relative asset paths support GitHub project sites. No API keys or backend are needed.

## Development and verification

Files in `dist/` are the editable published source. Run:

```sh
node --test tests/*.test.cjs
```

Tests cover seed reproducibility, hidden allele transmission, carrier ratios, all 256 combinations, mutations, row isolation, unchanged empty rows, invalid parent pairs, row counters, natural selection without cross-row mixing, selection versus drift, preset validation, coded URL round trips, zero/false settings, and damaged codes. Browser checks cover teacher link creation, applied student presets, hidden predictions and settings, parent selection, single-row breeding, the bird transition, reset, and responsive layout.

Student CSV files contain notes, row and round counters, beetle IDs, visible color names and hex colors. Teacher CSV files additionally include settings, measurements, family parentage, and genetic details. The app stores state only in the current tab.

## License

MIT. See LICENSE. Original implementation and assets inspired by a general memory of an educational simulation, without copied game artwork or branding.
