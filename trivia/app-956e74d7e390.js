'use strict';
var app=document.getElementById('app'), connection=document.getElementById('connection');
var state=null, ws=null, session=null, config={publicUrl:null,categories:[{id:'bible',name:'The Bible'}]}, viewKey='', retry=0, retryTimer=null, clockOffset=0, seq=0, priorSelection=null, selectionCleared=false, toastTimer=null, pendingAction=null, manualClose=false;
var runtime=window.HH_TRIVIA_CONFIG||{}, backendOrigin=runtime.backendOrigin||location.origin, pageHome=runtime.publicUrl||new URL(/\/join\/?$/.test(location.pathname)?'../':'.',location.href).href, warming=false, connectGeneration=0, healthRequest=null, socketTimer=null;
var letters=['A','B','C','D'];
function apiPath(path){return backendOrigin+path;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function readSession(){try{return JSON.parse(sessionStorage.getItem('hh-trivia')||'null');}catch(e){return null;}}
function saveSession(){try{if(session)sessionStorage.setItem('hh-trivia',JSON.stringify(session));else sessionStorage.removeItem('hh-trivia');}catch(e){}}
function toast(message){var el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('visible');},4500);}
function send(m){if(!ws||ws.readyState!==1){toast('Reconnecting. Wait for the connection before choosing.');return false;}ws.send(JSON.stringify(m));return true;}
var errors={ROOM_NOT_FOUND:'That room is no longer available. Check the code or start a new room.',ROOM_FULL:'This room already has twenty players.',NAME_TAKEN:'That name is taken. Try a different name.',INVALID_NAME:'Enter a name to join.',LESSON_RUNNING:'The answer is still being revealed. Continue in a moment.',NOT_REVEALING:'The next question is already on its way.',NOT_READY:'Every player must be connected and ready.',OPTION_REMOVED:'That answer is fading out. Choose another one.',NOT_ANSWERING:'The answer window is closed.',STALE_QUESTION:'A new question has started.',STALE_SUBMISSION:'Your newer answer has already been received.',INVALID_TOKEN:'This reconnect link has expired. Rejoin from the home screen.',MATCH_STARTED:'The match has started. You can still watch.',ROOM_EXPIRED:'This room has expired. Start a new room.',NOT_HOST:'Only the host or room captain can do that.',PLAYER_CONNECTED:'Only a disconnected player can be removed in the lobby.',SERVER_FULL:'The server is full. Please try again shortly.'};
function connectionNotice(message,busy){
  var notice=document.getElementById('connect-notice');notice.hidden=!message;
  document.getElementById('connect-message').textContent=message||'';
  document.getElementById('cancel-connect').textContent=busy?'Cancel':'Dismiss';
  ['host','solo','watch','show-join'].forEach(function(id){var button=document.getElementById(id);if(button)button.disabled=busy;});
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
  ws.onopen=function(){retry=0;connection.textContent='Game on!';if(pendingAction){send(pendingAction);pendingAction=null;}else if(session)send(session.token?{type:'resume',code:session.code,token:session.token}:{type:'watch',code:session.code});};
  ws.onmessage=function(event){var m;try{m=JSON.parse(event.data);}catch(e){return;}
    if(m.type==='joined'){clearTimeout(socketTimer);connectionNotice('',false);var rejoining=!!session;session={code:m.code,role:m.role,token:m.token};saveSession();if(m.midGame&&!rejoining)toast('You’re in! Join this question if there’s time. Your score starts at zero.');connection.textContent=m.role==='viewer'?'Watching live':'Game on!';}
    if(m.type==='state'){clockOffset=m.serverNow-performance.now();state=m;seq=Math.max(seq,m.self?m.self.lastSeq+1:0);render();}
    if(m.type==='error'){clearTimeout(socketTimer);connectionNotice('',false);toast(errors[m.code]||'That action is unavailable. Please try again.');if(['INVALID_TOKEN','ROOM_NOT_FOUND','ROOM_EXPIRED'].indexOf(m.code)>=0){leave(false);}else if(!session){manualClose=true;ws.close();connection.textContent='Bring your A-game!';}}
    if(m.type==='answerAccepted'){connection.textContent='Answer saved';if(state&&state.phase==='question'&&state.self&&state.round.id===m.roundId&&m.seq>=state.self.lastSeq){state.self.lastSeq=m.seq;state.self.selection={optionId:m.optionId,potentialPoints:m.potentialPoints};updateRound();}}
  };
  ws.onclose=function(event){clearTimeout(socketTimer);if(manualClose)return;connection.textContent='Reconnecting…';if(state)updateRound();if(event.code===4001){manualClose=true;connection.textContent='Open on another device';toast('This player reconnected in another tab. Return home to join separately.');return;}if(session){retryTimer=setTimeout(function(){connect();},Math.min(10000,1000*Math.pow(1.5,retry++)));}else{connection.textContent='Connection lost';connectionNotice('The game connection was interrupted. Please try again.',false);}};
  ws.onerror=function(){connection.textContent='Connection unavailable';};
}
function leave(showHome){connectGeneration++;warming=false;clearTimeout(socketTimer);if(healthRequest){healthRequest.abort();healthRequest=null;}connectionNotice('',false);manualClose=true;clearTimeout(retryTimer);if(ws)ws.close();ws=null;session=null;state=null;viewKey='';priorSelection=null;saveSession();connection.textContent='Bring your A-game!';if(showHome!==false)history.replaceState(null,'',location.pathname);renderHome();}
function homeSettings(){return {category:'bible',questionsPerRound:5};}
function setScreen(name){app.setAttribute('data-screen',name);}
function renderHome(){
  document.body.classList.remove('learning','playing','player-question');document.getElementById('header-leave').hidden=true;app.classList.remove('large-room','medium-room');setScreen('home');
  app.innerHTML='<section class="home couch-home" id="home-screen"><div class="hero-copy"><h1>Good company.<br><em>Great guesses.</em></h1><p class="game-intro">A trivia game for friends and family. Pick your answers, share a laugh, and learn something new together.</p><div class="hero-actions"><button class="btn" id="host">Host a game</button><button class="btn secondary" id="solo">Play solo</button><button class="btn join-button" id="show-join">Join a room</button></div></div><div class="party-art"><img src="'+esc(new URL('couch-party.png',pageHome).href)+'" alt="" width="1448" height="1086" fetchpriority="high"></div></section><section class="join-screen" id="join-screen" hidden><div class="join-badge"><span aria-hidden="true">✦</span> GAME NIGHT IS CALLING <span aria-hidden="true">✦</span></div><h1>Join the <em>fun!</em></h1><p class="lede">Grab the room code.<br>Pick your game-night name.</p><form id="join" class="join-form"><div><label for="code"><span class="join-step" aria-hidden="true">1</span> Room code</label><input id="code" name="code" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" required></div><div><label for="name"><span class="join-step" aria-hidden="true">2</span> Your game name</label><input id="name" name="name" maxlength="20" placeholder="e.g. Brian" autocomplete="given-name" required></div><button class="btn join-submit" type="submit">Let’s play! <span aria-hidden="true">→</span></button><button class="btn secondary" id="watch" type="button">Watch on this screen</button></form><button class="text-button" id="home-back">← Back</button></section>';
  function showJoin(){setScreen('join');document.getElementById('home-screen').hidden=true;document.getElementById('join-screen').hidden=false;}
  document.getElementById('show-join').onclick=showJoin;
  document.getElementById('home-back').onclick=renderHome;
  document.getElementById('host').onclick=function(){connect({type:'create',settings:homeSettings()});};
  document.getElementById('solo').onclick=function(){connect({type:'create',solo:true,name:'Player 1',settings:homeSettings()});};
  document.getElementById('join').onsubmit=function(e){e.preventDefault();connect({type:'join',code:document.getElementById('code').value.trim().toUpperCase(),name:document.getElementById('name').value});};
  document.getElementById('watch').onclick=function(){var code=document.getElementById('code').value.trim().toUpperCase();if(code.length!==5){toast('Enter the five-character room code first.');return;}connect({type:'watch',code:code});};
  var code=new URLSearchParams(location.search).get('room');if(/\/join\/?$/.test(location.pathname))showJoin();if(code){showJoin();document.getElementById('code').value=code.slice(0,5).toUpperCase();document.getElementById('name').focus();}
}
function joinLink(){return new URL((config.publicUrl||runtime.publicUrl?'join/':'')+'?room='+state.code,config.publicUrl||pageHome).href;}
function setMarkup(id,html){var el=document.getElementById(id);if(el&&el._renderedHTML!==html){el.innerHTML=html;el._renderedHTML=html;}}
function playerRows(results){
  var players=state.players.slice();if(results)players.sort(function(a,b){return b.score-a.score||a.name.localeCompare(b.name);});
  if(!players.length)return '<li class="empty">Waiting for the room captain…</li>';
  return players.map(function(p,i){var detail=p.captain?'Room captain · controls':'Player';if(!p.connected)detail='Reconnecting…';if(results&&p.result)detail=p.result.correct?'+'+p.result.points+' this question':p.result.optionId?'No points this question':'No answer selected';return '<li class="player-row"><span class="avatar">'+(results?state.players.filter(function(other){return other.score>p.score;}).length+1:esc(p.name.charAt(0).toUpperCase()))+'</span><span class="player-name">'+esc(p.name)+(state.self&&state.self.id===p.id?' <small>(you)</small>':'')+'<span class="player-detail">'+detail+'</span></span>'+(results?'<span class="score">'+p.score.toLocaleString()+'</span>':'<span class="player-status" aria-label="'+(p.ready?'Ready':'Getting ready')+'" title="'+(p.ready?'Ready':'Getting ready')+'"><span class="status-mark" aria-hidden="true">'+(p.ready?'✓':'…')+'</span><span class="status-label">'+(p.ready?' Ready':' Getting ready')+'</span></span>')+(!results&&!p.connected&&state.canControl?'<button class="text-button remove-player" data-id="'+p.id+'">Remove</button>':'')+'</li>';}).join('');
}
function render(){if(!state)return;var playerQuestion=!!state.self&&['countdown','question','reveal'].indexOf(state.phase)>=0;document.body.classList.toggle('player-question',playerQuestion);document.getElementById('header-leave').hidden=!playerQuestion;setScreen(state.phase);app.setAttribute('data-player-count',state.players.length);var lobbyRows=Math.max(1,Math.ceil(state.players.length/2));app.setAttribute('style','--lobby-rows:'+lobbyRows+';--lobby-count:'+Math.max(1,state.players.length)+';--phone-lobby-scale:'+Math.min(1,14/Math.max(1,state.players.length)).toFixed(2)+';--lobby-scale:'+Math.min(1,7/lobbyRows).toFixed(2)); app.classList.toggle('large-room',state.players.length>10);app.classList.toggle('medium-room',state.players.length>5);var key=state.phase+':'+(state.round?state.round.id:'');if(key!==viewKey){viewKey=key;if(state.phase==='lobby')buildLobby();else if(state.phase==='finished')buildResults();else if(state.phase==='reveal')buildReveal();else if(state.phase==='intermission')buildIntermission();else if(state.phase==='countdown')buildCountdown();else buildRound();}if(state.phase!=='reveal')document.body.classList.remove('learning');document.body.classList.toggle('playing',state.phase==='question'||state.phase==='reveal');if(state.phase==='lobby')updateLobby();else if(state.phase==='finished')updateResults();else if(state.phase==='reveal'||state.phase==='intermission'||state.phase==='countdown')updateClock();else updateRound();scheduleScoreFit();}
function buildLobby(){
  app.innerHTML='<div class="section-head"><div><h2>Ready, set… trivia!</h2></div><span class="pill">ROOM '+esc(state.code)+'</span></div><div class="room-layout"><section class="panel lobby-players"><div class="settings"><div class="setting-card category-card"><label for="category"><span aria-hidden="true">✦</span> Category</label><select id="category">'+config.categories.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('')+'</select></div><div class="setting-card rounds-card"><label for="questionsPerRound"><span aria-hidden="true">⚡</span> Per round</label><select id="questionsPerRound"><option value="3">3 questions</option><option value="5">5 questions</option><option value="10">10 questions</option></select><span class="round-total" id="round-total"></span></div></div><div class="roster-heading"><div class="side-heading" id="player-count"></div><p id="room-capacity" hidden>Room at max capacity — 20 players!</p></div><ul class="player-list" id="players"></ul><p class="helper" id="lobby-help"></p><div class="lobby-actions"><button class="btn" id="start">Start game →</button></div></section><aside class="lobby-invite"><div class="panel join-panel"><div class="eyebrow">Scan. Join. Play.</div><div class="room-code">'+esc(state.code)+'</div><img class="qr" src="'+esc(apiPath('/api/qr?room='+state.code))+'" alt="Scan to join this game room"><a class="join-link" href="'+esc(joinLink())+'" target="_blank" rel="noopener"><span>HappyHardens.com</span><span>/trivia/join/</span></a><p id="network-help"></p></div></aside></div><p class="tiny"'+(state.self?'':' hidden')+'><button class="text-button" id="leave">Leave room</button></p>';
  ['category','questionsPerRound'].forEach(function(id){document.getElementById(id).onchange=function(){send({type:'settings',settings:{category:document.getElementById('category').value,questionsPerRound:Number(document.getElementById('questionsPerRound').value)}});};});
  document.getElementById('start').onclick=function(){send({type:'start'});};
  document.getElementById('leave').onclick=function(){leave(true);};
  document.getElementById('network-help').textContent='Enter the code above.';
}
var automaticReady=null;
function readyOnJoin(){
  if(!state||state.phase!=='lobby'||!state.self){automaticReady=null;return;}
  var me=state.players.find(function(p){return p.id===state.self.id;});
  if(!me||me.ready){automaticReady=null;return;}
  if(!ws||ws.readyState!==1)return;
  if(automaticReady&&automaticReady.socket===ws&&automaticReady.id===me.id)return;
  automaticReady={socket:ws,id:me.id};
  send({type:'ready',ready:true});
}
function updateLobby(){
  readyOnJoin();
  connection.textContent=ws&&ws.readyState===1?'You’re in!':'Reconnecting…';
  ['category','questionsPerRound'].forEach(function(id){var el=document.getElementById(id);el.disabled=!state.canControl;if(document.activeElement!==el)el.value=state.settings[id];});
  document.getElementById('round-total').textContent=(state.settings.questionsPerRound*3)+' total · 3 rounds';
  setMarkup('players',playerRows(false));document.getElementById('player-count').textContent='THE PLAYERS · '+state.players.length;
  document.getElementById('room-capacity').hidden=state.players.length<state.rules.maxPlayers;
  document.querySelectorAll('.remove-player').forEach(function(el){el.onclick=function(){send({type:'remove',playerId:el.dataset.id});};});
  var start=document.getElementById('start');start.hidden=!state.canControl;start.disabled=!state.players.length||state.players.some(function(p){return !p.ready||!p.connected;});
  document.getElementById('lobby-help').textContent=state.canControl?'Everyone ready? Let’s play!':state.role==='viewer'?'Watching live. Answer on your phone.':'You’re in! Your host will start.';
}
function questionMeta(){
  return '<div class="round-meta"><span class="round-category">THE BIBLE</span><span class="round-number">QUESTION '+state.questionInRound+' OF '+state.settings.questionsPerRound+' · ROUND '+state.matchRound+' / 3</span></div>';
}
function availablePoints(now){
  var rules=state.rules,elapsed=now-state.round.startsAt;
  if(elapsed<0||elapsed>=rules.duration)return 0;
  return Math.max(rules.minPoints,Math.round(rules.maxPoints-(rules.maxPoints-rules.minPoints)*Math.max(0,elapsed-rules.fullPointsFor)/(rules.duration-rules.fullPointsFor)))*state.matchRound;
}
function buildCountdown(){
  buildRound();setMarkup('scores',playerRows(true));
}
function buildRound(){
  var isPreview=state.phase==='countdown';
  var preview=isPreview?null:document.querySelector('.question-preview');
  connection.textContent=ws&&ws.readyState===1?'Game on!':'Reconnecting…';
  priorSelection=null;selectionCleared=false;
  var answerArea=isPreview?'<div class="question-preview"><p>Get your thinking cap on!</p><div class="preview-clock" id="ready-timer">5</div><p>Answers appear when the countdown ends.</p></div>':'<div class="options">'+state.round.options.map(function(o,i){return '<button class="answer" id="option-'+o.id+'" data-option="'+o.id+'"><span class="letter">'+letters[i]+'</span><span>'+esc(o.label)+'</span></button>';}).join('')+'</div>';
  app.innerHTML='<div class="room-layout" id="question-layout"><section class="game-main'+(isPreview?' preview-round':'')+'"><div id="offline"></div><div class="round-top">'+questionMeta()+'<div class="live-stats"><div class="available-points"><strong class="points-value" id="points-available">'+state.rules.maxPoints*state.matchRound+'</strong><span class="stat-label">Points available</span></div><div class="timer" id="timer" aria-label="Seconds remaining">20</div></div></div><div class="time-track"><div class="time-fill" id="time-fill"></div></div><h2 class="question">'+esc(state.round.question)+'</h2><div class="answer-stage">'+answerArea+'</div><div class="selection-status" id="selection-status" role="status" aria-live="polite">'+(state.self?'Make your pick. You can change it until the timer ends.':'Choose on your device. You can change your answer until time runs out.')+'</div><div id="reveal"></div></section><aside><div class="leaderboard panel"><div class="side-heading">A little friendly competition</div><ul class="player-list" id="scores"></ul></div><div class="board-code"><img class="board-qr" src="'+esc(apiPath('/api/qr?room='+state.code))+'" alt="Scan to join this game"><div class="board-join-details"><span class="board-join-title">Scan to join</span><strong>'+esc(state.code)+'</strong><span class="board-join-url">HappyHardens.com/trivia</span><span class="board-join-note">Join any time</span></div></div></aside></div>';
  if(preview){
    preview.classList.add('preview-departing');preview.setAttribute('aria-hidden','true');
    var previewTimer=preview.querySelector('.preview-clock');if(previewTimer)previewTimer.textContent='0';
    document.querySelector('.answer-stage').appendChild(preview);
    setTimeout(function(){if(preview.parentNode)preview.parentNode.removeChild(preview);},1000);
  }
  document.querySelectorAll('.answer').forEach(function(b){b.onclick=function(){if(send({type:'answer',roundId:state.round.id,optionId:b.dataset.option,seq:seq++})){document.getElementById('selection-status').textContent='Saving your choice…';}};});

}
function updateRound(){
  if(!state||state.phase!=='question'||!state.round||!document.getElementById('timer'))return;
  var selected=state.self&&state.self.selection;var active=ws&&ws.readyState===1;var reveal=state.phase==='reveal';
  if(priorSelection&&!selected&&!reveal){selectionCleared=true;connection.textContent='Choose again';}
  if(selected)selectionCleared=false;priorSelection=selected;
  document.getElementById('offline').innerHTML=active?'':'<div class="offline-banner">Connection interrupted. The match continues. Reconnecting your device…</div>';
  state.round.options.forEach(function(o){var b=document.getElementById('option-'+o.id);b.disabled=!active||!state.self||state.phase!=='question'||o.removed;b.classList.toggle('removed',o.removed);b.classList.toggle('selected',!!selected&&selected.optionId===o.id);b.classList.toggle('correct',reveal&&state.round.answerId===o.id);b.classList.toggle('wrong-selection',reveal&&!!selected&&selected.optionId===o.id&&state.round.answerId!==o.id);b.setAttribute('aria-pressed',selected&&selected.optionId===o.id?'true':'false');b.setAttribute('aria-label',letters[state.round.options.indexOf(o)]+'. '+o.label+(o.removed?' — eliminated':''));});
  setMarkup('scores',playerRows(true));
  var status=document.getElementById('selection-status');
  if(!state.self){status.textContent='Choose on your device. You can change your answer until time runs out.';}
  else if(selectionCleared){status.textContent='Your choice was eliminated. Choose another answer!';}
  else if(selected){var index=state.round.options.findIndex(function(o){return o.id===selected.optionId;});status.textContent=letters[index]+' selected · '+selected.potentialPoints+' points if correct. You can change it until the timer ends.';}
  else status.textContent='Make your pick. You can change it until the timer ends.';
  updateClock();
}
function updateClock(){
  if(!state)return;
  if(state.phase==='countdown'){var el=document.getElementById('ready-timer');if(el)el.textContent=Math.max(0,Math.ceil((state.round.startsAt-performance.now()-clockOffset)/1000));return;}
  if(state.phase==='intermission'){var el=document.getElementById('break-timer');if(el)el.textContent=Math.max(0,Math.ceil((state.intermissionEndsAt-performance.now()-clockOffset)/1000));return;}
  if(state.phase==='reveal'){
    var now=performance.now()+clockOffset;
    if(!document.getElementById('learning-answer')&&now>=state.round.revealStartedAt+state.rules.fade)buildLearning();
    if(document.getElementById('learning-answer')){
      setScreen('learning');updateLearning();
      var button=document.getElementById('continue');if(button){button.disabled=now<state.round.lessonStartsAt||!ws||ws.readyState!==1;button.textContent=state.questionNumber===state.totalQuestions?'Show final scores →':'Continue →';}
    }return;
  }
  if(!state.round)return;var now=performance.now()+clockOffset,r=state.round,remaining;var timer=document.getElementById('timer');if(!timer)return;
  var fill=document.getElementById('time-fill');
  var points=document.getElementById('points-available');if(points)points.textContent=availablePoints(now);
  {remaining=Math.max(0,r.endsAt-now);timer.textContent=Math.ceil(remaining/1000);fill.style.transform='scaleX('+Math.min(1,remaining/20000)+')';if(remaining===0)document.querySelectorAll('.answer').forEach(function(b){b.disabled=true;});}
  timer.classList.toggle('urgent',state.phase==='question'&&remaining<=5000);
}
function buildReveal(){
  if(!document.querySelector('.options')){buildLearning();return;}
  state.round.options.forEach(function(o){var b=document.getElementById('option-'+o.id);b.disabled=true;b.classList.remove('selected');if(o.id===state.round.answerId){b.classList.remove('removed','final-fade');b.classList.add('correct');}else{b.classList.add('removed');if(!o.removed)b.classList.add('final-fade');}});
  var points=document.getElementById('points-available');if(points)points.textContent='0';
  document.getElementById('timer').textContent='0';document.getElementById('time-fill').style.transform='scaleX(0)';document.getElementById('selection-status').textContent='Time’s up — the correct answer is highlighted.';
  var me=state.self&&state.players.find(function(p){return p.id===state.self.id;});
  if(me&&me.result&&me.result.correct){
    document.getElementById('selection-status').textContent='You got it! +'+me.result.points+' points.';
    var celebration=document.createElement('div');celebration.className='answer-celebration';celebration.setAttribute('role','status');
    celebration.innerHTML='<div class="celebration-message"><strong>You got it!</strong><span>+'+me.result.points+' points</span></div><div class="confetti" aria-hidden="true">'+Array.from({length:18},function(_,i){return '<i class="confetti-bit" style="--x:'+(5+(i*37)%90)+'%;--delay:'+(i%5)*.06+'s;--spin:'+(180+i*41)+'deg"></i>';}).join('')+'</div>';
    document.querySelector('.game-main').appendChild(celebration);
  }
}
var lessonContentKey='';
function fadingQuestionScreen(answerId){
  var layer=document.createElement('div');layer.className='departing-question';layer.setAttribute('aria-hidden','true');
  [document.querySelector('.topbar'),app].forEach(function(source){
    if(!source)return;
    var rect=source.getBoundingClientRect(),copy=source.cloneNode(true);
    var answer=copy.querySelector('[id="option-'+answerId+'"]');if(answer)Array.prototype.forEach.call(answer.children,function(part){part.style.visibility='hidden';});
    copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(function(node){node.removeAttribute('id');});
    copy.style.position='absolute';copy.style.left=rect.left+'px';copy.style.top=rect.top+'px';
    copy.style.width=rect.width+'px';copy.style.height=rect.height+'px';copy.style.maxWidth='none';copy.style.margin='0';copy.style.display='flex';
    layer.appendChild(copy);
  });
  document.body.appendChild(layer);
  setTimeout(function(){if(layer.parentNode)layer.parentNode.removeChild(layer);},1100);
}
function buildLearning(){
  var r=state.round,answer=r.options.find(function(o){return o.id===r.answerId;}),letter=letters[r.options.indexOf(answer)];
  var old=document.getElementById('option-'+answer.id),oldLabel=old&&old.children[1];
  var from=oldLabel?oldLabel.getBoundingClientRect():null,oldStyle=old?window.getComputedStyle(old):null;
  var oldSize=oldStyle?parseFloat(oldStyle.fontSize):0,oldFamily=oldStyle&&oldStyle.fontFamily,oldWeight=oldStyle&&oldStyle.fontWeight;
  var skip=!from||performance.now()+clockOffset>=r.lessonStartsAt;
  if(!skip)fadingQuestionScreen(answer.id);
  document.body.classList.add('learning');setScreen('learning');lessonContentKey='';
  app.innerHTML='<section class="learning-screen"><div class="learning-answer" id="learning-answer"><span class="learning-letter">'+letter+'.</span> <span class="learning-label">'+esc(answer.label)+'</span></div><div class="lesson-layout"><div class="lesson-reading"><h3 class="lesson-heading">The story behind the answer</h3><p class="learning-fact">'+esc(r.explanation)+'</p><section class="verse-card" aria-label="Bible passage"><h3 id="verse-reference">'+esc(r.reference.label)+' · NLT</h3><p id="verse-text" aria-live="polite" tabindex="0" aria-label="Bible verses">Loading the passage…</p><p class="verse-credit" id="verse-credit"></p></section></div><aside class="lesson-scores"><h3>Points this question</h3><p class="your-gain" id="your-gain"></p><ol class="lesson-score-list" id="lesson-scores"></ol></aside></div><div class="lesson-footer"><p class="helper">Talk it over, then let any player tap Continue on their phone to keep the fun going.</p>'+(state.self?'<button class="btn" id="continue">Continue →</button>':'')+'</div></section>';
  if(state.self)document.getElementById('continue').onclick=function(){send({type:'continue',roundId:state.round.id});};
  var el=document.getElementById('learning-answer');
  if(skip)document.querySelector('.learning-screen').classList.add('skip-animation');
  el.style.animation='none';
  if(oldSize){el.style.fontSize=(oldSize*2)+'px';el.style.fontFamily=oldFamily;el.style.fontWeight=oldWeight;}
  updateLearning();
  if(!skip){
    var to=el.getBoundingClientRect(),label=el.querySelector('.learning-label').getBoundingClientRect();
    var scale=.5,cx=to.left+to.width/2,cy=to.top+to.height/2;
    el.style.setProperty('--answer-start-x',(from.left+from.width/2-cx-scale*(label.left+label.width/2-cx))+'px');
    el.style.setProperty('--answer-start-y',(from.top+from.height/2-cy-scale*(label.top+label.height/2-cy))+'px');
    el.style.setProperty('--answer-start-scale',scale);
  }
  el.style.removeProperty('animation');
}
function updateLearning(){
  if(!document.getElementById('verse-text'))return;
  var scripture=state.round.scripture||{status:'loading'},verses=scripture.verses||[];
  var key=JSON.stringify([scripture,state.players]);if(key===lessonContentKey)return;lessonContentKey=key;
  var text=document.getElementById('verse-text');
  text.textContent=verses.length?verses.map(function(verse){return verse.number+' '+verse.text;}).join(' '):scripture.status==='unavailable'?'The passage could not load right now. You can still discuss the lesson and continue.':'Loading the passage…';
  document.getElementById('verse-reference').textContent=state.round.reference.label+' · NLT';
  document.getElementById('verse-credit').textContent=scripture.status==='ready'?(scripture.credit||'NLT · Tyndale House Publishers'):'';
  var players=state.players.slice().sort(function(a,b){return ((b.result&&b.result.points)||0)-((a.result&&a.result.points)||0)||b.score-a.score;});
  document.getElementById('lesson-scores').parentNode.style.setProperty('--lesson-count',Math.min(9,players.length));
  setMarkup('lesson-scores',players.slice(0,9).map(function(p){return '<li><span class="gain-name">'+esc(p.name)+'</span><strong>+'+((p.result&&p.result.points)||0)+'</strong></li>';}).join(''));
  var self=state.self&&players.find(function(p){return p.id===state.self.id;});document.getElementById('your-gain').textContent=self?'You earned +'+((self.result&&self.result.points)||0)+' points':'';
  scheduleScoreFit();
}
function buildIntermission(){
  app.innerHTML='<section class="results"><header class="results-heading"><div class="eyebrow">ROUND '+state.matchRound+' COMPLETE</div><h1>The stakes are rising!</h1><p>Next round: '+(state.matchRound+1)+'× points</p></header><div class="scoreboard">'+finalScorecard(state.players.slice().sort(function(a,b){return b.score-a.score;}))+'</div><div class="break-countdown">Next round in <strong id="break-timer">8</strong></div></section>';
}
// Fit unusually long names/numbers within the available score rows, without truncating them.
var scoreFitFrame=0;
function scheduleScoreFit(){
  if(!window.requestAnimationFrame||scoreFitFrame)return;
  scoreFitFrame=window.requestAnimationFrame(function(){
    scoreFitFrame=0;
    document.querySelectorAll('.score-table tbody th,.score-table tbody td,#players .player-name,#scores .player-name,.gain-name,#verse-text').forEach(function(cell){
      cell.style.fontSize='';
      if(cell.id==='verse-text'&&window.innerWidth<=700)return;
      var size=parseFloat(window.getComputedStyle(cell).fontSize);
      while(size>8&&(cell.scrollHeight>cell.clientHeight+1||cell.scrollWidth>cell.clientWidth+1)){size-=1;cell.style.fontSize=size+'px';}
    });
  });
}
if(window.addEventListener)window.addEventListener('resize',scheduleScoreFit);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(scheduleScoreFit);
function finalScorecard(players){
  function table(group){return '<table class="score-table"><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col"><abbr title="Round 1">R1</abbr></th><th scope="col"><abbr title="Round 2">R2</abbr></th><th scope="col"><abbr title="Round 3">R3</abbr></th><th scope="col">Total</th></tr></thead><tbody>'+group.map(function(p){var rank=players.findIndex(function(other){return other.score===p.score;})+1;return '<tr class="'+(rank===1?'first-place':'')+'"><td class="final-rank">'+(rank===1?'★':rank)+'</td><th scope="row" class="final-name">'+esc(p.name)+'</th>'+p.roundScores.map(function(score,index){return '<td data-label="Round '+(index+1)+'">'+score.toLocaleString()+'</td>';}).join('')+'<td class="final-total" data-label="Total">'+p.score.toLocaleString()+'</td></tr>';}).join('')+'</tbody></table>';}
  var split=players.length>10?Math.ceil(players.length/2):players.length;
  return table(players.slice(0,split))+(split<players.length?table(players.slice(split)):'');
}
function buildResults(){app.innerHTML='<section class="results"><header class="results-heading"><div class="eyebrow">THAT’S A WRAP!</div><h1 id="winner"></h1><p>Good guesses. Great company.</p></header><div class="scoreboard" id="final-scores" tabindex="0" role="region" aria-label="Final scores"></div><div class="results-actions"><button class="btn" id="rematch">Play again ↗</button><button class="btn secondary" id="leave">Back to home</button></div><p class="tiny" id="results-help"></p></section>';document.getElementById('rematch').onclick=function(){send({type:'rematch'});};document.getElementById('leave').onclick=function(){leave(true);};}
function updateResults(){var players=state.players.slice().sort(function(a,b){return b.score-a.score;});var top=players.filter(function(p){return p.score===players[0].score;});document.getElementById('winner').textContent=players.length===1?players[0].score.toLocaleString()+' points. Nice work!':top.length>1?'A shared victory!':top[0].name+' takes the crown!';setMarkup('final-scores',finalScorecard(players));document.getElementById('rematch').hidden=!state.canRematch;document.getElementById('results-help').textContent=state.canRematch?'One more? Play again returns everyone to the lobby.':'Any player can start the next game.';}
document.getElementById('cancel-connect').onclick=function(){leave(true);};
document.getElementById('header-leave').onclick=function(){leave(true);};
document.getElementById('fullscreen').onclick=function(){if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen();};
document.addEventListener('keydown',function(e){if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.repeat)return;var i=letters.indexOf(e.key.toUpperCase());if(i>=0&&state&&state.phase==='question'){var b=document.getElementById('option-'+state.round.options[i].id);if(b&&!b.disabled)b.click();}});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&session&&ws&&ws.readyState===1)send({type:'sync'});});
setInterval(updateClock,100);
fetch(apiPath('/api/config'),{credentials:'omit'}).then(function(r){return r.json();}).then(function(c){config=c;}).catch(function(){});
session=readSession();if(session){app.innerHTML='<div class="panel"><h2>Welcome back.</h2><p>Reconnecting to your room…</p><button class="btn secondary" id="reset">Back to home</button></div>';document.getElementById('reset').onclick=function(){leave(true);};connect();}else renderHome();
