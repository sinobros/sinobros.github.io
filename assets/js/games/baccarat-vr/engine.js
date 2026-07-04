"use strict";

// Pure baccarat rules engine for the VR table. Ported from
// assets/js/games/baccarat.js (the live 2D game) — see
// bacplans/MASTER-PLAN-baccarat-webxr.md, Decision #4: this is a standalone
// copy, not a shared/refactored module, so the 2D game's DOM-wired file is
// never touched. No DOM, no Three.js, no fetch, no setTimeout — animation
// pacing belongs to the renderer (animate.js), not here.

export const SUITS = [
  { glyph: "♠", color: "black" },
  { glyph: "♥", color: "red" },
  { glyph: "♦", color: "red" },
  { glyph: "♣", color: "black" },
];

export const RANKS = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export const STARTING_BALANCE = 1000;
export const CHIP_VALUES = [10, 25, 50, 100, 500]; // matches assets/css/pages/baccarat.css chip rail
export const BET_SIDES = ["player", "tie", "banker"];

const DECKS = 6;
const RESHUFFLE_THRESHOLD = 20;

export function buildShoe(rng = Math.random) {
  const cards = [];
  for (let d = 0; d < DECKS; d++) {
    for (let s = 0; s < SUITS.length; s++) {
      for (let r = 0; r < RANKS.length; r++) {
        cards.push({ rank: RANKS[r], suit: SUITS[s] });
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function drawCard(state, rng) {
  if (state.shoe.length < RESHUFFLE_THRESHOLD) state.shoe = buildShoe(rng);
  return state.shoe.pop();
}

export function cardValue(card) {
  if (card.rank === "A") return 1;
  if (card.rank === "10" || card.rank === "J" || card.rank === "Q" || card.rank === "K") return 0;
  return parseInt(card.rank, 10);
}

export function handTotal(hand) {
  const sum = hand.reduce((t, c) => t + cardValue(c), 0);
  return sum % 10;
}

export function shouldPlayerDraw(playerTotal) {
  return playerTotal <= 5;
}

export function shouldBankerDraw(bankerTotal, playerThirdCardValue) {
  if (playerThirdCardValue == null) return bankerTotal <= 5;
  const p3 = playerThirdCardValue;
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return p3 !== 8;
  if (bankerTotal === 4) return p3 >= 2 && p3 <= 7;
  if (bankerTotal === 5) return p3 >= 4 && p3 <= 7;
  if (bankerTotal === 6) return p3 >= 6 && p3 <= 7;
  return false;
}

function totalStake(state) {
  return state.bets.player + state.bets.tie + state.bets.banker;
}

export function createInitialState(rng = Math.random) {
  return {
    balance: STARTING_BALANCE,
    bets: { player: 0, tie: 0, banker: 0 },
    chip: CHIP_VALUES[1],
    shoe: buildShoe(rng),
    playerHand: [],
    bankerHand: [],
    inRound: false,
    lastOutcome: null,
  };
}

export function placeBet(state, side) {
  if (state.inRound) return state;
  const chip = state.chip;
  const remaining = state.balance - totalStake(state);
  if (chip > remaining) return state;
  state.bets[side] += chip;
  return state;
}

export function clearBets(state) {
  if (state.inRound) return state;
  state.bets = { player: 0, tie: 0, banker: 0 };
  return state;
}

function settle(state) {
  const p = handTotal(state.playerHand);
  const b = handTotal(state.bankerHand);
  let outcome;
  if (p > b) outcome = "player";
  else if (b > p) outcome = "banker";
  else outcome = "tie";

  let net = 0;
  const lines = [];

  if (outcome === "player") {
    net += state.bets.player * 2;
    if (state.bets.player > 0) lines.push(`+${state.bets.player * 2} on Player`);
    if (state.bets.banker > 0) lines.push(`-${state.bets.banker} on Banker`);
    if (state.bets.tie > 0) lines.push(`-${state.bets.tie} on Tie`);
  } else if (outcome === "banker") {
    const won = Math.floor(state.bets.banker * 0.95);
    net += state.bets.banker + won;
    if (state.bets.banker > 0) lines.push(`+${state.bets.banker + won} on Banker`);
    if (state.bets.player > 0) lines.push(`-${state.bets.player} on Player`);
    if (state.bets.tie > 0) lines.push(`-${state.bets.tie} on Tie`);
  } else {
    // VR-only divergence from the live 2D game (Decision #5,
    // bacplans/MASTER-PLAN-baccarat-webxr.md): assets/js/games/baccarat.js's
    // settle() only pays the Tie bet on a push and forfeits the Player/Banker
    // stakes. Standard casino rule treats a Tie as a push for Player/Banker
    // bets, so this VR engine refunds those stakes in full here. This is
    // intentional — do not "fix" it back into parity with the 2D file.
    if (state.bets.tie > 0) {
      net += state.bets.tie * 9;
      lines.push(`+${state.bets.tie * 9} on Tie`);
    }
    if (state.bets.player > 0) {
      net += state.bets.player;
      lines.push(`refund ${state.bets.player} on Player`);
    }
    if (state.bets.banker > 0) {
      net += state.bets.banker;
      lines.push(`refund ${state.bets.banker} on Banker`);
    }
  }

  state.balance += net;
  return { outcome, net, lines, playerTotal: p, bankerTotal: b };
}

export function dealRound(state, rng = Math.random) {
  const stake = totalStake(state);
  if (state.inRound) return { state, events: [], outcome: null, payoutLines: [], reason: "in-round" };
  if (stake <= 0) return { state, events: [], outcome: null, payoutLines: [], reason: "no-bet" };
  if (stake > state.balance) return { state, events: [], outcome: null, payoutLines: [], reason: "insufficient-balance" };

  state.inRound = true;
  state.balance -= stake;
  state.playerHand = [];
  state.bankerHand = [];

  const events = [];

  const p1 = drawCard(state, rng);
  state.playerHand.push(p1);
  events.push({ type: "deal", seat: "player", card: p1 });

  const b1 = drawCard(state, rng);
  state.bankerHand.push(b1);
  events.push({ type: "deal", seat: "banker", card: b1 });

  const p2 = drawCard(state, rng);
  state.playerHand.push(p2);
  events.push({ type: "deal", seat: "player", card: p2 });

  const b2 = drawCard(state, rng);
  state.bankerHand.push(b2);
  events.push({ type: "deal", seat: "banker", card: b2 });

  events.push({ type: "reveal", seat: "player", cardIndex: 0 });
  events.push({ type: "reveal", seat: "player", cardIndex: 1 });
  events.push({ type: "reveal", seat: "banker", cardIndex: 0 });
  events.push({ type: "reveal", seat: "banker", cardIndex: 1 });

  const pTotal = handTotal(state.playerHand);
  const bTotal = handTotal(state.bankerHand);
  const isNatural = pTotal >= 8 || bTotal >= 8;

  let playerThirdValue = null;

  if (!isNatural) {
    if (shouldPlayerDraw(pTotal)) {
      const p3 = drawCard(state, rng);
      state.playerHand.push(p3);
      playerThirdValue = cardValue(p3);
      events.push({ type: "thirdCard", seat: "player", card: p3 });
      events.push({ type: "reveal", seat: "player", cardIndex: 2 });
    }

    if (shouldBankerDraw(bTotal, playerThirdValue)) {
      const b3 = drawCard(state, rng);
      state.bankerHand.push(b3);
      events.push({ type: "thirdCard", seat: "banker", card: b3 });
      events.push({ type: "reveal", seat: "banker", cardIndex: 2 });
    }
  }

  const result = settle(state);
  events.push({ type: "settle", outcome: result.outcome, net: result.net, lines: result.lines });

  state.bets = { player: 0, tie: 0, banker: 0 };
  state.inRound = false;
  state.lastOutcome = result.outcome;

  return {
    state,
    events,
    outcome: result.outcome,
    payoutLines: result.lines,
    net: result.net,
    playerTotal: result.playerTotal,
    bankerTotal: result.bankerTotal,
  };
}
