// Emberfall Duel — browser front end: renders the engine state as a DOM
// table, takes mouse/keyboard input, and stages deterministic scenes for
// the maker's screenshots behind ?shot=title|play|win|lose&seed=N. A staged
// scene plays the real rules forward with the real picks, so every shot is
// a frame the game itself can produce.
import {
  SUITS, START_LIFE, newDuel, playClash, wardenPick, heroPick, worstPick,
} from './engine.js';

const $ = (id) => document.getElementById(id);
const suitOf = (card) => SUITS.find((s) => s.id === card.suit);

function cardEl(card, cls = '') {
  const el = document.createElement('div');
  if (card.wild) {
    el.className = `card wild ${cls}`;
    el.innerHTML = `<div class="rank">6</div><div class="glyph">✦</div><div class="suitname">WILD SIGIL</div>`;
    return el;
  }
  const suit = suitOf(card);
  el.className = `card ${suit.id} ${cls}`;
  el.innerHTML = `<div class="rank">${card.rank}</div><div class="glyph">${suit.glyph}</div><div class="suitname">${suit.name.toUpperCase()}</div>`;
  return el;
}

function strikeText(who, card, s) {
  const name = card.wild ? 'Wild Sigil' : `${suitOf(card).name} ${card.rank}`;
  let parts = `${s.base}`;
  if (s.resonance) parts += ` + ${s.resonance} resonance`;
  if (s.counter) parts += ` + ${s.counter} counter`;
  return `${who} <b>${name}</b> strikes <b>${s.total}</b> (${parts})`;
}

function bannerFor(result) {
  let text = `Clash ${result.n} — ${strikeText('Your', result.yourCard, result.yours)} · ${strikeText('Warden’s', result.wardenCard, result.theirs)}.`;
  if (result.fatigue) text = `The deck is empty — hunger singes both duelists for 1. ` + text;
  if (result.dealt > 0 && result.taken > 0) text += ` Level strikes: <b>both are singed for 1</b>.`;
  else if (result.dealt > 0) text += ` <b>You wound the Warden for ${result.dealt}!</b>`;
  else if (result.taken > 0) text += ` <b>The Warden wounds you for ${result.taken}.</b>`;
  return text;
}

function lastSuitText(suitId) {
  if (!suitId) return 'Last suit: —';
  const suit = SUITS.find((s) => s.id === suitId);
  return `Last suit: ${suit.name} ${suit.glyph}`;
}

let duel = null;
let lastResult = null;

function render() {
  $('deckcount').textContent = String(duel.deck.length);
  $('clashno').textContent = `CLASH ${duel.clash}`;
  $('youlife').textContent = String(Math.max(0, duel.you.life));
  $('wardenlife').textContent = String(Math.max(0, duel.warden.life));
  $('youbar').style.width = `${Math.max(0, (duel.you.life / START_LIFE) * 100)}%`;
  $('wardenbar').style.width = `${Math.max(0, (duel.warden.life / START_LIFE) * 100)}%`;
  $('youlast').textContent = lastSuitText(duel.you.lastSuit);
  $('wardenlast').textContent = lastSuitText(duel.warden.lastSuit);

  const youHand = $('youhand');
  youHand.replaceChildren();
  duel.you.hand.forEach((card, index) => {
    const el = cardEl(card);
    el.title = 'Click to clash with this card';
    el.addEventListener('click', () => humanPlay(index));
    youHand.appendChild(el);
  });
  const wardenHand = $('wardenhand');
  wardenHand.replaceChildren();
  for (const card of duel.warden.hand) wardenHand.appendChild(cardEl(card));

  const yourSlot = $('yourslot');
  const wardenSlot = $('wardenslot');
  yourSlot.replaceChildren();
  wardenSlot.replaceChildren();
  if (lastResult) {
    yourSlot.appendChild(cardEl(lastResult.yourCard, 'slot'));
    wardenSlot.appendChild(cardEl(lastResult.wardenCard, 'slot'));
  } else {
    yourSlot.innerHTML = '<div class="slotempty">YOUR<br>CLASH CARD</div>';
    wardenSlot.innerHTML = '<div class="slotempty">WARDEN’S<br>CLASH CARD</div>';
  }
  $('banner').innerHTML = lastResult ? bannerFor(lastResult) : '';
  $('status').textContent = `You ${duel.you.life} life, Warden ${duel.warden.life} life, clash ${duel.clash}.`;
}

function showEnd() {
  const title = duel.winner === 'you' ? 'VICTORY' : duel.winner === 'warden' ? 'DEFEAT' : 'ASHEN DRAW';
  $('endtitle').textContent = title;
  $('endscore').textContent = `You ${Math.max(0, duel.you.life)} Life — Warden ${Math.max(0, duel.warden.life)} Life · ${duel.clash} clashes`;
  $('endline').textContent =
    duel.winner === 'you'
      ? 'The Warden’s flame gutters out. The Emberfall crown is yours.'
      : duel.winner === 'warden'
        ? 'Your flame gutters out. The Warden keeps the Emberfall crown — for now.'
        : 'Both flames gutter out together. The crown rolls into the ashes, unclaimed.';
  $('endcard').classList.remove('hidden');
}

function humanPlay(index) {
  if (!duel || duel.phase === 'over') return;
  const card = duel.you.hand[index];
  if (!card) return;
  lastResult = playClash(duel, card, wardenPick(duel, duel.rng));
  render();
  if (duel.phase === 'over') showEnd();
}

function startInteractive(seed) {
  duel = newDuel(seed);
  lastResult = null;
  $('endcard').classList.add('hidden');
  render();
}

/** Play a whole duel with a fixed human strategy; returns the final state. */
function simulate(seed, pick) {
  const state = newDuel(seed);
  let guard = 0;
  while (state.phase !== 'over' && guard < 200) {
    playClash(state, pick(state), wardenPick(state, state.rng));
    guard += 1;
  }
  return state;
}

function stage() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') ?? 7) || 7;
  if (!shot) {
    startInteractive(seed);
    $('titlecard').classList.remove('hidden');
    return;
  }
  if (shot === 'title') {
    startInteractive(seed);
    $('titlecard').classList.remove('hidden');
    return;
  }
  if (shot === 'play') {
    duel = newDuel(seed);
    lastResult = null;
    for (let i = 0; i < 5 && duel.phase !== 'over'; i += 1) {
      lastResult = playClash(duel, heroPick(duel), wardenPick(duel, duel.rng));
    }
    render();
    return;
  }
  if (shot === 'win' || shot === 'lose') {
    const pick = shot === 'win' ? heroPick : worstPick;
    const want = shot === 'win' ? 'you' : 'warden';
    let state = null;
    for (let s = seed; s < seed + 80; s += 1) {
      const candidate = simulate(s, pick);
      if (candidate.winner === want) { state = candidate; break; }
    }
    duel = state ?? simulate(seed, pick);
    lastResult = duel.log[duel.log.length - 1] ?? null;
    render();
    showEnd();
    return;
  }
  startInteractive(seed);
}

$('startbtn').addEventListener('click', () => $('titlecard').classList.add('hidden'));
$('againbtn').addEventListener('click', () => startInteractive(Date.now() % 100000));
document.addEventListener('keydown', (event) => {
  if (!$('titlecard').classList.contains('hidden')) {
    if (event.key === 'Enter' || event.key === ' ') $('titlecard').classList.add('hidden');
    return;
  }
  const n = Number(event.key);
  if (Number.isInteger(n) && n >= 1 && n <= 5) humanPlay(n - 1);
});

stage();
