/* Do4You, shared logic. Plain JS, no framework, no build step.
   Data rule: only ONE example per sport (one match, one tournament).
   Everything the Top Admin, scorer or player adds is saved in the browser
   (localStorage, keys starting with "ta_") and survives a reload. Live sync
   across phones is prepared in sync.js and needs a Firebase project later.
*/

(function () {
  'use strict';

  /* ---------- Small store helpers ---------- */
  function loadJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      return v === null || v === undefined ? fallback : v;
    } catch (err) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* storage full or blocked, app still works in memory */ }
    if (window.TASync && typeof window.TASync.push === 'function') {
      try { window.TASync.push(key, value); } catch (err) { /* sync is optional */ }
    }
  }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Navigation ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var siteNav = document.getElementById('siteNav');
  if (menuBtn && siteNav) {
    menuBtn.addEventListener('click', function () {
      siteNav.classList.toggle('open');
    });
  }

  /* ---------- Service worker (PWA install) ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
    });
  }

  /* ---------- Roles: set only by logging in on login.html ---------- */
  function getRole() { return localStorage.getItem('ta_role') || ''; }
  function getUserName() { return localStorage.getItem('ta_name') || ''; }
  function roleLabel(role) {
    if (role === 'top-admin') return 'Top Admin';
    if (role === 'scorer') return 'Admin / Scorer';
    if (role === 'player') return 'Player';
    return '';
  }
  function isTopAdmin() { return getRole() === 'top-admin'; }
  function isPlayer() { return getRole() === 'player'; }

  var navUser = document.getElementById('navUser');
  var navUserText = document.getElementById('navUserText');
  var navLogout = document.getElementById('navLogout');
  var role = getRole();
  if (role && navUser && navUserText) {
    navUser.classList.remove('hidden');
    navUserText.textContent = 'Logged in as ' + getUserName() + ' (' + roleLabel(role) + ')';
  }
  if (navLogout) {
    navLogout.addEventListener('click', function () {
      localStorage.removeItem('ta_role');
      localStorage.removeItem('ta_name');
      window.location.reload();
    });
  }
  /* Player watches only: no scoring controls anywhere. */
  if (isPlayer()) {
    var scorerEls = document.querySelectorAll('.scorer-only');
    for (var i = 0; i < scorerEls.length; i++) scorerEls[i].classList.add('hidden');
    var watchNote = document.getElementById('watchNote');
    if (watchNote) watchNote.classList.remove('hidden');
  }
  /* Winner announcement is Top Admin only, on every page. */
  if (!isTopAdmin()) {
    var adminEls = document.querySelectorAll('.topadmin-only');
    for (var j = 0; j < adminEls.length; j++) adminEls[j].classList.add('hidden');
  }

  /* ---------- Winners (announced by the Top Admin) ---------- */
  /* Stored as { matchId: { sport, winner, tournament, at } } in ta_winners. */
  function getWinners() { return loadJSON('ta_winners', {}); }
  function announceWinner(matchId, sport, winnerName, tournament) {
    var w = getWinners();
    w[matchId] = { sport: sport, winner: winnerName, tournament: tournament || '', at: new Date().toISOString() };
    saveJSON('ta_winners', w);
    return w[matchId];
  }
  function clearWinner(matchId) {
    var w = getWinners();
    if (w[matchId]) { delete w[matchId]; saveJSON('ta_winners', w); }
  }
  function showWinnerBanner(el, matchId) {
    if (!el) return;
    var w = getWinners()[matchId];
    if (w) {
      el.classList.remove('hidden');
      el.textContent = 'Winner announced: ' + w.winner + (w.tournament ? ' (' + w.tournament + ')' : '') + '.';
    } else {
      el.classList.add('hidden');
      el.textContent = '';
    }
  }
  function winnerForTournament(tournamentName) {
    var w = getWinners();
    for (var k in w) { if (w[k] && w[k].tournament === tournamentName) return w[k]; }
    return null;
  }

  /* ---------- Finished results (drives the points and league tables) ---------- */
  function getResults() { return loadJSON('ta_results', []); }
  function recordResult(r) {
    var res = getResults();
    for (var i = 0; i < res.length; i++) { if (res[i].matchId === r.matchId) return; }
    res.push(r);
    saveJSON('ta_results', res);
  }
  function removeResult(matchId) {
    var res = getResults().filter(function (r) { return r.matchId !== matchId; });
    saveJSON('ta_results', res);
  }

  /* ---------- Registrations ---------- */
  function getRegistrations() { return loadJSON('ta_registrations', []); }
  function registrationsFor(tournamentName) {
    return getRegistrations().filter(function (r) { return r.tournament === tournamentName; });
  }

  /* ---------- Badminton live ---------- */
  var COURT = {
    singles: {
      topLeft:    { x: 41,  y: 20,    w: 119, h: 216.5 },
      topRight:   { x: 160, y: 20,    w: 119, h: 216.5 },
      bottomLeft: { x: 41,  y: 418.5, w: 119, h: 216.5 },
      bottomRight:{ x: 160, y: 418.5, w: 119, h: 216.5 }
    },
    doubles: {
      topLeft:    { x: 20,  y: 55,    w: 140, h: 181.5 },
      topRight:   { x: 160, y: 55,    w: 140, h: 181.5 },
      bottomLeft: { x: 20,  y: 418.5, w: 140, h: 181.5 },
      bottomRight:{ x: 160, y: 418.5, w: 140, h: 181.5 }
    }
  };
  var BM_NAMES = {
    singles: ['Arjun Varma', 'Rohit Kumar'],
    doubles: ['Sai Teja / Karthik N.', 'Imran S. / Vikram R.']
  };
  var BM_MATCH_ID = 'bm-example';
  var BM_TOURNAMENT = 'AU Open Badminton 2026';

  function bmDefault() {
    return { mode: 'singles', score: [0, 0], games: [0, 0], server: 0, gameNo: 1, history: [], over: false, winner: -1, finished: false };
  }

  function bmBoxKey(side, leftRight) {
    return side + (leftRight === 'left' ? 'Left' : 'Right');
  }

  function bmInit() {
    if (!document.getElementById('bmScoreA')) return;
    var state = loadJSON('ta_bm', bmDefault());
    if (!state.score) state = bmDefault();
    state.history = state.history || [];

    function save() { saveJSON('ta_bm', state); }
    function snap() {
      return { score: state.score.slice(), games: state.games.slice(), server: state.server, gameNo: state.gameNo, over: state.over, winner: state.winner, finished: state.finished };
    }
    function restore(s) {
      state.score = s.score.slice(); state.games = s.games.slice();
      state.server = s.server; state.gameNo = s.gameNo; state.over = s.over; state.winner = s.winner; state.finished = s.finished;
    }

    function checkGame(scorer) {
      var s = state.score[scorer], o = state.score[1 - scorer];
      var won = (s === 30) || (s >= 21 && (s - o) >= 2);
      if (!won) return;
      state.games[scorer]++;
      if (state.games[scorer] === 2) {
        state.over = true;
        state.finished = true;
        state.winner = scorer;
      } else {
        state.score = [0, 0];
        state.gameNo++;
        state.server = scorer; // winner of the game serves first in the next game
      }
    }

    function point(i) {
      if (state.over) return;
      state.history.push(snap());
      if (state.history.length > 60) state.history.shift();
      state.score[i]++;
      if (i !== state.server) state.server = i; // receiver wins the rally, gains the serve
      checkGame(i);
      save();
      render();
    }

    function undo() {
      var s = state.history.pop();
      if (!s) return;
      restore(s);
      save();
      render();
    }

    function resetMatch() {
      var mode = state.mode;
      state = bmDefault();
      state.mode = mode;
      clearWinner(BM_MATCH_ID);
      save();
      render();
    }

    function finishMatch() {
      if (state.over) return;
      state.finished = true;
      state.over = true;
      if (state.score[0] !== state.score[1]) state.winner = state.score[0] > state.score[1] ? 0 : 1;
      save();
      render();
    }

    function setMode(mode) {
      if (state.mode === mode) return;
      state.mode = mode;
      resetMatch();
      document.getElementById('bmSinglesBtn').classList.toggle('on', mode === 'singles');
      document.getElementById('bmDoublesBtn').classList.toggle('on', mode === 'doubles');
      document.getElementById('bmModeLabel').textContent = mode === 'singles' ? 'Singles' : 'Doubles';
      document.getElementById('bmMatchTitle').textContent =
        mode === 'singles' ? "Men's Singles, Semi-final, Court 1" : "Men's Doubles, Semi-final, Court 2";
    }

    function boxFor(side, leftRight) {
      return COURT[state.mode][bmBoxKey(side, leftRight)];
    }

    function drawCourt() {
      var serveBox = document.getElementById('serveBox');
      var receiveBox = document.getElementById('receiveBox');
      var arrow = document.getElementById('serveArrow');
      var sLabel = document.getElementById('serveLabel');
      var rLabel = document.getElementById('receiveLabel');
      if (!serveBox) return;
      var serverSide = state.server === 0 ? 'bottom' : 'top';
      var serverScore = state.score[state.server];
      var side = (serverScore % 2 === 0) ? 'right' : 'left';
      var sBox = boxFor(serverSide, side);
      var rSide = serverSide === 'bottom' ? 'top' : 'bottom';
      var rSideLR = side === 'right' ? 'left' : 'right'; // serve goes diagonally
      var rBox = boxFor(rSide, rSideLR);
      function setRect(el, b) {
        el.setAttribute('x', b.x); el.setAttribute('y', b.y);
        el.setAttribute('width', b.w); el.setAttribute('height', b.h);
      }
      setRect(serveBox, sBox);
      setRect(receiveBox, rBox);
      var scx = sBox.x + sBox.w / 2, scy = sBox.y + sBox.h / 2;
      var rcx = rBox.x + rBox.w / 2, rcy = rBox.y + rBox.h / 2;
      arrow.setAttribute('x1', scx); arrow.setAttribute('y1', scy);
      arrow.setAttribute('x2', rcx); arrow.setAttribute('y2', rcy);
      sLabel.setAttribute('x', scx); sLabel.setAttribute('y', scy + 5);
      rLabel.setAttribute('x', rcx); rLabel.setAttribute('y', rcy + 5);
    }

    function render() {
      var names = BM_NAMES[state.mode];
      document.getElementById('bmNameA').textContent = names[0];
      document.getElementById('bmNameB').textContent = names[1];
      document.getElementById('bmScoreA').textContent = state.score[0];
      document.getElementById('bmScoreB').textContent = state.score[1];
      document.getElementById('bmGamesA').textContent = 'Games won: ' + state.games[0];
      document.getElementById('bmGamesB').textContent = 'Games won: ' + state.games[1];
      document.getElementById('bmServeA').style.visibility = state.server === 0 ? 'visible' : 'hidden';
      document.getElementById('bmServeB').style.visibility = state.server === 1 ? 'visible' : 'hidden';
      document.getElementById('bmPlusA').textContent = '+1 ' + names[0].split(' ')[0];
      document.getElementById('bmPlusB').textContent = '+1 ' + names[1].split(' ')[0];
      document.getElementById('bmSinglesBtn').classList.toggle('on', state.mode === 'singles');
      document.getElementById('bmDoublesBtn').classList.toggle('on', state.mode === 'doubles');
      document.getElementById('bmModeLabel').textContent = state.mode === 'singles' ? 'Singles' : 'Doubles';
      var line = document.getElementById('bmServeLine');
      var result = document.getElementById('bmResult');
      if (state.over) {
        var winText = state.winner >= 0 ? names[state.winner] : 'No winner yet';
        line.innerHTML = '<strong>' + esc(winText) + '</strong> lead the match ' + state.games[0] + '-' + state.games[1] + '.';
        result.classList.remove('hidden');
        result.textContent = state.winner >= 0
          ? 'Match over. ' + names[state.winner] + ' win ' + state.games[0] + '-' + state.games[1] + '.'
          : 'Match finished. The Top Admin announces the winner below.';
      } else {
        var sName = names[state.server];
        var sScore = state.score[state.server];
        var side = (sScore % 2 === 0) ? 'RIGHT' : 'LEFT';
        line.innerHTML = '<strong>' + esc(sName) + '</strong> serves at ' + sScore + ' (' + (sScore % 2 === 0 ? 'even' : 'odd') + '), from the <strong>' + side + ' box</strong>, diagonally. Game ' + state.gameNo + ' of 3.';
        result.classList.add('hidden');
      }
      var finishBtn = document.getElementById('bmFinish');
      if (finishBtn) finishBtn.disabled = state.over;
      var ann = document.getElementById('bmAnnounce');
      if (ann) ann.classList.toggle('hidden', !(state.finished && isTopAdmin()));
      var sel = document.getElementById('bmWinnerSelect');
      if (sel) {
        sel.innerHTML = '';
        names.forEach(function (n, idx) {
          var opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = n;
          sel.appendChild(opt);
        });
        if (state.winner >= 0) sel.value = String(state.winner);
      }
      showWinnerBanner(document.getElementById('bmWinnerBanner'), BM_MATCH_ID);
      drawCourt();
    }

    document.getElementById('bmPlusA').addEventListener('click', function () { point(0); });
    document.getElementById('bmPlusB').addEventListener('click', function () { point(1); });
    document.getElementById('bmUndo').addEventListener('click', undo);
    document.getElementById('bmReset').addEventListener('click', resetMatch);
    var finishBtn = document.getElementById('bmFinish');
    if (finishBtn) finishBtn.addEventListener('click', finishMatch);
    var annBtn = document.getElementById('bmAnnounceBtn');
    if (annBtn) annBtn.addEventListener('click', function () {
      var sel = document.getElementById('bmWinnerSelect');
      var idx = parseInt(sel.value, 10);
      announceWinner(BM_MATCH_ID, 'badminton', BM_NAMES[state.mode][idx], BM_TOURNAMENT);
      var msg = document.getElementById('bmAnnounceMsg');
      if (msg) { msg.classList.remove('hidden'); msg.textContent = 'Winner announced: ' + BM_NAMES[state.mode][idx] + '.'; }
      render();
    });
    document.getElementById('bmSinglesBtn').addEventListener('click', function () { setMode('singles'); });
    document.getElementById('bmDoublesBtn').addEventListener('click', function () { setMode('doubles'); });
    render();
  }
  bmInit();

  /* ---------- Cricket live ---------- */
  var CR_MATCH_ID = 'cr-example';
  var CR_TOURNAMENT = 'Vizag T20 Cup';
  var CR_TEAMS = ['AU Warriors', 'Beach Road Blasters'];

  function crDefault() {
    return {
      runs: 86, wkts: 3, balls: 44, target: 130, maxBalls: 60,
      chips: [1, 4, 0, 1, 'W', 2, 6, 1],
      batsmen: [
        { name: 'Nikhil Reddy', runs: 34, balls: 19, fours: 4, sixes: 1, out: false, striker: true, how: '' },
        { name: 'Surya Prakash', runs: 12, balls: 8, fours: 1, sixes: 0, out: false, striker: false, how: '' },
        { name: 'Deepak Yadav', runs: 21, balls: 14, fours: 2, sixes: 1, out: true, striker: false, how: 'c Varma b Kumar' }
      ],
      bowler: { name: 'Rohit Kumar', balls: 8, runs: 14, wkts: 1 },
      history: [],
      finished: false
    };
  }

  function cricketInit() {
    if (!document.getElementById('crScore')) return;
    var state = loadJSON('ta_cr', crDefault());
    if (typeof state.runs !== 'number') state = crDefault();
    state.history = state.history || [];

    function save() { saveJSON('ta_cr', state); }
    function striker() {
      for (var i = 0; i < state.batsmen.length; i++) if (state.batsmen[i].striker) return state.batsmen[i];
      return state.batsmen[0];
    }
    function otherBatsman(b) {
      for (var i = 0; i < state.batsmen.length; i++) {
        if (state.batsmen[i] !== b && !state.batsmen[i].out) return state.batsmen[i];
      }
      return null;
    }
    function swapStrike() {
      var s = striker(), o = otherBatsman(s);
      if (!o) return;
      s.striker = false; o.striker = true;
    }
    function inningsOver() {
      return state.balls >= state.maxBalls || state.wkts >= 10 || state.runs >= state.target;
    }

    function ball(runs, isWicket) {
      if (inningsOver() || state.finished) return;
      state.history.push(clone(state));
      if (state.history.length > 120) state.history.shift();
      var s = striker();
      state.balls++;
      state.bowler.balls++;
      if (isWicket) {
        state.wkts++;
        state.bowler.wkts++;
        state.chips.push('W');
        if (s) {
          s.out = true; s.how = 'b Rohit Kumar'; s.striker = false; s.balls++;
          var o = otherBatsman(s);
          if (o) { o.striker = true; }
          else {
            var next = { name: 'Batter ' + (state.batsmen.length + 1), runs: 0, balls: 0, fours: 0, sixes: 0, out: false, striker: true, how: '' };
            state.batsmen.push(next);
          }
        }
      } else {
        state.runs += runs;
        state.bowler.runs += runs;
        state.chips.push(runs);
        if (s) {
          s.runs += runs; s.balls++;
          if (runs === 4) s.fours++;
          if (runs === 6) s.sixes++;
        }
        if (runs % 2 === 1) swapStrike();
      }
      if (state.balls % 6 === 0 && !inningsOver()) swapStrike(); // strike changes at the end of the over
      if (inningsOver()) state.finished = true;
      save();
      render();
    }

    function undoBall() {
      var prev = state.history.pop();
      if (!prev) return;
      state = prev;
      save();
      render();
    }

    function resetMatch() {
      state = crDefault();
      clearWinner(CR_MATCH_ID);
      removeResult(CR_MATCH_ID);
      save();
      render();
    }

    function finishMatch() {
      state.finished = true;
      save();
      render();
    }

    function oversText(balls) {
      return Math.floor(balls / 6) + '.' + (balls % 6);
    }
    function render() {
      document.getElementById('crScore').textContent = state.runs + '/' + state.wkts;
      document.getElementById('crOvers').textContent = '(' + oversText(state.balls) + ' ov)';
      var crr = state.balls > 0 ? (state.runs / (state.balls / 6)).toFixed(1) : '0.0';
      document.getElementById('crCrr').textContent = 'CRR ' + crr;
      var need = state.target - state.runs;
      var left = state.maxBalls - state.balls;
      var needEl = document.getElementById('crNeed');
      if (state.runs >= state.target) needEl.textContent = 'Target reached. Beach Road Blasters win.';
      else if (state.finished || inningsOver()) needEl.textContent = 'Innings over. Beach Road Blasters finish on ' + state.runs + '/' + state.wkts + '.';
      else needEl.textContent = 'Beach Road Blasters need ' + need + ' off ' + left + ' balls. Target ' + state.target + '.';
      var chips = document.getElementById('crChips');
      chips.innerHTML = '';
      state.chips.slice(-12).forEach(function (c) {
        var span = document.createElement('span');
        span.className = 'ball-chip' + (c === 4 ? ' four' : c === 6 ? ' six' : c === 'W' ? ' wicket' : '');
        span.textContent = c;
        chips.appendChild(span);
      });
      var body = document.getElementById('crBatBody');
      body.innerHTML = '';
      state.batsmen.forEach(function (b) {
        var tr = document.createElement('tr');
        var sr = b.balls > 0 ? (b.runs / b.balls * 100).toFixed(1) : '0.0';
        var label = b.name + (b.striker ? ' *' : '') + (b.out ? ' (' + b.how + ')' : '');
        tr.innerHTML = '<td>' + esc(label) + '</td><td class="num">' + b.runs + '</td><td class="num">' + b.balls + '</td><td class="num">' + b.fours + '</td><td class="num">' + b.sixes + '</td><td class="num">' + sr + '</td>';
        body.appendChild(tr);
      });
      var bowlBody = document.getElementById('crBowlBody');
      if (bowlBody) {
        var bw = state.bowler;
        var econ = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(1) : '0.0';
        bowlBody.innerHTML = '<tr><td>' + esc(bw.name) + ' *</td><td class="num">' + oversText(bw.balls) + '</td><td class="num">' + bw.runs + '</td><td class="num">' + bw.wkts + '</td><td class="num">' + econ + '</td></tr>';
      }
      var finishBtn = document.getElementById('crFinish');
      if (finishBtn) finishBtn.disabled = state.finished;
      var ann = document.getElementById('crAnnounce');
      if (ann) ann.classList.toggle('hidden', !(state.finished && isTopAdmin()));
      showWinnerBanner(document.getElementById('crWinnerBanner'), CR_MATCH_ID);
      renderPoints();
    }

    function renderPoints() {
      var box = document.getElementById('crPoints');
      if (!box) return;
      var res = getResults().filter(function (r) { return r.sport === 'cricket'; });
      if (!res.length) {
        box.innerHTML = '<p class="meta">No points table yet. League results will appear here when a match finishes and the winner is announced.</p>';
        return;
      }
      var teams = {};
      res.forEach(function (r) {
        [r.a, r.b].forEach(function (t) { if (!teams[t]) teams[t] = { p: 0, w: 0, l: 0, pts: 0 }; });
        teams[r.a].p++; teams[r.b].p++;
        if (r.winner && teams[r.winner]) { teams[r.winner].w++; teams[r.winner].pts += 2; }
        if (r.loser && teams[r.loser]) teams[r.loser].l++;
      });
      var rows = Object.keys(teams).map(function (t) { return { team: t, p: teams[t].p, w: teams[t].w, l: teams[t].l, pts: teams[t].pts }; });
      rows.sort(function (x, y) { return y.pts - x.pts || y.w - x.w; });
      var html = '<table class="score-table"><thead><tr><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">L</th><th class="num">Pts</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        html += '<tr><td>' + esc(r.team) + '</td><td class="num">' + r.p + '</td><td class="num">' + r.w + '</td><td class="num">' + r.l + '</td><td class="num">' + r.pts + '</td></tr>';
      });
      box.innerHTML = html + '</tbody></table>';
    }

    var btns = document.querySelectorAll('.cr-ball');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        ball(parseInt(this.getAttribute('data-runs'), 10), this.getAttribute('data-wicket') === '1');
      });
    }
    var undoBtn = document.getElementById('crUndo');
    if (undoBtn) undoBtn.addEventListener('click', undoBall);
    var reset = document.getElementById('crReset');
    if (reset) reset.addEventListener('click', resetMatch);
    var finishBtn = document.getElementById('crFinish');
    if (finishBtn) finishBtn.addEventListener('click', finishMatch);
    var annBtn = document.getElementById('crAnnounceBtn');
    if (annBtn) annBtn.addEventListener('click', function () {
      var sel = document.getElementById('crWinnerSelect');
      var winner = sel.value;
      var loser = winner === CR_TEAMS[0] ? CR_TEAMS[1] : CR_TEAMS[0];
      announceWinner(CR_MATCH_ID, 'cricket', winner, CR_TOURNAMENT);
      recordResult({ matchId: CR_MATCH_ID, sport: 'cricket', a: CR_TEAMS[0], b: CR_TEAMS[1], winner: winner, loser: loser });
      var msg = document.getElementById('crAnnounceMsg');
      if (msg) { msg.classList.remove('hidden'); msg.textContent = 'Winner announced: ' + winner + '.'; }
      render();
    });
    render();
  }
  cricketInit();

  /* ---------- Football live ---------- */
  var FB_MATCH_ID = 'fb-example';
  var FB_TOURNAMENT = 'Vizag 5-a-side League';
  var FB_TEAMS = ['AU United', 'Vizag City FC'];

  function fbDefault() {
    return {
      a: 2, b: 1, minute: 67,
      goals: [
        { min: 61, team: 'a', text: 'Goal, AU United, Karthik N. (assist Sai Teja)' },
        { min: 44, team: 'b', text: 'Goal, Vizag City FC, Imran S.' },
        { min: 18, team: 'a', text: 'Goal, AU United, Arjun Varma' }
      ],
      history: [],
      finished: false
    };
  }

  function footballInit() {
    if (!document.getElementById('fbScoreA')) return;
    var state = loadJSON('ta_fb', fbDefault());
    if (typeof state.a !== 'number') state = fbDefault();
    state.history = state.history || [];

    function save() { saveJSON('ta_fb', state); }
    function render() {
      document.getElementById('fbScoreA').textContent = state.a;
      document.getElementById('fbScoreB').textContent = state.b;
      document.getElementById('fbMinute').textContent = state.finished ? 'Full time' : state.minute + "'";
      var ul = document.getElementById('fbTimeline');
      ul.innerHTML = '';
      state.goals.forEach(function (g) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="min">' + g.min + "'</span> " + esc(g.text);
        ul.appendChild(li);
      });
      var fullBtn = document.getElementById('fbFullTime');
      if (fullBtn) fullBtn.disabled = state.finished;
      var ann = document.getElementById('fbAnnounce');
      if (ann) ann.classList.toggle('hidden', !(state.finished && isTopAdmin()));
      showWinnerBanner(document.getElementById('fbWinnerBanner'), FB_MATCH_ID);
      renderTable();
    }
    function renderTable() {
      var box = document.getElementById('fbTable');
      if (!box) return;
      var res = getResults().filter(function (r) { return r.sport === 'football'; });
      if (!res.length) {
        box.innerHTML = '<p class="meta">No league table yet. Finished league matches will appear here when the winner is announced.</p>';
        return;
      }
      var teams = {};
      res.forEach(function (r) {
        [r.a, r.b].forEach(function (t) { if (!teams[t]) teams[t] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
        teams[r.a].p++; teams[r.b].p++;
        teams[r.a].gf += r.scoreA; teams[r.a].ga += r.scoreB;
        teams[r.b].gf += r.scoreB; teams[r.b].ga += r.scoreA;
        if (r.scoreA === r.scoreB) { teams[r.a].d++; teams[r.b].d++; teams[r.a].pts++; teams[r.b].pts++; }
        else if (r.winner === r.a) { teams[r.a].w++; teams[r.b].l++; teams[r.a].pts += 3; }
        else { teams[r.b].w++; teams[r.a].l++; teams[r.b].pts += 3; }
      });
      var rows = Object.keys(teams).map(function (t) {
        var x = teams[t];
        return { team: t, p: x.p, w: x.w, d: x.d, l: x.l, gd: x.gf - x.ga, pts: x.pts };
      });
      rows.sort(function (x, y) { return y.pts - x.pts || y.gd - x.gd; });
      var html = '<table class="score-table"><thead><tr><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">GD</th><th class="num">Pts</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        html += '<tr><td>' + esc(r.team) + '</td><td class="num">' + r.p + '</td><td class="num">' + r.w + '</td><td class="num">' + r.d + '</td><td class="num">' + r.l + '</td><td class="num">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="num">' + r.pts + '</td></tr>';
      });
      box.innerHTML = html + '</tbody></table>';
    }
    function goal(team) {
      if (state.finished) return;
      state.history.push(clone(state));
      if (state.history.length > 60) state.history.shift();
      var input = document.getElementById(team === 'a' ? 'fbScorerA' : 'fbScorerB');
      var scorer = input ? input.value.trim() : '';
      state[team]++;
      var teamName = team === 'a' ? FB_TEAMS[0] : FB_TEAMS[1];
      var text = scorer ? 'Goal, ' + teamName + ', ' + scorer : 'Goal, ' + teamName;
      state.goals.unshift({ min: state.minute, team: team, text: text });
      if (input) input.value = '';
      save();
      render();
    }
    function undoGoal() {
      var prev = state.history.pop();
      if (!prev) return;
      state = prev;
      save();
      render();
    }
    function resetMatch() {
      state = fbDefault();
      clearWinner(FB_MATCH_ID);
      removeResult(FB_MATCH_ID);
      save();
      render();
    }
    document.getElementById('fbGoalA').addEventListener('click', function () { goal('a'); });
    document.getElementById('fbGoalB').addEventListener('click', function () { goal('b'); });
    var minBtn = document.getElementById('fbMinutePlus');
    if (minBtn) minBtn.addEventListener('click', function () {
      if (state.finished) return;
      if (state.minute < 120) { state.minute++; save(); render(); }
    });
    var undoBtn = document.getElementById('fbUndo');
    if (undoBtn) undoBtn.addEventListener('click', undoGoal);
    var fullBtn = document.getElementById('fbFullTime');
    if (fullBtn) fullBtn.addEventListener('click', function () { state.finished = true; save(); render(); });
    var reset = document.getElementById('fbReset');
    if (reset) reset.addEventListener('click', resetMatch);
    var annBtn = document.getElementById('fbAnnounceBtn');
    if (annBtn) annBtn.addEventListener('click', function () {
      var sel = document.getElementById('fbWinnerSelect');
      var winner = sel.value;
      announceWinner(FB_MATCH_ID, 'football', winner, FB_TOURNAMENT);
      recordResult({ matchId: FB_MATCH_ID, sport: 'football', a: FB_TEAMS[0], b: FB_TEAMS[1], scoreA: state.a, scoreB: state.b, winner: winner });
      var msg = document.getElementById('fbAnnounceMsg');
      if (msg) { msg.classList.remove('hidden'); msg.textContent = 'Winner announced: ' + winner + '.'; }
      render();
    });
    render();
  }
  footballInit();

  /* ---------- Login ---------- */
  function loginInit() {
    var form = document.getElementById('loginForm');
    if (!form) return;
    var status = document.getElementById('loginStatus');
    var msg = document.getElementById('loginMsg');
    var current = getRole();
    if (current && status) {
      status.classList.remove('hidden');
      status.textContent = 'You are logged in as ' + getUserName() + ' (' + roleLabel(current) + ').';
    }
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('ta_role');
        localStorage.removeItem('ta_name');
        window.location.reload();
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('loginName').value.trim();
      var r = document.getElementById('loginRole').value;
      if (!name || !r) {
        msg.textContent = 'Enter your name and pick a role.';
        msg.classList.remove('hidden');
        return;
      }
      localStorage.setItem('ta_role', r);
      localStorage.setItem('ta_name', name);
      msg.classList.remove('hidden');
      msg.textContent = 'Logged in as ' + name + ' (' + roleLabel(r) + ').';
      if (status) {
        status.classList.remove('hidden');
        status.textContent = 'You are logged in as ' + name + ' (' + roleLabel(r) + ').';
      }
      window.setTimeout(function () { window.location.href = 'index.html'; }, 900);
    });
  }
  loginInit();

  /* ---------- Fixture generation (Top Admin creates a tournament) ---------- */
  function fixtureTime(index, minsPerMatch) {
    var start = 9 * 60 + index * minsPerMatch;
    var h = Math.floor(start / 60), m = start % 60;
    var ap = h >= 12 ? 'PM' : 'AM';
    var hh = h % 12 || 12;
    return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function roundLabel(total, pairIndex, format) {
    if (format === 'League' || format === 'League + Knockout') return 'League, Match ' + (pairIndex + 1);
    if (total <= 2) return 'Final';
    if (total <= 4) return 'Semi-final ' + (pairIndex + 1);
    if (total <= 8) return 'Quarter-final ' + (pairIndex + 1);
    return 'Round 1, Match ' + (pairIndex + 1);
  }
  function generateFixtures(t) {
    var fixtures = [];
    var date = t.dates || '';
    var venue = t.venue || 'Andhra University Ground, Visakhapatnam';
    function add(title, label, index, mins, court) {
      fixtures.push({
        id: 'fx-' + t.id + '-' + fixtures.length,
        tournamentId: t.id,
        tournament: t.name,
        sport: t.sport,
        title: title,
        label: label,
        date: date,
        time: fixtureTime(index, mins),
        venue: venue,
        court: court || '',
        status: 'upcoming'
      });
    }
    if (t.sport === 'badminton') {
      var players = parseInt(t.players, 10) || 0;
      var courts = parseInt(t.courts, 10) || 1;
      var pairs = [];
      if (t.format === 'League') {
        for (var a = 1; a <= players; a++) for (var b = a + 1; b <= players; b++) pairs.push([a, b]);
        pairs = pairs.slice(0, 28); // first 28 league matches, the rest are added round by round
      } else {
        for (var p = 1; p + 1 <= players; p += 2) pairs.push([p, p + 1]);
      }
      pairs.forEach(function (pr, idx) {
        add('Match ' + (idx + 1) + ': Player ' + pr[0] + ' vs Player ' + pr[1],
          roundLabel(players, idx, t.format), idx, 45, 'Court ' + ((idx % courts) + 1));
      });
    } else if (t.sport === 'cricket') {
      var teams = parseInt(t.teams, 10) || 0;
      var cpairs = [];
      if (t.format === 'League' || t.format === 'League + Knockout') {
        for (var c = 1; c <= teams; c++) for (var d = c + 1; d <= teams; d++) cpairs.push([c, d]);
        cpairs = cpairs.slice(0, 28);
      } else {
        for (var e = 1; e + 1 <= teams; e += 2) cpairs.push([e, e + 1]);
      }
      cpairs.forEach(function (pr, idx) {
        add('Match ' + (idx + 1) + ': Team ' + pr[0] + ' vs Team ' + pr[1],
          roundLabel(teams, idx, t.format), idx, 120, 'AU Ground');
      });
    } else {
      var fteams = parseInt(t.teams, 10) || 0;
      var fpairs = [];
      if (t.format === 'League' || t.format === 'League + Knockout') {
        for (var f = 1; f <= fteams; f++) for (var g = f + 1; g <= fteams; g++) fpairs.push([f, g]);
        fpairs = fpairs.slice(0, 28);
      } else {
        for (var h = 1; h + 1 <= fteams; h += 2) fpairs.push([h, h + 1]);
      }
      fpairs.forEach(function (pr, idx) {
        add('Match ' + (idx + 1) + ': Team ' + pr[0] + ' vs Team ' + pr[1],
          roundLabel(fteams, idx, t.format), idx, 90, 'AU Ground');
      });
    }
    return fixtures;
  }

  /* ---------- Create tournament (Top Admin only) ---------- */
  function createInit() {
    var form = document.getElementById('ctForm');
    if (!form) return;
    var gate = document.getElementById('ctGate');
    if (!isTopAdmin()) {
      if (gate) gate.classList.remove('hidden');
      form.classList.add('hidden');
      return;
    }
    var sport = '';
    var pickBtns = document.querySelectorAll('.ct-sport');
    function showSport(s) {
      sport = s;
      for (var i = 0; i < pickBtns.length; i++) pickBtns[i].classList.toggle('on', pickBtns[i].getAttribute('data-sport') === s);
      document.getElementById('ctBadminton').classList.toggle('hidden', s !== 'badminton');
      document.getElementById('ctCricket').classList.toggle('hidden', s !== 'cricket');
      document.getElementById('ctFootball').classList.toggle('hidden', s !== 'football');
      document.getElementById('ctCommon').classList.remove('hidden');
    }
    for (var j = 0; j < pickBtns.length; j++) {
      pickBtns[j].addEventListener('click', function () { showSport(this.getAttribute('data-sport')); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('ctName').value.trim();
      if (!name || !sport) {
        alert('Enter a tournament name and pick a sport first.');
        return;
      }
      var format = 'Knockout';
      var fmt = document.querySelector('input[name="ctFormat"]:checked');
      if (fmt) format = fmt.value;
      var t = {
        id: 't' + Date.now(),
        sport: sport,
        name: name,
        format: format,
        fee: document.getElementById('ctFee').value.trim(),
        venue: document.getElementById('ctVenue').value.trim(),
        dates: document.getElementById('ctDates').value,
        formLink: document.getElementById('ctFormLink').value.trim(),
        status: 'Registrations open',
        createdAt: new Date().toISOString()
      };
      if (sport === 'badminton') {
        t.categories = document.getElementById('ctBmCats').value;
        t.players = document.getElementById('ctBmPlayers').value;
        t.courts = document.getElementById('ctBmCourts').value;
      } else if (sport === 'cricket') {
        t.teams = document.getElementById('ctCrTeams').value;
        t.playersPerTeam = document.getElementById('ctCrPlayers').value;
        t.overs = document.getElementById('ctCrOvers').value;
      } else {
        t.teams = document.getElementById('ctFbTeams').value;
        t.side = document.getElementById('ctFbSide').value;
        t.duration = document.getElementById('ctFbDuration').value;
      }
      var saved = loadJSON('ta_tournaments', []);
      saved.push(t);
      saveJSON('ta_tournaments', saved);
      var fixtures = generateFixtures(t);
      var allFx = loadJSON('ta_fixtures', []);
      fixtures.forEach(function (f) { allFx.push(f); });
      saveJSON('ta_fixtures', allFx);
      var done = document.getElementById('ctDone');
      var doneText = document.getElementById('ctDoneText');
      var doneLink = document.getElementById('ctDoneLink');
      doneText.textContent = 'Tournament created: ' + name + '. It is now listed on the ' + sport + ' tournaments page, and ' + fixtures.length + ' fixture' + (fixtures.length === 1 ? '' : 's') + ' were generated on the ' + sport + ' fixtures page.';
      doneLink.href = sport + '-tournaments.html';
      doneLink.textContent = 'View ' + sport + ' tournaments';
      done.classList.remove('hidden');
      form.classList.add('hidden');
      window.scrollTo(0, 0);
    });
  }
  createInit();

  /* ---------- Registration (shared handler for every tournament form) ---------- */
  function regFormHtml(tournamentName, sport, fee) {
    return '<form class="reg-form" data-tournament="' + esc(tournamentName) + '" data-sport="' + esc(sport) + '">' +
      '<label>Your name</label>' +
      '<input type="text" class="reg-name" placeholder="Enter your name" required>' +
      '<label>Entry fee, Rs ' + esc(fee || '') + '</label>' +
      '<div class="radio-row">' +
      '<label class="radio-pill"><input type="radio" name="pay" value="Cash at venue" checked> Cash at venue</label>' +
      '<label class="radio-pill"><input type="radio" name="pay" value="UPI"> UPI</label>' +
      '</div>' +
      '<p class="help">UPI payment is kept ready here. UPI details will come later, no payment is taken in this app. Pay cash at the venue for now.</p>' +
      '<div class="btn-row"><button class="btn" type="submit">Register</button></div>' +
      '<p class="toast hidden reg-msg"></p>' +
      '</form>';
  }
  function regCountHtml(tournamentName) {
    var regs = registrationsFor(tournamentName);
    if (!regs.length) return '<p class="meta">No registrations yet.</p>';
    var names = regs.map(function (r) { return esc(r.player); }).join(', ');
    return '<p class="meta">' + regs.length + ' registered: ' + names + '</p>';
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.classList || !form.classList.contains('reg-form')) return;
    e.preventDefault();
    var nameInput = form.querySelector('.reg-name');
    var name = nameInput ? nameInput.value.trim() : '';
    var msg = form.querySelector('.reg-msg');
    if (!name) {
      if (msg) { msg.classList.remove('hidden'); msg.textContent = 'Enter your name to register.'; }
      return;
    }
    var pay = 'Cash at venue';
    var checked = form.querySelector('input[name="pay"]:checked');
    if (checked) pay = checked.value;
    var regs = getRegistrations();
    regs.push({ tournament: form.getAttribute('data-tournament'), sport: form.getAttribute('data-sport'), player: name, payment: pay, at: new Date().toISOString() });
    saveJSON('ta_registrations', regs);
    if (msg) {
      msg.classList.remove('hidden');
      msg.textContent = pay === 'UPI'
        ? 'Registered, ' + name + '. UPI details will come later. Please pay cash at the venue for now.'
        : 'Registered, ' + name + '. Pay the entry fee in cash at the venue.';
    }
    if (nameInput) nameInput.value = '';
    var list = form.parentElement ? form.parentElement.querySelector('.reg-list') : null;
    if (list) list.innerHTML = regCountHtml(form.getAttribute('data-tournament'));
  });

  /* ---------- Saved tournaments on the tournaments pages ---------- */
  function savedInit() {
    var box = document.getElementById('savedTournaments');
    if (!box) return;
    var page = document.querySelector('.page');
    var sport = page ? page.getAttribute('data-sport') : '';
    var saved = loadJSON('ta_tournaments', []);
    var mine = saved.filter(function (t) { return t.sport === sport; });
    /* Winner banner for the one example tournament on this page. */
    var winnerBox = document.getElementById('tournamentWinner');
    var exampleName = sport === 'badminton' ? BM_TOURNAMENT : sport === 'cricket' ? CR_TOURNAMENT : FB_TOURNAMENT;
    var w = winnerForTournament(exampleName);
    if (winnerBox) {
      if (w) { winnerBox.classList.remove('hidden'); winnerBox.textContent = 'Winner announced: ' + w.winner + ' (' + exampleName + ').'; }
      else winnerBox.classList.add('hidden');
    }
    /* Registration count for the example tournament. */
    var exList = document.getElementById('exampleRegList');
    if (exList) exList.innerHTML = regCountHtml(exampleName);
    if (!mine.length) return;
    box.classList.remove('hidden');
    box.innerHTML = '';
    mine.forEach(function (t) {
      var div = document.createElement('div');
      div.className = 'card';
      var detail = '';
      if (t.sport === 'badminton') detail = 'Badminton, ' + t.categories + ', ' + t.format + ', ' + t.courts + ' courts, ' + t.players + ' players';
      else if (t.sport === 'cricket') detail = 'Cricket, ' + t.teams + ' teams, ' + t.playersPerTeam + ' players per team, ' + t.overs + ' overs, ' + t.format;
      else detail = 'Football, ' + t.teams + ' teams, ' + t.side + ', ' + t.duration + ' min, ' + t.format;
      var tw = winnerForTournament(t.name);
      var winnerLine = tw ? '<p><strong>Winner announced: ' + esc(tw.winner) + '</strong></p>' : '';
      var formLink = t.formLink ? '<p><a href="' + esc(t.formLink) + '">Register on Google Forms</a></p>' : '<p class="meta">Google Forms link not added yet.</p>';
      div.innerHTML = '<div class="row-main"><h3>' + esc(t.name) + '</h3><p>' + esc(detail) + '</p><p>' + esc(t.dates || '') + ' ' + esc(t.venue || '') + ' Entry Rs ' + esc(t.fee || '') + '</p></div>' +
        '<span class="tag">JUST CREATED</span>' + winnerLine + formLink +
        '<div class="reg-list">' + regCountHtml(t.name) + '</div>' +
        regFormHtml(t.name, t.sport, t.fee);
      box.appendChild(div);
    });
  }
  savedInit();

  /* ---------- Generated fixtures on the fixtures pages ---------- */
  function fixturesInit() {
    var box = document.getElementById('generatedFixtures');
    if (!box) return;
    var page = document.querySelector('.page');
    var sport = page ? page.getAttribute('data-sport') : '';
    var all = loadJSON('ta_fixtures', []);
    var mine = all.filter(function (f) { return f.sport === sport; });
    /* Winner line under the one example fixture. */
    var fw = document.getElementById('fixtureWinner');
    var exampleName = sport === 'badminton' ? BM_TOURNAMENT : sport === 'cricket' ? CR_TOURNAMENT : FB_TOURNAMENT;
    var w = winnerForTournament(exampleName);
    if (fw) {
      if (w) { fw.classList.remove('hidden'); fw.textContent = 'Winner announced: ' + w.winner + '.'; }
      else fw.classList.add('hidden');
    }
    if (!mine.length) return;
    box.innerHTML = '';
    var livePage = sport + '-live.html';
    mine.forEach(function (f) {
      var div = document.createElement('div');
      div.className = 'row-item';
      var when = (f.date || 'Date to be announced') + (f.time ? ', ' + f.time : '');
      var place = (f.court ? f.court + ', ' : '') + (f.venue || '');
      div.innerHTML = '<div class="row-time">' + esc(f.status.toUpperCase()) + '</div>' +
        '<div class="row-main"><h3>' + esc(f.label || '') + '</h3><p>' + esc(f.title) + '</p><p>' + esc(when) + ', ' + esc(place) + '</p><p>' + esc(f.tournament) + '</p></div>' +
        '<span class="tag">' + esc(f.status.toUpperCase()) + '</span>';
      box.appendChild(div);
      var row = document.createElement('div');
      row.className = 'btn-row';
      row.innerHTML = '<a class="btn btn-secondary" href="' + livePage + '">View live match</a>';
      box.appendChild(row);
    });
  }
  fixturesInit();

  /* ---------- Home page: created tournaments + install hint ---------- */
  function homeInit() {
    var box = document.getElementById('homeTournaments');
    if (box) {
      var saved = loadJSON('ta_tournaments', []);
      if (saved.length) {
        box.innerHTML = '<h2>Tournaments you created</h2>';
        saved.forEach(function (t) {
          var div = document.createElement('div');
          div.className = 'row-item';
          div.innerHTML = '<div class="row-main"><h3>' + esc(t.name) + '</h3><p>' + esc(t.sport) + ', ' + esc(t.format) + ', Entry Rs ' + esc(t.fee || '') + '</p></div><span class="tag">JUST CREATED</span>';
          box.appendChild(div);
          var row = document.createElement('div');
          row.className = 'btn-row';
          row.innerHTML = '<a class="btn btn-secondary" href="' + esc(t.sport) + '-tournaments.html">View ' + esc(t.sport) + ' tournaments</a>';
          box.appendChild(row);
        });
      }
    }
    var installBtn = document.getElementById('installBtn');
    var installNote = document.getElementById('installNote');
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      if (installBtn) installBtn.classList.remove('hidden');
      if (installNote) installNote.textContent = 'Tap Install below to add Do4You to your home screen.';
    });
    if (installBtn) installBtn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred = null;
      installBtn.classList.add('hidden');
    });
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      var hint = document.getElementById('installHint');
      if (hint) hint.classList.add('hidden');
    }
  }
  homeInit();
})();
