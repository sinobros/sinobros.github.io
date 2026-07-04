// Plain node-runnable assertions against engine.js — no test framework/dependency.
// Run: node assets/js/games/baccarat-vr/engine.test.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SUITS,
  CHIP_VALUES,
  BET_SIDES,
  STARTING_BALANCE,
  cardValue,
  handTotal,
  shouldPlayerDraw,
  shouldBankerDraw,
  createInitialState,
  placeBet,
  clearBets,
  dealRound,
} from "./engine.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

function card(rank, suit = SUITS[0]) {
  return { rank, suit };
}

// Stack a state's shoe so the given cards (in intended draw order) are drawn
// first. Cards come off the shoe with pop(), so the draw order is reversed
// onto the end of the array. Padded to stay >= 20 cards so drawCard()'s
// reshuffle-under-20 check doesn't discard the stacked cards before they're
// reached.
function stackShoe(state, drawOrderCards) {
  // Padding must keep the shoe at >= 20 cards even after every forced card is
  // popped, or drawCard()'s reshuffle-under-20 check fires mid-sequence and
  // silently replaces the rest of the stacked order with a fresh random shoe.
  const padding = [];
  while (padding.length < 20 + drawOrderCards.length) {
    padding.push(card("2"));
  }
  state.shoe = [...padding, ...[...drawOrderCards].reverse()];
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Card values.
assert(cardValue(card("A")) === 1, "A should be worth 1");
assert(cardValue(card("10")) === 0, "10 should be worth 0");
assert(cardValue(card("J")) === 0, "J should be worth 0");
assert(cardValue(card("Q")) === 0, "Q should be worth 0");
assert(cardValue(card("K")) === 0, "K should be worth 0");
for (let n = 2; n <= 9; n++) {
  assert(cardValue(card(String(n))) === n, `${n} should be worth ${n}`);
}
assert(handTotal([card("9"), card("9")]) === 8, "9+9=18 should total 8 (mod 10)");
assert(handTotal([card("K"), card("5")]) === 5, "K+5=5 should total 5");
assert(handTotal([card("A"), card("A")]) === 2, "A+A=2 should total 2");

// 2. Player draw rule: draws on 0-5, stands on 6-7.
for (let t = 0; t <= 5; t++) {
  assert(shouldPlayerDraw(t) === true, `player should draw on total ${t}`);
}
for (let t = 6; t <= 7; t++) {
  assert(shouldPlayerDraw(t) === false, `player should stand on total ${t}`);
}

// 3. Every banker third-card branch.
assert(shouldBankerDraw(0, null) === true, "banker 0, no player third -> draws");
assert(shouldBankerDraw(5, null) === true, "banker 5, no player third -> draws");
assert(shouldBankerDraw(6, null) === false, "banker 6, no player third -> stands");
assert(shouldBankerDraw(7, null) === false, "banker 7, no player third -> stands");
for (let p3 = 0; p3 <= 9; p3++) {
  assert(shouldBankerDraw(0, p3) === true, `banker 0 always draws (player third ${p3})`);
  assert(shouldBankerDraw(1, p3) === true, `banker 1 always draws (player third ${p3})`);
  assert(shouldBankerDraw(2, p3) === true, `banker 2 always draws (player third ${p3})`);
}
assert(shouldBankerDraw(3, 8) === false, "banker 3 stands only when player third is 8");
for (let p3 = 0; p3 <= 9; p3++) {
  if (p3 === 8) continue;
  assert(shouldBankerDraw(3, p3) === true, `banker 3 draws when player third is ${p3}`);
}
for (let p3 = 0; p3 <= 9; p3++) {
  const expected = p3 >= 2 && p3 <= 7;
  assert(shouldBankerDraw(4, p3) === expected, `banker 4, player third ${p3} -> ${expected}`);
}
for (let p3 = 0; p3 <= 9; p3++) {
  const expected = p3 >= 4 && p3 <= 7;
  assert(shouldBankerDraw(5, p3) === expected, `banker 5, player third ${p3} -> ${expected}`);
}
for (let p3 = 0; p3 <= 9; p3++) {
  const expected = p3 >= 6 && p3 <= 7;
  assert(shouldBankerDraw(6, p3) === expected, `banker 6, player third ${p3} -> ${expected}`);
}
assert(shouldBankerDraw(7, 5) === false, "banker 7 always stands");

// 4. Naturals stop all third-card draws (both directions).
{
  const state = createInitialState();
  stackShoe(state, [card("4"), card("3"), card("5"), card("6")]); // player 4+5=9 (natural), banker 3+6=9
  state.bets.player = 10;
  const result = dealRound(state);
  assert(state.playerHand.length === 2, "player natural: no third card drawn for player");
  assert(state.bankerHand.length === 2, "player natural: no third card drawn for banker");
  assert(result.outcome === "tie", "9 vs 9 should be a tie");
}
{
  const state = createInitialState();
  stackShoe(state, [card("2"), card("4"), card("3"), card("4")]); // player 2+3=5, banker 4+4=8 (natural)
  state.bets.banker = 10;
  const result = dealRound(state);
  assert(state.playerHand.length === 2, "banker natural: no third card drawn for player even though player total <=5");
  assert(state.bankerHand.length === 2, "banker natural: no third card drawn for banker");
  assert(result.outcome === "banker", "banker 8 vs player 5 -> banker wins");
}

// Player-only draw, banker-only draw, and both-draw branches.
{
  // player 1+1=2 (draws), banker 2+5=7 (always stands regardless of player's third)
  const state = createInitialState();
  stackShoe(state, [card("A"), card("2"), card("A"), card("5")]);
  state.bets.player = 10;
  dealRound(state);
  assert(state.playerHand.length === 3, "player-only draw: player gets a third card");
  assert(state.bankerHand.length === 2, "player-only draw: banker stands on 7");
}
{
  // player 3+4=7 (stands), banker 1+1=2 (always draws when no player third)
  const state = createInitialState();
  stackShoe(state, [card("3"), card("A"), card("4"), card("A")]);
  state.bets.banker = 10;
  dealRound(state);
  assert(state.playerHand.length === 2, "banker-only draw: player stands on 7");
  assert(state.bankerHand.length === 3, "banker-only draw: banker draws on 2 with no player third");
}
{
  // player A+A=2 (draws third), banker A+A=2 (always draws regardless of player's third)
  const state = createInitialState();
  stackShoe(state, [card("A"), card("A"), card("A"), card("A")]);
  state.bets.player = 10;
  dealRound(state);
  assert(state.playerHand.length === 3, "both-draw: player draws third");
  assert(state.bankerHand.length === 3, "both-draw: banker draws third");
}

// 5. Banker payout uses floor(stake * 0.95) commission.
{
  const state = createInitialState();
  // player 3+5=8 (natural), banker 4+5=9 (natural) -> banker wins, no thirds
  stackShoe(state, [card("3"), card("4"), card("5"), card("5")]);
  state.bets.banker = 15;
  const before = state.balance;
  const result = dealRound(state);
  assert(result.outcome === "banker", "banker should win 9 vs 8");
  const expectedNet = 15 + Math.floor(15 * 0.95); // 15 + 14 = 29
  assert(result.net === expectedNet, `banker win net should be ${expectedNet}, got ${result.net}`);
  assert(state.balance === before - 15 + expectedNet, "balance should reflect stake deduction + commissioned payout");
}

// 6. VR tie refunds Player and Banker stakes (the one place VR must NOT match the 2D file).
{
  const state = createInitialState();
  // player 4+5=9 (natural), banker 3+6=9 (natural) -> tie
  stackShoe(state, [card("4"), card("3"), card("5"), card("6")]);
  state.bets.player = 100;
  state.bets.tie = 50;
  state.bets.banker = 80;
  const before = state.balance;
  const result = dealRound(state);
  assert(result.outcome === "tie", "should be a tie");
  const expectedNet = 50 * 9 + 100 + 80; // tie payout + full player refund + full banker refund
  assert(result.net === expectedNet, `tie net should refund player+banker stakes: expected ${expectedNet}, got ${result.net}`);
  assert(state.balance === before - 230 + expectedNet, "balance should reflect VR tie refund behavior");
}

// 7. Bets are rejected once they'd exceed balance.
{
  const state = createInitialState();
  state.chip = 700;
  placeBet(state, "player");
  assert(state.bets.player === 700, "first 700 bet should be accepted (balance 1000)");
  placeBet(state, "banker");
  assert(state.bets.banker === 0, "second 700 bet should be rejected (only 300 remaining)");
}
{
  const state = createInitialState();
  state.chip = 1500;
  placeBet(state, "player");
  assert(state.bets.player === 0, "a bet larger than the whole balance should be rejected");
}
{
  const state = createInitialState();
  state.chip = 100;
  placeBet(state, "player");
  clearBets(state);
  assert(state.bets.player === 0 && state.bets.tie === 0 && state.bets.banker === 0, "clearBets resets all sides");
}

// 8. Run many simulated rounds with a deterministic rng; balance never negative,
// and never diverges from the sum of round-by-round net changes.
{
  const rng = mulberry32(123456789);
  const state = createInitialState(rng);
  let roundsPlayed = 0;
  for (let i = 0; i < 1500; i++) {
    // Top up when the bankroll can no longer cover a bet — the point of this
    // loop is to stress-test the arithmetic over 1000+ played rounds, not to
    // model a single continuous bankroll running out (that's a legitimate,
    // separately-covered state: rejection is tested above).
    if (state.balance < CHIP_VALUES[0]) state.balance = STARTING_BALANCE;
    state.chip = CHIP_VALUES[0];
    const side = BET_SIDES[Math.floor(rng() * BET_SIDES.length)];
    placeBet(state, side);
    const stakeThisRound = state.bets.player + state.bets.tie + state.bets.banker;
    const beforeBalance = state.balance;
    const result = dealRound(state, rng);
    if (stakeThisRound > 0 && result.outcome !== null) {
      roundsPlayed++;
      const expectedDelta = result.net - stakeThisRound;
      assert(
        state.balance === beforeBalance + expectedDelta,
        `balance drift at round ${i}: expected ${beforeBalance + expectedDelta}, got ${state.balance}`
      );
    }
    assert(state.balance >= 0, `balance went negative at round ${i}: ${state.balance}`);
  }
  assert(roundsPlayed >= 1000, `expected at least 1000 played rounds, got ${roundsPlayed}`);
}

// 9. Grep-level check: no fetch( anywhere in engine.js.
{
  const enginePath = fileURLToPath(new URL("./engine.js", import.meta.url));
  const source = readFileSync(enginePath, "utf8");
  assert(!source.includes("fetch("), "engine.js must never call fetch(...)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
