# Sumo stars in the trait magnifier

Turn on Trait magnifier and hover or keyboard-focus a beetle in the tank, Keep tank, or occupied parent jar. Its hover card shows a five-slot sumo trait rating above the existing three selected readings. Turning the magnifier off hides both. The rating uses expressed genes and never changes saved beetles, breeding, match physics, or shared battles.

Each visible star is empty (0), copper (1), silver (2), gold (3), or diamond (4). Fill five copper slots, then upgrade from left to right. Six points displays one silver and four copper stars; sixteen displays one diamond and four gold; twenty displays five diamond stars.

## Fixed build rubric

This is a transparent design rubric, not a calibrated win probability or proof that one build is unbeatable. Every one of the current engine's 56 inherited inputs is included exactly once. The input-coverage test traces direct engine references, derived anatomy, and dynamic ability factors.

| Group | Maximum points | Inputs |
| --- | ---: | --- |
| Power and body | 20 | strength, mass, bodyWidth, bodyGrowth, jaw, jawGrowth, headGrowth |
| Grip and balance | 20 | grip, brace, lateralBalance, claw, legSpread |
| Movement | 15 | motor, stride, acceleration, turnRate, legLength, legGrowth |
| Stamina and recovery | 15 | endurance, recovery |
| Senses and behavior | 20 | tracking, reaction, focus, pushDrive, persistence, wander, tactics, edgeSense, centerDrive, curiosity, sociality, caution, antennaGrowth |
| Special abilities | 10 | horn, hornGrowth, hornCount, jumpGate, puffGate; Power, Reach, Control, Efficiency, Recovery, and Instinct for each of lift, jump, and puff |

Numeric values score 0–1 against the trait's permitted range and the rubric's target. Most targets are their maximum; wandering targets zero, head growth targets -1, jaw growth targets 1, and body/leg/antenna/horn growth target zero. These are explicit designer-selected balanced-build targets, not experimentally established optima. Distance on either side of an interior target is normalized to that side's permitted endpoint. Maximum raw growth therefore does not automatically earn maximum points.

Each group averages its inputs' qualities and multiplies by its point limit. Horn count contributes visible horn count divided by three. Horn traits and lift factors receive zero when there is no functional horn. Jump and puff activation each score one only when the recessive anatomy is expressed; their six factors receive zero otherwise. Hidden carriers do not receive active-ability credit. Consequently, this universal rubric requires working lift, jump, and puff to reach perfection.

Sum the six group scores without rounding. For imperfect builds, the displayed rating is the total divided by five, rounded down and limited to 1–19. Thus totals below ten display 1; 10–below 15 display 2; 50–below 55 display 10; 95–below 100 display 19. Only a build with every input quality exactly one receives 20/20. A near-perfect value must never round up to twenty.

Future calibration can adjust weights and target values using representative opponents and paired seeds while retaining input coverage and the exact-perfection rule. Cosmetic and tank-only traits do not contribute because the current sumo engine does not use them.
