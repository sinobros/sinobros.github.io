      "use strict";
      const DEFAULT_API = "https://golfmat.ch:3000";
      const POLL_MS = 1500;
      const state = { api: localStorage.getItem("sinobrosPokerApiUrl") || DEFAULT_API, handle: localStorage.getItem("sinobrosPokerHandle") || "Dragon", matchId: localStorage.getItem("sinobrosPokerMatchId") || "", playerId: localStorage.getItem("sinobrosPokerPlayerId") || "", snapshot: null, poller: null, betRange: { min: 0, max: 0, bb: 20, initialized: false } };
      const $ = (id) => document.getElementById(id);
      const els = { apiUrl: $("api-url"), handle: $("handle"), apiStatus: $("api-status"), matchId: $("match-id"), create: $("create-match"), join: $("join-match"), offline: $("offline-note"), youName: $("you-name"), youStack: $("you-stack"), youCards: $("you-cards"), youHandReadout: $("you-hand-readout"), youHandName: $("you-hand-name"), oppName: $("opp-name"), oppStack: $("opp-stack"), oppCards: $("opp-cards"), seatYou: $("seat-you"), seatOpp: $("seat-opp"), board: $("board"), pot: $("pot"), turnTitle: $("turn-title"), result: $("result-text"), actions: $("actions"), raise: $("raise-amount"), raiseLabel: $("raise-amount-label"), betSlider: $("bet-slider"), betMinus: $("bet-decrement"), betPlus: $("bet-increment"), eventLog: $("event-log"), stateMatch: $("state-match"), statePhase: $("state-phase"), stateStreet: $("state-street"), stateButton: $("state-button"), stateActor: $("state-actor"), stateHands: $("state-hands"), aliveTime: $("alive-time"), sessionCount: $("session-count") };

      function saveBasics() { localStorage.setItem("sinobrosPokerApiUrl", state.api); localStorage.setItem("sinobrosPokerHandle", state.handle); if (state.matchId) localStorage.setItem("sinobrosPokerMatchId", state.matchId); if (state.playerId) localStorage.setItem("sinobrosPokerPlayerId", state.playerId); }
      function api(path) { return state.api.replace(/\/$/, "") + path; }
      function normalizeMatchCode(value) { return String(value || "").replace(/\D/g, "").slice(0, 4); }
      function isMatchCode(value) { return /^\d{4}$/.test(value); }
      async function request(path, options = {}) { const res = await fetch(api(path), { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); return data; }
      function setStatus(ok, text) { els.apiStatus.className = `status-chip ${ok ? "ok" : "bad"}`; els.apiStatus.textContent = text; els.offline.hidden = ok; }
      async function checkHealth() {
        try {
          const data = await request("/health");
          setStatus(true, "backend online");
          if (els.aliveTime) {
            const d = new Date(data.ts || Date.now());
            els.aliveTime.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          }
          if (els.sessionCount) {
            els.sessionCount.textContent = (data.matches !== undefined ? data.matches : "—");
          }
        } catch {
          setStatus(false, "backend offline");
          if (els.aliveTime) els.aliveTime.textContent = "—";
          if (els.sessionCount) els.sessionCount.textContent = "—";
        }
      }
      function cardColor(card) { return card && (card[1] === "h" || card[1] === "d") ? "red" : "black"; }
      function suitGlyph(card) { return ({s:"♠",h:"♥",d:"♦",c:"♣"})[card?.[1]] || ""; }
      function prettyCard(card) { if (!card) return "?"; return card[0].replace("T", "10") + suitGlyph(card); }
      const RANK_ORDER = "23456789TJQKA";
      const RANK_LABELS = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
      const RANK_PLURALS = ["Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces"];
      const HAND_RANKS = { HIGH_CARD: 0, ONE_PAIR: 1, TWO_PAIR: 2, THREE_OF_A_KIND: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, FOUR_OF_A_KIND: 7, STRAIGHT_FLUSH: 8 };
      function rankIndex(rank) { return RANK_ORDER.indexOf(rank); }
      function validCards(cards) { return (cards || []).filter(card => typeof card === "string" && card.length >= 2 && rankIndex(card[0]) >= 0); }
      function evaluate5(cards) {
        const ranks = cards.map(card => rankIndex(card[0])).sort((a, b) => b - a);
        const suits = cards.map(card => card[1]);
        const isFlush = suits.every(suit => suit === suits[0]);
        const rankSet = [...new Set(ranks)];
        let isStraight = false;
        let straightHigh = 0;
        if (rankSet.length === 5) {
          if (ranks[0] - ranks[4] === 4) {
            isStraight = true;
            straightHigh = ranks[0];
          } else if (ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
            isStraight = true;
            straightHigh = 3;
          }
        }

        const freq = {};
        for (const rank of ranks) freq[rank] = (freq[rank] || 0) + 1;
        const counts = Object.entries(freq)
          .map(([rank, count]) => ({ r: Number(rank), c: count }))
          .sort((a, b) => b.c - a.c || b.r - a.r);

        if (isFlush && isStraight) return { rank: HAND_RANKS.STRAIGHT_FLUSH, tiebreak: [straightHigh] };
        if (counts[0].c === 4) return { rank: HAND_RANKS.FOUR_OF_A_KIND, tiebreak: [counts[0].r, counts[1].r] };
        if (counts[0].c === 3 && counts[1].c === 2) return { rank: HAND_RANKS.FULL_HOUSE, tiebreak: [counts[0].r, counts[1].r] };
        if (isFlush) return { rank: HAND_RANKS.FLUSH, tiebreak: ranks };
        if (isStraight) return { rank: HAND_RANKS.STRAIGHT, tiebreak: [straightHigh] };
        if (counts[0].c === 3) return { rank: HAND_RANKS.THREE_OF_A_KIND, tiebreak: [counts[0].r, ...counts.slice(1).map(x => x.r)] };
        if (counts[0].c === 2 && counts[1].c === 2) return { rank: HAND_RANKS.TWO_PAIR, tiebreak: [counts[0].r, counts[1].r, counts[2].r] };
        if (counts[0].c === 2) return { rank: HAND_RANKS.ONE_PAIR, tiebreak: [counts[0].r, ...counts.slice(1).map(x => x.r)] };
        return { rank: HAND_RANKS.HIGH_CARD, tiebreak: ranks };
      }
      function combinations(arr, k) {
        if (k === 0) return [[]];
        if (arr.length < k) return [];
        if (arr.length === k) return [arr];
        const [first, ...rest] = arr;
        return [...combinations(rest, k - 1).map(combo => [first, ...combo]), ...combinations(rest, k)];
      }
      function compareEval(a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        for (let i = 0; i < Math.min(a.tiebreak.length, b.tiebreak.length); i++) {
          if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] - b.tiebreak[i];
        }
        return 0;
      }
      function bestHoldemHand(cards) {
        let best = null;
        for (const five of combinations(cards, 5)) {
          const ev = evaluate5(five);
          if (!best || compareEval(ev, best) > 0) best = ev;
        }
        return best;
      }
      function highLabel(rank) { return `${RANK_LABELS[rank]} high`; }
      function describeMadeHand(ev) {
        if (!ev) return "";
        switch (ev.rank) {
          case HAND_RANKS.STRAIGHT_FLUSH:
            return ev.tiebreak[0] === 12 ? "Royal flush" : `Straight flush, ${highLabel(ev.tiebreak[0])}`;
          case HAND_RANKS.FOUR_OF_A_KIND:
            return `Four of a kind, ${RANK_PLURALS[ev.tiebreak[0]]}`;
          case HAND_RANKS.FULL_HOUSE:
            return `Full house, ${RANK_PLURALS[ev.tiebreak[0]]} over ${RANK_PLURALS[ev.tiebreak[1]]}`;
          case HAND_RANKS.FLUSH:
            return `Flush, ${highLabel(ev.tiebreak[0])}`;
          case HAND_RANKS.STRAIGHT:
            return `Straight, ${highLabel(ev.tiebreak[0])}`;
          case HAND_RANKS.THREE_OF_A_KIND:
            return `Three of a kind, ${RANK_PLURALS[ev.tiebreak[0]]}`;
          case HAND_RANKS.TWO_PAIR:
            return `Two pair, ${RANK_PLURALS[ev.tiebreak[0]]} and ${RANK_PLURALS[ev.tiebreak[1]]}`;
          case HAND_RANKS.ONE_PAIR:
            return `Pair of ${RANK_PLURALS[ev.tiebreak[0]]}`;
          default:
            return highLabel(ev.tiebreak[0]);
        }
      }
      function describeStartingHand(cards) {
        const ranks = cards.map(card => rankIndex(card[0])).sort((a, b) => b - a);
        if (ranks.length < 2) return "";
        if (ranks[0] === ranks[1]) return `Pocket ${RANK_PLURALS[ranks[0]]}`;
        return `${RANK_LABELS[ranks[0]]}-${RANK_LABELS[ranks[1]]} ${cards[0][1] === cards[1][1] ? "suited" : "offsuit"}`;
      }
      function describeVisibleHoldemHand(holeCards, boardCards) {
        const holes = validCards(holeCards);
        const board = validCards(boardCards);
        if (holes.length < 2) return "";
        if (board.length < 3) return describeStartingHand(holes);
        return describeMadeHand(bestHoldemHand([...holes, ...board]));
      }
      function updateHandReadout(player, hand) {
        if (!els.youHandReadout || !els.youHandName) return;
        const name = player && hand ? describeVisibleHoldemHand(player.holes, hand.community) : "";
        els.youHandReadout.hidden = !name;
        els.youHandName.textContent = name || "—";
      }
      function updateActionButtons(snapshot) { const legal = new Set((snapshot.legalActions || []).map(a => a.action)); els.actions.querySelectorAll("button[data-action]").forEach(btn => { const action = btn.dataset.action; btn.disabled = action === "next-hand" ? !(snapshot.phase === "playing" && snapshot.hand && snapshot.hand.status !== "active") : !legal.has(action); }); }
      function refreshSliderButtons() { const value = Number(els.raise.value); const min = Number(els.raise.min); const max = Number(els.raise.max); els.raiseLabel.textContent = value; els.betMinus.disabled = els.raise.disabled || value <= min; els.betPlus.disabled = els.raise.disabled || value >= max; }
      function configureBetSlider(snapshot) {
        const legal = snapshot.legalActions || [];
        const betAction = legal.find(a => a.action === "bet" || a.action === "raise");
        const bb = (snapshot.blinds && snapshot.blinds.big) || state.betRange.bb || 20;
        if (!betAction) { els.betSlider.hidden = true; state.betRange.initialized = false; return; }
        els.betSlider.hidden = false;
        const { min, max } = betAction;
        const rangeChanged = !state.betRange.initialized || state.betRange.min !== min || state.betRange.max !== max;
        els.raise.min = min; els.raise.max = max; els.raise.step = bb; els.raise.disabled = max <= min;
        if (rangeChanged) { els.raise.value = min; state.betRange = { min, max, bb, initialized: true }; }
        refreshSliderButtons();
      }
      function stepBet(delta) { const bb = state.betRange.bb || 20; const next = Math.min(Number(els.raise.max), Math.max(Number(els.raise.min), Number(els.raise.value) + delta * bb)); els.raise.value = next; refreshSliderButtons(); }
      function renderCard(card) { const div = document.createElement("div"); if (!card) { if (window.createCardSVG) { div.innerHTML = createCardSVG("2", "s", false); } else { div.className = "playing-card back"; div.textContent = "🂠"; } return div; } if (window.createCardSVG) { div.innerHTML = createCardSVG(card[0], card[1], true); } else { div.className = `playing-card ${cardColor(card)}`; div.textContent = prettyCard(card); } return div; }
      function renderHoleCards(container, holes, hasHand) { container.innerHTML = ""; if (!hasHand) return; const cards = holes || [null, null]; cards.forEach(c => container.appendChild(renderCard(c))); }
      function render(snapshot) {
        state.snapshot = snapshot;
        const me = snapshot.players.find(p => p.id === state.playerId);
        const opp = snapshot.players.find(p => p.id !== state.playerId);
        const hand = snapshot.hand;
        if (me) { els.youName.textContent = me.handle; els.youStack.textContent = `Stack ${me.stack}`; renderHoleCards(els.youCards, me.holes, !!hand); els.seatYou.classList.toggle("active", !!(hand && hand.actorId === me.id)); }
        if (opp) { els.oppName.textContent = opp.handle; els.oppStack.textContent = `Stack ${opp.stack}`; renderHoleCards(els.oppCards, opp.holes, !!hand); els.seatOpp.classList.toggle("active", !!(hand && hand.actorId === opp.id)); }
        updateHandReadout(me, hand);
        els.board.innerHTML = ""; if (hand && hand.community.length > 0) { hand.community.forEach(c => els.board.appendChild(renderCard(c))); }
        els.pot.textContent = hand ? hand.pot : 0;
        let title = "Create or join a match"; let sub = "Play-money heads-up tournament. Button posts the small blind preflop; big blind acts first after the flop.";
        if (snapshot.phase === "waiting") { title = "Waiting for opponent…"; sub = `Share match code ${snapshot.matchId} with a friend to start.`; }
        else if (snapshot.phase === "playing" && hand) { if (hand.status === "active") { const actor = snapshot.players.find(p => p.id === hand.actorId); title = hand.actorId === state.playerId ? "Your Turn" : `${actor ? actor.handle : "Opponent"}’s Turn`; sub = hand.street.charAt(0).toUpperCase() + hand.street.slice(1); } else if (hand.result) { const { winner, reason } = hand.result; title = winner === state.playerId ? "You Win!" : winner === null ? "Tie — pot split" : "You Lose"; sub = reason || ""; } }
        else if (snapshot.phase === "complete") { const w = snapshot.players.find(p => p.id === snapshot.winner); title = snapshot.winner === state.playerId ? "You Win the Match!" : `${w ? w.handle : "Opponent"} Wins the Match`; sub = "Match complete."; }
        els.turnTitle.textContent = title; els.result.textContent = sub;
        updateActionButtons(snapshot);
        configureBetSlider(snapshot);
        els.stateMatch.textContent = snapshot.matchId || "—"; els.statePhase.textContent = snapshot.phase || "—"; els.stateStreet.textContent = hand ? hand.street : "—"; els.stateButton.textContent = hand ? (snapshot.players[hand.buttonSeat] || {}).handle || "—" : "—"; els.stateActor.textContent = hand && hand.actorId ? (snapshot.players.find(p => p.id === hand.actorId) || {}).handle || "—" : "—"; els.stateHands.textContent = snapshot.handsPlayed;
        if (snapshot.events && snapshot.events.length) { els.eventLog.innerHTML = snapshot.events.slice().reverse().map(e => `<li>${e.msg}</li>`).join(""); }
      }
      async function poll() { if (!state.matchId) return; try { const { state: snap } = await request(`/api/matches/${encodeURIComponent(state.matchId)}?playerId=${encodeURIComponent(state.playerId)}`); setStatus(true, "backend online"); render(snap); } catch (err) { setStatus(false, err.message || "backend offline"); } }
      function startPolling() { if (state.poller) clearInterval(state.poller); state.poller = setInterval(poll, POLL_MS); poll(); }
      async function createMatch() { state.handle = els.handle.value.trim() || "Dragon"; const data = await request("/api/matches", { method:"POST", body: JSON.stringify({ handle: state.handle }) }); state.matchId = data.matchId; state.playerId = data.playerId; els.matchId.value = state.matchId; saveBasics(); render(data.state); startPolling(); }
      async function joinMatch() { state.handle = els.handle.value.trim() || "Dragon"; state.matchId = normalizeMatchCode(els.matchId.value); els.matchId.value = state.matchId; if (state.matchId.length !== 4) throw new Error("Enter a 4-digit match code first"); const data = await request(`/api/matches/${encodeURIComponent(state.matchId)}/join`, { method:"POST", body: JSON.stringify({ handle: state.handle }) }); state.playerId = data.playerId; saveBasics(); render(data.state); startPolling(); }
      async function sendAction(action) { const body = { playerId: state.playerId, action }; if (action === "bet" || action === "raise") body.amount = parseInt(els.raise.value, 10) || 0; const { state: snap } = await request(`/api/matches/${encodeURIComponent(state.matchId)}/actions`, { method:"POST", body: JSON.stringify(body) }); render(snap); }
      function wire() { els.apiUrl.value = state.api; els.handle.value = state.handle; state.matchId = isMatchCode(state.matchId) ? state.matchId : ""; els.matchId.value = state.matchId; els.matchId.addEventListener("input", () => { els.matchId.value = normalizeMatchCode(els.matchId.value); }); els.apiUrl.addEventListener("change", () => { state.api = els.apiUrl.value.trim() || DEFAULT_API; saveBasics(); checkHealth(); startPolling(); }); els.handle.addEventListener("change", () => { state.handle = els.handle.value.trim() || "Dragon"; saveBasics(); }); els.create.addEventListener("click", () => createMatch().catch(e => setStatus(false, e.message))); els.join.addEventListener("click", () => joinMatch().catch(e => setStatus(false, e.message))); els.actions.addEventListener("click", (e) => { const btn = e.target.closest("button[data-action]"); if (btn && !btn.disabled) sendAction(btn.dataset.action).catch(err => setStatus(false, err.message)); }); els.raise.addEventListener("input", refreshSliderButtons); els.betMinus.addEventListener("click", () => stepBet(-1)); els.betPlus.addEventListener("click", () => stepBet(1)); checkHealth(); if (state.matchId) startPolling(); else updateActionButtons({ legalActions: [] }); }
      wire();
