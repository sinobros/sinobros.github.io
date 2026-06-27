      "use strict";

      const SUITS = [
        { glyph: "♠", color: "black" },
        { glyph: "♥", color: "red" },
        { glyph: "♦", color: "red" },
        { glyph: "♣", color: "black" },
      ];
      const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const STARTING_BALANCE = 1000;
      const STORAGE_KEY = "sinobros-blackjack-to-mars";
      const DEAL_DELAY = 360;
      const REVEAL_DELAY = 420;

      const state = {
        balance: STARTING_BALANCE,
        chip: 25,
        pendingBet: 0,
        shoe: [],
        dealerHand: [],
        hands: [],
        activeHand: 0,
        phase: "betting",
        stats: { hands: 0, net: 0, blackjacks: 0, biggestWin: 0 },
        history: [],
      };

      const els = {
        balance: document.getElementById("balance"),
        shoeCount: document.getElementById("shoe-count"),
        dealerCards: document.getElementById("dealer-cards"),
        dealerTotal: document.getElementById("dealer-total"),
        playerHands: document.getElementById("player-hands"),
        resultText: document.getElementById("result-text"),
        resultSub: document.getElementById("result-sub"),
        statusPill: document.getElementById("status-pill"),
        currentBet: document.getElementById("current-bet"),
        dealBtn: document.getElementById("deal-btn"),
        clearBetBtn: document.getElementById("clear-bet-btn"),
        resetBtn: document.getElementById("reset-btn"),
        betPanel: document.getElementById("bet-panel"),
        actionPanel: document.getElementById("action-panel"),
        hitBtn: document.getElementById("hit-btn"),
        standBtn: document.getElementById("stand-btn"),
        doubleBtn: document.getElementById("double-btn"),
        splitBtn: document.getElementById("split-btn"),
        rulesPanel: document.getElementById("rules-panel"),
        rulesToggle: document.getElementById("rules-toggle"),
        sideRulesToggle: document.getElementById("side-rules-toggle"),
        historyList: document.getElementById("history-list"),
        handsStat: document.getElementById("hands-stat"),
        netStat: document.getElementById("net-stat"),
        bjStat: document.getElementById("bj-stat"),
        biggestStat: document.getElementById("biggest-stat"),
        chipButtons: document.querySelectorAll(".chip"),
        rocket: document.getElementById("rocket"),
      };

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      function saveDemoState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          balance: state.balance,
          stats: state.stats,
          history: state.history,
        }));
      }

      function loadDemoState() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
          if (!saved) return;
          if (Number.isFinite(saved.balance)) state.balance = saved.balance;
          if (saved.stats) state.stats = { ...state.stats, ...saved.stats };
          if (Array.isArray(saved.history)) state.history = saved.history.slice(0, 8);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      function buildShoe() {
        const cards = [];
        for (let d = 0; d < 6; d++) {
          for (const suit of SUITS) {
            for (const rank of RANKS) cards.push({ rank, suit });
          }
        }
        for (let i = cards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
      }

      function reshuffleIfNeeded(force = false) {
        if (force || state.shoe.length < 156) {
          state.shoe = buildShoe();
          setStatus("Robot shuffle");
          updateShoeCount();
        }
      }

      function drawCard() {
        reshuffleIfNeeded();
        return state.shoe.pop();
      }

      function cardBaseValue(card) {
        if (card.rank === "A") return 11;
        if (["K", "Q", "J"].includes(card.rank)) return 10;
        return parseInt(card.rank, 10);
      }

      function cardSplitValue(card) {
        return card.rank === "A" ? 11 : Math.min(cardBaseValue(card), 10);
      }

      function scoreHand(cards) {
        let total = cards.reduce((sum, card) => sum + cardBaseValue(card), 0);
        let aces = cards.filter((card) => card.rank === "A").length;
        while (total > 21 && aces > 0) {
          total -= 10;
          aces -= 1;
        }
        return { total, soft: aces > 0, bust: total > 21, blackjack: cards.length === 2 && total === 21 };
      }

      function payoutForBlackjack(bet) {
        return bet + Math.floor(bet * 1.5);
      }

      function makeHand(cards, bet, label) {
        return { cards, bet, label, stood: false, doubled: false, settled: false, result: "" };
      }

      function makeCardElement(card, reveal = true) {
        const el = document.createElement("div");
        el.className = `card dealing${reveal ? " revealed" : ""}`;
        el.innerHTML = `
          <div class="card-inner">
            <div class="card-back"></div>
            <div class="card-face ${card.suit.color}">
              <div class="card-corner top"><span class="card-rank">${card.rank}</span><span class="card-suit-small">${card.suit.glyph}</span></div>
              <span class="card-suit-big">${card.suit.glyph}</span>
              <div class="card-corner bottom"><span class="card-rank">${card.rank}</span><span class="card-suit-small">${card.suit.glyph}</span></div>
            </div>
          </div>`;
        setTimeout(() => el.classList.remove("dealing"), 480);
        return el;
      }

      function setStatus(text) {
        els.statusPill.textContent = text;
      }

      function setResult(text, sub = "", tone = "") {
        els.resultText.textContent = text;
        els.resultText.classList.remove("win", "lose", "push");
        if (tone) els.resultText.classList.add(tone);
        els.resultSub.textContent = sub;
      }

      function updateShoeCount() {
        const decks = Math.max(0, state.shoe.length / 52).toFixed(1);
        els.shoeCount.textContent = `${decks} decks`;
      }

      function renderDealer(revealHole = false) {
        els.dealerCards.innerHTML = "";
        state.dealerHand.forEach((card, index) => {
          els.dealerCards.appendChild(makeCardElement(card, index !== 1 || revealHole));
        });
        const visible = revealHole ? state.dealerHand : state.dealerHand.slice(0, 1);
        const score = scoreHand(visible);
        els.dealerTotal.textContent = revealHole && state.dealerHand.length ? `${scoreHand(state.dealerHand).total}` : `${score.total}+`;
        els.dealerTotal.classList.toggle("hidden", state.dealerHand.length === 0);
      }

      function renderHands() {
        els.playerHands.innerHTML = "";
        state.hands.forEach((hand, index) => {
          const score = scoreHand(hand.cards);
          const wrap = document.createElement("section");
          wrap.className = `player-hand ${index === state.activeHand && state.phase === "playing" ? "active" : ""} ${hand.settled ? "settled " + resultClass(hand.result) : ""}`;
          wrap.innerHTML = `
            <div class="seat-label">
              <span class="seat-name">${hand.label}</span>
              <span style="display:flex;gap:8px;flex-wrap:wrap;"><span class="hand-bet">Bet ${hand.bet}</span><span class="total-pill">${score.total}${score.soft ? " soft" : ""}</span></span>
            </div>
            <div class="cards"></div>`;
          const cardRow = wrap.querySelector(".cards");
          hand.cards.forEach((card) => cardRow.appendChild(makeCardElement(card, true)));
          els.playerHands.appendChild(wrap);
        });
      }

      function resultClass(result) {
        if (result.includes("wins") || result.includes("blackjack")) return "win";
        if (result.includes("push")) return "push";
        return "lose";
      }

      function renderControls() {
        const betting = state.phase === "betting";
        const playing = state.phase === "playing";
        els.betPanel.hidden = !betting;
        els.actionPanel.hidden = !playing;
        els.currentBet.textContent = `Bet: ${state.pendingBet}`;
        els.dealBtn.disabled = !betting || state.pendingBet <= 0;
        els.clearBetBtn.disabled = !betting || state.pendingBet <= 0;
        els.chipButtons.forEach((button) => {
          const value = parseInt(button.dataset.chip, 10);
          button.classList.toggle("selected", value === state.chip);
          button.disabled = !betting || value > state.balance - state.pendingBet;
        });
        if (playing) {
          const hand = state.hands[state.activeHand];
          const score = scoreHand(hand.cards);
          const firstTwo = hand.cards.length === 2;
          els.hitBtn.disabled = score.bust;
          els.standBtn.disabled = false;
          els.doubleBtn.disabled = !firstTwo || state.balance < hand.bet;
          els.splitBtn.disabled = !firstTwo || state.hands.length >= 2 || state.balance < hand.bet || cardSplitValue(hand.cards[0]) !== cardSplitValue(hand.cards[1]);
        }
      }

      function renderStats() {
        els.balance.textContent = state.balance;
        els.handsStat.textContent = state.stats.hands;
        els.netStat.textContent = state.stats.net >= 0 ? `+${state.stats.net}` : state.stats.net;
        els.bjStat.textContent = state.stats.blackjacks;
        els.biggestStat.textContent = state.stats.biggestWin;
        els.historyList.innerHTML = state.history.length
          ? state.history.map((item) => `<div class="history-row"><strong>${item.title}</strong>${item.detail}</div>`).join("")
          : `<div class="history-row">No launches yet. Place a bet to start the mission.</div>`;
      }

      function renderAll(revealDealer = false) {
        updateShoeCount();
        renderDealer(revealDealer);
        renderHands();
        renderControls();
        renderStats();
      }

      function placeChip(value) {
        if (state.phase !== "betting") return;
        if (value > state.balance - state.pendingBet) {
          setResult("Insufficient Dragon Gold", "Choose a smaller chip or clear the current launch bet.", "lose");
          return;
        }
        state.chip = value;
        state.pendingBet += value;
        setResult("Bet armed", `${state.pendingBet} Dragon Gold ready for launch.`);
        renderAll();
      }

      function clearBet() {
        if (state.phase !== "betting") return;
        state.pendingBet = 0;
        setResult("Place your launch bet", "Pick a chip, place Dragon Gold, then deal. This is browser-generated play money only.");
        renderAll();
      }

      async function dealRound() {
        if (state.pendingBet <= 0 || state.phase !== "betting") return;
        if (state.pendingBet > state.balance) return;
        state.phase = "dealing";
        state.balance -= state.pendingBet;
        state.dealerHand = [];
        state.hands = [makeHand([], state.pendingBet, "Pilot hand")];
        state.activeHand = 0;
        setStatus("Dealing");
        setResult("Robot dealer online", "Cards entering orbit...");
        renderAll();
        await dealTo(state.hands[0]);
        await dealToDealer(true);
        await dealTo(state.hands[0]);
        await dealToDealer(false);
        state.pendingBet = 0;
        renderAll(false);
        await sleep(REVEAL_DELAY);
        const playerScore = scoreHand(state.hands[0].cards);
        const dealerScore = scoreHand(state.dealerHand);
        if (playerScore.blackjack || dealerScore.blackjack) {
          await settleRound(true);
          return;
        }
        state.phase = "playing";
        setStatus("Your action");
        setResult("Choose your flight path", "Hit, stand, double, or split if the hand allows it.");
        renderAll(false);
      }

      async function dealTo(hand) {
        hand.cards.push(drawCard());
        renderAll(false);
        await sleep(DEAL_DELAY);
      }

      async function dealToDealer(reveal) {
        state.dealerHand.push(drawCard());
        renderDealer(reveal);
        renderHands();
        renderStats();
        await sleep(DEAL_DELAY);
      }

      async function hit() {
        if (state.phase !== "playing") return;
        const hand = state.hands[state.activeHand];
        await dealTo(hand);
        const score = scoreHand(hand.cards);
        if (score.bust) {
          hand.stood = true;
          setResult("Hand busted", `${hand.label} burned up at ${score.total}.`, "lose");
          await sleep(520);
          await nextHandOrDealer();
        } else if (score.total === 21) {
          hand.stood = true;
          setResult("Twenty-one locked", `${hand.label} auto-stands at 21.`, "win");
          await sleep(520);
          await nextHandOrDealer();
        }
        renderAll(false);
      }

      async function stand() {
        if (state.phase !== "playing") return;
        state.hands[state.activeHand].stood = true;
        await nextHandOrDealer();
      }

      async function doubleDown() {
        if (state.phase !== "playing") return;
        const hand = state.hands[state.activeHand];
        if (hand.cards.length !== 2 || state.balance < hand.bet) return;
        state.balance -= hand.bet;
        hand.bet *= 2;
        hand.doubled = true;
        setResult("Double down", `${hand.label} doubles the burn and takes one card.`);
        await dealTo(hand);
        hand.stood = true;
        await sleep(520);
        await nextHandOrDealer();
      }

      async function splitHand() {
        if (state.phase !== "playing") return;
        const hand = state.hands[0];
        if (state.hands.length >= 2 || hand.cards.length !== 2 || state.balance < hand.bet) return;
        if (cardSplitValue(hand.cards[0]) !== cardSplitValue(hand.cards[1])) return;
        state.balance -= hand.bet;
        const second = hand.cards.pop();
        state.hands = [makeHand([hand.cards[0]], hand.bet, "Pilot hand A"), makeHand([second], hand.bet, "Pilot hand B")];
        state.activeHand = 0;
        setResult("Split trajectory", "Two hands are now in orbit. Each receives a new card.");
        await dealTo(state.hands[0]);
        await dealTo(state.hands[1]);
        if (state.hands[0].cards[0].rank === "A") {
          state.hands.forEach((h) => (h.stood = true));
          await sleep(520);
          await settleRound(false);
        }
        renderAll(false);
      }

      async function nextHandOrDealer() {
        const next = state.hands.findIndex((hand, index) => index > state.activeHand && !hand.stood && !scoreHand(hand.cards).bust);
        if (next >= 0) {
          state.activeHand = next;
          setStatus("Next hand");
          setResult("Next trajectory", `${state.hands[next].label} is active.`);
          renderAll(false);
          return;
        }
        await settleRound(false);
      }

      async function playDealer() {
        setStatus("Dealer reveal");
        renderAll(true);
        await sleep(650);
        while (true) {
          const score = scoreHand(state.dealerHand);
          if (score.total > 17 || score.bust) break;
          if (score.total === 17) break;
          setStatus("Dealer draws");
          await dealToDealer(true);
          await sleep(520);
        }
      }

      async function settleRound(fromInitialDeal) {
        state.phase = "settling";
        const anyLive = state.hands.some((hand) => !scoreHand(hand.cards).bust);
        if (anyLive) await playDealer();
        else renderAll(true);

        const dealer = scoreHand(state.dealerHand);
        let returns = 0;
        const summaries = [];
        for (const hand of state.hands) {
          const score = scoreHand(hand.cards);
          let result;
          let paid = 0;
          if (score.blackjack && fromInitialDeal && dealer.blackjack) {
            result = "blackjack push";
            paid = hand.bet;
          } else if (score.blackjack && fromInitialDeal) {
            result = "blackjack wins";
            paid = payoutForBlackjack(hand.bet);
            state.stats.blackjacks += 1;
            launchRocket();
          } else if (score.bust) {
            result = "bust loses";
          } else if (dealer.blackjack && fromInitialDeal) {
            result = "dealer blackjack loses";
          } else if (dealer.bust || score.total > dealer.total) {
            result = "wins";
            paid = hand.bet * 2;
          } else if (score.total === dealer.total) {
            result = "push";
            paid = hand.bet;
          } else {
            result = "loses";
          }
          hand.result = result;
          hand.settled = true;
          returns += paid;
          summaries.push(`${hand.label}: ${score.total} ${result}${paid ? ` (+${paid})` : ""}`);
        }

        state.balance += returns;
        const totalBet = state.hands.reduce((sum, hand) => sum + hand.bet, 0);
        const net = returns - totalBet;
        state.stats.hands += state.hands.length;
        state.stats.net += net;
        state.stats.biggestWin = Math.max(state.stats.biggestWin, net);
        const tone = net > 0 ? "win" : net < 0 ? "lose" : "push";
        setStatus("Round settled");
        setResult(net > 0 ? "Mars launch paid" : net < 0 ? "Mission lost" : "Orbit push", `${summaries.join(" • ")} — net ${net >= 0 ? "+" : ""}${net} Dragon Gold`, tone);
        state.history.unshift({ title: `${net >= 0 ? "+" : ""}${net} Dragon Gold`, detail: summaries.join(" • ") });
        state.history = state.history.slice(0, 8);
        state.phase = "betting";
        state.pendingBet = 0;
        saveDemoState();
        renderAll(true);
        setTimeout(() => {
          if (state.phase === "betting") setStatus("Betting open");
        }, 1200);
      }

      function launchRocket() {
        els.rocket.classList.remove("launch");
        void els.rocket.offsetWidth;
        els.rocket.classList.add("launch");
      }

      function resetDemo() {
        localStorage.removeItem(STORAGE_KEY);
        state.balance = STARTING_BALANCE;
        state.pendingBet = 0;
        state.dealerHand = [];
        state.hands = [];
        state.activeHand = 0;
        state.phase = "betting";
        state.stats = { hands: 0, net: 0, blackjacks: 0, biggestWin: 0 };
        state.history = [];
        reshuffleIfNeeded(true);
        setStatus("Betting open");
        setResult("Demo reset", "Fresh Dragon Gold and a newly shuffled robot shoe are ready.");
        renderAll(false);
      }

      function toggleRules() {
        els.rulesPanel.hidden = !els.rulesPanel.hidden;
      }

      function init() {
        loadDemoState();
        reshuffleIfNeeded(true);
        els.chipButtons.forEach((button) => {
          button.addEventListener("click", () => placeChip(parseInt(button.dataset.chip, 10)));
        });
        els.dealBtn.addEventListener("click", dealRound);
        els.clearBetBtn.addEventListener("click", clearBet);
        els.resetBtn.addEventListener("click", resetDemo);
        els.hitBtn.addEventListener("click", hit);
        els.standBtn.addEventListener("click", stand);
        els.doubleBtn.addEventListener("click", doubleDown);
        els.splitBtn.addEventListener("click", splitHand);
        els.rulesToggle.addEventListener("click", toggleRules);
        els.sideRulesToggle.addEventListener("click", toggleRules);
        renderAll(false);
      }

      init();
