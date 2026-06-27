      "use strict";

      const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const WHEEL_SEQUENCE = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
      const STARTING_BALANCE = 1000;
      const STORAGE_KEY = "sinobros-roulette-state";
      const POCKET_COUNT = WHEEL_SEQUENCE.length;
      const POCKET_ANGLE = 360 / POCKET_COUNT;
      const WHEEL_SPIN_DURATION = 3900;
      const BALL_SPIN_DURATION = 5200;
      const OUTSIDE_BETS = [
        { id: "red", label: "Red", className: "red-bet", payout: 1, test: (n) => RED_NUMBERS.has(n) },
        { id: "black", label: "Black", className: "black-bet", payout: 1, test: (n) => n !== 0 && !RED_NUMBERS.has(n) },
        { id: "odd", label: "Odd", payout: 1, test: (n) => n !== 0 && n % 2 === 1 },
        { id: "even", label: "Even", payout: 1, test: (n) => n !== 0 && n % 2 === 0 },
        { id: "low", label: "1–18", payout: 1, test: (n) => n >= 1 && n <= 18 },
        { id: "high", label: "19–36", payout: 1, test: (n) => n >= 19 && n <= 36 },
        { id: "dozen-1", label: "1st 12", payout: 2, test: (n) => n >= 1 && n <= 12 },
        { id: "dozen-2", label: "2nd 12", payout: 2, test: (n) => n >= 13 && n <= 24 },
        { id: "dozen-3", label: "3rd 12", payout: 2, test: (n) => n >= 25 && n <= 36 },
        { id: "column-1", label: "Column 1", payout: 2, test: (n) => n > 0 && n % 3 === 1 },
        { id: "column-2", label: "Column 2", payout: 2, test: (n) => n > 0 && n % 3 === 2 },
        { id: "column-3", label: "Column 3", payout: 2, test: (n) => n > 0 && n % 3 === 0 },
      ];

      const state = {
        balance: STARTING_BALANCE,
        chip: 25,
        bets: [],
        history: [],
        stats: { spins: 0, wagered: 0, won: 0, net: 0 },
        spinning: false,
        rotation: 0,
        ballAngle: 0,
      };

      const els = {
        balance: document.getElementById("balance"),
        numberGrid: document.getElementById("number-grid"),
        zeroRow: document.getElementById("zero-row"),
        outsideGrid: document.getElementById("outside-grid"),
        chipButtons: document.querySelectorAll(".chip"),
        spinBtn: document.getElementById("spin-btn"),
        clearBtn: document.getElementById("clear-btn"),
        undoBtn: document.getElementById("undo-btn"),
        wheel: document.getElementById("wheel"),
        ball: document.getElementById("ball"),
        winningNumber: document.getElementById("winning-number"),
        resultText: document.getElementById("result-text"),
        resultSub: document.getElementById("result-sub"),
        betSlip: document.getElementById("bet-slip"),
        historyList: document.getElementById("history-list"),
        spinsStat: document.getElementById("spins-stat"),
        netStat: document.getElementById("net-stat"),
        wageredStat: document.getElementById("wagered-stat"),
        wonStat: document.getElementById("won-stat"),
      };

      const ballTransform = (angle, radiusVar) => `rotate(${angle}deg) translateY(calc(var(${radiusVar}) * -1))`;

      function nextEquivalentAngle(targetAngle, fromAngle, minTravel) {
        const laps = Math.ceil((fromAngle + minTravel - targetAngle) / 360);
        return targetAngle + Math.max(0, laps) * 360;
      }

      function pocketCenterAngle(wheelRotation, wheelPosition) {
        return wheelRotation + (wheelPosition + 0.5) * POCKET_ANGLE;
      }

      function settleBallInPocket(startAngle, finalAngle) {
        const travel = finalAngle - startAngle;
        const keyframes = [
          { transform: ballTransform(startAngle, "--ball-track-radius"), offset: 0 },
          { transform: ballTransform(startAngle + travel * 0.34, "--ball-track-radius"), offset: 0.34 },
          { transform: ballTransform(startAngle + travel * 0.62, "--ball-track-radius"), offset: 0.62 },
          { transform: ballTransform(startAngle + travel * 0.78, "--ball-track-radius"), offset: 0.78 },
          { transform: ballTransform(finalAngle - POCKET_ANGLE * 1.1, "--ball-track-radius"), offset: 0.86 },
          { transform: ballTransform(finalAngle + POCKET_ANGLE * 0.42, "--ball-pocket-radius"), offset: 0.91 },
          { transform: ballTransform(finalAngle - POCKET_ANGLE * 0.18, "--ball-track-radius"), offset: 0.95 },
          { transform: ballTransform(finalAngle + POCKET_ANGLE * 0.08, "--ball-pocket-radius"), offset: 0.98 },
          { transform: ballTransform(finalAngle, "--ball-pocket-radius"), offset: 1 },
        ];
        els.ball.getAnimations().forEach((animation) => animation.cancel());
        const animation = els.ball.animate(keyframes, {
          duration: BALL_SPIN_DURATION,
          easing: "cubic-bezier(0.12, 0.72, 0.16, 1)",
          fill: "forwards",
        });
        return animation.finished.catch(() => undefined);
      }

      function numberColor(number) {
        if (number === 0) return "green";
        return RED_NUMBERS.has(number) ? "red" : "black";
      }

      function setWinningNumberDisplay(number) {
        const color = numberColor(number);
        els.winningNumber.textContent = number;
        els.winningNumber.classList.remove("red", "black", "green");
        els.winningNumber.classList.add(color);
      }

      function resetWinningNumberDisplay(label = "?") {
        els.winningNumber.textContent = label;
        els.winningNumber.classList.remove("red", "black", "green");
      }

      function betKey(bet) {
        return `${bet.kind}:${bet.target}`;
      }

      function betLabel(bet) {
        if (bet.kind === "straight") return `Number ${bet.target}`;
        return OUTSIDE_BETS.find((b) => b.id === bet.target)?.label ?? bet.target;
      }

      function totalBet() {
        return state.bets.reduce((sum, bet) => sum + bet.amount, 0);
      }

      function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          balance: state.balance,
          history: state.history,
          stats: state.stats,
        }));
      }

      function loadState() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (!saved) return;
          if (Number.isFinite(saved.balance)) state.balance = saved.balance;
          if (Array.isArray(saved.history)) state.history = saved.history.slice(0, 18);
          if (saved.stats) state.stats = { ...state.stats, ...saved.stats };
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      function buildGrid() {
        const zero = makeBetButton({ kind: "straight", target: 0 }, "0", "green");
        els.zeroRow.appendChild(zero);
        for (let n = 1; n <= 36; n += 1) {
          els.numberGrid.appendChild(makeBetButton({ kind: "straight", target: n }, String(n), numberColor(n)));
        }
        OUTSIDE_BETS.forEach((bet) => {
          const button = makeBetButton({ kind: "outside", target: bet.id }, bet.label, bet.className || "");
          button.classList.add("outside-bet");
          button.classList.remove("bet-cell");
          els.outsideGrid.appendChild(button);
        });
      }

      function buildWheelNumbers() {
        const wheelEl = els.wheel;
        wheelEl.querySelectorAll('.wheel-number-slot, .wheel-number-item').forEach(el => el.remove());
        const angleStep = POCKET_ANGLE;
        WHEEL_SEQUENCE.forEach((num, i) => {
          const slot = document.createElement('div');
          slot.className = 'wheel-number-slot';
          const el = document.createElement('div');
          el.className = 'wheel-number-item';
          el.textContent = num;
          const angle = (i + 0.5) * angleStep;
          // Match the conic-gradient sector centers: 0deg is the top of the wheel.
          // The parent rotates each label with its pocket; the child is centered on that radial line.
          slot.style.transform = `rotate(${angle}deg)`;
          slot.appendChild(el);
          wheelEl.appendChild(slot);
        });
      }

      function makeBetButton(bet, label, colorClass) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `bet-cell ${colorClass}`.trim();
        button.dataset.bet = betKey(bet);
        button.textContent = label;
        button.addEventListener("click", () => placeBet(bet));
        return button;
      }

      function placeBet(bet) {
        if (state.spinning) return;
        const remaining = state.balance - totalBet();
        if (state.chip > remaining) {
          els.resultText.textContent = "Not enough Dragon Gold";
          els.resultSub.textContent = `You have ${remaining} Dragon Gold available for new bets.`;
          return;
        }
        const key = betKey(bet);
        const existing = state.bets.find((b) => betKey(b) === key);
        if (existing) existing.amount += state.chip;
        else state.bets.push({ ...bet, amount: state.chip });
        els.resultText.textContent = "Bet placed";
        els.resultSub.textContent = `${betLabel(bet)} covered for ${state.chip}. Total wager ${totalBet()}.`;
        render();
      }

      function clearBets() {
        if (state.spinning) return;
        state.bets = [];
        els.resultText.textContent = "Place your bets";
        els.resultSub.textContent = "Pick a chip, cover the grid, then spin the wheel.";
        render();
      }

      function undoBet() {
        if (state.spinning || state.bets.length === 0) return;
        const last = state.bets[state.bets.length - 1];
        last.amount -= state.chip;
        if (last.amount <= 0) state.bets.pop();
        render();
      }

      function selectChip(value) {
        state.chip = value;
        els.chipButtons.forEach((button) => {
          button.classList.toggle("selected", Number(button.dataset.chip) === value);
        });
      }

      function evaluateBet(bet, winningNumber) {
        if (bet.kind === "straight") return bet.target === winningNumber ? 35 : -1;
        const outside = OUTSIDE_BETS.find((b) => b.id === bet.target);
        return outside?.test(winningNumber) ? outside.payout : -1;
      }

      async function spin() {
        if (state.spinning || state.bets.length === 0) return;
        const wager = totalBet();
        if (wager > state.balance) {
          els.resultText.textContent = "Not enough Dragon Gold";
          els.resultSub.textContent = `You bet ${wager} but only have ${state.balance}.`;
          return;
        }

        state.spinning = true;
        state.balance -= wager;
        clearWinHighlights();
        setControlsDisabled(true);
        resetWinningNumberDisplay("…");
        els.resultText.textContent = "No more bets";
        els.resultSub.textContent = "The wheel is moving.";
        render();

        const winningNumber = Math.floor(Math.random() * 37);
        const wheelPos = WHEEL_SEQUENCE.indexOf(winningNumber);
        const wheelTravel = 1440 + Math.floor(Math.random() * 360);
        state.rotation += wheelTravel;
        const finalPocketAngle = pocketCenterAngle(state.rotation, wheelPos);
        const startBallAngle = state.ballAngle;
        const minBallTravel = wheelTravel + 540 + Math.floor(Math.random() * 220);
        const finalBallAngle = nextEquivalentAngle(finalPocketAngle, startBallAngle, minBallTravel);
        state.ballAngle = finalBallAngle;

        els.wheel.style.transition = `transform ${WHEEL_SPIN_DURATION}ms cubic-bezier(0.15, 0.8, 0.18, 1)`;
        els.wheel.style.transform = `rotate(${state.rotation}deg)`;
        els.ball.style.transform = ballTransform(startBallAngle, "--ball-track-radius");
        await settleBallInPocket(startBallAngle, finalBallAngle);
        els.ball.style.transform = ballTransform(finalBallAngle, "--ball-pocket-radius");
        els.ball.getAnimations().forEach((animation) => animation.cancel());

        let grossWin = 0;
        const winningLines = [];
        state.bets.forEach((bet) => {
          const multiplier = evaluateBet(bet, winningNumber);
          if (multiplier >= 0) {
            const returned = bet.amount * (multiplier + 1);
            grossWin += returned;
            winningLines.push(`${betLabel(bet)} +${bet.amount * multiplier}`);
          }
        });

        const net = grossWin - wager;
        state.balance += grossWin;
        state.stats.spins += 1;
        state.stats.wagered += wager;
        state.stats.won += grossWin;
        state.stats.net += net;
        state.history.unshift({ number: winningNumber, color: numberColor(winningNumber), net });
        state.history = state.history.slice(0, 18);

        setWinningNumberDisplay(winningNumber);
        els.resultText.textContent = `${winningNumber} ${numberColor(winningNumber).toUpperCase()} • ${net >= 0 ? "+" : ""}${net}`;
        els.resultSub.textContent = winningLines.length
          ? `${winningLines.join(" • ")} — ${grossWin} returned`
          : `No winning lines. ${wager} Dragon Gold wagered.`;
        highlightWinningBets(winningNumber);

        state.bets = [];
        state.spinning = false;
        setControlsDisabled(false);
        saveState();
        render();
      }

      function setControlsDisabled(disabled) {
        document.querySelectorAll(".bet-cell, .outside-bet").forEach((button) => (button.disabled = disabled));
        els.chipButtons.forEach((button) => (button.disabled = disabled));
        els.clearBtn.disabled = disabled;
        els.undoBtn.disabled = disabled;
        els.spinBtn.disabled = disabled || state.bets.length === 0;
      }

      function clearWinHighlights() {
        document.querySelectorAll(".win").forEach((el) => el.classList.remove("win"));
      }

      function highlightWinningBets(winningNumber) {
        document.querySelectorAll(".bet-cell, .outside-bet").forEach((button) => {
          const [kind, rawTarget] = button.dataset.bet.split(":");
          const bet = { kind, target: kind === "straight" ? Number(rawTarget) : rawTarget };
          if (evaluateBet(bet, winningNumber) >= 0) button.classList.add("win");
        });
      }

      function render() {
        els.balance.textContent = state.balance;
        els.spinBtn.disabled = state.spinning || state.bets.length === 0;
        els.undoBtn.disabled = state.spinning || state.bets.length === 0;
        els.clearBtn.disabled = state.spinning || state.bets.length === 0;

        document.querySelectorAll(".bet-cell, .outside-bet").forEach((button) => {
          const bet = state.bets.find((b) => betKey(b) === button.dataset.bet);
          button.classList.toggle("selected", Boolean(bet));
          let dot = button.querySelector(".stake-dot");
          if (bet && !dot) {
            dot = document.createElement("span");
            dot.className = "stake-dot";
            button.appendChild(dot);
          }
          if (dot) {
            if (bet) dot.textContent = bet.amount;
            else dot.remove();
          }
        });

        els.betSlip.innerHTML = state.bets.length
          ? state.bets.map((bet) => `<div class="bet-slip-row"><span>${betLabel(bet)}</span><strong>${bet.amount}</strong></div>`).join("")
          : '<div class="result-sub">No active bets.</div>';

        els.historyList.innerHTML = state.history.length
          ? state.history.map((spin) => `<span class="history-chip ${spin.color}" title="Net ${spin.net}">${spin.number}</span>`).join("")
          : '<div class="result-sub">Spin history will appear here.</div>';

        els.spinsStat.textContent = state.stats.spins;
        els.netStat.textContent = `${state.stats.net >= 0 ? "+" : ""}${state.stats.net}`;
        els.wageredStat.textContent = state.stats.wagered;
        els.wonStat.textContent = state.stats.won;
      }

      function init() {
        loadState();
        buildGrid();
        buildWheelNumbers();
        selectChip(state.chip);
        els.chipButtons.forEach((button) => {
          button.addEventListener("click", () => selectChip(Number(button.dataset.chip)));
        });
        els.spinBtn.addEventListener("click", spin);
        els.clearBtn.addEventListener("click", clearBets);
        els.undoBtn.addEventListener("click", undoBet);
        render();
      }

      init();
