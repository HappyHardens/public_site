'use strict';
var app=document.getElementById('app'), connection=document.getElementById('connection');
var state=null, ws=null, session=null, config={publicUrl:null,categories:[{id:'bible',name:'The Bible'}]}, viewKey='', retry=0, retryTimer=null, clockOffset=0, seq=0, priorSelection=null, selectionCleared=false, toastTimer=null, pendingAction=null, manualClose=false;
var runtime=window.HH_TRIVIA_CONFIG||{}, backendOrigin=runtime.backendOrigin||location.origin, pageHome=runtime.publicUrl||new URL('.',location.href).href, warming=false, connectGeneration=0, healthRequest=null, socketTimer=null;
var letters=['A','B','C','D'];
function apiPath(path){return backendOrigin+path;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function readSession(){try{return JSON.parse(sessionStorage.getItem('hh-trivia')||'null');}catch(e){return null;}}
function saveSession(){try{if(session)sessionStorage.setItem('hh-trivia',JSON.stringify(session));else sessionStorage.removeItem('hh-trivia');}catch(e){}}
function toast(message){var el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('visible');},4500);}
function send(m){if(!ws||ws.readyState!==1){toast('Reconnecting. Wait for the connection before choosing.');return false;}ws.send(JSON.stringify(m));return true;}
var errors={ROOM_NOT_FOUND:'That room is no longer available. Check the code or start a new room.',ROOM_FULL:'This room already has twenty players.',NAME_TAKEN:'That name is taken. Try a different name.',INVALID_NAME:'Enter a name to join.',LESSON_RUNNING:'Take a moment to read the lesson. Continue will be ready when the countdown ends.',NOT_REVEALING:'The next question is already on its way.',NOT_READY:'Every player must be connected and ready.',OPTION_REMOVED:'That answer is fading out. Choose another one.',NOT_ANSWERING:'The answer window is closed.',STALE_QUESTION:'A new question has started.',STALE_SUBMISSION:'Your newer answer has already been received.',INVALID_TOKEN:'This reconnect link has expired. Rejoin from the home screen.',MATCH_STARTED:'The match has started. You can still watch.',ROOM_EXPIRED:'This room has expired. Start a new room.',NOT_HOST:'Only the host or room captain can do that.',PLAYER_CONNECTED:'Only a disconnected player can be removed in the lobby.',SERVER_FULL:'The server is full. Please try again shortly.'};
function connectionNotice(message,busy){
  var notice=document.getElementById('connect-notice');notice.hidden=!message;
  document.getElementById('connect-message').textContent=message||'';
  document.getElementById('cancel-connect').textContent=busy?'Cancel':'Dismiss';
  ['host','solo','watch'].forEach(function(id){var button=document.getElementById(id);if(button)button.disabled=busy;});
  var join=document.getElementById('join');if(join)Array.prototype.forEach.call(join.querySelectorAll('button'),function(button){button.disabled=busy;});
}
function connect(action){
  if(warming||(ws&&(ws.readyState===0||ws.readyState===1)))return;
  clearTimeout(retryTimer);connectionNotice('Opening your game. This can take about a minute if the server is waking up.',true);
  if(backendOrigin===location.origin){openSocket(action);return;}
  warming=true;manualClose=false;var generation=++connectGeneration,deadline=Date.now()+90000;
  connection.textContent='Waking up the game server…';
  function attempt(){
    if(generation!==connectGeneration)return;
    // XMLHttpRequest timeout works on TV browsers that lack AbortController.
    var request=new XMLHttpRequest(),settled=false;healthRequest=request;
    function finish(ok){
      if(settled)return;settled=true;if(generation!==connectGeneration)return;healthRequest=null;
      if(ok){warming=false;openSocket(action);return;}
      if(Date.now()<deadline){retryTimer=setTimeout(attempt,2500);}else{warming=false;connection.textContent='Please try again';connectionNotice('We could not reach the game server. Please try again. If it keeps happening, check this device’s internet connection.',false);}
    }
    request.onload=function(){var ok=false;try{ok=request.status===200&&JSON.parse(request.responseText).ok===true;}catch(e){}finish(ok);};
    request.onerror=request.ontimeout=function(){finish(false);};
    try{request.open('GET',apiPath('/health'),true);request.timeout=8000;request.send();}catch(e){finish(false);}
  }
  attempt();
}
function openSocket(action){
  if(action&&ws&&(ws.readyState===0||ws.readyState===1))return;
  pendingAction=action||null;manualClose=false;clearTimeout(retryTimer);connection.textContent='Connecting…';
  try{ws=new WebSocket(backendOrigin.replace(/^http/,'ws')+'/ws');}catch(e){connection.textContent='Connection unavailable';connectionNotice('This browser could not open the game connection. Please try again or use another browser.',false);return;}
  var socket=ws;socketTimer=setTimeout(function(){if(ws===socket&&!session){connection.textContent='Please try again';manualClose=true;socket.close();ws=null;connectionNotice('The game connection timed out. Please try again.',false);}},15000);
  ws.onopen=function(){retry=0;connection.textContent='Connected';if(pendingAction){send(pendingAction);pendingAction=null;}else if(session)send(session.token?{type:'resume',code:session.code,token:session.token}:{type:'watch',code:session.code});};
  ws.onmessage=function(event){var m;try{m=JSON.parse(event.data);}catch(e){return;}
    if(m.type==='joined'){clearTimeout(socketTimer);connectionNotice('',false);var rejoining=!!session;session={code:m.code,role:m.role,token:m.token};saveSession();if(m.midGame&&!rejoining)toast('You’re in! Join this question if there’s time. Your score starts at zero.');connection.textContent=m.role==='viewer'?'Watching live':'Connected';}
    if(m.type==='state'){clockOffset=m.serverNow-performance.now();state=m;seq=Math.max(seq,m.self?m.self.lastSeq+1:0);render();}
    if(m.type==='error'){clearTimeout(socketTimer);connectionNotice('',false);toast(errors[m.code]||'That action is unavailable. Please try again.');if(['INVALID_TOKEN','ROOM_NOT_FOUND','ROOM_EXPIRED'].indexOf(m.code)>=0){leave(false);}else if(!session){manualClose=true;ws.close();connection.textContent='Let’s play';}}
    if(m.type==='answerAccepted'){connection.textContent='Answer saved';}
  };
  ws.onclose=function(event){clearTimeout(socketTimer);if(manualClose)return;connection.textContent='Reconnecting…';if(state)updateRound();if(event.code===4001){manualClose=true;connection.textContent='Open on another device';toast('This player reconnected in another tab. Return home to join separately.');return;}if(session){retryTimer=setTimeout(function(){connect();},Math.min(10000,1000*Math.pow(1.5,retry++)));}else{connection.textContent='Connection lost';connectionNotice('The game connection was interrupted. Please try again.',false);}};
  ws.onerror=function(){connection.textContent='Connection unavailable';};
}
function leave(showHome){connectGeneration++;warming=false;clearTimeout(socketTimer);if(healthRequest){healthRequest.abort();healthRequest=null;}connectionNotice('',false);manualClose=true;clearTimeout(retryTimer);if(ws)ws.close();ws=null;session=null;state=null;viewKey='';priorSelection=null;saveSession();connection.textContent='Let’s play';if(showHome!==false)history.replaceState(null,'',location.pathname);renderHome();}
function homeSettings(){return {category:'bible',questionsPerRound:5};}
function renderHome(){
  document.body.classList.remove('learning','playing');
  app.innerHTML='<section class="home"><div class="hero-copy"><div class="eyebrow">The next great game night</div><h1>A little knowledge.<br><em>A lot of friendly<br>competition.</em></h1><p class="lede">Four answers. One ticking clock. Trust your first instinct—or change your mind as the choices fade.</p><div class="hero-actions"><button class="btn" id="host">Host a game <span aria-hidden="true">↗</span></button><button class="btn secondary" id="solo">Play solo</button></div><p class="tiny">Use this screen as the game board. Everyone joins on their own phone.</p><div class="fact-row"><span><strong>1–20</strong>players</span><span><strong>20 sec</strong>to decide</span><span><strong>3 rounds</strong>growing challenge</span></div></div><div class="showcase"><div class="eyebrow">Category no. 01</div><div class="book-symbol" aria-hidden="true">✦</div><h2>The Bible</h2><p>Familiar stories. Surprising details.<br>Something for every level of knowledge.</p><div class="preview-options" aria-hidden="true"><div class="preview-option"><b>A</b> Make your pick</div><div class="preview-option"><b>B</b> Change your mind</div><div class="preview-option"><b>C</b> Going…</div><div class="preview-option"><b>D</b> Going…</div></div></div></section><section class="join-strip"><div><h3>Have a room code?</h3><span class="tiny">Your phone is your answer sheet.</span></div><form id="join" class="join-form"><div><label for="code">ROOM CODE</label><input id="code" name="code" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" required></div><div><label for="name">YOUR NAME</label><input id="name" name="name" maxlength="20" placeholder="e.g. Brian" autocomplete="given-name" required></div><button class="btn" type="submit">Join game</button><button class="text-button" id="watch" type="button">Watch on this screen</button></form></section><footer class="home-footer tiny"><span>HAPPY HARDENS · GOOD COMPANY. GREAT GAMES.</span><span>Original questions · Scripture references in NLT</span></footer>';
  document.getElementById('host').onclick=function(){connect({type:'create',settings:homeSettings()});};
  document.getElementById('solo').onclick=function(){connect({type:'create',solo:true,name:'Player 1',settings:homeSettings()});};
  document.getElementById('join').onsubmit=function(e){e.preventDefault();connect({type:'join',code:document.getElementById('code').value.trim().toUpperCase(),name:document.getElementById('name').value});};
  document.getElementById('watch').onclick=function(){var code=document.getElementById('code').value.trim().toUpperCase();if(code.length!==5){toast('Enter the five-character room code first.');return;}connect({type:'watch',code:code});};
  var code=new URLSearchParams(location.search).get('room');if(code){document.getElementById('code').value=code.slice(0,5).toUpperCase();document.getElementById('name').focus();}
}
function joinLink(){return new URL('?room='+state.code,config.publicUrl||pageHome).href;}
function setMarkup(id,html){var el=document.getElementById(id);if(el&&el._renderedHTML!==html){el.innerHTML=html;el._renderedHTML=html;}}
function playerRows(results){
  var players=state.players.slice();if(results)players.sort(function(a,b){return b.score-a.score||a.name.localeCompare(b.name);});
  if(!players.length)return '<li class="empty">Waiting for the room captain…</li>';
  var totalPlayers=players.length;if(results&&players.length>8){var own=state.self&&players.find(function(p){return p.id===state.self.id;});players=players.slice(0,6);if(own&&!players.some(function(p){return p.id===own.id;}))players.push(own);}
  return players.map(function(p,i){var detail=p.captain?'Room captain · controls':'Player';if(!p.connected)detail='Reconnecting…';if(results&&p.result)detail=p.result.correct?'+'+p.result.points+' this question':p.result.optionId?'No points this question':'No answer selected';return '<li class="player-row"><span class="avatar">'+(results?state.players.filter(function(other){return other.score>p.score;}).length+1:esc(p.name.charAt(0).toUpperCase()))+'</span><span class="player-name">'+esc(p.name)+(state.self&&state.self.id===p.id?' <small>(you)</small>':'')+'<span class="player-detail">'+detail+'</span></span>'+(results?'<span class="score">'+p.score.toLocaleString()+'</span>':'<span class="player-status">'+(p.ready?'✓ Ready':'Getting ready')+'</span>')+(!results&&!p.connected&&state.canControl?'<button class="text-button remove-player" data-id="'+p.id+'">Remove</button>':'')+'</li>';}).join('')+(results&&totalPlayers>8?'<li class="leaderboard-more tiny">Showing leaders'+(state.self?' and your place':'')+' · '+totalPlayers+' players total</li>':'');
}
function render(){if(!state)return;var key=state.phase+':'+(state.round?state.round.id:'');if(key!==viewKey){viewKey=key;if(state.phase==='lobby')buildLobby();else if(state.phase==='finished')buildResults();else if(state.phase==='reveal')buildReveal();else if(state.phase==='intermission')buildIntermission();else if(state.phase==='countdown')buildCountdown();else buildRound();}if(state.phase!=='reveal')document.body.classList.remove('learning');document.body.classList.toggle('playing',state.phase==='question'||state.phase==='reveal');if(state.phase==='lobby')updateLobby();else if(state.phase==='finished')updateResults();else if(state.phase==='reveal'||state.phase==='intermission'||state.phase==='countdown')updateClock();else updateRound();}
function buildLobby(){
  app.innerHTML='<div class="section-head"><div><div class="eyebrow">Make yourself at home</div><h2>The room is yours.</h2><p class="tiny">Pick a category, gather your people, and get ready.</p></div><span class="pill">ROOM '+esc(state.code)+'</span></div><div class="room-layout"><section class="panel"><div class="settings"><div><label for="category">CATEGORY</label><select id="category">'+config.categories.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('')+'</select></div><div><label for="questionsPerRound">PER ROUND</label><select id="questionsPerRound"><option value="3">3 questions · 9 total</option><option value="5">5 questions · 15 total</option><option value="10">10 questions · 30 total</option></select></div></div><div class="side-heading" id="player-count"></div><ul class="player-list" id="players"></ul><div class="lobby-actions"><button class="btn secondary" id="ready">I’m ready</button><button class="btn" id="start">Start game →</button></div><p class="helper" id="lobby-help"></p></section><aside><div class="panel join-panel"><div class="eyebrow">Scan. Join. Play.</div><div class="room-code">'+esc(state.code)+'</div><img class="qr" src="'+esc(apiPath('/api/qr?room='+state.code))+'" alt="Scan to join this game room"><a class="join-link" href="'+esc(joinLink())+'" target="_blank" rel="noopener">'+esc(joinLink())+'</a><p id="network-help"></p><button class="btn light" id="copy-link">Copy join link</button></div><div class="rules-summary"><strong>Here’s the twist.</strong>Three rounds: easy for 100, medium for 200, and difficult for 300 points. Full points for the first 3 seconds, then the value counts down. Wrong answers fade at 8 and 14 seconds. Change your choice until time runs out, then learn the story behind the answer.</div></aside></div><p class="tiny"><button class="text-button" id="leave">Leave room</button> · Scripture references open in NLT after each reveal.</p>';
  ['category','questionsPerRound'].forEach(function(id){document.getElementById(id).onchange=function(){send({type:'settings',settings:{category:document.getElementById('category').value,questionsPerRound:Number(document.getElementById('questionsPerRound').value)}});};});
  document.getElementById('ready').onclick=function(){var p=state.players.find(function(p){return p.id===state.self.id;});send({type:'ready',ready:!p.ready});};
  document.getElementById('start').onclick=function(){send({type:'start'});};
  document.getElementById('leave').onclick=function(){leave(true);};
  document.getElementById('copy-link').onclick=function(){if(navigator.clipboard)navigator.clipboard.writeText(joinLink()).then(function(){toast('Join link copied.');},function(){toast('Copy the link shown above.');});else toast('Copy the link shown above.');};
  document.getElementById('network-help').textContent=/localhost|127\.0\.0\.1/.test(joinLink())?'For phones, open this screen using the server’s LAN address first.':'Share this link with your players. Each device needs access to this server.';
}
function updateLobby(){
  ['category','questionsPerRound'].forEach(function(id){var el=document.getElementById(id);el.disabled=!state.canControl;if(document.activeElement!==el)el.value=state.settings[id];});
  setMarkup('players',playerRows(false));document.getElementById('player-count').textContent='THE PLAYERS · '+state.players.length+' / '+state.rules.maxPlayers;
  document.querySelectorAll('.remove-player').forEach(function(el){el.onclick=function(){send({type:'remove',playerId:el.dataset.id});};});
  var ready=document.getElementById('ready');ready.hidden=!state.self;if(state.self){var p=state.players.find(function(p){return p.id===state.self.id;});ready.textContent=p.ready?'✓ Ready · tap to undo':'I’m ready';}
  var start=document.getElementById('start');start.hidden=!state.canControl;start.disabled=!state.players.length||state.players.some(function(p){return !p.ready||!p.connected;});
  document.getElementById('lobby-help').textContent=state.canControl?'Start when everyone is connected and ready. Changing settings resets readiness.':state.role==='viewer'?'You’re watching. Players answer on their own devices.':'Mark yourself ready. The host or room captain will start the game.';
}
function buildCountdown(){connection.textContent=ws&&ws.readyState===1?'Connected':'Reconnecting…';app.innerHTML='<section class="results"><div class="eyebrow">ROUND '+state.matchRound+' · '+state.round.difficulty.toUpperCase()+'</div><h1>Get ready.</h1><p>Question '+state.questionInRound+' of '+state.settings.questionsPerRound+' · Up to '+(100*state.matchRound)+' points</p><div class="ready-clock" id="ready-timer">3</div></section>';}
function buildRound(){
  connection.textContent=ws&&ws.readyState===1?'Connected':'Reconnecting…';
  priorSelection=null;selectionCleared=false;
  app.innerHTML='<div class="room-layout"><section class="game-main"><div id="offline"></div><div class="round-top"><div class="round-meta">THE BIBLE <span class="tiny">/ '+state.round.difficulty.toUpperCase()+'</span><div class="tiny round-number">QUESTION '+state.questionInRound+' OF '+state.settings.questionsPerRound+' · ROUND '+state.matchRound+' / 3 · '+state.matchRound+'× POINTS</div></div><div class="live-stats"><div><span class="points-value" id="points">100</span><span class="stat-label" id="points-label">Points available</span></div><div class="timer" id="timer" aria-label="Seconds remaining">20</div></div></div><div class="time-track"><div class="time-fill" id="time-fill"></div></div><h2 class="question">'+esc(state.round.question)+'</h2><div class="options">'+state.round.options.map(function(o,i){return '<button class="answer" id="option-'+o.id+'" data-option="'+o.id+'"><span class="letter">'+letters[i]+'</span><span>'+esc(o.label)+'</span></button>';}).join('')+'</div><div class="selection-status" id="selection-status" role="status" aria-live="polite"></div><div id="reveal"></div></section><aside><div class="leaderboard panel"><div class="side-heading">A little friendly competition</div><ul class="player-list" id="scores"></ul></div><div class="board-code">HAPPY HARDENS TRIVIA<strong>'+esc(state.code)+'</strong><img class="board-qr" src="'+esc(apiPath('/api/qr?room='+state.code))+'" alt="Scan to join this game">Join any time. Answer on your own device.</div></aside></div><button class="text-button" id="leave">Leave room</button>';
  document.querySelectorAll('.answer').forEach(function(b){b.onclick=function(){if(send({type:'answer',roundId:state.round.id,optionId:b.dataset.option,seq:seq++})){document.getElementById('selection-status').textContent='Saving your choice…';}};});
  document.getElementById('leave').onclick=function(){leave(true);};
}
function updateRound(){
  if(!state||state.phase!=='question'||!state.round||!document.getElementById('timer'))return;
  var selected=state.self&&state.self.selection;var active=ws&&ws.readyState===1;var reveal=state.phase==='reveal';
  if(priorSelection&&!selected&&!reveal){selectionCleared=true;connection.textContent='Choose again';}
  if(selected)selectionCleared=false;priorSelection=selected;
  document.getElementById('offline').innerHTML=active?'':'<div class="offline-banner">Connection interrupted. The match continues. Reconnecting your device…</div>';
  state.round.options.forEach(function(o){var b=document.getElementById('option-'+o.id);b.disabled=!active||!state.self||state.phase!=='question'||o.removed;b.classList.toggle('removed',o.removed);b.classList.toggle('selected',!!selected&&selected.optionId===o.id);b.classList.toggle('correct',reveal&&state.round.answerId===o.id);b.classList.toggle('wrong-selection',reveal&&!!selected&&selected.optionId===o.id&&state.round.answerId!==o.id);b.setAttribute('aria-pressed',selected&&selected.optionId===o.id?'true':'false');b.setAttribute('aria-label',letters[state.round.options.indexOf(o)]+'. '+o.label+(o.removed?' — removed':''));});
  setMarkup('scores',playerRows(true));
  var status=document.getElementById('selection-status');
  if(!state.self){status.textContent='Choose on your device. You can change your answer until time runs out.';}
  else if(selectionCleared){status.textContent='Your choice faded out. Choose another answer!';}
  else if(selected){var index=state.round.options.findIndex(function(o){return o.id===selected.optionId;});status.textContent=letters[index]+' selected · worth '+selected.potentialPoints+' points if correct. You can still change it.';}
  else status.textContent='Make your pick. You can change it until the timer ends.';
  updateClock();
}
function updateClock(){
  if(!state)return;
  if(state.phase==='countdown'){var el=document.getElementById('ready-timer');if(el)el.textContent=Math.max(0,Math.ceil((state.round.startsAt-performance.now()-clockOffset)/1000));return;}
  if(state.phase==='intermission'){var el=document.getElementById('break-timer');if(el)el.textContent=Math.max(0,Math.ceil((state.intermissionEndsAt-performance.now()-clockOffset)/1000));return;}
  if(state.phase==='reveal'){var now=performance.now()+clockOffset;if(!document.getElementById('learning-timer')&&now>=state.round.revealStartedAt+state.rules.fade)buildLearning();var el=document.getElementById('learning-timer'),seconds=Math.min(15,Math.max(0,Math.ceil((state.round.revealEndsAt-now)/1000)));if(el)el.textContent=seconds;var button=document.getElementById('continue');if(button){button.disabled=seconds>0||!ws||ws.readyState!==1;button.textContent=seconds>0?'Continue in '+seconds+' seconds':state.questionNumber===state.totalQuestions?'Show final scores →':'Continue →';}var help=document.getElementById('learning-help');if(help)help.textContent=seconds>0?'A moment to read. Then continue when you’re ready.':state.self?'Take your time. Any player can continue for the group.':'Discuss together. Continue on any player’s phone when you’re ready.';return;}
  if(!state.round)return;var now=performance.now()+clockOffset,r=state.round,remaining;var timer=document.getElementById('timer');if(!timer)return;
  var points=document.getElementById('points'),label=document.getElementById('points-label'),fill=document.getElementById('time-fill');
  {remaining=Math.max(0,r.endsAt-now);timer.textContent=Math.ceil(remaining/1000);points.textContent=(remaining>0?Math.max(state.rules.minPoints,Math.round(state.rules.maxPoints-(state.rules.maxPoints-state.rules.minPoints)*Math.max(0,now-r.startsAt-state.rules.fullPointsFor)/(state.rules.duration-state.rules.fullPointsFor)))*state.matchRound:0).toLocaleString();label.textContent='Points available';fill.style.transform='scaleX('+Math.min(1,remaining/20000)+')';if(remaining===0)document.querySelectorAll('.answer').forEach(function(b){b.disabled=true;});}
  timer.classList.toggle('urgent',state.phase==='question'&&remaining<=5000);
}
function buildReveal(){
  if(!document.querySelector('.options')){buildLearning();return;}
  state.round.options.forEach(function(o){var b=document.getElementById('option-'+o.id);b.disabled=true;b.classList.remove('selected');if(o.id!==state.round.answerId){b.classList.add('removed');if(!o.removed)b.classList.add('final-fade');}});
  document.getElementById('timer').textContent='0';document.getElementById('points').textContent='0';document.getElementById('time-fill').style.transform='scaleX(0)';document.getElementById('selection-status').textContent='Time’s up…';
}
function buildLearning(){
  var r=state.round, answer=r.options.find(function(o){return o.id===r.answerId;}), letter=letters[r.options.indexOf(answer)];
  var old=document.getElementById('option-'+answer.id), fromTop=old?old.getBoundingClientRect().top:window.innerHeight*.4;
  document.body.classList.add('learning');
  app.innerHTML='<section class="learning-screen"><div class="learning-answer" id="learning-answer"><span class="learning-letter">'+letter+'.</span> '+esc(answer.label)+'</div><div class="learning-detail"><div class="eyebrow">The story behind the answer</div><p class="learning-fact">'+esc(r.explanation)+'</p><a class="scripture" href="'+esc(r.reference.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.reference.label)+' · Read in NLT ↗</a><div class="learning-countdown"><span id="learning-timer">15</span><span>'+(state.questionNumber===state.totalQuestions?'Final results':state.questionInRound===state.settings.questionsPerRound?'Round scores':'Next question')+' when you continue</span></div><p class="helper" id="learning-help"></p>'+(state.self?'<button class="btn" id="continue" disabled>Continue</button>':'')+'</div></section>';
  if(state.self)document.getElementById('continue').onclick=function(){send({type:'continue',roundId:state.round.id});};
  var el=document.getElementById('learning-answer');el.style.setProperty('--answer-start-y',Math.max(0,fromTop-window.innerHeight*.08)+'px');if(performance.now()+clockOffset>=r.lessonStartsAt)document.querySelector('.learning-screen').classList.add('skip-animation');
}
function buildIntermission(){
  app.innerHTML='<section class="results"><div class="eyebrow">ROUND '+state.matchRound+' COMPLETE</div><h1>The stakes are rising.</h1><p class="lede results-lede">Round '+(state.matchRound+1)+' is worth '+(state.matchRound+1)+'× points per question.</p><div class="panel"><div class="side-heading">The scores so far</div><ul class="player-list">'+playerRows(true)+'</ul></div><div class="break-countdown">Next round in <strong id="break-timer">8</strong></div></section>';
}
function finalScorecard(players){
  return players.map(function(p,i){var rank=players.findIndex(function(other){return other.score===p.score;})+1;return '<article class="final-player '+(rank===1?'first-place':'')+'"><div class="final-person"><span class="final-rank">'+(rank===1?'✦':'#'+rank)+'</span><div><span class="place-label">'+(rank===1?(players.length===1?'YOUR SCORE':'FIRST PLACE'):'PLACE '+rank)+'</span><strong>'+esc(p.name)+'</strong></div><div class="final-total"><strong>'+p.score.toLocaleString()+'</strong><span>TOTAL POINTS</span></div></div><div class="round-scores">'+p.roundScores.map(function(score,n){return '<div><span>ROUND '+(n+1)+'</span><strong>'+score.toLocaleString()+'</strong></div>';}).join('')+'</div></article>';}).join('');
}
function buildResults(){app.innerHTML='<section class="results"><div class="eyebrow">That’s a wrap</div><div class="trophy" aria-hidden="true">✦</div><h1 id="winner"></h1><p class="lede results-lede">Good guesses. Great company. One more round?</p><div class="panel"><div class="side-heading">The final scores</div><div id="final-scores"></div></div><div class="results-actions"><button class="btn" id="rematch">Play again ↗</button><button class="btn secondary" id="leave">Back to home</button></div><p class="tiny" id="results-help"></p></section>';document.getElementById('rematch').onclick=function(){send({type:'rematch'});};document.getElementById('leave').onclick=function(){leave(true);};}
function updateResults(){var players=state.players.slice().sort(function(a,b){return b.score-a.score;});var top=players.filter(function(p){return p.score===players[0].score;});document.getElementById('winner').textContent=players.length===1?players[0].score.toLocaleString()+' points. Nicely played.':top.length>1?'A shared victory!':top[0].name+' takes the win!';setMarkup('final-scores',finalScorecard(players));document.getElementById('rematch').hidden=!state.canRematch;document.getElementById('results-help').textContent=state.canRematch?'Play again to return to the lobby and choose your next match.':'Any player can start a rematch.';}
document.getElementById('cancel-connect').onclick=function(){leave(true);};
document.getElementById('fullscreen').onclick=function(){if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen();};
document.addEventListener('keydown',function(e){if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.repeat)return;var i=letters.indexOf(e.key.toUpperCase());if(i>=0&&state&&state.phase==='question'){var b=document.getElementById('option-'+state.round.options[i].id);if(b&&!b.disabled)b.click();}});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&session&&ws&&ws.readyState===1)send({type:'sync'});});
setInterval(updateClock,100);
fetch(apiPath('/api/config'),{credentials:'omit'}).then(function(r){return r.json();}).then(function(c){config=c;}).catch(function(){});
session=readSession();if(session){app.innerHTML='<div class="panel"><h2>Welcome back.</h2><p>Reconnecting to your room…</p><button class="btn secondary" id="reset">Back to home</button></div>';document.getElementById('reset').onclick=function(){leave(true);};connect();}else renderHome();
