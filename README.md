# Gold Miner

A classic-style browser mining game for one player or two friends on the same keyboard. The mine fills the browser window, with four HUD fields (money, target, time, and stage number) and icon-based controls. Aim the swinging claw, collect enough treasure before time runs out, and stock up at the shop between endless stages.

All illustrations, sound effects, and music are independently drawn or synthesized. This is a tribute to the classic gameplay, not a distribution of the original game's assets or levels. The interface supports Simplified Chinese and English.

**[Play online](https://mikeyan01.github.io/Gold-Miner/)**

## Play locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal. No account, backend, or external asset service is required.

Use the **EN / 中文** button in the upper-right controls to switch languages. The ability selection dialog has its own switch too. Language changes apply immediately to controls, abilities, shop text, notices, and on-screen rewards without restarting the run or re-rolling choices. The selection is saved in this browser alongside sound and high scores; older saves keep their records and start in Chinese.

| Action | Solo | Co-op Player 1 (left) | Co-op Player 2 (right) |
| --- | --- | --- | --- |
| Launch the claw | Down arrow | S | Down arrow |
| Destroy the item on your claw with dynamite | Up arrow | W | Up arrow |
| Pause / resume | Escape or Space | Escape or Space | Escape or Space |

Choose the one-miner or two-miner play button to start. Down arrow also opens the solo ability selection. The first countdown starts only after choosing an ability. During play, touch-capable phones and tablets automatically show **launch** and **dynamite** buttons, including in landscape and wide tablet windows. Solo has one pair; co-op has a pair for each player on the left and right. Controls stay clear of screen safe areas and remain available in narrow windows without touch hardware. Leaving the browser tab automatically pauses the game. Audio starts after interaction and can be muted using the speaker icon.

Shop items show their illustration, price, and a short effect description. The cart icon opens the shop after a successful stage, and the right arrow starts the next stage.

## The mine

- Gold, diamonds, heavy rocks, bones, mystery bags, moving moles, and chain-reacting TNT.
- Gold comes in four sizes worth $50, $100, $250, and $500, with progressively greater hauling weights.
- Small/large rocks are worth $11/$20 and have original weights 8/9, matching $250/$500 gold. Long bones are worth $7 at weight 3; skulls are worth $20 at weight 2, matching diamonds.
- Resource supply starts from the original game's ten categories, with three equally likely numerical profiles per category. After stage 10, categories 4–10 repeat indefinitely. A custom density reduction retains roughly 80% of medium/large gold, diamonds, and diamond moles, and 65% of other materials, rounded per type. Direct diamonds, including co-op additions, are then halved; odd counts round up or down with equal probability. Ability conversions use their own explicit chance and are not halved again.
- Positions are independently generated, not copied original layouts. Medium/large gold is generated below the upper 40% of the mine; Alchemy and Gold Growth can produce larger nuggets in place during play. Loose diamonds strongly prefer the bottom third, with a middle/lower fallback. Ordinary moles mostly spawn in the upper or middle third; diamond moles are restricted to the middle/lower thirds unless Airy Moles is owned.
- TNT has a minimum of three per mine in stages 1–3, four in stages 4–24, and five from stage 25; originally higher counts are retained. About 85% of layouts favor a nearby pair; other charges prioritize separation rather than deliberately forming a whole-mine chain. The blast radius is **250**, twice the original 125 and four times its area, with no extra aspect-ratio enlargement beyond the normal sprite scale. Damage and explosion circles use the same radius. TNT blasts, including delayed and chained explosions, destroy only unclaimed underground items: cargo already on either hook is protected. Manually using dynamite still destroys your own cargo. Direct hook contact returns a non-explosive fragment worth $1 at the original TNT weight of 2.
- Stages 1–10 keep the original cumulative wallet targets, starting at $650, $1,195, and $2,010 and reaching $15,275 at stage 10. Over stages 11–20, the per-stage increment rises linearly from the stage-10 baseline of $2,705 to $8,000, rounding each increment before adding it. Stage 11 requires $18,510, stage 20 requires $71,450, and every later stage adds exactly $8,000. Rich mines fund later poor mines: a single mine is **not** guaranteed to cover its target increment or all shop purchases.
- Solo and co-op share the same score target on every stage, including endless stages. Base round times are 60 seconds solo and 40 seconds co-op. Time Rush reduces those bases to 48/32 seconds. Time Bank pays cash for unused time; it never extends a later stage.
- Local co-op has two independent claws, extra treasure, and a shared wallet and inventory. Gold additions are unchanged; direct diamond additions follow the same halving rule as solo supply.
- Runs start with $0 and no dynamite, as in the original. Dynamite can be bought or found in bags.
- Shop purchases deduct from your cumulative money. Dynamite carries over; strength, luck, the rock book, and diamond polish last for the next stage only.
- Ordinary moles are worth $2; diamond-carrying moles are worth $602. Diamond polish adds $300 to the diamond part: $600 becomes $900, or $902 including the mole's unchanged $2 value. The original rock book triples small/large rock values to $33/$60.
- Purchased value bonuses and bag prizes are fixed when the next mine is initialized, not re-rolled or reapplied when the items reach the surface. Diamond Vein applies active polish once when it creates a diamond at capture. Ability payout bonuses are applied separately at collection, rounding once to whole coins before Clone and Buzzer Delivery apply their respective doubling effects.
- Reaching the goal does not end the stage immediately: keep mining or choose to finish early once your claws are empty.
- Separate solo and co-op high scores and your sound preference are saved in this browser.

## Run abilities

Before stages **1, 4, 7, and 10**, choose one of three distinct abilities never previously offered in the run, from a pool of 22. **The two cards you skip cannot appear again that run**, so the four drafts offer 12 different abilities in total. Abilities and offer history are shared by the team and cleared on restart. Chosen abilities last for the run and cannot be upgraded. There are at most four; after the fourth pick, no more cards are offered. Bomb Expert and Slow Fuse are mutually exclusive: owning either removes the other from later offers. Selection and shopping never consume round time. Before stages 4/7/10, the selection comes before the shop so a new Thief or Regular Customer can be used immediately.

Click a card, use `1` / `2` / `3`, or move between cards with the arrow keys or `W` / `S` and confirm with Enter.

After selection, hover or keyboard-focus an owned ability icon to read its effect and interaction details in the game's tooltip. Touch users can tap the icon. Escape dismisses the tooltip without pausing the game.

| Ability | Effect |
| --- | --- |
| 大力 / Might | An extra +50% loaded hauling speed after the original reel mode is determined; it does not change the original strength value or the ordinary bag prize lottery, including stage-long strength. |
| 金块收藏家 / Gold Collector | +30% gold value, including transmuted stones that remain gold. |
| 钻石收藏家 / Diamond Collector | +15% diamond value; combines with polish for $1,035 diamonds and $1,037 diamond moles. |
| 点石成金 / Alchemy | Each grabbed stone has one 40% chance to become a $500 large gold nugget, including its weight and appearance. This gold can then trigger Diamond Vein. |
| 射线 / Aim Line | Shows the current first collision along the hook direction; moving targets are not automatically tracked. |
| 深渊巨口 / Wide Claw | +100% claw width and hook hit radius (double the original). Still catches only the first target. |
| 璀璨胜金 / Diamond Vein | Each caught gold nugget has one 20% chance to become a diamond, including its value, weight, and appearance. Includes gold from Alchemy and Gold Growth; no conversion at mine generation. |
| 拆弹专家 / Bomb Expert | TNT is safe to haul, worth $50, and weighs the same as the smallest gold nugget. Active dynamite still works. |
| 谁动了我的钻石 / Diamond Moles | One extra diamond-carrying mole per shared mine. |
| 钱袋子 / Moneybags | More bags, always cash, at fixed diamond weight 2. Clover still improves cash rewards. |
| 窃贼 / Thief | Two chosen free stock units per shop visit, shared by both players. |
| 富贵险中求 / Risk Reward | +50% gold/diamond value when caught within 75% of the blast radius of an active, unclaimed TNT. Disarmed TNT counts. Eligibility locks at capture, so a teammate collecting the TNT afterward does not remove the bonus. |
| 时间银行 / Time Bank | Earn $50 per remaining displayed second when finishing a stage early after reaching its target. The shared reward is paid once, not carried over as time. |
| 透气的鼹鼠 / Airy Moles | Diamond moles strongly prefer the middle and upper thirds, including extra Diamond Moles spawns. Speed and hauling weight remain unchanged. |
| 慢燃引信 / Slow Fuse | Touching TNT ignites a 3-second fuse and lets the hook continue through it. Lit charges show a countdown and no longer block either hook. Incompatible with Bomb Expert. |
| 争分夺秒 / Time Rush | Base round time -20%; gold and diamond value +40%. Stacks multiplicatively with collectors, polish, and Risk Reward, but does not boost the mole's $2 body value. |
| 老主顾 / Regular Customer | Every shop stocks strength, clover, and diamond polish at their normal prices and one-unit limits. Thief still grants only two thefts per visit. |
| 考古学家 / Archaeologist | Long bones pay $140 and skulls $400, with unchanged weights. Adds one long bone and one skull per shared mine, stacking with Fossil Puzzle. They remain bones, not stones, gold, or diamonds. |
| 克隆 / Clone | The first item caught each stage pays twice its final reward after all other bonuses. One shared capture per team, not one per player. |
| 化石拼图 / Fossil Puzzle | Collect a long bone and a skull in either order for an extra $500 once per shared stage. Adds one of each bone per shared mine, stacking with Archaeologist. Both bones also pay their ordinary ability-adjusted values. |
| 黄金生长 / Gold Growth | Every 5 active-play seconds, exactly one randomly chosen underground nugget grows one tier: $50 → $100 → $250 → $500, including size and weight. |
| 压哨交货 / Buzzer Delivery | At zero time, cargo still caught on either hook is settled for twice its final coin value before the pass/fail result. Stacks with Clone; empty hooks and destroyed cargo earn nothing. |

Risk Reward uses a **187.5** base proximity radius, 25% smaller than the unchanged **250** TNT blast radius. Both checks include the treasure's radius and use the same viewport scaling. It multiplies with collectors and diamond polish, but not the mole's $2 body value: large gold with Gold Collector pays $975; a polished diamond with Diamond Collector pays $1,553, or $1,555 on a diamond mole. Rocks, bones, cash bags, TNT, and fragments do not receive the risk bonus. Nearby eligible treasure has an amber outline using the same tighter proximity check.

Time Bank applies when finishing early or clearing the mine after meeting the target. It pays **displayed remaining seconds x $50**, using the same rounded-up whole seconds as the HUD: for example, 17 displayed seconds pay $850. At the ordinary time limits, its maximum is $3,000 solo or $2,000 shared in co-op; Time Rush naturally lowers the amount of time available to redeem. A failed round or a round that reaches zero pays no bonus. The results show the bank reward separately, and shopping never grants it a second time. Choosing Time Bank does not retroactively pay for a stage completed before it was owned.

Diamond Vein rolls only at capture, never while aiming or hauling. It can convert any gold tier, including a nugget just created by Alchemy. A converted diamond has base value $600 and weight 2; active polish raises it to $900, and Diamond Collector then pays $1,035 at collection. Gold Collector no longer applies to that item. Risk Reward, Time Rush, and Clone use the converted item as usual.

Slow Fuse counts only active play time, including when both miners interact with the same charge; pause freezes its countdown and later touches do not restart it. Chain reactions still detonate neighboring TNT immediately. Lit TNT remains eligible for Risk Reward until it explodes.

Clone locks at **capture**, not collection: a teammate returning first does not take the bonus. Empty hooks and merely igniting TNT do not spend it, but destroying the selected cargo does; another capture cannot replace it. A fragment caught after a direct TNT explosion can be the first item and pays $2. The cargo keeps its original weight and displays a **x2** marker. A polished diamond with Diamond Collector pays **$1,035 x 2 = $2,070**; a similarly buffed diamond mole pays **$2,074**, including its doubled $2 body value. Risk Reward and Time Rush are applied before the final whole-coin payout is doubled. Cash bags and dynamite prizes are doubled without re-rolling the bag; the non-stacking, stage-long strength effect still activates once.

Fossil Puzzle is shared across both miners and resets each stage. Archaeologist and Fossil Puzzle each add one long bone and one skull to every shared mine, even categories with no baseline bones; owning both adds two of each, not an extra set per player. The $500 completion bonus is separate from the bones' sale prices: Archaeologist raises the bones to $140/$400, but neither it, Clone, nor Buzzer Delivery multiplies the extra $500. The results show the puzzle bonus separately.

Gold Growth selects uniformly among active, unclaimed $50/$100/$250 nuggets; the same nugget can be selected again at a later interval. Already-caught, destroyed, and $500 nuggets cannot grow. Only one nugget grows per interval for the whole team, with no extra effect when there are no eligible nuggets. Growth pauses with the game, resets its clock each stage, and changes the nugget in place. Diamond Vein can still convert it when it is later caught.

Buzzer Delivery doubles the final whole-coin value of cargo still on either hook at timeout, after normal item bonuses and Clone. A polished diamond with Diamond Collector and Clone pays $4,140 at the buzzer. Cash bags are doubled; dynamite and stage-long strength prizes retain their normal Clone-adjusted effects. Fossil Puzzle progress is recorded, but its separate $500 completion bonus is not doubled. Items returned before timeout are not doubled again. The ability does not rescue destroyed cargo or finish an empty outward shot. Time Bank pays nothing at zero, even if the last-second delivery reaches the goal.

### Mystery bags

Each mine rolls a **total** bag count, replacing authored bag counts rather than adding on top:

| Bags | 0 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| Normal | 15% | 45% | 25% | 12% | 3% |
| Moneybags | 5% | 32% | 40% | 18% | 5% |

Normal bags use the original discrete weight draw at generation: equal chances of a uniform integer 1–9, a uniform integer −1 to −5, fixed 9, or fixed −1. The weight stays fixed. Weight −1 invokes fast retrieval without losing the bag's prize; other negative weights use the original strength-minus-weight rule. Moneybags instead fixes weight at 2; this is predictable, not lighter than every possible original bag.

The original six-way lottery is sampled when each bag is generated:

| Clover | Faces | Prize |
| --- | --- | --- |
| No | 1–3 | A uniform integer $1–600 |
| No | 4 | Strength for the remainder of the stage |
| No | 5 | One dynamite; if inventory was above 3 at generation, $100–199 instead |
| No | 6 | $800 |
| Yes | 1–2 | Strength for the remainder of the stage |
| Yes | 3–4 | One dynamite; if inventory was above 3 at generation, $300–599 instead |
| Yes | 5–6 | $700 |

Clover increases the chances of strength and dynamite; it does not necessarily increase cash-only expectation. Later inventory changes never alter an existing bag's stored prize.

Might uses the same six-way lottery as ordinary abilities: stage-long strength remains possible, with the same clover effects and dynamite-inventory cash substitutions. Moneybags is the only prize override and always gives random cash, including when Might is also owned: $100–450, or $400–800 with clover. The custom 0–4 bag-count distribution is separate from the original prize lottery.

### Original hauling and strength

The physics now uses the authenticated original weights and **18 Hz reel timeline**, including its measured 250-point axial trajectory, first-cycle playback differences and final settlement behavior. The hook, rope, and attached cargo are visually interpolated between physics steps at the display's frame rate, without changing collision, payout, or hauling timing. Gold weights are **3 / 7 / 8 / 9** for $50 / $100 / $250 / $500; diamonds weigh 2, ordinary moles 3, and diamond moles 5.

Base strength is **10**. The shop drink adds **2** for the next stage, making ordinary timeline advancement `strength − weight`; it is not a uniform +65%. Its effect is largest on heavy gold: a $500 nugget's body step rises from 1 to 3.

A bag strength prize instead enables the original **fast-return mode for the rest of the stage**. It starts when the bag is collected, has no 15/25-second timer, does not gain additional speed from the shop drink, and clears on entering the shop or starting the next stage. Empty hooks and destroyed cargo also use the original local fast-return rule.

Might is a separate custom +50% speed modifier for loaded hooks. Drafts, the shared 60/40-second base timers, Time Rush, Time Bank cash rewards, bag-count probabilities, and ability reward overrides remain this game's custom rules. Original stage coordinates are mapped to the current canvas height; extra-long widescreen ropes extend the original body rate without cropping the playable area. Source editions, numerical evidence and adaptation limits are documented in [the physics research](docs/research/original-material-physics.md).

### Shop prices and theft

Original supply and random price ranges are used first. Here `k` is the **completed stage's resource category**, not the next stage or the ever-increasing display number. Integer price endpoints are inclusive.

| Item | Availability | Base price |
| --- | --- | --- |
| Dynamite | Always if inventory is below 5; absent otherwise | $1–300 + 2k |
| Strength drink | 40%; always with Regular Customer | $100–399 |
| Clover | 40%; always with Regular Customer | $1–50k + 2k |
| Rock book | 60% | $1–150 |
| Diamond polish | 50%; always with Regular Customer | $201–(200 + 100k) |

Each stocked item is one unit per visit. Without Regular Customer, a shop can be empty when dynamite inventory is already at least 5. Opening it again does not re-roll supply or quotes. **There is no additional stage-based inflation:** the sampled original price is the final quote. Prices still vary with the random draw and resource category, so removing inflation does not make them fixed.

Thief provides up to two separate **偷取** actions for available, unsold goods, even with an empty wallet. It does not create missing stock or allow stealing the same single dynamite twice. Unused thefts do not carry over. Even far-future shops use the same category-based price ranges rather than exponentially increasing quotes.

Purchases deduct from the same cumulative wallet used to pass stages; the next target is never rebased to compensate. This version retains its no-debt purchase guard, even though the original purchase action blocks allow negative balances. Exact baseline rules, resource counts, provenance and this adaptation are documented in [the economy research](docs/research/original-economy.md).

## Development

```sh
npm test          # Game mechanics and saved-data validation
npm run build    # Type check and production build
npx playwright install chromium
npm run test:e2e  # Real browser keyboard, shop, audio, and responsive flows
```

`npm run preview` serves the production build at `http://127.0.0.1:4173/Gold-Miner/`. The development server keeps the root path `/`. To play from another device on your own network, explicitly bind the development server with `npm run dev -- --host 0.0.0.0`.

## GitHub Pages

Pushes to `main` run the tests, typecheck and build, then publish `dist/` to [mikeyan01.github.io/Gold-Miner](https://mikeyan01.github.io/Gold-Miner/) through [the deployment workflow](.github/workflows/deploy.yml). Production builds and previews use `/Gold-Miner/` for asset URLs; local development still uses `/`.

Before the first deployment, the repository owner must select **GitHub Actions** under **Settings → Pages → Build and deployment → Source** in [the repository's Pages settings](https://github.com/MikeYan01/Gold-Miner/settings/pages). No personal access token or additional repository secret is needed. After enabling Pages, run **Deploy to GitHub Pages** from the Actions tab if the first push happened before that setting was enabled.
