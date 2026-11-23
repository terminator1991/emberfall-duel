// Emberfall Duel — rules engine. Pure logic, no DOM: the browser front end
// renders this state, and the screenshot stager drives it headlessly.
//
// The duel in one breath: two duelists at 20 Life share one 44-card deck.
// Each clash both play one card. A card strikes for its rank, +2 Resonance
// when its suit matches the suit of your own previous card, and +3 Counter
// when its suit beats the suit of the foe's card this clash on the cycle
// Ember > Grove > Stone > Tide > Ember. The higher strike wounds the loser
// for the difference; a tie singes both duelists for 1. Wild Sigils strike
// a flat 6, earn no bonuses, and cannot be countered. When the deck runs
// dry, starting a clash hungry costs 1 Life (fatigue), so every duel ends.

export const SUITS = [
  { id: 'ember', name: 'Ember', glyph: '♦', colour: '#e2492f' },
  { id: 'grove', name: 'Grove', glyph: '♣', colour: '#2e9e5b' },
  { id: 'stone', name: 'Stone', glyph: '♠', colour: '#8a6d3b' },
  { id: 'tide', name: 'Tide', glyph: '♥', colour: '#2f6fd0' },
];

/** BEATS[x] is the suit that x counters on the cycle. */
export const BEATS = { ember: 'grove', grove: 'stone', stone: 'tide', tide: 'ember' };

export const START_LIFE = 20;
export const HAND_SIZE = 5;
export const RESONANCE_BONUS = 2;
export const COUNTER_BONUS = 3;
export const WILD_POWER = 6;

/** mulberry32: tiny seeded RNG so a seed always deals the same duel. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The shared deck: four suits of ranks 1..10, plus four Wild Sigils. */
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 10; rank += 1) deck.push({ suit: suit.id, rank, wild: false });
  }
  for (let i = 0; i < 4; i += 1) deck.push({ suit: null, rank: WILD_POWER, wild: true });
  return deck;
}

