[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/terminator1991/emberfall-duel/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/terminator1991/emberfall-duel/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

# Emberfall Duel

An original 1v1 card duel for the make.fun "Make the best card game" bounty:
https://make.fun/bounty/best-card-game-20261122-1826

Two duelists — you and the Warden, an AI — stand at 20 Life each across one
shared 44-card deck: four suits (Ember, Grove, Stone, Tide) of ranks 1–10,
plus four Wild Sigils. Hands are open; nothing is hidden but the deck.

## How a clash works

Every turn is a clash: you click one of your five cards, the Warden plays
one of its own, and the two strikes are compared.

- A card strikes for its **rank**.
- **Resonance +2** — if the card's suit matches the suit of your own
  previous card, the echo feeds the flame.
- **Counter +3** — if the card's suit beats the foe's card on the cycle
  **Ember → Grove → Stone → Tide → Ember** (Ember burns Grove, Grove cracks
  Stone, Stone dams Tide, Tide douses Ember).
- A **Wild Sigil** strikes a flat **6**, earns no bonuses, and cannot be
  countered.
- The higher strike wounds the loser for the difference; level strikes
  singe both duelists for 1.
- Both duelists draw back up after each clash. When the deck runs dry,
  starting a clash hungry costs both duelists 1 Life — so every duel ends,
  in flame or in ashes.

The twist is the memory: because Resonance rewards repeating your last
suit while Counter rewards answering the Warden's, the best card is rarely
just the biggest number. Keys 1–5 also pick a card; Enter starts the duel.

## Layout

- `main.ts` — the handover program: copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json` with the vendored library
  in `vendor/makefun-game.ts` (the kit's copy, unchanged).
- `game/` — the game itself: plain static files, no build step, no network.
  `game/src/engine.js` holds the pure rules; `game/src/main.js` renders
  the table and stages the screenshot scenes.
- `screenshots/` — four real renders of the game in a browser: the title
  screen, a table mid-duel with both hands and the strike arithmetic, a
  victory and a defeat. Scenes are staged deterministically with
  `?shot=title|play|win|lose&seed=N`, each playing the real rules forward.

Run it locally with any static file server over `game/`, or hand it in with
`MAKEFUN_OUTPUT_DIR=out node main.ts`.
