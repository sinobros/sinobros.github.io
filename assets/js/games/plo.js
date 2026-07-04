      "use strict";
      const DEFAULT_API = "https://golfmat.ch:3000";
      const POLL_MS = 1500;
      const TIMER_TICK_MS = 1000;
      const state = { 
        api: localStorage.getItem("sinobrosPloApiUrl") || DEFAULT_API, 
        handle: localStorage.getItem("sinobrosPloHandle") || "Sunset", 
        matchId: localStorage.getItem("sinobrosPloMatchId") || "", 
        playerId: localStorage.getItem("sinobrosPloPlayerId") || "", 
        snapshot: null, 
        poller: null,
        blindTimer: null,
        blindTimerReceivedAt: 0,
        timerTicker: null,
        lastActionPromptKey: ""
      };
      const $ = (id) => document.getElementById(id);
      const els = { 
        apiUrl: $("api-url"), handle: $("handle"), apiStatus: $("api-status"), 
        matchId: $("match-id"), create: $("create-match"), join: $("join-match"), 
        offline: $("offline-note"),
        heroName: $("hero-name"), heroStack: $("hero-stack"), heroCards: $("hero-cards"),
        villainName: $("villain-name"), villainStack: $("villain-stack"), villainCards: $("villain-cards"),
        communityCards: $("community-cards"), potAmount: $("pot-amount"),
        currentStreet: $("current-street"), turnMessage: $("turn-message"), gameLog: $("game-log"),
        foldBtn: $("fold-btn"), callBtn: $("call-btn"), raiseInput: $("raise-amount"), raiseBtn: $("raise-btn"), allInBtn: $("all-in-btn"), nextHandBtn: $("next-hand-btn"),
        blinds: $("blinds"), blindTimer: $("blind-timer"), blindLevel: $("blind-level"), nextBlinds: $("next-blinds"), handNumber: $("hand-number")
      };

      function saveBasics() { 
        localStorage.setItem("sinobrosPloApiUrl", state.api); 
        localStorage.setItem("sinobrosPloHandle", state.handle); 
        if (state.matchId) localStorage.setItem("sinobrosPloMatchId", state.matchId); 
        if (state.playerId) localStorage.setItem("sinobrosPloPlayerId", state.playerId); 
      }
      function syncApiFromInput() {
        state.api = els.apiUrl.value.trim() || DEFAULT_API;
        saveBasics();
      }
      function handleApiChange() {
        syncApiFromInput();
        checkHealth();
        startPolling();
      }
      function api(path) { return state.api.replace(/\/$/, "") + path; }
      function normalizeMatchCode(value) { return String(value || "").replace(/\D/g, "").slice(0, 4); }
      function isMatchCode(value) { return /^\d{4}$/.test(value); }
      async function request(path, options = {}) { 
        const res = await fetch(api(path), { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); 
        const data = await res.json().catch(() => ({})); 
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); 
        return data; 
      }
      function setStatus(ok, text) { 
        els.apiStatus.className = `status-chip ${ok ? "ok" : "bad"}`; 
        els.apiStatus.textContent = text; 
        els.offline.hidden = ok; 
      }
      async function checkHealth() { try { await request("/health"); setStatus(true, "backend online"); } catch { setStatus(false, "backend offline"); } }

	      // PLO card rendering (4-color)
	      const SUITS = { h:{symbol:'♥',cssClass:'four-color-hearts'}, d:{symbol:'♦',cssClass:'four-color-diamonds'}, c:{symbol:'♣',cssClass:'four-color-clubs'}, s:{symbol:'♠',cssClass:'four-color-spades'} };
	      function renderCard(card, faceUp=true) {
	        const div = document.createElement('div');
	        div.className = 'card';
	        if (window.createCardSVG) {
	          const rank = card ? card[0] : '2';
	          const suit = card ? card[1] : 's';
	          div.innerHTML = createCardSVG(rank, suit, faceUp);
	          return div.outerHTML;
	        }
	        if (!card || !faceUp) return '<div class="card">?</div>';
	        const rank = card[0].replace('T', '10');
	        const s = SUITS[card[1]] || SUITS.s;
	        return `<div class="card"><div class="rank">${rank}</div><div class="suit ${s.cssClass}">${s.symbol}</div></div>`;
	      }
      function renderCards(container, cards, hiddenCount=0) {
        container.innerHTML = '';
        if (cards && cards.length) {
          cards.forEach(c => container.innerHTML += renderCard(c, true));
        } else {
          for (let i=0; i<hiddenCount; i++) container.innerHTML += renderCard(null, false);
        }
      }

      function updatePot(anim=true) { 
        const el = els.potAmount; 
        const pd = $("pot-display"); 
        el.textContent = (state.snapshot?.hand?.pot || 0).toLocaleString(); 
        if (anim) { pd.style.transform='translate(-50%,-50%) scale(1.15)'; setTimeout(()=>pd.style.transform='translate(-50%,-50%) scale(1)',220); } 
      }
      function formatTimer(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return `${minutes}:${seconds}`;
      }
      function updateBlindTimer() {
        if (!els.blindTimer || !els.blindLevel || !els.nextBlinds) return;

        const timer = state.blindTimer;
        if (!timer || !timer.enabled) {
          els.blindTimer.textContent = "3:00";
          els.blindLevel.textContent = "1";
          els.nextBlinds.textContent = "20/40";
          els.blindTimer.closest(".blind-timer-box")?.classList.remove("is-urgent");
          return;
        }

        els.blindLevel.textContent = (timer.level + 1).toLocaleString();
        els.nextBlinds.textContent = timer.next ? `${timer.next.small}/${timer.next.big}` : "—";

        if (!timer.startedAt) {
          els.blindTimer.textContent = "Waiting";
          els.blindTimer.closest(".blind-timer-box")?.classList.remove("is-urgent");
          return;
        }

        const elapsedSincePoll = Date.now() - state.blindTimerReceivedAt;
        const remainingMs = Math.max(0, timer.remainingMs - elapsedSincePoll);
        els.blindTimer.textContent = formatTimer(remainingMs);
        els.blindTimer.closest(".blind-timer-box")?.classList.toggle("is-urgent", remainingMs <= 30000);
      }
      function updateBlinds() { 
        const activeHandBlinds = state.snapshot?.hand?.status === "active" ? state.snapshot.hand.blinds : null;
        const blinds = activeHandBlinds || state.snapshot?.blinds;
        if (blinds) {
          els.blinds.textContent = `${blinds.small}/${blinds.big}`;
        }
        state.blindTimer = state.snapshot?.blindTimer || null;
        state.blindTimerReceivedAt = Date.now();
        updateBlindTimer();
      }
      function log(msg, hl=false) { 
        const e = document.createElement('div'); 
        e.className='log-entry'; 
        e.innerHTML=hl?`<span class="highlight">${msg}</span>`:msg; 
        els.gameLog.appendChild(e); 
        els.gameLog.scrollTop=els.gameLog.scrollHeight; 
      }
      function updateStreet(s) { els.currentStreet.textContent = s ? s[0].toUpperCase()+s.slice(1) : '—'; }

      function render(snapshot) { 
        state.snapshot = snapshot; 
        const me = snapshot.players?.find(p => p.id === state.playerId) || snapshot.players?.[0]; 
        const opp = snapshot.players?.find(p => p.id !== state.playerId) || snapshot.players?.[1]; 
        
        els.heroName.textContent = me ? `${me.handle}${me.id === state.playerId ? " (you)" : ""}` : "You • Hero";
        els.heroStack.textContent = me ? me.stack.toLocaleString() : "—";
        els.villainName.textContent = opp ? opp.handle : "Waiting opponent";
        els.villainStack.textContent = opp ? opp.stack.toLocaleString() : "—";

        // Render 4 hole cards
        renderCards(els.heroCards, me?.holes || [], me && !me.holes ? 4 : 0);
        renderCards(els.villainCards, opp?.holes || [], opp ? 4 : 0);
        renderCards(els.communityCards, snapshot.hand?.community || []);

        updatePot(true);
        updateBlinds();
        els.handNumber.textContent = ((snapshot.handsPlayed || 0) + (snapshot.hand ? 1 : 0)).toLocaleString();
        if (snapshot.hand?.street) updateStreet(snapshot.hand.street);

        // Log events
        els.gameLog.innerHTML = '';
        (snapshot.events || []).slice().reverse().forEach(e => {
          const div = document.createElement('div');
          div.className = 'log-entry';
          div.innerHTML = `${new Date(e.t).toLocaleTimeString()} — ${e.msg}`;
          els.gameLog.appendChild(div);
        });

        // Update action buttons based on legal actions
        updateActionButtons(snapshot);
      }

      function updateActionButtons(snapshot) {
        const legalActions = snapshot.legalActions || [];
        const legal = new Set(legalActions.map(a => a.action));
        const callAction = legalActions.find(a => a.action === "call");
        const betAction = legalActions.find(a => a.action === "bet");
        const raiseAction = legalActions.find(a => a.action === "raise");
        const allInAction = legalActions.find(a => a.action === "all-in");
        const wagerAction = raiseAction || betAction;
        const canNextHand = snapshot.phase === "playing" && snapshot.hand && snapshot.hand.status !== "active";
        const actor = snapshot.players?.find(p => p.id === snapshot.hand?.actorId);

        if (snapshot.phase === "waiting") {
          els.turnMessage.textContent = `Waiting for opponent. Share match code ${snapshot.matchId}.`;
        } else if (snapshot.phase === "complete") {
          const winner = snapshot.players?.find(p => p.id === snapshot.winner);
          els.turnMessage.textContent = winner ? `${winner.handle} wins the match.` : "Match complete.";
        } else if (snapshot.hand?.status !== "active") {
          els.turnMessage.textContent = snapshot.hand?.result?.reason || "Hand complete.";
        } else if (snapshot.hand?.actorId === state.playerId) {
          els.turnMessage.textContent = "Your turn.";
        } else if (actor) {
          els.turnMessage.textContent = `${actor.handle}'s turn.`;
        } else {
          els.turnMessage.textContent = "Waiting for action.";
        }
        
        els.foldBtn.style.display = legal.has('fold') ? 'inline-block' : 'none';
        els.callBtn.style.display = (legal.has('call') || legal.has('check')) ? 'inline-block' : 'none';
        els.callBtn.textContent = callAction ? `CALL ${callAction.amount}` : "CHECK";
        els.raiseInput.style.display = wagerAction ? 'inline-block' : 'none';
        els.raiseBtn.style.display = wagerAction ? 'inline-block' : 'none';
        els.allInBtn.style.display = allInAction ? 'inline-block' : 'none';
        els.allInBtn.textContent = allInAction ? `ALL IN ${allInAction.amount}` : "ALL IN";
        els.nextHandBtn.style.display = canNextHand ? 'inline-block' : 'none';
        
        if (wagerAction) {
          els.raiseInput.min = wagerAction.min;
          els.raiseInput.max = wagerAction.max;
          els.raiseInput.value = wagerAction.max;
          els.raiseBtn.textContent = wagerAction.action === "bet" ? "BET POT" : "RAISE POT";
        }

        maybeRevealActions(snapshot, legalActions);
      }

      function maybeRevealActions(snapshot, legalActions) {
        const isHeroAction = snapshot.hand?.status === "active" &&
          snapshot.hand.actorId === state.playerId &&
          legalActions.length > 0;
        const promptKey = isHeroAction
          ? [
              snapshot.matchId,
              snapshot.hand.street,
              snapshot.hand.pot,
              legalActions.map(a => `${a.action}:${a.amount || a.min || ""}:${a.max || ""}`).join("|")
            ].join(":")
          : "";

        if (!promptKey) {
          state.lastActionPromptKey = "";
          return;
        }
        if (promptKey === state.lastActionPromptKey) return;

        state.lastActionPromptKey = promptKey;
        requestAnimationFrame(() => {
          const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
          document.getElementById("action-area")?.scrollIntoView({ behavior, block: "center" });
        });
      }

      async function poll() { 
        if (!state.matchId) return; 
        try { 
          const { state: snap } = await request(`/api/matches/${encodeURIComponent(state.matchId)}?playerId=${encodeURIComponent(state.playerId)}`); 
          setStatus(true, "backend online"); 
          render(snap); 
        } catch (err) { 
          setStatus(false, err.message || "backend offline"); 
        } 
      }
      function startPolling() { if (state.poller) clearInterval(state.poller); state.poller = setInterval(poll, POLL_MS); poll(); }
      function startBlindTimerTick() { 
        if (state.timerTicker) clearInterval(state.timerTicker); 
        state.timerTicker = setInterval(updateBlindTimer, TIMER_TICK_MS); 
        updateBlindTimer(); 
      }

      async function createMatch() { 
        syncApiFromInput();
        state.handle = els.handle.value.trim() || "Sunset"; 
        const data = await request("/api/matches", { method:"POST", body: JSON.stringify({ handle: state.handle, game: "plo" }) }); 
        state.matchId = data.matchId; 
        state.playerId = data.playerId; 
        els.matchId.value = state.matchId; 
        saveBasics(); 
        render(data.state); 
        startPolling(); 
      }
      async function joinMatch() { 
        syncApiFromInput();
        state.handle = els.handle.value.trim() || "Sunset"; 
        state.matchId = normalizeMatchCode(els.matchId.value); 
        els.matchId.value = state.matchId; 
        if (state.matchId.length !== 4) throw new Error("Enter a 4-digit match code first"); 
        const data = await request(`/api/matches/${encodeURIComponent(state.matchId)}/join`, { method:"POST", body: JSON.stringify({ handle: state.handle, game: "plo" }) }); 
        state.playerId = data.playerId; 
        saveBasics(); 
        render(data.state); 
        startPolling(); 
      }

      async function sendAction(action) { 
        const body = { playerId: state.playerId, action }; 
        if (action === "bet" || action === "raise") body.amount = parseInt(els.raiseInput.value, 10) || 0; 
        const { state: snap } = await request(`/api/matches/${encodeURIComponent(state.matchId)}/actions`, { method:"POST", body: JSON.stringify(body) }); 
        render(snap); 
      }

      function playerAction(type) {
        if (!state.snapshot) return;
        sendAction(type).catch(err => setStatus(false, err.message));
      }

      function wire() { 
        els.apiUrl.value = state.api; 
        els.handle.value = state.handle; 
        state.matchId = isMatchCode(state.matchId) ? state.matchId : ""; 
        els.matchId.value = state.matchId; 
        
        els.matchId.addEventListener("input", () => { els.matchId.value = normalizeMatchCode(els.matchId.value); }); 
        els.apiUrl.addEventListener("change", handleApiChange); 
        els.handle.addEventListener("change", () => { state.handle = els.handle.value.trim() || "Sunset"; saveBasics(); }); 
        
        els.create.addEventListener("click", () => createMatch().catch(e => setStatus(false, e.message))); 
        els.join.addEventListener("click", () => joinMatch().catch(e => setStatus(false, e.message))); 
        
        // Action buttons
        document.getElementById('action-area').addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          const legal = new Set((state.snapshot?.legalActions || []).map(a => a.action));
          const action = btn.id === 'fold-btn' ? 'fold' :
            btn.id === 'call-btn' ? (legal.has('call') ? 'call' : 'check') :
            btn.id === 'raise-btn' ? (legal.has('raise') ? 'raise' : 'bet') :
            btn.id === 'all-in-btn' ? 'all-in' :
            btn.id === 'next-hand-btn' ? 'next-hand' :
            null;
          if (action) playerAction(action);
        });

        checkHealth(); 
        startBlindTimerTick();
        if (state.matchId) startPolling(); 
      }

      function init() {
        els.gameLog.innerHTML = '<div class="log-entry">🌊 Heads-Up PLO ready — real players only (no bot). Create or join a 4-digit match.</div>';
        log('Enter match code or create new. Same backend as Hold\'em.');
        wire();
        document.addEventListener('click', ()=>{ /* init audio if needed */ }, {once:true});
      }
      window.onload = init;

      // Legacy restart for compatibility (resets local state only)
      function restartTournament() {
        if (state.poller) clearInterval(state.poller);
        state.matchId = ""; state.playerId = ""; state.snapshot = null;
        state.blindTimer = null; state.blindTimerReceivedAt = 0;
        state.lastActionPromptKey = "";
        els.gameLog.innerHTML = '';
        log('Match left. Create or join a new one.', true);
        els.heroStack.textContent = '10,000';
        els.villainStack.textContent = '—';
        els.heroCards.innerHTML = '';
        els.villainCards.innerHTML = '';
        els.communityCards.innerHTML = '';
        els.potAmount.textContent = '0';
        els.currentStreet.textContent = 'Preflop';
        els.blinds.textContent = '10/20';
        updateBlindTimer();
      }