function shuffled(deck, rng) {
  const cards = deck.slice();
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** A fresh duel. `you` is the human side, `warden` the AI side. */
export function newDuel(seed) {
  const rng = makeRng(seed);
  const deck = shuffled(buildDeck(), rng);
  const state = {
    rng,
    deck,
    you: { life: START_LIFE, hand: [], lastSuit: null },
    warden: { life: START_LIFE, hand: [], lastSuit: null },
    clash: 0,
    phase: 'play', // 'play' while cards remain to be clashed, then 'over'
    winner: null, // 'you' | 'warden' | 'draw'
    log: [],
  };
  for (let i = 0; i < HAND_SIZE; i += 1) {
    state.you.hand.push(state.deck.pop());
    state.warden.hand.push(state.deck.pop());
  }
  return state;
}

/**
 * Strike of `card` played by a side whose previous suit was `ownLast`,
 * against the foe's card this clash. Returns the total and its parts so
 * the UI can show the arithmetic.
 */
export function strikeOf(card, ownLast, foeCard) {
  if (card.wild) return { total: WILD_POWER, base: WILD_POWER, resonance: 0, counter: 0 };
  let resonance = 0;
  let counter = 0;
  if (ownLast !== null && ownLast === card.suit) resonance = RESONANCE_BONUS;
  if (!foeCard.wild && BEATS[card.suit] === foeCard.suit) counter = COUNTER_BONUS;
  return { total: card.rank + resonance + counter, base: card.rank, resonance, counter };
}

function drawUp(state, side) {
  if (state.deck.length > 0) side.hand.push(state.deck.pop());
}

function finishIfDone(state) {
  const { you, warden } = state;
  if (you.life > 0 && warden.life > 0) {
    if (you.hand.length === 0 && warden.hand.length === 0 && state.deck.length === 0) {
      state.phase = 'over';
      state.winner = you.life === warden.life ? 'draw' : you.life > warden.life ? 'you' : 'warden';
    }
    return;
  }
  state.phase = 'over';
  state.winner = you.life === warden.life ? 'draw' : you.life > warden.life ? 'you' : 'warden';
}

/**
 * Play one clash: `yourCard` and `wardenCard` are the actual card objects
 * from each hand. Mutates state; returns a result record for the banner.
 */
export function playClash(state, yourCard, wardenCard) {
  const { you, warden } = state;
  you.hand.splice(you.hand.indexOf(yourCard), 1);
  warden.hand.splice(warden.hand.indexOf(wardenCard), 1);
  state.clash += 1;

  // Fatigue: an empty deck at clash start singes both duelists.
  let fatigue = 0;
  if (state.deck.length === 0) {
    fatigue = 1;
    you.life -= 1;
    warden.life -= 1;
  }

  const yours = strikeOf(yourCard, you.lastSuit, wardenCard);
  const theirs = strikeOf(wardenCard, warden.lastSuit, yourCard);
  let dealt = 0;
  let taken = 0;
  if (yours.total > theirs.total) dealt = yours.total - theirs.total;
  else if (theirs.total > yours.total) taken = theirs.total - yours.total;
  else { dealt = 1; taken = 1; } // a tie singes both
  warden.life -= dealt;
  you.life -= taken;

  you.lastSuit = yourCard.wild ? you.lastSuit : yourCard.suit;
  warden.lastSuit = wardenCard.wild ? warden.lastSuit : wardenCard.suit;

  const result = { n: state.clash, yourCard, wardenCard, yours, theirs, dealt, taken, fatigue };
  state.log.push(result);

  if (you.life > 0 && warden.life > 0) {
    drawUp(state, you);
    drawUp(state, warden);
  }
  finishIfDone(state);
  return result;
}

/** The Warden's pick: the card with the best strike against your last suit, with a seeded wobble. */
export function wardenPick(state, rng) {
  const hand = state.warden.hand;
  let best = hand[0];
  let bestScore = -Infinity;
  for (const card of hand) {
    // The Warden cannot see your card yet; it plays against your last suit.
    const probe = card.wild ? { wild: true, suit: null } : { wild: false, suit: state.you.lastSuit ?? 'ember' };
    const s = strikeOf(card, state.warden.lastSuit, probe);
    const score = s.total + rng() * 1.5;
    if (score > bestScore) { bestScore = score; best = card; }
  }
  return best;
}

/**
 * The foe card the stager's autopilots plan against: the Warden's most
 * dangerous card (highest rank, Wild Sigils last), not just its first.
 * Planning against the strongest threat makes the staged duels play like
 * a careful human's, and the staged defeat like a careless one's.
 */
function likelyFoeCard(state) {
  let foe = state.warden.hand[0] ?? { wild: true, suit: null };
  for (const card of state.warden.hand) {
    if (!card.wild && (foe.wild || card.rank > foe.rank)) foe = card;
  }
  return foe;
}

/** Autopilot for the human side, used by the screenshot stager: strongest strike, ties broken by rank. */
export function heroPick(state) {
  const foe = likelyFoeCard(state);
  let best = state.you.hand[0];
  let bestScore = -Infinity;
  for (const card of state.you.hand) {
    const s = strikeOf(card, state.you.lastSuit, foe);
    const score = s.total * 100 + card.rank;
    if (score > bestScore) { bestScore = score; best = card; }
  }
  return best;
}

/** The weakest pick, for staging a loss: lowest strike, then lowest rank. */
export function worstPick(state) {
  const foe = likelyFoeCard(state);
  let worst = state.you.hand[0];
  let worstScore = Infinity;
  for (const card of state.you.hand) {
    const s = strikeOf(card, state.you.lastSuit, foe);
    const score = s.total * 100 + card.rank;
    if (score < worstScore) { worstScore = score; worst = card; }
  }
  return worst;
}
