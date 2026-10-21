# Leaf & Lineage

[Play the game](https://ragingaxolotl-art.github.io/leaf-and-lineage/) · [Download the standalone HTML](https://github.com/ragingaxolotl-art/leaf-and-lineage/blob/main/Leaf-and-Lineage.html)

An original, playable beetle evolution and breeding lab. Designed for school Chromebooks, laptops, tablets, and phones. All illustrations are original SVG/CSS, and all simulation code is included. No accounts, installation, analytics, external fonts, or network requests are required by the game.

## Play immediately

Open **Leaf-and-Lineage.html** from the downloadable package in a current browser. It is a self-contained copy of the whole game.

You can also open **dist/index.html**; keep `styles.css`, `simulation.js`, and `app.js` alongside that version. The downloaded game works offline, including through `file://` where opening local HTML is allowed. A school's device policies may require a hosted copy instead.

Alternatively, from this folder run:

```sh
python3 -m http.server 8000 --directory dist
```

Then open http://localhost:8000. Stop the server with Ctrl+C.

## Controls

- **Habitat:** choose Meadow, Dry leaves, Dusk, or any custom color. Current beetles retain their genes and colors when the habitat changes.
- **Natural selection:** press Start evolving or Next generation. A cartoon bird head visits and eats the 24 beetles that do not survive. Only then do the 24 survivors reproduce to form 48 offspring. Higher selection strength makes camouflage matter more; 0% makes survival random. The animation does not decide survival: it displays the model’s already-sampled outcome. Turn off **Show the bird eating** to shorten transitions. Reduced-motion preferences also skip the moving bird.
- **Breeding jars:** eight jars sit above eight fixed columns. Drag two beetles into a jar with a mouse, trackpad, pen, or touch. Alternatively, select a beetle on a leaf, then click an empty jar slot. Each pair produces all six siblings in the column below. You can use parents from any column and reuse a parent across jars. A jar needs two different beetles.
- **Complete or empty jars:** press **Breed jar families** once at least one jar has a complete pair. Empty jars use two distinct random parents from their own columns. Half-filled jars must be completed or cleared. All 48 beetles are replaced, so the generation counter still applies to the entire population. Jars clear after breeding to let you select from the new generation. A jar’s family label recalls the previous pair and predictions.
- **Compare families:** **Use pair in all jars** copies the active jar’s pair into all eight jars. All columns then share parent IDs, with independently generated offspring. Clicking a filled slot removes a parent; dragging onto a filled slot replaces it. Clear jars empties all drafts. Jar mode bypasses bird selection; automatic playback and selection strength are disabled.
- **Live genetics preview:** inspect a jar to see its parent colors, red/green/blue Punnett squares, all 64 equally likely transmission combinations before mutation, combined visible-color probabilities, and the expected average color. Individual offspring are independent draws; six siblings need not match the theoretical proportions.
- **Small screens:** the board scrolls sideways while keeping each jar aligned to its column. Dragging has edge scrolling; click-to-add remains available without dragging.
- **Mutation:** independently changes each inherited gene copy at the selected probability. Set it to 0% to isolate inheritance. Small pale dots mark offspring that inherited mutations.
- **Speed / pause / step:** follow generations at your own pace. Clicking a beetle pauses playback and reveals its genes. A generation already undergoing selection finishes when paused; no further generation starts. Playback pauses when the page is hidden.
- **Reset experiment:** returns to the same seeded starting population, meadow habitat, natural mode, 80% selection strength, and 3% mutation rate. Notes remain available. Save data before resetting to keep the previous run's results.
- **Save data:** downloads a CSV with generation measurements, setting events, the current population's genes and parent IDs, and your notes. Notes otherwise last only for the current page session.
- **Field guide:** explains the model, offers a short experiment, and describes limitations. Tab and Enter/Space work throughout. The lab respects reduced-motion preferences.

## A 10-minute classroom experiment

1. Describe the starting color variation and predict which beetles will reproduce.
2. Run 10–20 generations in the meadow. Pause and save the data.
3. Switch to dry leaves. Explain why camouflage changes immediately but beetle genes do not.
4. Run another 10–20 generations. Compare the average color, camouflage, and diversity.
5. Reset and set selection to 0%. Repeat from the same starting population. Explain the difference between selection and random genetic drift.
6. At 0% mutation, drag two parents into a jar. Inspect its Punnett squares, predict the offspring, breed a generation, and inspect all six siblings in that column. Use the same pair in every jar to compare random samples of six offspring.

## Publish on GitHub Pages

**Simplest route:** create a GitHub repository and upload the **contents** of `dist/` to the repository root (including `index.html`). In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, and Save. GitHub provides the playable website URL after deployment. The relative asset paths also work for project sites such as `username.github.io/repository-name/`.

**Keep the full project:** upload this whole project to a repository, including the hidden `.github/workflows/pages.yml` file. In **Settings → Pages**, choose **GitHub Actions** as the source. Push to `main`, or run the “Deploy beetle lab to Pages” workflow manually. It publishes only `dist/`. The repository includes only the game source, documentation, tests, and deployment workflow.

Official instructions: [Configure a GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

No server, database, build step, paid service, or API keys are needed. Hosting makes the game accessible to students without requiring a GitHub account to play a public Pages site, subject to school network rules.

## Model details

The lab uses a seeded pseudorandom generator (seed 42). A beetle has three diploid quantitative loci, one for each RGB color channel. Each allele is an integer from 0 to 255. A phenotype channel is the average of its two alleles. These are teaching genes, not a claim about actual beetle color genetics.

Let `d² = mean(((beetle_rgb - habitat_rgb) / 255)²)`. The displayed camouflage fraction is `exp(-10 × d²)`. This color similarity score is not a survival probability and uses a simple RGB distance, not a full model of bird vision.

In natural mode, breeders are sampled without replacement using weight `(1 - pressure) + pressure × (0.015 + camouflage²)`. Each offspring has two distinct parents drawn uniformly from the 24 breeders. Each locus receives one randomly selected allele from each parent. Selected breeders contribute equally in expectation. The generation completely replaces the previous one.

At each transmission, a mutation occurs with the chosen per-copy probability and adds or subtracts a uniformly chosen integer from 1 to 36, clamped to 0–255. Directions are independent of the habitat. The reported mutation count includes copies whose values actually changed. Because offspring have six inherited copies, the per-beetle chance of at least one mutation is higher than the slider's per-copy rate.

In jar mode, the population is laid out row-major in eight columns. Each column gets six independent offspring of its own two parents. Empty jars sample parents uniformly without replacement from that column’s six current adults. Chosen pairs override that random choice. All parent IDs must belong to the current generation; the same parent cannot occupy both slots in one jar.

The probability preview enumerates all four allele transmissions per locus and their Cartesian product across three independent loci (64 equally likely combinations). Repeated visible RGB colors are grouped and their probabilities combined. For two parents each carrying red alleles 100 and 200, the red phenotype probabilities are 25% for 100, 50% for 150, and 25% for 200. Mutations happen after inheritance and are excluded from these predictions. The expected color is the mean of the two parent phenotypes, which is a population expectation rather than a promise for each offspring.

Color diversity is `100 × sqrt(mean(distance²(individual, population_mean)))`. The chart records measurements at birth under that generation's habitat; changing habitats can cause a discontinuity on the next recorded point. Dashed lines mark habitat changes. Neither average camouflage nor diversity is a measured real-world fitness estimate.

Real biology is more complex. The model omits dominance, linkage, migration, sex, age, ecological feedback, and population-size change. It illustrates heritable variation, differential reproductive contribution, random mutation, artificial selection, and genetic drift. Evolution is not guaranteed to improve camouflage in every generation.

## Development and checks

Files in `dist/` are the editable, published source. No build is required. With Node.js available:

```sh
node --test tests/simulation.test.cjs
```

The tests check reproducibility, inheritance, independent random mutation, selection versus drift over multiple trials, manual parent selection, population size, generation bookkeeping, and the rule that changing habitats never changes existing genes. The suite also checks all 64 combinations and probability sums, duplicate-color probabilities, column-specific parent IDs, random pairs for empty jars, independent siblings, invalid or stale parents, and shared pairs across jars. UI verification covers real mouse dragging, the click alternative, family lineage inspection, the bird visiting only non-survivors, cancellation by reset, downloads, and responsive layouts.

## License

MIT. See LICENSE. This is an original implementation inspired by a general memory of an educational simulation, without copied game assets or branding.
