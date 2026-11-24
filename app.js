/* Tournament App - shared logic. Plain JS, no framework. */

(function () {
  'use strict';

  /* ---------- Navigation ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var siteNav = document.getElementById('siteNav');
  if (menuBtn && siteNav) {
    menuBtn.addEventListener('click', function () {
      siteNav.classList.toggle('open');
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

  /* Show who is logged in, and hide scoring controls for Players. */
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
  if (role === 'player') {
    var scorerEls = document.querySelectorAll('.scorer-only');
    for (var i = 0; i < scorerEls.length; i++) scorerEls[i].classList.add('hidden');
    var watchNote = document.getElementById('watchNote');
    if (watchNote) watchNote.classList.remove('hidden');
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

  function bmBoxKey(side, leftRight) {
    // side: 'top' or 'bottom'. leftRight: 'left' or 'right'.
    return side + (leftRight === 'left' ? 'Left' : 'Right');
  }

  function bmInit() {
    if (!document.getElementById('bmScoreA')) return;
    var state = {
      mode: 'singles',
      score: [0, 0],
      games: [0, 0],
      server: 0, // 0 = bottom side (Arjun / pair 1), 1 = top side (Rohit / pair 2)
      gameNo: 1,
      history: [],
      over: false,
      winner: -1
    };

    function snap() {
      return { score: state.score.slice(), games: state.games.slice(), server: state.server, gameNo: state.gameNo, over: state.over, winner: state.winner };
    }
    function restore(s) {
      state.score = s.score.slice(); state.games = s.games.slice();
      state.server = s.server; state.gameNo = s.gameNo; state.over = s.over; state.winner = s.winner;
    }

    function checkGame(scorer) {
      var s = state.score[scorer], o = state.score[1 - scorer];
      var won = (s === 30) || (s >= 21 && (s - o) >= 2);
      if (!won) return;
      state.games[scorer]++;
      if (state.games[scorer] === 2) {
        state.over = true;
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
      state.score[i]++;
      if (i !== state.server) state.server = i; // receiver wins the rally, gains the serve
      checkGame(i);
      render();
    }

    function undo() {
      var s = state.history.pop();
      if (!s) return;
      restore(s);
      render();
    }

    function resetMatch() {
      state.score = [0, 0];
      state.games = [0, 0];
      state.server = 0;
      state.gameNo = 1;
      state.history = [];
      state.over = false;
      state.winner = -1;
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
      var line = document.getElementById('bmServeLine');
      var result = document.getElementById('bmResult');
      if (state.over) {
        line.innerHTML = '<strong>' + names[state.winner] + '</strong> win the match ' + state.games[0] + '-' + state.games[1] + '.';
        result.classList.remove('hidden');
        result.textContent = 'Match over. ' + names[state.winner] + ' win ' + state.games[0] + '-' + state.games[1] + '.';
      } else {
        var sName = names[state.server];
        var sScore = state.score[state.server];
        var side = (sScore % 2 === 0) ? 'RIGHT' : 'LEFT';
        line.innerHTML = '<strong>' + sName + '</strong> serves at ' + sScore + ' (' + (sScore % 2 === 0 ? 'even' : 'odd') + '), from the <strong>' + side + ' box</strong>, diagonally. Game ' + state.gameNo + ' of 3.';
        result.classList.add('hidden');
      }
      drawCourt();
    }

    document.getElementById('bmPlusA').addEventListener('click', function () { point(0); });
    document.getElementById('bmPlusB').addEventListener('click', function () { point(1); });
    document.getElementById('bmUndo').addEventListener('click', undo);
    document.getElementById('bmReset').addEventListener('click', resetMatch);
    document.getElementById('bmSinglesBtn').addEventListener('click', function () { setMode('singles'); });
    document.getElementById('bmDoublesBtn').addEventListener('click', function () { setMode('doubles'); });
    render();
  }
  bmInit();

  /* ---------- Cricket live ---------- */
  function cricketInit() {
    if (!document.getElementById('crScore')) return;
    var state = {
      runs: 86, wkts: 3, balls: 44, target: 130, maxBalls: 60,
      chips: [1, 4, 0, 1, 'W', 2, 6, 1]
    };
    var batsmen = [
      { name: 'Nikhil Reddy', runs: 34, balls: 19, fours: 4, sixes: 1, out: false, striker: true },
      { name: 'Surya Prakash', runs: 12, balls: 8, fours: 1, sixes: 0, out: false, striker: false },
      { name: 'Deepak Yadav', runs: 21, balls: 14, fours: 2, sixes: 1, out: true, how: 'c Varma b Kumar' }
    ];

    function striker() {
      for (var i = 0; i < batsmen.length; i++) if (batsmen[i].striker) return batsmen[i];
      return batsmen[0];
    }
    function otherBatsman(b) {
      for (var i = 0; i < batsmen.length; i++) {
        if (batsmen[i] !== b && !batsmen[i].out) return batsmen[i];
      }
      return null;
    }
    function swapStrike() {
      var s = striker(), o = otherBatsman(s);
      if (!o) return;
      s.striker = false; o.striker = true;
    }

    function ball(runs, isWicket) {
      if (state.balls >= state.maxBalls || state.wkts >= 10 || state.runs >= state.target) return;
      var s = striker();
      state.balls++;
      if (isWicket) {
        state.wkts++;
        state.chips.push('W');
        if (s) {
          s.out = true; s.how = 'b Rohit Kumar'; s.striker = false;
          var o = otherBatsman(s);
          if (o) o.striker = true;
        }
      } else {
        state.runs += runs;
        state.chips.push(runs);
        if (s) {
          s.runs += runs; s.balls++;
          if (runs === 4) s.fours++;
          if (runs === 6) s.sixes++;
        }
        if (runs % 2 === 1) swapStrike();
      }
      render();
    }

    function oversText() {
      return Math.floor(state.balls / 6) + '.' + (state.balls % 6) + ' ov';
    }
    function render() {
      document.getElementById('crScore').textContent = state.runs + '/' + state.wkts;
      document.getElementById('crOvers').textContent = oversText();
      var crr = state.balls > 0 ? (state.runs / (state.balls / 6)).toFixed(1) : '0.0';
      document.getElementById('crCrr').textContent = 'CRR ' + crr;
      var need = state.target - state.runs;
      var left = state.maxBalls - state.balls;
      var needEl = document.getElementById('crNeed');
      if (state.runs >= state.target) needEl.textContent = 'Target reached. Beach Road Blasters win.';
      else if (state.balls >= state.maxBalls || state.wkts >= 10) needEl.textContent = 'Innings over. Beach Road Blasters finish on ' + state.runs + '/' + state.wkts + '.';
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
      batsmen.forEach(function (b) {
        var tr = document.createElement('tr');
        var sr = b.balls > 0 ? (b.runs / b.balls * 100).toFixed(1) : '0.0';
        var label = b.name + (b.striker ? ' *' : '') + (b.out ? ' (' + b.how + ')' : '');
        tr.innerHTML = '<td>' + label + '</td><td class="num">' + b.runs + '</td><td class="num">' + b.balls + '</td><td class="num">' + b.fours + '</td><td class="num">' + b.sixes + '</td><td class="num">' + sr + '</td>';
        body.appendChild(tr);
      });
    }

    var btns = document.querySelectorAll('.cr-ball');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        ball(parseInt(this.getAttribute('data-runs'), 10), this.getAttribute('data-wicket') === '1');
      });
    }
    var reset = document.getElementById('crReset');
    if (reset) reset.addEventListener('click', function () { window.location.reload(); });
    render();
  }
  cricketInit();

  /* ---------- Football live ---------- */
  function footballInit() {
    if (!document.getElementById('fbScoreA')) return;
    var state = {
      a: 2, b: 1, minute: 67,
      goals: [
        { min: 61, team: 'a', text: 'Goal, AU United, Karthik N. (assist Sai Teja)' },
        { min: 44, team: 'b', text: 'Goal, Vizag City FC, Imran S.' },
        { min: 18, team: 'a', text: 'Goal, AU United, Arjun Varma' }
      ]
    };
    function render() {
      document.getElementById('fbScoreA').textContent = state.a;
      document.getElementById('fbScoreB').textContent = state.b;
      document.getElementById('fbMinute').textContent = state.minute + "'";
      var ul = document.getElementById('fbTimeline');
      ul.innerHTML = '';
      state.goals.forEach(function (g) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="min">' + g.min + "'</span> " + g.text;
        ul.appendChild(li);
      });
    }
    function goal(team) {
      var input = document.getElementById(team === 'a' ? 'fbScorerA' : 'fbScorerB');
      var scorer = input ? input.value.trim() : '';
      state[team]++;
      var teamName = team === 'a' ? 'AU United' : 'Vizag City FC';
      var text = scorer ? 'Goal, ' + teamName + ', ' + scorer : 'Goal, ' + teamName;
      state.goals.unshift({ min: state.minute, team: team, text: text });
      if (input) input.value = '';
      render();
    }
    document.getElementById('fbGoalA').addEventListener('click', function () { goal('a'); });
    document.getElementById('fbGoalB').addEventListener('click', function () { goal('b'); });
    var reset = document.getElementById('fbReset');
    if (reset) reset.addEventListener('click', function () { window.location.reload(); });
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

  /* ---------- Create tournament (Top Admin only) ---------- */
  function createInit() {
    var form = document.getElementById('ctForm');
    if (!form) return;
    var gate = document.getElementById('ctGate');
    if (getRole() !== 'top-admin') {
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
        sport: sport,
        name: name,
        format: format,
        fee: document.getElementById('ctFee').value.trim(),
        venue: document.getElementById('ctVenue').value.trim(),
        dates: document.getElementById('ctDates').value,
        formLink: document.getElementById('ctFormLink').value.trim()
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
      var saved = [];
      try { saved = JSON.parse(localStorage.getItem('ta_tournaments') || '[]'); } catch (err) { saved = []; }
      saved.push(t);
      localStorage.setItem('ta_tournaments', JSON.stringify(saved));
      var done = document.getElementById('ctDone');
      var doneText = document.getElementById('ctDoneText');
      var doneLink = document.getElementById('ctDoneLink');
      doneText.textContent = 'Tournament created: ' + name + '. It is now listed on the ' + sport + ' tournaments page.';
      doneLink.href = sport + '-tournaments.html';
      doneLink.textContent = 'View ' + sport + ' tournaments';
      done.classList.remove('hidden');
      form.classList.add('hidden');
      window.scrollTo(0, 0);
    });
  }
  createInit();

  /* ---------- Saved tournaments on the tournaments pages ---------- */
  function savedInit() {
    var box = document.getElementById('savedTournaments');
    if (!box) return;
    var page = document.querySelector('.page');
    var sport = page ? page.getAttribute('data-sport') : '';
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem('ta_tournaments') || '[]'); } catch (err) { saved = []; }
    var mine = saved.filter(function (t) { return t.sport === sport; });
    if (!mine.length) return;
    box.classList.remove('hidden');
    mine.forEach(function (t) {
      var div = document.createElement('div');
      div.className = 'row-item';
      var detail = '';
      if (t.sport === 'badminton') detail = 'Badminton, ' + t.categories + ', ' + t.format + ', ' + t.courts + ' courts, ' + t.players + ' players';
      else if (t.sport === 'cricket') detail = 'Cricket, ' + t.teams + ' teams, ' + t.playersPerTeam + ' players per team, ' + t.overs + ' overs, ' + t.format;
      else detail = 'Football, ' + t.teams + ' teams, ' + t.side + ', ' + t.duration + ' min, ' + t.format;
      div.innerHTML = '<div class="row-main"><h3>' + t.name + '</h3><p>' + detail + '</p><p>' + (t.dates || '') + ' ' + (t.venue || '') + ' Entry Rs ' + (t.fee || '') + '</p></div><span class="tag">JUST CREATED</span>';
      box.appendChild(div);
    });
  }
  savedInit();
})();
