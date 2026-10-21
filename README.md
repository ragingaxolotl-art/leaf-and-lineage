# Leaf & Lineage

[Teacher setup](https://ragingaxolotl-art.github.io/leaf-and-lineage/?teacher=1) · [Open lab](https://ragingaxolotl-art.github.io/leaf-and-lineage/)

An original beetle evolution and breeding simulation for school Chromebooks and modern browsers. No accounts, installation, database, analytics, external fonts, or paid services are required. All art is original SVG/CSS.

## Make a student link

1. Open **Classroom setup**.
2. Set the row count, starting population, solid or Neapolitan habitat, seed, selection strength, mutation rate (a whole number from 0 to 20%), and animation speed.
3. Choose **Bird mode only**, **Breeding mode only**, or **Both · students can switch**.
4. Check **Students may change environments** if students should control their own backgrounds. Otherwise the assigned environment stays fixed.
5. Check **Show students all stats and genetics** to reveal the full measurements, history chart, inherited gene copies, family parentage, offspring odds for allowed breeding, and detailed data downloads. Leave it unchecked for the simplified student view.
6. Press **Create student link → Copy student link** and paste the complete link into the assignment. **Preview student view** shows exactly what students receive.

The code is already included in the link. Students open directly into the chosen preset, with the chosen statistics visibility already applied. Full stats shows experiment settings as read-only values; it does not unlock settings sliders or teacher setup. Environment permission and activity permissions travel with the code. A bird-only class has no jars or breeding switch; a breeding-only class has no bird controls. With both enabled, students can switch between choosing parents and natural selection. Choosing parents and bird selection are separate activities; the bird does not automatically hunt after a manual breeding step.

When environment changes are allowed, students get Meadow, Dry leaves, Dusk, Neapolitan, and a custom color picker. Changing the background preserves every existing beetle and its genes. It affects camouflage and future natural selection. Controls pause during a generation transition, then become available again. Switching environments during breeding changes the background but does not introduce bird selection.

**Start over** restores the assigned starting population, habitat, and activity. Notes remain until the page closes or reloads. A preset code contains starting conditions, not student information or a saved game. The same seed and presets give everyone the same starting beetles; later choices determine later results. The teacher can paste a code or full student link under **Reuse an existing class code** to load its setup.

New links use `LL4` codes, which include the full-stats choice and the Neapolitan layout with three colors. Older `LL3` codes retain their full-stats choice and use a solid habitat. Older `LL2` links retain their activity and environment permissions, with full stats off. Previously shared `LL1` links remain valid, enabling both activities and a fixed environment. They use the revised inheritance model, so older codes retain their setup choices but do not reproduce the previous genetics model's exact beetles. Codes simplify the classroom view; they are not authentication or an assessment security boundary. The source and open teacher lab remain public.

## Each jar replaces only its row

Every row is an independent population with room for eight beetles with its own generation counter. Drag two different living beetles into its jar, or select a beetle and click an empty + slot. Press **Breed row** to replace only that row. Empty and unfinished jars leave their rows unchanged.

**Next generation** advances all complete jars once. **Play** continues advancing complete jars until paused. Parents may come from any row and may be reused across jars. **Use pair in all jars** explicitly copies the active pair. Original parents stay saved in their jars, even after their offspring replace the row or the activity switches. Each later brood uses the same original pair until a parent is replaced or removed. Repeated broods of a pair are siblings rather than descendant generations. Select offspring as new parents to follow inheritance down later generations. Global **Round** counts completed experiment steps; row generations can differ.

In bird mode, every insect gets one independent survival roll. The bird can eat any number, including zero or all. Each row with at least two survivors produces eight offspring. A lone survivor stays on its own leaf and produces no offspring; zero survivors leaves an empty row. There is no forced survivor quota, rescue selection, or reroll. Natural selection never automatically mixes rows. Contrasting beetles are more likely to be eaten when selection is strong, but chance remains. The bird animation displays an already-sampled survival outcome. Turning the animation off does not turn selection off. Reduced-motion preferences skip the moving bird.

**Next generation** advances exactly once. **Play** keeps advancing, and becomes **Pause** while running. This works in both bird and breeding modes. Breeding Play reuses the original parents in each complete jar; it does not automatically choose new offspring as parents. Empty jars never auto-fill. Selecting a beetle pauses playback. A generation already in progress finishes when paused. Playback stops when the tab is hidden or no beetles remain in bird mode, and reset cancels transitions. On small screens, swipe sideways along a row; its jar stays at the left. Mouse, trackpad, touch, pen, and keyboard click-to-add are supported.

## Neapolitan environments

Neapolitan is a fourth environment beside Meadow, Dry leaves, and Dusk. It divides the board’s leaf area into three continuous vertical bands of equal width, with colors set by the teacher. The bands span all rows and the spaces between them. The defaults are Meadow, Dry leaves, and Dusk. Each insect’s camouflage and survival chance use the band directly behind its own leaf. With eight leaf columns, columns 1–3 occupy the left third, 4–5 the middle third, and 6–8 the right third. The jars sit outside these survival zones.

The teacher can share a fixed Neapolitan preset or allow students to switch environments. Changing layouts or colors never changes existing beetles or their genes. Surviving parents reproduce within their row; offspring occupy that row’s leaf positions. Full stats shows each selected insect’s actual background and survival chance.

## Inherited surprises — teacher reference

The previous fixed ranking of color alleles has been replaced by interacting inherited genes. Each baby receives one copy of each gene from each parent. Those copies can pass through later generations and recombine into contrasting offspring, even with mutation set to zero. The game does not assign a green parent a separate fixed label such as “hidden blue.”

This original teaching model has six binary color genes and three numeric shade genes, each with two copies. Two color genes form each of three pathways: yellow, red, and blue. A pathway activates when both gene pairs are 1/1. For two parents with 0/1 at both genes, a pathway activates in 1/16 transmissions. With all six color genes varied, a pure contrasting family such as red has probability `(1/16) × (15/16)²`, about 5.49%, before mutation. Eight babies are independent draws; no contrasting baby is guaranteed in a particular row.

The pathways combine rather than masking one another. The base green RGB is (122,156,80). Active yellow adds (87,22,-15), red adds (68,-61,-4), and blue adds (-19,-27,102). Multiple active pathways create orange, teal, purple, or mixed families. Colors are clamped to 0–255. Three additional shade genes contribute one quarter of their copy mean minus 128 to each RGB channel. This creates varied shades within a family.

Teacher starting scenarios include mixed colors, green beetles with inherited blue possibilities, and green beetles with inherited yellow and red possibilities. **Try an inheritance cross** selects two living green beetles with varied copies and turns mutation off. The teacher preview calculates pathway activation probabilities and the resulting eight family patterns, then combines them with 64 shade transmissions. Duplicate RGB outcomes are grouped with their probability weights. Students can see the preview and genetic export when their teacher enables full stats. With full stats off, the preview, genetic inspector details, charts, and detailed export stay hidden.

Mutations are separate from inherited recombination. A transmitted binary copy may flip between 0 and 1; a shade copy may shift by ±1–36, staying within 0–255. The mutation rate applies independently to 18 inherited copies. Mutations do not target the environment. A copy lost from every living beetle is not kept in an invisible ancestral archive; reintroduction requires mutation. Parent IDs and actual inherited copies are retained in the teacher data export.

Camouflage is `exp(-10 × d²)`, where `d²` is mean squared normalized RGB distance to the habitat. It is a similarity score, not a survival probability or a full model of bird vision. Every living insect is rolled once against survival probability `(1-pressure) × 0.7 + pressure × (0.1 + 0.8 × camouflage²)`. At zero pressure, survival ignores color and has a 70% chance for every insect. At full pressure, perfect camouflage gives 90% survival, while very poor camouflage approaches 10%. The population size is not used to force a target survivor count. Where a row has at least two survivors, two distinct survivors are chosen uniformly for each offspring. Diversity measures color spread; the teacher chart combines all row populations after each round.

This invented pathway model illustrates inherited variation, interactions between genes, selection, mutation, and drift. It does not claim to reproduce actual beetle color genetics. Genes inherit independently, each row has capacity eight but may become empty, and selection depends only on camouflage and chance.

## Run or download

Open **Leaf-and-Lineage.html** in a current browser for a self-contained offline version, where school device policy permits local HTML. Alternatively keep all five files in `dist/` together and run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Share hosted URLs for access on other devices. A downloaded page's local file address is not shareable across devices.

## Publish on GitHub Pages

This repository publishes `dist/` on pushes to `main` through `.github/workflows/pages.yml`. Repository **Settings → Pages** uses **GitHub Actions** as its source. Tests run before deployment.

For a separate simpler repository, upload the contents of `dist/` to its root and enable **Deploy from a branch → main → /(root)**. Relative paths work on project sites. No build step, backend, or API keys are required.

## Verification and data

The editable published source is in `dist/`. Run:

```sh
node --test tests/*.test.cjs
```

Tests cover inherited copies, contrasting offspring at zero mutation, multigeneration inheritance, exhaustive color transmissions versus predicted probabilities, combined pathways, mutation, reproducibility, unchanged empty rows, jar isolation, parent validity, row counters, independent survival rolls, varying hunt counts, single-survivor and extinction outcomes, saved-parent broods, per-leaf Neapolitan backgrounds, selection and drift, classroom permissions, coded URL round trips, old code compatibility, independent stats visibility, preserved activity permissions, and damaged codes. Browser checks cover all three activity presets, allowed and fixed environments, unchanged beetles after background changes, single-row breeding, mode switching, full versus simplified stats, genetic inspection, chart updates, single-step versus continuous playback in both activities, fixed breeding parents, Neapolitan bands, one-survivor and empty-row rendering, reset, and mobile layout.

Simplified student CSV contains notes, round and row counters, beetle IDs, and visible color names and hex values. Full-stats student CSV and teacher CSV additionally contain settings, measurements, parentage, inherited gene copies, mutation counts, survivor/eaten counts, layouts, each leaf background, and individual survival probabilities. All state stays in the current tab; save observations before leaving.

## License

MIT. See LICENSE. Original implementation inspired by a general memory of an educational simulation, without copied assets or branding.
