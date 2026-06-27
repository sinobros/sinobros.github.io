      // ==================== GAME STATE ====================
      let balance = 5000;
      let currentBet = 25;
      let isSpinning = false;
      let audioCtx = null;

      const balanceEl = document.getElementById('balance');
      const winDisplay = document.getElementById('win-display');
      const statusEl = document.getElementById('status');
      const winHistoryEl = document.getElementById('win-history');
      const reelsContainer = document.getElementById('reels-container');

      // Symbols definition
      const SYMBOLS = [
        { id: 'R7', emoji: '7️⃣', cls: 'red7', value: 500 },
        { id: 'G7', emoji: '⭐7', cls: 'gold7', value: 1000 },
        { id: 'B7', emoji: '🔵7', cls: 'blue7', value: 300 },
        { id: 'BAR', emoji: 'BAR', cls: 'bar', value: 200 },
        { id: 'CHERRY', emoji: '🍒', cls: 'cherry', value: 50 },
        { id: 'BELL', emoji: '🔔', cls: 'bell', value: 100 },
        { id: 'WILD', emoji: '⭐', cls: 'wild', value: 0 },
        { id: 'SCATTER', emoji: '🎡', cls: 'scatter', value: 0 }
      ];

      // Reel strips (longer for realistic spinning)
      const REEL_STRIPS = [
        // Reel 1
        ['R7','G7','B7','BAR','CHERRY','BELL','WILD','SCATTER','R7','G7','B7','BAR','CHERRY','BELL','WILD','SCATTER'],
        // Reel 2
        ['G7','B7','BAR','CHERRY','BELL','WILD','SCATTER','R7','G7','B7','BAR','CHERRY','BELL','WILD','SCATTER','R7'],
        // Reel 3
        ['B7','BAR','CHERRY','BELL','WILD','SCATTER','R7','G7','B7','BAR','CHERRY','BELL','WILD','SCATTER','R7','G7']
      ];

      let reelPositions = [0, 0, 0]; // current top index for each reel
      let reelElements = [];

      // Paylines (5 lines for 3x3 grid)
      const PAYLINES = [
        [0, 0, 0], // top row
        [1, 1, 1], // middle row
        [2, 2, 2], // bottom row
        [0, 1, 2], // diagonal \
        [2, 1, 0]  // diagonal /
      ];

      // ==================== AUDIO ENGINE (Web Audio API) ====================
      function initAudio() {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
      }

      function playSound(type, duration = 0.3) {
        if (!audioCtx) initAudio();
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        switch (type) {
          case 'spin':
            // Whoosh / spinning sound
            osc.type = 'sawtooth';
            osc.frequency.value = 80;
            filter.type = 'lowpass';
            filter.frequency.value = 600;
            gain.gain.value = 0.18;
            
            // Frequency sweep
            osc.frequency.linearRampToValueAtTime(220, now + duration);
            gain.gain.linearRampToValueAtTime(0.01, now + duration);
            break;

          case 'stop':
            // Clack / reel stop
            osc.type = 'square';
            osc.frequency.value = 180;
            filter.type = 'lowpass';
            filter.frequency.value = 1200;
            gain.gain.value = 0.25;
            gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
            break;

          case 'win':
            // Pleasant win chime
            osc.type = 'sine';
            osc.frequency.value = 660;
            gain.gain.value = 0.22;
            // Second note
            setTimeout(() => {
              if (audioCtx) {
                const osc2 = audioCtx.createOscillator();
                const g2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.value = 880;
                g2.gain.value = 0.18;
                osc2.connect(g2);
                g2.connect(audioCtx.destination);
                osc2.start(now);
                g2.gain.linearRampToValueAtTime(0.001, now + 0.6);
                osc2.stop(now + 0.7);
              }
            }, 180);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.65);
            break;

          case 'jackpot':
            // Big jackpot fanfare
            osc.type = 'sawtooth';
            osc.frequency.value = 440;
            gain.gain.value = 0.3;
            osc.frequency.linearRampToValueAtTime(880, now + 0.8);
            gain.gain.linearRampToValueAtTime(0.001, now + 1.4);
            break;

          case 'click':
            osc.type = 'square';
            osc.frequency.value = 1200;
            gain.gain.value = 0.08;
            gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
            break;

          case 'scatter':
            // Special scatter trigger sound
            osc.type = 'sine';
            osc.frequency.value = 550;
            gain.gain.value = 0.2;
            setTimeout(() => {
              if (audioCtx) {
                const o2 = audioCtx.createOscillator();
                const g2 = audioCtx.createGain();
                o2.frequency.value = 780;
                g2.gain.value = 0.15;
                o2.connect(g2); g2.connect(audioCtx.destination);
                o2.start(now + 0.15);
                g2.gain.linearRampToValueAtTime(0.001, now + 0.9);
                o2.stop(now + 1.0);
              }
            }, 120);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
            break;

          case 'wheel-spin':
            // Deep wheel spin whoosh
            osc.type = 'sawtooth';
            osc.frequency.value = 55;
            filter.type = 'lowpass';
            filter.frequency.value = 450;
            gain.gain.value = 0.25;
            osc.frequency.linearRampToValueAtTime(140, now + duration * 0.7);
            gain.gain.linearRampToValueAtTime(0.02, now + duration);
            break;

          case 'wheel-stop':
            // Wheel stopping clack + ding
            osc.type = 'square';
            osc.frequency.value = 220;
            gain.gain.value = 0.3;
            gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
            setTimeout(() => {
              if (audioCtx) {
                const ding = audioCtx.createOscillator();
                const dg = audioCtx.createGain();
                ding.type = 'sine';
                ding.frequency.value = 980;
                dg.gain.value = 0.2;
                ding.connect(dg);
                dg.connect(audioCtx.destination);
                ding.start(now + 0.2);
                dg.gain.linearRampToValueAtTime(0.001, now + 0.9);
                ding.stop(now + 1.0);
              }
            }, 200);
            break;
        }

        osc.start(now);
        osc.stop(now + duration + 0.1);
      }

      // ==================== REELS RENDERING ====================
      function createReel(reelIndex) {
        const reel = document.createElement('div');
        reel.className = 'reel';
        
        const strip = document.createElement('div');
        strip.className = 'reel-strip';
        
        const stripSymbols = REEL_STRIPS[reelIndex];
        
        // Duplicate for seamless spinning
        const fullStrip = [...stripSymbols, ...stripSymbols];
        
        fullStrip.forEach((symId, idx) => {
          const symbolData = SYMBOLS.find(s => s.id === symId);
          const symEl = document.createElement('div');
          symEl.className = `symbol ${symbolData.cls}`;
          symEl.innerHTML = symbolData.emoji;
          symEl.dataset.symbol = symId;
          strip.appendChild(symEl);
        });
        
        reel.appendChild(strip);
        reelElements[reelIndex] = { reel, strip, symbols: strip.children };
        
        return reel;
      }

      function renderReels() {
        reelsContainer.innerHTML = '';
        reelElements = [];
        
        for (let i = 0; i < 3; i++) {
          const reelEl = createReel(i);
          reelsContainer.appendChild(reelEl);
        }
        
        // Initial position
        updateReelVisuals();
      }

      function updateReelVisuals() {
        reelElements.forEach((reelObj, idx) => {
          const symbolHeight = 118;
          const offset = reelPositions[idx] * symbolHeight;
          reelObj.strip.style.transition = 'none';
          reelObj.strip.style.transform = `translateY(-${offset}px)`;
        });
      }

      // ==================== SPIN LOGIC ====================
      function getRandomSymbolForReel(reelIndex, isGoldSpin = false) {
        const strip = REEL_STRIPS[reelIndex];
        let sym = strip[Math.floor(Math.random() * strip.length)];
        
        if (isGoldSpin) {
          // Bias towards high value symbols on Gold Spin
          const highValue = ['G7', 'R7', 'WILD', 'SCATTER'];
          if (Math.random() < 0.65) {
            sym = highValue[Math.floor(Math.random() * highValue.length)];
          }
        }
        return sym;
      }

      function spinReels(isGoldSpin = false) {
        if (isSpinning) return;
        isSpinning = true;

        const spinBtn = document.getElementById('spin-btn');
        const goldBtn = document.getElementById('gold-spin-btn');
        spinBtn.disabled = true;
        goldBtn.disabled = true;

        winDisplay.textContent = '';
        winDisplay.classList.remove('win');

        // Deduct bet - Fixed costs as requested
        const spinCost = isGoldSpin ? 50 : 25;
        if (balance < spinCost) {
          alert('Not enough Dragon Gold!');
          isSpinning = false;
          spinBtn.disabled = false;
          goldBtn.disabled = false;
          return;
        }
        
        balance -= spinCost;
        updateBalance();

        // Play spin sound
        playSound('spin', 1.1);

        // Animate each reel with different durations
        const reelDurations = [820, 980, 1140];
        const newPositions = [];
        const finalSymbols = [[], [], []];

        reelElements.forEach((reelObj, reelIdx) => {
          const symbolHeight = 118;
          const stripLength = REEL_STRIPS[reelIdx].length;
          
          // Generate final symbols
          for (let row = 0; row < 3; row++) {
            finalSymbols[reelIdx][row] = getRandomSymbolForReel(reelIdx, isGoldSpin);
          }
          
          // Find target position that matches the final symbols (top of visible window)
          let targetPos = reelPositions[reelIdx];
          // Search for matching sequence in the strip
          const targetSeq = finalSymbols[reelIdx].join(',');
          for (let p = 0; p < stripLength * 2; p++) {
            const seq = [
              REEL_STRIPS[reelIdx][p % stripLength],
              REEL_STRIPS[reelIdx][(p + 1) % stripLength],
              REEL_STRIPS[reelIdx][(p + 2) % stripLength]
            ].join(',');
            if (seq === targetSeq) {
              targetPos = p;
              break;
            }
          }
          
          newPositions[reelIdx] = targetPos;

          // Animate
          const distance = (targetPos - reelPositions[reelIdx] + stripLength * 3) * symbolHeight;
          const duration = reelDurations[reelIdx];
          
          reelObj.strip.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
          reelObj.strip.style.transform = `translateY(-${reelPositions[reelIdx] * symbolHeight + distance}px)`;

          // Stop sound per reel
          setTimeout(() => {
            playSound('stop', 0.2);
          }, duration - 80);
        });

        // After all reels stopped
        setTimeout(() => {
          // Update logical positions
          reelPositions = newPositions;
          
          // Reset strips to clean position (loop)
          reelElements.forEach((reelObj, idx) => {
            reelObj.strip.style.transition = 'none';
            const symbolHeight = 118;
            const modPos = reelPositions[idx] % REEL_STRIPS[idx].length;
            reelPositions[idx] = modPos;
            reelObj.strip.style.transform = `translateY(-${modPos * symbolHeight}px)`;
          });

          // Evaluate wins
          const winAmount = evaluateWins(isGoldSpin);
          
          if (winAmount > 0) {
            balance += winAmount;
            updateBalance();
            
            winDisplay.innerHTML = `+${winAmount} <span style="font-size:16px;opacity:0.7;">Dragon Gold</span>`;
            winDisplay.classList.add('win');
            
            playSound(winAmount > 800 ? 'jackpot' : 'win', 0.9);
            
            addToHistory(winAmount, isGoldSpin);
            
            // Confetti for big wins
            if (winAmount > 600) {
              launchConfetti(28);
            }
          } else {
            winDisplay.textContent = '';
          }

          // Check for scatter bonus
          const scatterCount = countScatters(finalSymbols);
          if (scatterCount >= 3) {
            setTimeout(() => {
              triggerWheelBonus(scatterCount);
            }, 650);
          }

          isSpinning = false;
          spinBtn.disabled = false;
          goldBtn.disabled = false;
          
        }, Math.max(...reelDurations) + 120);
      }

      function countScatters(symbolGrid) {
        let count = 0;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (symbolGrid[c][r] === 'SCATTER') count++;
          }
        }
        return count;
      }

      // ==================== WIN EVALUATION ====================
      function evaluateWins(isGoldSpin = false) {
        const multiplier = isGoldSpin ? 2 : 1;
        let totalWin = 0;
        const symbolGrid = [[], [], []]; // [reel][row]

        // Build symbol grid from current positions
        reelElements.forEach((reelObj, reelIdx) => {
          const children = Array.from(reelObj.symbols);
          const baseIdx = reelPositions[reelIdx] % REEL_STRIPS[reelIdx].length;
          
          for (let row = 0; row < 3; row++) {
            const symIdx = (baseIdx + row) % REEL_STRIPS[reelIdx].length;
            const symId = REEL_STRIPS[reelIdx][symIdx];
            symbolGrid[reelIdx][row] = symId;
          }
        });

        // Check each payline
        PAYLINES.forEach((line, lineIdx) => {
          const syms = [
            symbolGrid[0][line[0]],
            symbolGrid[1][line[1]],
            symbolGrid[2][line[2]]
          ];

          // Count matching with wild substitution
          let matchSymbol = null;
          let matchCount = 0;

          for (let s of syms) {
            if (s === 'SCATTER') continue;
            if (!matchSymbol) {
              matchSymbol = (s === 'WILD') ? null : s;
              matchCount = 1;
            } else if (s === matchSymbol || s === 'WILD') {
              matchCount++;
            } else if (matchSymbol === null && s !== 'WILD') {
              matchSymbol = s;
              matchCount = 2;
            } else {
              matchCount = 0;
              break;
            }
          }

          if (matchCount === 3 && matchSymbol) {
            const symData = SYMBOLS.find(x => x.id === matchSymbol);
            let payout = symData ? symData.value * currentBet * multiplier : 0;
            totalWin += payout;
          }
        });

        // Any 3 matching anywhere bonus (for fun)
        // Already covered by lines

        return Math.floor(totalWin);
      }

      // ==================== BALANCE & UI ====================
      function updateBalance() {
        balanceEl.textContent = balance.toLocaleString();
      }

      function updateBetButtons() {
        const container = document.getElementById('bet-buttons');
        container.innerHTML = '';
        
        const bets = [10, 25, 50, 100, 250];
        
        bets.forEach(bet => {
          const btn = document.createElement('button');
          btn.className = `bet-btn ${bet === currentBet ? 'active' : ''}`;
          btn.textContent = bet;
          btn.onclick = () => {
            if (isSpinning) return;
            currentBet = bet;
            updateBetButtons();
            playSound('click', 0.05);
          };
          container.appendChild(btn);
        });
      }

      function addToHistory(amount, isGold = false) {
        const entry = document.createElement('div');
        entry.style.marginBottom = '6px';
        entry.innerHTML = `
          <span style="color:#ffe600;">+${amount}</span> 
          <span style="color:#666;font-size:12px;">${isGold ? 'GOLD SPIN' : 'SPIN'}</span>
        `;
        winHistoryEl.prepend(entry);
        
        // Keep only last 8
        while (winHistoryEl.children.length > 8) {
          winHistoryEl.removeChild(winHistoryEl.lastChild);
        }
      }

      // ==================== CONFETTI ====================
      function launchConfetti(count = 18) {
        const container = document.body;
        for (let i = 0; i < count; i++) {
          const piece = document.createElement('div');
          piece.className = 'confetti';
          piece.style.left = Math.random() * 100 + 'vw';
          piece.style.top = '-20px';
          piece.style.background = Math.random() > 0.5 ? '#ffe600' : '#ff9d00';
          piece.style.width = (6 + Math.random() * 8) + 'px';
          piece.style.height = piece.style.width;
          piece.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
          piece.style.opacity = 0.9 + Math.random() * 0.3;
          
          container.appendChild(piece);
          
          setTimeout(() => {
            if (piece.parentNode) piece.parentNode.removeChild(piece);
          }, 2400);
        }
      }

      // ==================== WHEEL OF FORTUNE BONUS ====================
      let wheelAngle = 0;
      let isWheelSpinning = false;

      const WHEEL_SEGMENTS = [
        { label: '10×', multiplier: 10, color: '#ffe600' },
        { label: '2×', multiplier: 2, color: '#ff9d00' },
        { label: '50×', multiplier: 50, color: '#e51e47' },
        { label: '5×', multiplier: 5, color: '#4da6ff' },
        { label: 'JACKPOT', multiplier: 150, color: '#ffe600', special: true },
        { label: '25×', multiplier: 25, color: '#ff9d00' },
        { label: '3×', multiplier: 3, color: '#00a86b' },
        { label: '100×', multiplier: 100, color: '#e51e47' }
      ];

      function drawWheel(ctx, angleOffset = 0) {
        const center = 190;
        const radius = 170;
        const segmentAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;

        ctx.save();
        ctx.clearRect(0, 0, 380, 380);
        ctx.translate(center, center);
        ctx.rotate(angleOffset);

        WHEEL_SEGMENTS.forEach((seg, i) => {
          const startAngle = i * segmentAngle;
          const endAngle = startAngle + segmentAngle;

          // Segment
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius, startAngle, endAngle);
          ctx.fillStyle = seg.color;
          ctx.fill();
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Text
          ctx.save();
          ctx.rotate(startAngle + segmentAngle / 2);
          ctx.fillStyle = '#000';
          ctx.font = seg.special ? 'bold 22px Poppins' : 'bold 20px Poppins';
          ctx.textAlign = 'right';
          ctx.fillText(seg.label, radius - 22, 8);
          ctx.restore();
        });

        // Center hub
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe600';
        ctx.fill();

        ctx.restore();
      }

      function spinWheel() {
        if (isWheelSpinning) return;
        isWheelSpinning = true;

        const canvas = document.getElementById('fortune-wheel');
        const ctx = canvas.getContext('2d');
        const spinBtn = document.getElementById('spin-wheel-btn');
        spinBtn.disabled = true;

        // Play wheel spin sound
        playSound('wheel-spin', 2.8);

        const totalSpins = 5 + Math.random() * 4; // 5-9 full rotations
        const targetSegment = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
        const segmentAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;
        
        const targetAngle = (Math.PI * 2) * totalSpins - (targetSegment * segmentAngle) - (segmentAngle * 0.5);
        
        const startTime = Date.now();
        const duration = 3200; // ms
        const startAngle = wheelAngle;

        function animate() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          
          wheelAngle = startAngle + (targetAngle - startAngle) * eased;
          
          drawWheel(ctx, wheelAngle);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Finished
            isWheelSpinning = false;
            spinBtn.disabled = false;

            playSound('wheel-stop', 0.6);

            // Calculate prize
            const normalizedAngle = ((wheelAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            const segIndex = Math.floor((normalizedAngle / (Math.PI * 2)) * WHEEL_SEGMENTS.length);
            const prize = WHEEL_SEGMENTS[(WHEEL_SEGMENTS.length - segIndex - 1 + WHEEL_SEGMENTS.length) % WHEEL_SEGMENTS.length];

            let winAmount;
            if (prize.special) {
              // Gold spin bonus jackpot - fixed massive prize
              winAmount = 100000;
            } else {
              winAmount = Math.floor(prize.multiplier * currentBet * 3); // Bonus multiplier
            }
            
            balance += winAmount;
            updateBalance();

            const resultEl = document.getElementById('bonus-result');
            resultEl.innerHTML = `
              <div style="font-size:42px;color:#ffe600;margin-bottom:4px;">${prize.label}</div>
              <div style="font-size:22px;">+${winAmount} Dragon Gold</div>
            `;

            if (prize.special || prize.multiplier >= 50) {
              launchConfetti(42);
              playSound('jackpot', 1.2);
            } else {
              playSound('win', 0.8);
            }

            addToHistory(winAmount, true);
          }
        }

        animate();
      }

      function triggerWheelBonus(scatterCount = 3) {
        const modal = document.getElementById('bonus-modal');
        const resultEl = document.getElementById('bonus-result');
        const spinWheelBtn = document.getElementById('spin-wheel-btn');
        
        resultEl.innerHTML = `<div style="font-size:20px;color:#aaa;">${scatterCount} SCATTERS — SPIN FOR BIG WINS!</div>`;
        
        modal.classList.add('active');
        
        // Draw initial wheel
        const canvas = document.getElementById('fortune-wheel');
        const ctx = canvas.getContext('2d');
        drawWheel(ctx, wheelAngle);

        // Reset state
        isWheelSpinning = false;
        spinWheelBtn.disabled = false;
        spinWheelBtn.onclick = () => spinWheel();

        // Play scatter trigger sound
        playSound('scatter', 0.7);
      }

      function closeBonusModal() {
        const modal = document.getElementById('bonus-modal');
        modal.classList.remove('active');
        document.getElementById('bonus-result').innerHTML = '';
      }

      // ==================== INITIALIZATION ====================
      function initGame() {
        renderReels();
        updateBalance();
        updateBetButtons();

        // Spin buttons
        document.getElementById('spin-btn').onclick = () => spinReels(false);
        document.getElementById('gold-spin-btn').onclick = () => spinReels(true);

        // Bonus modal close
        document.getElementById('close-bonus-btn').onclick = closeBonusModal;

        // Keyboard support
        document.addEventListener('keydown', (e) => {
          if (e.key === ' ' && !isSpinning) {
            e.preventDefault();
            spinReels(false);
          }
          if (e.key.toLowerCase() === 'g' && !isSpinning) {
            e.preventDefault();
            spinReels(true);
          }
        });

        // Click anywhere on reels to spin (quality of life)
        reelsContainer.onclick = () => {
          if (!isSpinning) spinReels(false);
        };

        // Initial status message
        statusEl.textContent = 'Press SPIN or GOLD SPIN • Spacebar = Normal Spin';

        // Seed a couple of example history entries
        setTimeout(() => {
          if (winHistoryEl.children.length === 0) {
            const demo = document.createElement('div');
            demo.style.color = '#555';
            demo.style.fontSize = '13px';
            demo.innerHTML = 'Demo mode active — wins are simulated';
            winHistoryEl.appendChild(demo);
          }
        }, 1200);

        // Easter egg: click balance to add 1000
        balanceEl.onclick = () => {
          balance += 1000;
          updateBalance();
          launchConfetti(8);
        };

        console.log('%c[Wheel of Fortune] Game initialized with sounds & animations', 'color:#666');
      }

      // Boot the game
      initGame();
