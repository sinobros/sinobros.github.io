      "use strict";

      const SUITS = [
        { glyph: "♠", color: "black" },
        { glyph: "♥", color: "red" },
        { glyph: "♦", color: "red" },
        { glyph: "♣", color: "black" },
      ];
      const RANKS = [
        "A",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "Q",
        "K",
      ];

      const STARTING_BALANCE = 1000;
      const DEAL_GAP_MS = 700;
      const DEAL_ANIM_MS = 900;
      const FLIP_ANIM_MS = 700;
      const PAUSE_BEFORE_THIRD_MS = 900;
      const PAUSE_BEFORE_RESULT_MS = 700;

      const state = {
        balance: STARTING_BALANCE,
        bets: { player: 0, tie: 0, banker: 0 },
        chip: 25,
        shoe: [],
        playerHand: [],
        bankerHand: [],
        inRound: false,
      };

      const els = {
        balance: document.getElementById("balance"),
        playerCards: document.getElementById("player-cards"),
        bankerCards: document.getElementById("banker-cards"),
        playerTotal: document.getElementById("player-total"),
        bankerTotal: document.getElementById("banker-total"),
        resultText: document.getElementById("result-text"),
        resultSub: document.getElementById("result-sub"),
        statusPill: document.getElementById("status-pill"),
        dealBtn: document.getElementById("deal-btn"),
        clearBtn: document.getElementById("clear-btn"),
        rulesToggle: document.getElementById("rules-toggle"),
        rulesPanel: document.getElementById("rules-panel"),
        betButtons: document.querySelectorAll(".bet-btn"),
        chipButtons: document.querySelectorAll(".chip"),
        stake: {
          player: document.getElementById("stake-player"),
          tie: document.getElementById("stake-tie"),
          banker: document.getElementById("stake-banker"),
        },
        deck: document.querySelector(".deck"),
      };

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      function buildShoe() {
        const decks = 6;
        const cards = [];
        for (let d = 0; d < decks; d++) {
          for (let s = 0; s < SUITS.length; s++) {
            for (let r = 0; r < RANKS.length; r++) {
              cards.push({ rank: RANKS[r], suit: SUITS[s] });
            }
          }
        }
        for (let i = cards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
      }

      function cardValue(card) {
        if (card.rank === "A") return 1;
        if (["10", "J", "Q", "K"].includes(card.rank)) return 0;
        return parseInt(card.rank, 10);
      }

      function handTotal(hand) {
        const sum = hand.reduce((t, c) => t + cardValue(c), 0);
        return sum % 10;
      }

      function drawCard() {
        if (state.shoe.length < 20) state.shoe = buildShoe();
        return state.shoe.pop();
      }

      function makeCardElement(card) {
        const wrap = document.createElement("div");
        wrap.className = "card";
        wrap.innerHTML = `
          <div class="card-inner">
            <div class="card-back"></div>
            <div class="card-face ${card.suit.color}">
              <div class="card-corner top">
                <span class="card-rank">${card.rank}</span>
                <span class="card-suit-small">${card.suit.glyph}</span>
              </div>
              <span class="card-suit-big">${card.suit.glyph}</span>
              <div class="card-corner bottom">
                <span class="card-rank">${card.rank}</span>
                <span class="card-suit-small">${card.suit.glyph}</span>
              </div>
            </div>
          </div>`;
        return wrap;
      }

      async function dealCardTo(seatEl, card) {
        const el = makeCardElement(card);
        const deckRect = els.deck.getBoundingClientRect();
        seatEl.appendChild(el);
        const targetRect = el.getBoundingClientRect();
        const dx = deckRect.left - targetRect.left;
        const dy = deckRect.top - targetRect.top;
        el.style.setProperty("--dx", `${dx}px`);
        el.style.setProperty("--dy", `${dy}px`);
        el.classList.add("dealing");
        await sleep(DEAL_ANIM_MS);
        el.classList.remove("dealing");
        return el;
      }

      async function revealCard(cardEl) {
        cardEl.classList.add("flipping");
        await sleep(FLIP_ANIM_MS);
      }

      function renderTotals(showBanker, showPlayer) {
        if (showPlayer) {
          els.playerTotal.textContent = handTotal(state.playerHand);
          els.playerTotal.classList.remove("hidden");
        } else {
          els.playerTotal.classList.add("hidden");
        }
        if (showBanker) {
          els.bankerTotal.textContent = handTotal(state.bankerHand);
          els.bankerTotal.classList.remove("hidden");
        } else {
          els.bankerTotal.classList.add("hidden");
        }
      }

      function renderBalance() {
        els.balance.textContent = state.balance;
      }

      function renderStakes() {
        ["player", "tie", "banker"].forEach((k) => {
          const v = state.bets[k];
          els.stake[k].textContent = v > 0 ? `● ${v}` : "";
        });
        const total = state.bets.player + state.bets.tie + state.bets.banker;
        els.dealBtn.disabled = total <= 0 || state.inRound;
      }

      function clearTable() {
        els.playerCards.innerHTML = "";
        els.bankerCards.innerHTML = "";
        renderTotals(false, false);
      }

      function setStatus(text, show = true) {
        els.statusPill.textContent = text;
        els.statusPill.hidden = !show;
      }

      function setControlsDisabled(disabled) {
        els.betButtons.forEach((b) => (b.disabled = disabled));
        els.chipButtons.forEach((b) => (b.disabled = disabled));
        els.clearBtn.disabled = disabled;
        if (disabled) {
          els.dealBtn.disabled = true;
        } else {
          renderStakes();
        }
      }

      function totalStake() {
        return state.bets.player + state.bets.tie + state.bets.banker;
      }

      async function bankerDrawsThird(playerThirdCard) {
        const bTotal = handTotal(state.bankerHand);
        if (!playerThirdCard) return bTotal <= 5;
        const p3 = cardValue(playerThirdCard);
        if (bTotal <= 2) return true;
        if (bTotal === 3) return p3 !== 8;
        if (bTotal === 4) return p3 >= 2 && p3 <= 7;
        if (bTotal === 5) return p3 >= 4 && p3 <= 7;
        if (bTotal === 6) return p3 >= 6 && p3 <= 7;
        return false;
      }

      function settle() {
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
          if (state.bets.banker > 0) {
            lines.push(`-${state.bets.banker} on Banker`);
          }
          if (state.bets.tie > 0) {
            lines.push(`-${state.bets.tie} on Tie`);
          }
        } else if (outcome === "banker") {
          const won = Math.floor(state.bets.banker * 0.95);
          net += state.bets.banker + won;
          if (state.bets.banker > 0) lines.push(`+${state.bets.banker + won} on Banker`);
          if (state.bets.player > 0) {
            lines.push(`-${state.bets.player} on Player`);
          }
          if (state.bets.tie > 0) {
            lines.push(`-${state.bets.tie} on Tie`);
          }
        } else {
          if (state.bets.tie > 0) {
            net += state.bets.tie * 9;
            lines.push(`+${state.bets.tie * 9} on Tie`);
          }
        }

        state.balance += net;
        renderBalance();

        const labelMap = {
          player: "Player wins",
          banker: "Banker wins",
          tie: "Tie",
        };
        els.resultText.textContent = `${labelMap[outcome]} • ${p} vs ${b}`;
        els.resultText.classList.remove("win", "lose", "tie");
        if (net > 0) els.resultText.classList.add("win");
        else if (net < 0) els.resultText.classList.add("lose");
        else els.resultText.classList.add("tie");

        if (lines.length === 0) {
          els.resultSub.textContent = "No active bets on the outcome.";
        } else {
          const sign = net >= 0 ? "+" : "";
          els.resultSub.textContent = `${lines.join(" • ")} — net ${sign}${net} Dragon Gold`;
        }
      }

      async function playRound() {
        if (state.inRound) return;
        const stake = totalStake();
        if (stake <= 0) return;
        if (stake > state.balance) {
          els.resultText.textContent = "Not enough Dragon Gold";
          els.resultText.classList.remove("win", "tie");
          els.resultText.classList.add("lose");
          els.resultSub.textContent = `You bet ${stake} but only have ${state.balance}.`;
          return;
        }

        state.inRound = true;
        state.balance -= stake;
        renderBalance();
        setControlsDisabled(true);
        clearTable();
        els.resultText.textContent = "Dealing";
        els.resultText.classList.remove("win", "lose", "tie");
        els.resultSub.textContent = "";
        setStatus("Dealing", true);

        state.playerHand = [];
        state.bankerHand = [];

        const dealtCards = [];

        const p1 = drawCard();
        state.playerHand.push(p1);
        const p1El = await dealCardTo(els.playerCards, p1);
        dealtCards.push(p1El);
        await sleep(DEAL_GAP_MS);

        const b1 = drawCard();
        state.bankerHand.push(b1);
        const b1El = await dealCardTo(els.bankerCards, b1);
        dealtCards.push(b1El);
        await sleep(DEAL_GAP_MS);

        const p2 = drawCard();
        state.playerHand.push(p2);
        const p2El = await dealCardTo(els.playerCards, p2);
        dealtCards.push(p2El);
        await sleep(DEAL_GAP_MS);

        const b2 = drawCard();
        state.bankerHand.push(b2);
        const b2El = await dealCardTo(els.bankerCards, b2);
        dealtCards.push(b2El);
        await sleep(DEAL_GAP_MS);

        setStatus("Revealing Player", true);
        await revealCard(p1El);
        await sleep(180);
        await revealCard(p2El);
        renderTotals(false, true);
        await sleep(400);

        setStatus("Revealing Banker", true);
        await revealCard(b1El);
        await sleep(180);
        await revealCard(b2El);
        renderTotals(true, true);

        const pTotal = handTotal(state.playerHand);
        const bTotal = handTotal(state.bankerHand);

        let playerThird = null;

        if (pTotal >= 8 || bTotal >= 8) {
          setStatus("Natural", true);
          await sleep(600);
        } else {
          if (pTotal <= 5) {
            setStatus("Player draws", true);
            await sleep(PAUSE_BEFORE_THIRD_MS);
            playerThird = drawCard();
            state.playerHand.push(playerThird);
            const p3El = await dealCardTo(els.playerCards, playerThird);
            await sleep(220);
            await revealCard(p3El);
            renderTotals(true, true);
            await sleep(400);
          }

          if (await bankerDrawsThird(playerThird)) {
            setStatus("Banker draws", true);
            await sleep(PAUSE_BEFORE_THIRD_MS);
            const b3 = drawCard();
            state.bankerHand.push(b3);
            const b3El = await dealCardTo(els.bankerCards, b3);
            await sleep(220);
            await revealCard(b3El);
            renderTotals(true, true);
            await sleep(400);
          }
        }

        setStatus("", false);
        await sleep(PAUSE_BEFORE_RESULT_MS);
        settle();
        submitScore();

        state.bets = { player: 0, tie: 0, banker: 0 };
        document.querySelectorAll(".bet-btn.selected").forEach((b) =>
          b.classList.remove("selected")
        );
        state.inRound = false;
        setControlsDisabled(false);
        renderStakes();
      }

      function placeBet(side) {
        if (state.inRound) return;
        const chip = state.chip;
        const remaining = state.balance - totalStake();
        if (chip > remaining) {
          els.resultSub.textContent = `Not enough Dragon Gold for that chip.`;
          return;
        }
        state.bets[side] += chip;
        document
          .querySelector(`.bet-btn[data-bet="${side}"]`)
          .classList.add("selected");
        renderStakes();
        els.resultText.textContent = "Bet placed";
        els.resultText.classList.remove("win", "lose", "tie");
        els.resultSub.textContent = `Total wager ${totalStake()} • chip ${chip}`;
      }

      function clearBets() {
        if (state.inRound) return;
        state.bets = { player: 0, tie: 0, banker: 0 };
        document.querySelectorAll(".bet-btn.selected").forEach((b) =>
          b.classList.remove("selected")
        );
        renderStakes();
        els.resultText.textContent = "Place your bet";
        els.resultText.classList.remove("win", "lose", "tie");
        els.resultSub.textContent =
          "Choose a side and a chip, then deal the cards.";
      }

      function selectChip(value) {
        state.chip = value;
        els.chipButtons.forEach((b) => {
          b.classList.toggle(
            "selected",
            parseInt(b.dataset.chip, 10) === value
          );
        });
      }

      const leaderboardEl = document.getElementById("leaderboard");
      const leaderboardBodyEl = document.getElementById("leaderboard-body");
      const yourRankEl = document.getElementById("your-rank");
      const playerNameEl = document.getElementById("player-name");
      const BACKEND_API = "https://golfmat.ch:3000";

      function renderLeaderboard(topTen, myRank, submittedName) {
        leaderboardEl.hidden = false;
        yourRankEl.textContent = myRank ? `Your rank: #${myRank}` : "";
        const rows = topTen.map((entry, i) => {
          const isYou = entry.name === submittedName && (i + 1) === myRank;
          return `<tr class="${isYou ? "highlight" : ""}">
            <td>#${i + 1}</td>
            <td>${entry.name}</td>
            <td>${entry.score}</td>
          </tr>`;
        }).join("");
        leaderboardBodyEl.innerHTML = `
          <table class="leaderboard-table">
            <thead><tr><th>#</th><th>Name</th><th>Score</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      }

      async function submitScore() {
        const name = playerNameEl.value.trim();
        if (!name) return;
        leaderboardEl.hidden = false;
        leaderboardBodyEl.innerHTML = '<span class="leaderboard-loading">Submitting…</span>';
        yourRankEl.textContent = "";

        const API = `${BACKEND_API}/highscore`;
        const body = new URLSearchParams({ name, score: state.balance }).toString();

        // POST the score. The server records it even if CORS blocks the response.
        let postData = null;
        try {
          const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          postData = await res.json();
        } catch {
          // CORS blocked reading the POST response — score was still recorded.
          // Fall through and try a GET for the leaderboard.
        }

        if (postData) {
          renderLeaderboard(postData.topTen, postData.rank, name);
          return;
        }

        // Try fetching the leaderboard via GET (some servers allow GET with CORS even when POST responses are blocked).
        try {
          const res = await fetch(API, { method: "GET" });
          const data = await res.json();
          // GET returns leaderboard without personal rank
          renderLeaderboard(data.topTen ?? data, null, name);
        } catch {
          leaderboardBodyEl.innerHTML =
            '<span class="leaderboard-loading">Score submitted! Leaderboard blocked by browser CORS policy — ask the server to add Access-Control-Allow-Origin.</span>';
        }
      }

      function init() {
        state.shoe = buildShoe();
        renderBalance();
        renderStakes();
        selectChip(state.chip);

        const saved = localStorage.getItem("baccarat-name");
        if (saved) playerNameEl.value = saved;
        playerNameEl.addEventListener("change", () => {
          localStorage.setItem("baccarat-name", playerNameEl.value.trim());
        });

        els.betButtons.forEach((b) => {
          b.addEventListener("click", () => placeBet(b.dataset.bet));
        });
        els.chipButtons.forEach((b) => {
          b.addEventListener("click", () =>
            selectChip(parseInt(b.dataset.chip, 10))
          );
        });
        els.dealBtn.addEventListener("click", playRound);
        els.clearBtn.addEventListener("click", clearBets);
        els.rulesToggle.addEventListener("click", () => {
          els.rulesPanel.hidden = !els.rulesPanel.hidden;
        });
      }

      init();
