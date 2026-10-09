# DECISIONS-WB - Wheel Balancing module

**Pattern.** Same as Wheel alignment: own folder, `runGuidedModule`, shared control system only (no hand-built DOM), pure model + scene + page glue, page switcher (Overview / Static / Dynamic / Procedure).

**Conventions.** Grams, mm, degrees. Angles run clockwise from 12 o'clock seen from the outer face. A weight stuck at angle A cancels a heavy spot at A - 180. Each wheel has one heavy spot per plane (inner / outer).
- Static imbalance = vector sum of both planes. Couple = moment of the two spots about the middle (`g/2 x plane gap`).
- Vibration: hop (static) and shimmy (couple) both grow with speed squared and peak near 95 km/h. Constants are illustrative.
- Display rounds to 5 g and shows OK below 5 g (as the DL-65 class machines do). Typing a wrong rim diameter scales the read-out weights (`displayedWeight`).
- The machine spins only with the hood down; lifting it brakes the wheel. The display is stale (---) after any weight change until the next spin.

**Not done / honest list.** Not rendered in a browser (sandbox is offline, three.js loads from a CDN), so the machine proportions, hood swing and display layout are untested visually: please look and tell me what to adjust. **Phase 4.** Hidden weight: spokes at 0/72/144/216/288 deg, hidden within 12 deg, split weights at spoke +/- 26 deg, rounded to 5 g (so a few grams can remain).

Not built: width / offset entry (only diameter), run-out, clip-on vs stick-on weight types, tyre-changer step, tread-wear overlay.
