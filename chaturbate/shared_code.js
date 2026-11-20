/*
 * AFTERDARK BROTHERHOOD — Shared Code
 * Version: 0.1.1
 * Paste into the Chaturbate Developer Portal "Shared Code" editor.
 *
 * Chaturbate SDK access is injected by event handlers through LBC.runtime.
 */
var LBC = (function () {
  "use strict";

  var PREFIX = "lbc_v1_";
  var GAME_TIMEOUT_LABEL = "lbc_guess_number_timeout";
  var GAME_SECONDS = 90;
  var MIN_GUESS = 1;
  var MAX_GUESS = 100;
  var MAX_SCORE_ENTRIES = 100;

  function readJson(key, fallback) {
    try {
      var raw = LBC.runtime.kvGet(PREFIX + key, "");
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      return LBC.runtime.kvSet(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      return false;
    }
  }

  function now() {
    return Math.floor(Date.now() / 1000);
  }

  function cleanName(value) {
    return String(value || "someone").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25) || "someone";
  }

  function notice(text, options) {
    try {
      LBC.runtime.sendNotice(String(text), options || {});
    } catch (err) {
      // A notice failure must never crash the app's event handler.
    }
  }

  function getGame() {
    return readJson("game", {
      type: "idle",
      active: false,
      secret: null,
      guesses: {},
      startedAt: 0,
      endsAt: 0
    });
  }

  function saveGame(game) {
    writeJson("game", game);
  }

  function getRecords() {
    return readJson("records", { rounds: 0, wins: {}, recentWinners: [] });
  }

  function saveRecords(records) {
    writeJson("records", records);
  }

  function getScoreboardLines(records, limit) {
    var rows = [];
    var wins = records && records.wins ? records.wins : {};
    Object.keys(wins).forEach(function (name) {
      rows.push({ name: name, wins: Number(wins[name]) || 0 });
    });
    rows.sort(function (a, b) {
      return b.wins - a.wins || a.name.localeCompare(b.name);
    });
    return rows.slice(0, limit || 5).map(function (row, index) {
      return (index + 1) + ". " + row.name + " — " + row.wins + " win" + (row.wins === 1 ? "" : "s");
    });
  }

  function helpText() {
    return [
      "🖤 AFTERDARK BROTHERHOOD — BROTHERHOOD",
      "No map. No supervision. Questionable decisions.",
      "",
      "FREE GAME: GUESS THE NUMBER",
      "When a round is active, type: !guess 42",
      "Pick a whole number from 1 to 100. One guess per person.",
      "",
      "Room commands:",
      "!ab — show this help",
      "!game — show the current game",
      "!scoreboard — show brotherhood records",
      "!points / !rewards — free-play loyalty points and reward shelf",
      "",
      "Broadcaster controls:",
      "/ab start — start a 90-second round",
      "/ab stop — end the current round"
    ].join("\n");
  }

  function statusText() {
    var game = getGame();
    if (!game.active) return "🎮 No game running. The brotherhood is unsupervised.";
    var count = Object.keys(game.guesses || {}).length;
    return "🎯 GUESS THE NUMBER is live! Pick 1–100 with !guess <number>. " +
      count + " player" + (count === 1 ? "" : "s") + " entered. " +
      "Time left: " + Math.max(0, game.endsAt - now()) + "s.";
  }

  function startGuessGame() {
    var current = getGame();
    if (current.active) {
      notice("The current round is already running. Please don't make the brotherhood manage two disasters at once.");
      return;
    }

    var secret = Math.floor(Math.random() * (MAX_GUESS - MIN_GUESS + 1)) + MIN_GUESS;
    var game = {
      type: "guess_number",
      active: true,
      secret: secret,
      guesses: {},
      startedAt: now(),
      endsAt: now() + GAME_SECONDS
    };

    saveGame(game);
    try {
      LBC.runtime.cancelCallback(GAME_TIMEOUT_LABEL);
      LBC.runtime.createCallback(GAME_TIMEOUT_LABEL, GAME_SECONDS, false);
    } catch (err) {
      // The round remains playable; broadcaster can end it manually.
    }

    notice(
      "🖤 AFTERDARK BROTHERHOOD GAME TIME 🖤\n" +
      "GUESS THE NUMBER: I'm thinking of a number from 1 to 100.\n" +
      "Type !guess followed by your number. One guess each.\n" +
      "You have " + GAME_SECONDS + " seconds. No tips, entry fees, or purchases required.\n" +
      "Let's see who has at least one functioning brain cell."
    );
  }

  function finishGuessGame(reason) {
    var game = getGame();
    if (!game.active || game.type !== "guess_number") return;

    game.active = false;
    saveGame(game);

    var records = getRecords();
    records.rounds = (Number(records.rounds) || 0) + 1;

    var guessers = Object.keys(game.guesses || {});
    var winner = null;
    guessers.forEach(function (name) {
      if (Number(game.guesses[name]) === Number(game.secret)) winner = name;
    });

    if (winner) {
      records.wins[winner] = (Number(records.wins[winner]) || 0) + 1;
      if (LBC.rewards) LBC.rewards.award(winner, 5, "Guess the Number win", "win:guess:" + game.startedAt + ":" + winner.toLowerCase());
      records.recentWinners.unshift({ name: winner, at: now() });
      records.recentWinners = records.recentWinners.slice(0, 10);
      saveRecords(records);
      notice("🏆 BROTHERHOOD WINNER: " + winner + " got it. The number was " + game.secret + ". Enjoy your wildly temporary superiority.");
    } else {
      saveRecords(records);
      notice(
        (reason === "timeout" ? "⏰ Time's up." : "🛑 Round ended.") +
        " Nobody nailed it. The number was " + game.secret +
        ". " + guessers.length + " guess" + (guessers.length === 1 ? "" : "es") + " submitted. The brotherhood remains intellectually unsupervised."
      );
    }
  }

  function submitGuess(username, rawGuess) {
    var game = getGame();
    if (!game.active || game.type !== "guess_number") {
      notice("There's no number game running right now. The boys are currently making other questionable decisions.", { toUsername: username });
      return;
    }

    var guess = Number(rawGuess);
    if (!Number.isInteger(guess) || guess < MIN_GUESS || guess > MAX_GUESS) {
      notice("Your guess needs to be a whole number from 1 to 100.", { toUsername: username });
      return;
    }

    var key = cleanName(username).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(game.guesses, key)) {
      notice("You've already used your guess this round. One brain cell, one shot.", { toUsername: username });
      return;
    }

    game.guesses[key] = guess;
    saveGame(game);
    if (LBC.rewards) LBC.rewards.award(username, 1, "Guess the Number participation", "play:guess:" + game.startedAt + ":" + key);

    if (guess === Number(game.secret)) {
      finishGuessGame("winner");
    } else {
      var hint = guess < Number(game.secret) ? "higher" : "lower";
      notice("Guess locked for " + cleanName(username) + ". Try " + hint + ".", { toUsername: username });
    }
  }

  function scoreboard() {
    var records = getRecords();
    var lines = getScoreboardLines(records, 5);
    notice(
      "🏚️ AFTERDARK BROTHERHOOD — HALL OF SHAME / FAME\n" +
      "Rounds played: " + (Number(records.rounds) || 0) + "\n" +
      (lines.length ? lines.join("\n") : "No winners yet. A clean slate of questionable potential.")
    );
  }

  function welcome(username) {
    var safe = cleanName(username);
    var key = "welcome_" + safe.toLowerCase();
    var last = Number(LBC.runtime.kvGet(PREFIX + key, "0")) || 0;
    var current = now();

    // One welcome per user per 6 hours, avoiding noisy repeat greetings.
    if (current - last < 21600) return;
    LBC.runtime.kvSet(PREFIX + key, String(current), 86400);

    notice("🖤 " + safe + " wandered into AFTERDARK BROTHERHOOD. No map, no supervision, questionable decisions. Make yourself comfortable.");
  }

  function onChatMessage(rawBody, rawUsername, isOwner) {
    var body = String(rawBody || "").trim();
    if (!body) return;

    var username = cleanName(rawUsername);
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab start") {
      startGuessGame();
      return;
    }
    if (isOwner && lower === "/ab stop") {
      finishGuessGame("manual");
      return;
    }

    if (lower === "!ab" || lower === "!ab help") {
      notice(helpText(), { toUsername: username });
      return;
    }
    if (lower === "!game") {
      notice(statusText(), { toUsername: username });
      return;
    }
    if (lower === "!scoreboard") {
      scoreboard();
      return;
    }

    var match = lower.match(/^!guess\s+([0-9]{1,3})$/);
    if (match) {
      submitGuess(username, match[1]);
      return;
    }

    // Broadcaster-only command help. Do not react to ordinary conversation.
    if (isOwner && lower === "/ab help") {
      notice(helpText(), { toUsername: username });
    }
  }

  function onCallback(label) {
    if (label === GAME_TIMEOUT_LABEL) finishGuessGame("timeout");
  }

  function onTip(tokens, isAnon, username) {
    // Tips are acknowledged, never treated as paid game entry or a wager.
    var safe = isAnon ? "A generous mystery human" : cleanName(username);
    if (Number(tokens) > 0) {
      notice("🖤 " + safe + " tossed " + Number(tokens) + " tokens into the brotherhood. Much appreciated. No game advantage attached.");
    }
  }

  function panelData() {
    var game = getGame();
    var records = getRecords();
    var leaders = getScoreboardLines(records, 1);
    return {
      game: game,
      rounds: Number(records.rounds) || 0,
      leader: leaders.length ? leaders[0] : "No champion yet"
    };
  }

  return {
    version: "0.1.1",
    helpText: helpText,
    statusText: statusText,
    startGuessGame: startGuessGame,
    finishGuessGame: finishGuessGame,
    onChatMessage: onChatMessage,
    onUserEnter: welcome,
    onCallback: onCallback,
    onTip: onTip,
    panelData: panelData,
    notice: notice
  };
}());

/*
 * AFTERDARK BROTHERHOOD — EVENT HANDLER BRIDGE
 * Shared Code never calls the Chaturbate SDK directly. Event handlers
 * inject platform methods through this runtime facade.
 */
(function () {
  "use strict";
  var runtime = {};
  LBC.setRuntime = function (api) { runtime = api || {}; };
  LBC.runtime = {
    kvGet: function (key, fallback) { try { return typeof runtime.kvGet === "function" ? runtime.kvGet(key, fallback) : fallback; } catch (err) { return fallback; } },
    kvSet: function (key, value, ttlSeconds) { try { return typeof runtime.kvSet === "function" ? runtime.kvSet(key, value, ttlSeconds) : false; } catch (err) { return false; } },
    sendNotice: function (message, options) { try { return typeof runtime.sendNotice === "function" ? runtime.sendNotice(String(message), options || {}) : false; } catch (err) { return false; } },
    createCallback: function (label, seconds, repeat) { try { return typeof runtime.createCallback === "function" ? runtime.createCallback(label, seconds, repeat) : false; } catch (err) { return false; } },
    cancelCallback: function (label) { try { return typeof runtime.cancelCallback === "function" ? runtime.cancelCallback(label) : false; } catch (err) { return false; } },
    reloadPanel: function () { try { return typeof runtime.reloadPanel === "function" ? runtime.reloadPanel() : false; } catch (err) { return false; } },
    setPanelTemplate: function (template) { try { return typeof runtime.setPanelTemplate === "function" ? runtime.setPanelTemplate(template) : false; } catch (err) { return false; } }
  };
}());

/*
 * AFTERDARK BROTHERHOOD — ADVANCED GOAL ENGINE
 * Multi-stage goals, configurable milestones, pause/resume, extensions and queued goals.
 */
(function () {
  "use strict";
  var KEY="lbc_m2_room_goal", STATS="lbc_m2_tip_stats", DEFAULTS=[25,50,75,100];
  function json(k,d){try{var r=LBC.runtime.kvGet(k,"");return r?JSON.parse(r):d;}catch(e){return d;}}
  function total(){return Math.max(0,Number(json(STATS,{}).totalTokens)||0);}
  function cleanTitle(v){return String(v||"Brotherhood Goal").replace(/[\r\n\t]/g," ").replace(/\s+/g," ").trim().slice(0,48)||"Brotherhood Goal";}
  function read(){var g=json(KEY,{});return {version:2,target:Math.max(0,Number(g.target)||0),title:cleanTitle(g.title),startTotal:Math.max(0,Number(g.startTotal)||0),active:g.active===true,paused:g.paused===true,pausedTotal:Math.max(0,Number(g.pausedTotal)||0),completed:g.completed===true,milestones:Array.isArray(g.milestones)&&g.milestones.length?g.milestones:DEFAULTS.slice(),reached:g.reached&&typeof g.reached==="object"?g.reached:{},queue:Array.isArray(g.queue)?g.queue.slice(0,10):[],lastCompleted:g.lastCompleted||null};}
  function save(g){LBC.runtime.kvSet(KEY,JSON.stringify(g));LBC.runtime.reloadPanel();}
  function snap(g){if(!g||!g.target)return null;var p=Math.max(0,total()-g.startTotal);return {shown:Math.min(p,g.target),percent:Math.min(100,Math.floor(p/g.target*100))};}
  function activate(g,t,n){g.target=t;g.title=cleanTitle(n);g.startTotal=total();g.active=true;g.paused=false;g.pausedTotal=0;g.completed=false;g.reached={};}
  function status(){var g=read(),s=snap(g);if(!s){LBC.notice("No room goal is active. Use /ab goal set 1000 Title to launch one.");return;}LBC.notice("🏁 "+g.title.toUpperCase()+"\n"+(g.paused?"PAUSED":g.active?"LIVE":g.completed?"REACHED":"OFF")+" · "+s.shown+" / "+g.target+" tokens · "+s.percent+"%"+(g.queue.length?"\nQueued goals: "+g.queue.length:"")+"\nSupport is voluntary. Tipping does not award points or game advantages.");}
  LBC.handleRoomGoalCommand=function(raw,isOwner){
    var body=String(raw||"").trim(),low=body.toLowerCase(),m,g=read();
    if(low==="!goal"||low==="!clubgoal"){status();return;}
    if(!isOwner||low.indexOf("/ab goal")!==0)return;
    if((m=body.match(/^\/ab goal(?:\s+set)?\s+([1-9][0-9]{0,6})(?:\s+(.+))?$/i))){activate(g,Number(m[1]),m[2]);save(g);LBC.notice("🏁 Goal started: "+g.title+" · "+g.target+" tokens.");return;}
    if((m=body.match(/^\/ab goal queue\s+([1-9][0-9]{0,6})(?:\s+(.+))?$/i))){if(g.queue.length>=10){LBC.notice("Goal queue is full (10).");return;}g.queue.push({target:Number(m[1]),title:cleanTitle(m[2])});save(g);LBC.notice("Queued goal #"+g.queue.length+": "+g.queue[g.queue.length-1].title+".");return;}
    if(low==="/ab goal queue list"){LBC.notice(g.queue.length?"UPCOMING GOALS\n"+g.queue.map(function(x,i){return (i+1)+". "+x.title+" — "+x.target+" tokens";}).join("\n"):"No queued goals.");return;}
    if(low==="/ab goal queue clear"){g.queue=[];save(g);LBC.notice("Goal queue cleared.");return;}
    if((m=low.match(/^\/ab goal milestones\s+(.+)$/))){var p=m[1].split(/[,\s]+/),marks=[];for(var i=0;i<p.length;i++){var n=Number(p[i]);if(!Number.isInteger(n)||n<1||n>100){LBC.notice("Use whole percentages from 1 to 100.");return;}if(marks.indexOf(n)<0)marks.push(n);}if(marks.indexOf(100)<0)marks.push(100);marks.sort(function(a,b){return a-b;});g.milestones=marks.slice(0,10);g.reached={};save(g);LBC.notice("Milestones set: "+g.milestones.join("%, ")+"%.");return;}
    if((m=low.match(/^\/ab goal extend\s+([1-9][0-9]{0,6})$/))){if(!g.active){LBC.notice("No active goal to extend.");return;}g.target+=Number(m[1]);g.paused=false;g.completed=false;save(g);LBC.notice("Goal extended. New target: "+g.target+" tokens.");return;}
    if(low==="/ab goal pause"){if(!g.active){LBC.notice("No active goal to pause.");return;}g.paused=true;g.pausedTotal=total();save(g);LBC.notice("Goal paused. Tips received while paused will not count.");return;}
    if(low==="/ab goal resume"){if(!g.active){LBC.notice("No active goal to resume.");return;}g.startTotal+=Math.max(0,total()-g.pausedTotal);g.pausedTotal=0;g.paused=false;save(g);LBC.notice("Goal resumed. Tips received during the pause were excluded.");return;}
    if(low==="/ab goal reset"){if(!g.target){LBC.notice("Set a goal first.");return;}g.startTotal=total();g.active=true;g.paused=false;g.pausedTotal=0;g.completed=false;g.reached={};save(g);LBC.notice("Goal reset to 0 / "+g.target+".");return;}
    if(low==="/ab goal off"){g.active=false;g.paused=false;g.pausedTotal=0;g.completed=false;save(g);LBC.notice("Current goal switched off. Queue preserved.");return;}
    if(low==="/ab goal status"){status();return;}
    LBC.notice("GOAL: /ab goal set 1000 Title · queue 1500 Next Goal · pause · resume · reset · extend 250 · milestones 10 25 50 75 100 · queue list · queue clear · off. Viewers: !goal.");
  };
  LBC.processRoomGoalTip=function(tokens){if(!(Number(tokens)>0))return;var g=read();if(!g.active||g.paused)return;var s=snap(g);if(!s)return;g.milestones.forEach(function(mark){var k=String(mark);if(s.percent>=mark&&!g.reached[k]){g.reached[k]=true;LBC.notice(mark===100?"🏁 GOAL REACHED — "+g.title+" · "+g.target+" tokens. Thank you.":"🏚️ "+g.title+" reached "+mark+"% · "+s.shown+" / "+g.target+" tokens.");}});if(s.percent>=100){g.active=false;g.completed=true;g.paused=false;g.lastCompleted={title:g.title,target:g.target,at:Date.now()};if(g.queue.length){var next=g.queue.shift();activate(g,Number(next.target),next.title);LBC.notice("🏁 NEXT GOAL: "+g.title+" · "+g.target+" tokens. Progress starts now.");}}save(g);};
  LBC.updateGoalPanel=function(){var g=read(),s=snap(g);if(!s)return;var p=LBC.panelData();LBC.runtime.setPanelTemplate({template:"3_rows_of_labels",row1_label:"AFTERDARK BROTHERHOOD",row1_value:(p.game&&p.game.active)?"GAME LIVE":"BROTHERHOOD OPEN",row2_label:cleanTitle(g.title).toUpperCase().slice(0,18),row2_value:(g.paused?"PAUSED · ":g.active?"":g.completed?"REACHED · ":"OFF · ")+s.shown+"/"+g.target+" · "+s.percent+"%",row3_label:"HALL OF FAME",row3_value:(p.leader||"No champion yet")+" · "+(Number(p.rounds)||0)+" rounds"});};
}());

/*
 * AFTERDARK BROTHERHOOD — LOYALTY & REWARDS
 * Points come from free game participation and wins, never from tips.
 * Redemption requests are broadcaster-reviewed; no cash value or random prizes.
 */
(function () {
  "use strict";
  var USER="lbc_ab_rewards_user_",CAT="lbc_ab_rewards_catalog",REQ="lbc_ab_rewards_requests",NEXT="lbc_ab_rewards_next_id";
  function clean(v){return String(v||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,25);}
  function read(k,d){try{var x=LBC.runtime.kvGet(k,"");return x?JSON.parse(x):d;}catch(e){return d;}}
  function write(k,v){return LBC.runtime.kvSet(k,JSON.stringify(v));}
  function getUser(name){var n=clean(name);if(!n)return null;var p=read(USER+n.toLowerCase(),{});return {username:n,balance:Math.max(0,Number(p.balance)||0),earned:Math.max(0,Number(p.earned)||0),spent:Math.max(0,Number(p.spent)||0),ids:Array.isArray(p.ids)?p.ids.slice(-30):[],history:Array.isArray(p.history)?p.history.slice(0,8):[]};}
  function saveUser(p){return p?write(USER+p.username.toLowerCase(),p):false;}
  function catalog(){var a=read(CAT,[]);return Array.isArray(a)?a.slice(0,12):[];}
  function requests(){var a=read(REQ,[]);return Array.isArray(a)?a.slice(-50):[];}
  function award(name,amount,reason,id){var p=getUser(name),n=Math.floor(Number(amount)||0),key=String(id||"");if(!p||n<1||n>1000||(key&&p.ids.indexOf(key)>=0))return false;p.balance=Math.min(1000000,p.balance+n);p.earned+=n;p.history.unshift({kind:"earned",points:n,reason:String(reason||"Free game activity").slice(0,45),at:Date.now()});p.history=p.history.slice(0,8);if(key){p.ids.push(key);p.ids=p.ids.slice(-30);}return saveUser(p);}
  function showCatalog(){var a=catalog();LBC.notice(a.length?"🖤 BROTHERHOOD REWARDS\n"+a.map(function(x){return "#"+x.id+" · "+x.cost+" pts — "+x.name;}).join("\n")+"\nRedeem with !redeem <number>. Points are earned by free game participation.":"Rewards shelf empty. Broadcaster: /ab rewards add 100 Reward name.");}
  function review(id,approve){var a=requests(),r=null;for(var i=0;i<a.length;i++)if(Number(a[i].id)===id){r=a[i];break;}if(!r||r.status!=="pending"){LBC.notice("Pending reward request not found.");return;}r.status=approve?"approved":"denied";if(!approve){var p=getUser(r.user);if(p){p.balance+=r.cost;p.spent=Math.max(0,p.spent-r.cost);p.history.unshift({kind:"refund",points:r.cost,reason:"Request #"+id+" denied",at:Date.now()});saveUser(p);}}write(REQ,a);LBC.notice(approve?"Approved #"+id+": "+r.user+" — "+r.name+". Broadcaster fulfillment is now due.":"Denied #"+id+"; "+r.cost+" points refunded to "+r.user+".");LBC.notice(approve?"Your reward request #"+id+" was approved: "+r.name+".":"Your reward request #"+id+" was declined; points refunded.",{toUsername:r.user});}
  function redeem(user,itemId){var name=clean(user),a=catalog(),item=null;for(var i=0;i<a.length;i++)if(Number(a[i].id)===Number(itemId)){item=a[i];break;}if(!item){LBC.notice("That reward is not available.",{toUsername:name});return;}var p=getUser(name),list=requests(),pending=list.filter(function(r){return r.user.toLowerCase()===name.toLowerCase()&&r.status==="pending";});if(pending.length>=3){LBC.notice("You have three pending reward requests already.",{toUsername:name});return;}if(!p||p.balance<item.cost){LBC.notice("You need "+item.cost+" points. Your balance is "+(p?p.balance:0)+".",{toUsername:name});return;}var id=Math.max(1,Number(LBC.runtime.kvGet(NEXT,"1"))||1);LBC.runtime.kvSet(NEXT,String(id+1));p.balance-=item.cost;p.spent+=item.cost;p.history.unshift({kind:"reserved",points:item.cost,reason:"Request #"+id,at:Date.now()});saveUser(p);list.push({id:id,user:name,itemId:item.id,name:item.name,cost:item.cost,status:"pending",at:Date.now()});write(REQ,list.slice(-50));LBC.notice("Reward request #"+id+" submitted: "+item.name+". The broadcaster will review it.",{toUsername:name});LBC.notice(name+" requested reward #"+id+": "+item.name+" ("+item.cost+" points).");}
  LBC.rewards={version:"1.0",award:award,balance:function(name){var p=getUser(name);return p?p.balance:0;}};
  LBC.handleRewardsCommand=function(raw,user,isOwner){var body=String(raw||"").trim(),low=body.toLowerCase(),m;if(low==="!points"){var p=getUser(user);if(p)LBC.notice(p.username+" · "+p.balance+" BROTHERHOOD POINTS\nEarned: "+p.earned+" · Redeemed: "+p.spent+"\nPoints cannot be purchased or earned by tipping.",{toUsername:p.username});return;}if(low==="!rewards"){showCatalog();return;}if((m=body.match(/^!redeem\s+([1-9][0-9]{0,3})$/i))){redeem(user,Number(m[1]));return;}if(!isOwner||(low.indexOf("/ab rewards")!==0&&low.indexOf("/ab points")!==0))return;
    if((m=body.match(/^\/ab rewards add\s+([1-9][0-9]{0,5})\s+(.{2,60})$/i))){var a=catalog();if(a.length>=12){LBC.notice("Rewards shelf is full (12 items).");return;}var id=a.reduce(function(max,x){return Math.max(max,Number(x.id)||0);},0)+1;var name=String(m[2]).replace(/[\r\n\t]/g," ").replace(/\s+/g," ").trim().slice(0,60);a.push({id:id,cost:Number(m[1]),name:name});write(CAT,a);LBC.notice("Added reward #"+id+": "+name+" · "+m[1]+" points.");return;}
    if((m=low.match(/^\/ab rewards remove\s+([1-9][0-9]{0,3})$/))){var rid=Number(m[1]),old=catalog(),next=old.filter(function(x){return Number(x.id)!==rid;});if(next.length===old.length){LBC.notice("Reward not found.");return;}write(CAT,next);LBC.notice("Reward #"+rid+" removed.");return;}
    if((m=low.match(/^\/ab rewards (approve|deny)\s+([1-9][0-9]{0,4})$/))){review(Number(m[2]),m[1]==="approve");return;}
    if(low==="/ab rewards pending"){var q=requests().filter(function(x){return x.status==="pending";});LBC.notice(q.length?"PENDING REWARDS\n"+q.map(function(x){return "#"+x.id+" "+x.user+" — "+x.name+" ("+x.cost+" pts)";}).join("\n"):"No pending reward requests.");return;}
    if(low==="/ab rewards"||low==="/ab rewards list"){showCatalog();return;}
    if((m=body.match(/^\/ab points grant\s+([A-Za-z0-9_-]{1,25})\s+([1-9][0-9]{0,2})$/i))){if(award(m[1],Number(m[2]),"Broadcaster bonus","admin:"+Date.now()+":"+Math.random()))LBC.notice("Granted "+m[2]+" points to "+clean(m[1])+".");return;}
    LBC.notice("REWARDS: /ab rewards add 100 Reward name · remove 1 · pending · approve 1 · deny 1 · list. POINTS: /ab points grant username 10. VIEWERS: !points · !rewards · !redeem 1.");
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Configurable Tip Menu
 * Informational display only.
 */
(function () {
  "use strict";

  var MENU_KEY = "lbc_m2_tip_menu";
  var MAX_ITEMS = 12;
  var MAX_LABEL_LENGTH = 70;

  function readMenu() {
    try {
      var raw = LBC.runtime.kvGet(MENU_KEY, "");
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && Number(item.amount) > 0 && String(item.label || "").trim();
      }).slice(0, MAX_ITEMS);
    } catch (err) {
      return [];
    }
  }

  function saveMenu(items) {
    LBC.runtime.kvSet(MENU_KEY, JSON.stringify(items));
  }

  function cleanLabel(value) {
    return String(value || "")
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_LABEL_LENGTH);
  }

  function showMenu() {
    var items = readMenu();

    if (!items.length) {
      LBC.notice("🏚️ The AFTERDARK BROTHERHOOD tip menu is empty.");
      return;
    }

    var lines = items.map(function (item, index) {
      return (index + 1) + ". " + Number(item.amount) +
        " tokens — " + cleanLabel(item.label);
    });

    LBC.notice(
      "🖤 AFTERDARK BROTHERHOOD — TIP MENU\n" +
      lines.join("\n") +
      "\n\nTips are voluntary. Menu items are requests, not guaranteed outcomes. No game access or advantage is tied to tipping."
    );
  }

  LBC.handleTipMenuCommand = function (rawBody, isOwner) {
    var body = String(rawBody || "").trim();
    var lower = body.toLowerCase();

    if (lower === "!tipmenu" || lower === "!menu") {
      showMenu();
      return;
    }

    if (!isOwner || lower.indexOf("/ab menu") !== 0) return;

    var addMatch = body.match(/^\/ab menu add ([1-9][0-9]{0,4}) (.{1,200})$/i);

    if (addMatch) {
      var amount = Number(addMatch[1]);
      var label = cleanLabel(addMatch[2]);

      if (!label) {
        LBC.notice("Give the menu item a short label.");
        return;
      }

      var items = readMenu();

      if (items.length >= MAX_ITEMS) {
        LBC.notice("The tip menu is full. Remove an item before adding another.");
        return;
      }

      if (items.some(function (item) {
        return Number(item.amount) === amount;
      })) {
        LBC.notice("That token amount is already in the menu.");
        return;
      }

      items.push({ amount: amount, label: label });
      items.sort(function (a, b) {
        return a.amount - b.amount;
      });

      saveMenu(items);
      LBC.notice("Added: " + amount + " tokens — " + label + ". View with !tipmenu.");
      return;
    }

    var removeMatch = lower.match(/^\/ab menu remove ([1-9][0-9]?)$/);

    if (removeMatch) {
      var removeIndex = Number(removeMatch[1]) - 1;
      var current = readMenu();

      if (removeIndex < 0 || removeIndex >= current.length) {
        LBC.notice("That menu item number doesn't exist.");
        return;
      }

      var removed = current.splice(removeIndex, 1)[0];
      saveMenu(current);
      LBC.notice("Removed: " + removed.amount + " tokens — " + cleanLabel(removed.label) + ".");
      return;
    }

    if (lower === "/ab menu clear") {
      saveMenu([]);
      LBC.notice("Tip menu cleared.");
      return;
    }

    if (lower === "/ab menu" || lower === "/ab menu show") {
      showMenu();
      return;
    }

    LBC.notice(
      "Tip menu controls: /ab menu add 50 Song request · " +
      "/ab menu remove 1 · /ab menu clear · /ab menu show. " +
      "Viewers use !tipmenu."
    );
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Rotating Room Announcements
 * Broadcaster-controlled, low-frequency informational notices.
 * Starts disabled; one notice every 15 minutes while enabled.
 */
(function () {
  "use strict";

  var STATE_KEY = "lbc_m2_announcements";
  var CALLBACK_PREFIX = "lbc_m2_announce_";
  var INTERVAL_SECONDS = 900;
  var MESSAGES = [
    "🖤 Welcome to AFTERDARK BROTHERHOOD. No map. No supervision. Questionable decisions. Type !ab for the brotherhood guide.",
    "🎮 The brotherhood game is free to join. Type !game to see whether a round is running.",
    "🏚️ New around here? Type !ab for the room guide, or !scoreboard to see the brotherhood records.",
    "🖤 Curious what's on the informational tip menu? Type !tipmenu. Requests are voluntary and aren't guaranteed.",
    "Make yourself comfortable, say hello, and enjoy the chaos. No purchase or tip is needed to join the games."
  ];

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var state = raw ? JSON.parse(raw) : {};
      return {
        enabled: state.enabled === true,
        index: Math.max(0, Number(state.index) || 0),
        callbackLabel: String(state.callbackLabel || "")
      };
    } catch (err) {
      return { enabled: false, index: 0, callbackLabel: "" };
    }
  }

  function saveState(state) {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function scheduleNext(state) {
    var label = CALLBACK_PREFIX + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    state.callbackLabel = label;
    saveState(state);
    LBC.runtime.createCallback(label, INTERVAL_SECONDS);
  }

  LBC.startAnnouncements = function (restart) {
    var state = readState();
    if (!state.enabled) return;
    if (!restart && state.callbackLabel) return;
    scheduleNext(state);
  };

  LBC.handleAnnouncementCommand = function (rawBody, isOwner) {
    var body = String(rawBody || "").trim().toLowerCase();
    if (!isOwner || body.indexOf("/ab announcements") !== 0) return;

    var state = readState();

    if (body === "/ab announcements on") {
      if (state.enabled) {
        LBC.notice("Rotating announcements are already on. One short notice every 15 minutes.");
        return;
      }
      state.enabled = true;
      state.index = 0;
      state.callbackLabel = "";
      saveState(state);
      scheduleNext(state);
      LBC.notice("Rotating announcements enabled. The first short room notice will appear in 15 minutes.");
      return;
    }

    if (body === "/ab announcements off") {
      state.enabled = false;
      state.callbackLabel = "";
      saveState(state);
      LBC.notice("Rotating announcements disabled.");
      return;
    }

    if (body === "/ab announcements status") {
      LBC.notice("Rotating announcements are " + (state.enabled ? "ON" : "OFF") + ". Cadence: one notice every 15 minutes.");
      return;
    }

    LBC.notice("Announcement controls: /ab announcements on · /ab announcements off · /ab announcements status. Default: off.");
  };

  LBC.onAnnouncementsCallback = function (label) {
    var state = readState();
    if (!state.enabled || !label || label !== state.callbackLabel) return;

    var message = MESSAGES[state.index % MESSAGES.length];
    state.index = (state.index + 1) % MESSAGES.length;
    state.callbackLabel = "";
    saveState(state);
    LBC.notice(message);
    scheduleNext(state);
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Custom Broadcaster Announcements
 * One-off broadcaster message; no scheduling or automatic repetition.
 */
(function () {
  "use strict";

  var MAX_MESSAGE_LENGTH = 200;

  function cleanAnnouncement(value) {
    return String(value || "")
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  LBC.handleCustomAnnouncementCommand = function (rawBody, isOwner, username) {
    if (!isOwner) return;

    var body = String(rawBody || "").trim();
    var match = body.match(/^\/ab\s+say(?:\s+([\s\S]*))?$/i);
    if (!match) return;

    var message = cleanAnnouncement(match[1] || "");

    if (!message) {
      LBC.notice("Usage: /ab say Your announcement goes here.", {
        toUsername: String(username || "")
      });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      LBC.notice("That announcement is too long. Keep it to " + MAX_MESSAGE_LENGTH + " characters or fewer.", {
        toUsername: String(username || "")
      });
      return;
    }

    LBC.notice("📣 AFTERDARK BROTHERHOOD — " + message);

    LBC.notice("Your announcement was posted.", {
      toUsername: String(username || "")
    });
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Guess the Number Player Guidance
 * Clear private instructions and recovery guidance for malformed commands.
 */
(function () {
  "use strict";

  function sendPrivateGuide(username) {
    LBC.notice(
      "🎯 GUESS THE NUMBER — QUICK GUIDE\n" +
      "The game is free. No tip or purchase is needed.\n" +
      "When a round is live, send one whole number from 1 to 100.\n" +
      "Example: !guess 42\n" +
      "You get one guess per round. Your higher/lower hint is sent privately.\n" +
      "A correct guess wins the round. Type !game to check whether a round is live.",
      { toUsername: String(username || "") }
    );
  }

  LBC.handleGuessNumberGuidance = function (rawBody, username) {
    var body = String(rawBody || "").trim();

    if (/^!(howtoplay|gamehelp)$/i.test(body)) {
      sendPrivateGuide(username);
      return;
    }

    if (!/^!guess(?:\s+.*)?$/i.test(body)) return;

    if (/^!guess\s+[0-9]{1,3}$/i.test(body)) return;

    LBC.notice(
      "Try !guess followed by one whole number from 1 to 100. Example: !guess 42. " +
      "Type !howtoplay for the full game guide.",
      { toUsername: String(username || "") }
    );
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Higher or Lower
 * Free prediction game. One prediction per viewer; no voting or paid entry.
 */
(function () {
  "use strict";

  var STATE_KEY = "lbc_m3_higher_lower";
  var ROUND_SECONDS = 90;
  var CALLBACK_PREFIX = "lbc_m3_hl_timeout_";

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var state = raw ? JSON.parse(raw) : {};
      return {
        active: state.active === true,
        current: Number(state.current) || 0,
        target: Number(state.target) || 0,
        guesses: state.guesses && typeof state.guesses === "object" ? state.guesses : {},
        endsAt: Number(state.endsAt) || 0,
        callbackLabel: String(state.callbackLabel || "")
      };
    } catch (err) {
      return { active: false, current: 0, target: 0, guesses: {}, endsAt: 0, callbackLabel: "" };
    }
  }

  function saveState(state) {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function cleanName(value) {
    return String(value || "someone").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25) || "someone";
  }

  function coreGameIsActive() {
    try {
      var raw = LBC.runtime.kvGet("lbc_v1_game", "");
      var game = raw ? JSON.parse(raw) : null;
      return !!(game && game.active === true);
    } catch (err) {
      return false;
    }
  }

  function schedule(state, seconds) {
    var label = CALLBACK_PREFIX + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    state.callbackLabel = label;
    saveState(state);
    LBC.runtime.createCallback(label, Math.max(1, seconds));
  }

  function finish(reason, expectedLabel) {
    var state = readState();
    if (!state.active) return;
    if (expectedLabel && expectedLabel !== state.callbackLabel) return;

    state.active = false;
    state.callbackLabel = "";
    saveState(state);

    var correctDirection = state.target > state.current ? "higher" : "lower";
    var winners = [];
    var players = Object.keys(state.guesses);
    players.forEach(function (name) {
      if (state.guesses[name] === correctDirection) winners.push(name);
    });

    if (LBC.rewards) winners.forEach(function (name) { LBC.rewards.award(name, 5, "Higher or Lower win", "win:higher:" + state.endsAt + ":" + name.toLowerCase()); });
    var outcome = "The next number was " + state.target + " — " + correctDirection.toUpperCase() + ". ";
    if (winners.length) {
      LBC.notice(
        "🏆 HIGHER OR LOWER — " + outcome +
        "Correct call" + (winners.length === 1 ? "" : "s") + ": " + winners.join(", ") +
        ". Apparently someone here can read numbers. 🖤"
      );
    } else {
      LBC.notice(
        (reason === "timeout" ? "⏰ Time's up. " : "🛑 Round stopped. ") +
        "HIGHER OR LOWER — " + outcome +
        "No correct calls. " + players.length + " prediction" +
        (players.length === 1 ? "" : "s") + " locked in."
      );
    }
  }

  function startRound() {
    var state = readState();
    if (state.active) {
      LBC.notice("Higher or Lower is already running. One brotherhood disaster at a time.");
      return;
    }
    if (coreGameIsActive()) {
      LBC.notice("Guess the Number is already running. Finish that round before starting another game.");
      return;
    }

    var current = Math.floor(Math.random() * 99) + 1;
    var target = Math.floor(Math.random() * 100) + 1;
    while (target === current) target = Math.floor(Math.random() * 100) + 1;

    state = {
      active: true,
      current: current,
      target: target,
      guesses: {},
      endsAt: Math.floor(Date.now() / 1000) + ROUND_SECONDS,
      callbackLabel: ""
    };
    schedule(state, ROUND_SECONDS);

    LBC.notice(
      "🎲 AFTERDARK BROTHERHOOD — HIGHER OR LOWER\n" +
      "The number is " + current + ". The next number is hidden.\n" +
      "Will it be HIGHER or LOWER? Type !higher or !lower.\n" +
      "One prediction per person. " + ROUND_SECONDS + " seconds. Free to play — no tips or purchases."
    );
  }

  LBC.handleHigherLowerCommand = function (rawBody, isOwner, username) {
    var body = String(rawBody || "").trim().toLowerCase();
    var name = cleanName(username);
    var state = readState();

    // If the broadcaster starts the core game, close this round first.
    // Chat Message invokes the core handler before this additive module.
    if (isOwner && body === "/ab start" && state.active) {
      finish("manual");
      return;
    }

    if (body === "!higherhelp") {
      LBC.notice(
        "🎲 HIGHER OR LOWER: When a round is live, look at the displayed number and predict the next one. " +
        "Type !higher or !lower. One free prediction per round. No tip required.",
        { toUsername: name }
      );
      return;
    }

    if (body === "!higherstatus") {
      LBC.notice(
        state.active
          ? "HIGHER OR LOWER is live. Current number: " + state.current + ". " +
          Object.keys(state.guesses).length + " prediction" +
          (Object.keys(state.guesses).length === 1 ? "" : "s") + " locked. Use !higher or !lower."
          : "Higher or Lower is not running. Type !higherhelp for the rules.",
        { toUsername: name }
      );
      return;
    }

    if (isOwner && body === "/ab higher start") {
      startRound();
      return;
    }

    if (isOwner && body === "/ab higher stop") {
      finish("manual");
      return;
    }

    if (isOwner && body === "/ab higher status") {
      LBC.notice("Higher or Lower is " + (state.active ? "ON" : "OFF") + ".");
      return;
    }

    if (body !== "!higher" && body !== "!lower") return;

    if (!state.active) {
      LBC.notice("No Higher or Lower round is running. Type !higherhelp for the rules.", { toUsername: name });
      return;
    }

    var key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(state.guesses, key)) {
      LBC.notice("Your prediction is already locked for this round. One shot, troublemaker.", { toUsername: name });
      return;
    }

    state.guesses[key] = body === "!higher" ? "higher" : "lower";
    saveState(state);
    if (LBC.rewards) LBC.rewards.award(name, 1, "Higher or Lower participation", "play:higher:" + state.endsAt + ":" + key);
    LBC.notice("Your " + (body === "!higher" ? "HIGHER" : "LOWER") + " prediction is locked in. 🖤", { toUsername: name });
  };

  LBC.onHigherLowerCallback = function (label) {
    finish("timeout", String(label || ""));
  };

  LBC.resumeHigherLower = function () {
    var state = readState();
    if (!state.active) return;

    var remaining = state.endsAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      finish("timeout");
      return;
    }

    // Rotate the callback label so any pre-restart callback becomes stale.
    schedule(state, remaining);
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Couple Trivia
 * Broadcaster-managed questions; free, first-correct-answer wins.
 */
(function () {
  "use strict";

  var QUESTIONS_KEY = "lbc_m3_trivia_questions";
  var STATE_KEY = "lbc_m3_trivia_state";
  var LAST_KEY = "lbc_m3_trivia_last_question";
  var ROUND_SECONDS = 120;
  var CALLBACK_PREFIX = "lbc_m3_trivia_timeout_";
  var MAX_QUESTIONS = 50;
  var MAX_QUESTION_LENGTH = 140;
  var MAX_ANSWER_LENGTH = 80;

  function cleanText(value) {
    return String(value || "")
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readQuestions() {
    try {
      var raw = LBC.runtime.kvGet(QUESTIONS_KEY, "");
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (item) {
        return item && cleanText(item.question) && cleanText(item.answer) &&
          cleanText(item.question).length <= MAX_QUESTION_LENGTH &&
          cleanText(item.answer).length <= MAX_ANSWER_LENGTH;
      }).slice(0, MAX_QUESTIONS);
    } catch (err) {
      return [];
    }
  }

  function saveQuestions(list) {
    LBC.runtime.kvSet(QUESTIONS_KEY, JSON.stringify(list));
  }

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var state = raw ? JSON.parse(raw) : {};
      return {
        active: state.active === true,
        question: String(state.question || ""),
        answer: String(state.answer || ""),
        guesses: state.guesses && typeof state.guesses === "object" ? state.guesses : {},
        endsAt: Number(state.endsAt) || 0,
        callbackLabel: String(state.callbackLabel || "")
      };
    } catch (err) {
      return { active: false, question: "", answer: "", guesses: {}, endsAt: 0, callbackLabel: "" };
    }
  }

  function saveState(state) {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function cleanName(value) {
    return String(value || "someone").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25) || "someone";
  }

  function otherGameIsActive() {
    try {
      var coreRaw = LBC.runtime.kvGet("lbc_v1_game", "");
      var core = coreRaw ? JSON.parse(coreRaw) : null;
      if (core && core.active === true) return true;

      var higherRaw = LBC.runtime.kvGet("lbc_m3_higher_lower", "");
      var higher = higherRaw ? JSON.parse(higherRaw) : null;
      return !!(higher && higher.active === true);
    } catch (err) {
      return false;
    }
  }

  function schedule(state, seconds) {
    var label = CALLBACK_PREFIX + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    state.callbackLabel = label;
    saveState(state);
    LBC.runtime.createCallback(label, Math.max(1, seconds));
  }

  function finish(reason, expectedLabel, winner) {
    var state = readState();
    if (!state.active) return;
    if (expectedLabel && expectedLabel !== state.callbackLabel) return;

    state.active = false;
    state.callbackLabel = "";
    saveState(state);

    if (winner) {
      if (LBC.rewards) LBC.rewards.award(winner, 5, "Couple Trivia win", "win:trivia:" + state.endsAt + ":" + String(winner).toLowerCase());
      LBC.notice(
        "🏆 COUPLE TRIVIA — " + cleanName(winner) + " got it first!\n" +
        "Answer: " + state.answer + ". Apparently somebody was paying attention. 🖤"
      );
      return;
    }

    LBC.notice(
      (reason === "timeout" ? "⏰ Time's up. " : "🛑 Trivia round stopped. ") +
      "COUPLE TRIVIA — The answer was: " + state.answer + ". " +
      Object.keys(state.guesses).length + " answer" +
      (Object.keys(state.guesses).length === 1 ? "" : "s") + " submitted."
    );
  }

  function startRound() {
    var state = readState();
    if (state.active) {
      LBC.notice("Couple Trivia is already running. One brotherhood disaster at a time.");
      return;
    }
    if (otherGameIsActive()) {
      LBC.notice("Another brotherhood game is already running. Finish it before starting Couple Trivia.");
      return;
    }

    var questions = readQuestions();
    if (!questions.length) {
      LBC.notice("The trivia deck is empty. Add a question first: /ab trivia add Question :: Answer");
      return;
    }

    var last = Number(LBC.runtime.kvGet(LAST_KEY, "-1"));
    var index = Math.floor(Math.random() * questions.length);
    if (questions.length > 1 && index === last) index = (index + 1) % questions.length;
    LBC.runtime.kvSet(LAST_KEY, String(index));

    var selected = questions[index];
    state = {
      active: true,
      question: selected.question,
      answer: selected.answer,
      guesses: {},
      endsAt: Math.floor(Date.now() / 1000) + ROUND_SECONDS,
      callbackLabel: ""
    };
    schedule(state, ROUND_SECONDS);

    LBC.notice(
      "🧠 AFTERDARK BROTHERHOOD — COUPLE TRIVIA\n" +
      selected.question + "\n" +
      "Type !answer followed by your answer. One attempt each. " +
      ROUND_SECONDS + " seconds. Free to play — no tips or purchases."
    );
  }

  LBC.handleCoupleTriviaCommand = function (rawBody, isOwner, username) {
    var body = String(rawBody || "").trim();
    var lower = body.toLowerCase();
    var name = cleanName(username);
    var state = readState();

    // Other game-start handlers run before this appended module.
    if (isOwner && (lower === "/ab start" || lower === "/ab higher start") && state.active) {
      finish("manual");
      return;
    }

    if (lower === "!triviahelp") {
      LBC.notice(
        "🧠 COUPLE TRIVIA: When a round is live, read the question and send !answer followed by your answer. " +
        "One attempt per person. First correct answer wins. Free to play; no tip required.",
        { toUsername: name }
      );
      return;
    }

    if (lower === "!triviastatus") {
      LBC.notice(
        state.active
          ? "Couple Trivia is live. " + Object.keys(state.guesses).length +
          " answer" + (Object.keys(state.guesses).length === 1 ? "" : "s") +
          " submitted. Send !answer <your answer>."
          : "Couple Trivia is not running. Type !triviahelp for the rules.",
        { toUsername: name }
      );
      return;
    }

    if (isOwner && lower === "/ab trivia start") {
      startRound();
      return;
    }

    if (isOwner && lower === "/ab trivia stop") {
      finish("manual");
      return;
    }

    if (isOwner && lower === "/ab trivia status") {
      LBC.notice("Couple Trivia is " + (state.active ? "ON" : "OFF") + ". " +
        readQuestions().length + " question(s) saved.");
      return;
    }

    if (isOwner && lower === "/ab trivia list") {
      var listed = readQuestions();
      if (!listed.length) {
        LBC.notice("No trivia questions saved yet.");
      } else {
        LBC.notice("COUPLE TRIVIA QUESTIONS (answers hidden):\n" +
          listed.map(function (item, index) {
            return (index + 1) + ". " + item.question;
          }).join("\n"), { toUsername: name });
      }
      return;
    }

    if (isOwner && lower === "/ab trivia clear") {
      if (state.active) {
        LBC.notice("Stop the active trivia round before clearing the question deck.");
        return;
      }
      saveQuestions([]);
      LBC.notice("Couple Trivia question deck cleared.");
      return;
    }

    if (isOwner && lower.indexOf("/ab trivia add") === 0) {
      var addMatch = body.match(/^\/ab trivia add\s+([\s\S]+?)\s+::\s+([\s\S]+)$/i);
      if (!addMatch) {
        LBC.notice("Use: /ab trivia add Your question? :: Correct answer");
        return;
      }
      var question = cleanText(addMatch[1]);
      var answer = cleanText(addMatch[2]);
      if (!question || !answer || question.length > MAX_QUESTION_LENGTH || answer.length > MAX_ANSWER_LENGTH) {
        LBC.notice("Question limit: " + MAX_QUESTION_LENGTH + " characters. Answer limit: " +
          MAX_ANSWER_LENGTH + " characters. Both are required.");
        return;
      }
      var deck = readQuestions();
      if (deck.length >= MAX_QUESTIONS) {
        LBC.notice("The trivia deck is full (" + MAX_QUESTIONS + " questions). Remove one before adding another.");
        return;
      }
      deck.push({ question: question, answer: answer });
      saveQuestions(deck);
      LBC.notice("Trivia question added (" + deck.length + "/" + MAX_QUESTIONS + "). Use /ab trivia list to review the deck.");
      return;
    }

    if (isOwner && lower.indexOf("/ab trivia remove") === 0) {
      var removeMatch = lower.match(/^\/ab trivia remove ([1-9][0-9]?)$/);
      if (!removeMatch) {
        LBC.notice("Use: /ab trivia remove <number>. Check positions with /ab trivia list.");
        return;
      }
      if (state.active) {
        LBC.notice("Stop the active trivia round before editing the question deck.");
        return;
      }
      var removeIndex = Number(removeMatch[1]) - 1;
      var currentDeck = readQuestions();
      if (removeIndex < 0 || removeIndex >= currentDeck.length) {
        LBC.notice("That question number does not exist.");
        return;
      }
      currentDeck.splice(removeIndex, 1);
      saveQuestions(currentDeck);
      LBC.notice("Trivia question removed. " + currentDeck.length + " question(s) remain.");
      return;
    }

    if (isOwner && lower.indexOf("/ab trivia") === 0) {
      LBC.notice(
        "TRIVIA CONTROLS: /ab trivia add Question :: Answer · " +
        "/ab trivia remove 1 · /ab trivia list · /ab trivia clear · " +
        "/ab trivia start · /ab trivia stop · /ab trivia status"
      );
      return;
    }

    var answerMatch = body.match(/^!answer\s+([\s\S]+)$/i);
    if (!answerMatch) return;

    if (!state.active) {
      LBC.notice("No Couple Trivia round is running. Type !triviahelp for the rules.", { toUsername: name });
      return;
    }

    var key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(state.guesses, key)) {
      LBC.notice("Your answer is already locked in for this round. One attempt each.", { toUsername: name });
      return;
    }

    var submitted = cleanText(answerMatch[1]);
    if (!submitted || submitted.length > MAX_ANSWER_LENGTH) {
      LBC.notice("Keep your answer to " + MAX_ANSWER_LENGTH + " characters or fewer.", { toUsername: name });
      return;
    }
    state.guesses[key] = submitted;
    saveState(state);

    if (normalizeAnswer(submitted) === normalizeAnswer(state.answer)) {
      finish("winner", "", name);
    } else {
      LBC.notice("Your answer is locked in. We'll reveal the answer when the round ends. 🖤", { toUsername: name });
    }
  };

  LBC.onCoupleTriviaCallback = function (label) {
    finish("timeout", String(label || ""));
  };

  LBC.resumeCoupleTrivia = function () {
    var state = readState();
    if (!state.active) return;

    var remaining = state.endsAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      finish("timeout");
      return;
    }
    schedule(state, remaining);
  };
}());

/*
 * AFTERDARK BROTHERHOOD — UNIFIED GAME LIBRARY
 * Version 1.0
 *
 * Central event routing for all LBC games.
 * Existing handlers remain compatible.
 * New games register through LBC.gameLibrary.register().
 */

(function () {
  "use strict";

  if (LBC.gameLibrary) return;

  var modules = {};
  var activeDispatch = "";
  var activeGameKey = "lbc_game_library_active";

  function safeCall(fn, args, label) {
    if (typeof fn !== "function") return;

    try {
      fn.apply(null, args || []);
    } catch (err) {
      LBC.notice(
        "The brotherhood had a small technical issue while processing " +
        label + ". The rest of the room is still running."
      );
    }
  }

  function runModules(eventName, args) {
    Object.keys(modules).forEach(function (name) {
      var module = modules[name];

      if (module && typeof module[eventName] === "function") {
        safeCall(module[eventName], args, name);
      }
    });
  }

  function readActiveGame() {
    try {
      var raw = LBC.runtime.kvGet(activeGameKey, "")
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveActiveGame(game) {
    try {
      if (!game) {
        LBC.runtime.kvSet(activeGameKey, "");
        return;
      }

      LBC.runtime.kvSet(activeGameKey, JSON.stringify(game));
    } catch (err) {
      LBC.notice("The game controller couldn't save its current state.");
    }
  }

  function claimGame(gameId, displayName) {
    var current = readActiveGame();

    if (current && current.active && current.id !== gameId) {
      LBC.notice(
        current.name + " is already running. " +
        "Finish that round before starting another game."
      );
      return false;
    }

    saveActiveGame({
      id: String(gameId),
      name: String(displayName || gameId),
      active: true,
      startedAt: Math.floor(Date.now() / 1000)
    });

    return true;
  }

  function releaseGame(gameId) {
    var current = readActiveGame();

    if (!current || !current.active) return false;
    if (gameId && current.id !== String(gameId)) return false;

    saveActiveGame(null);
    return true;
  }

  function dispatchChat(body, username, isOwner) {
    activeDispatch = "chat";

    var args = [body, username, isOwner];

    // Original Guess the Number engine.
    safeCall(originals.coreChat, args, "Guess the Number");

    // Existing room systems.
    safeCall(originals.roomGoal, [body, isOwner], "Room Goal");
    safeCall(originals.rewards, [body, username, isOwner], "Rewards");
    safeCall(originals.tipMenu, [body, isOwner], "Tip Menu");
    safeCall(originals.announcements, [body, isOwner], "Announcements");
    safeCall(originals.customAnnouncement, [body, isOwner, username], "Custom Announcements");
    safeCall(originals.guidance, [body, username], "Player Guidance");

    // Existing games.
    safeCall(originals.higherLower, [body, isOwner, username], "Higher or Lower");
    safeCall(originals.trivia, [body, isOwner, username], "Couple Trivia");

    // All future registered games.
    runModules("onChatMessage", args);
  }

  function dispatchCallback(label) {
    activeDispatch = "callback";

    safeCall(originals.coreCallback, [label], "Guess the Number");
    safeCall(originals.announcementCallback, [label], "Announcements");
    safeCall(originals.higherCallback, [label], "Higher or Lower");
    safeCall(originals.triviaCallback, [label], "Couple Trivia");

    runModules("onCallback", [label]);
  }

  function dispatchAppStart() {
    activeDispatch = "appstart";

    safeCall(originals.startAnnouncements, [true], "Announcements Recovery");
    safeCall(originals.resumeHigherLower, [], "Higher or Lower Recovery");
    safeCall(originals.resumeTrivia, [], "Couple Trivia Recovery");

    runModules("onAppStart", []);
  }

  /*
   * Preserve the original functions before installing the controller.
   */
  var originals = {
    coreChat: LBC.onChatMessage,
    coreCallback: LBC.onCallback,

    roomGoal: LBC.handleRoomGoalCommand,
    rewards: LBC.handleRewardsCommand,
    tipMenu: LBC.handleTipMenuCommand,
    announcements: LBC.handleAnnouncementCommand,
    customAnnouncement: LBC.handleCustomAnnouncementCommand,
    guidance: LBC.handleGuessNumberGuidance,

    higherLower: LBC.handleHigherLowerCommand,
    trivia: LBC.handleCoupleTriviaCommand,

    announcementCallback: LBC.onAnnouncementsCallback,
    higherCallback: LBC.onHigherLowerCallback,
    triviaCallback: LBC.onCoupleTriviaCallback,

    startAnnouncements: LBC.startAnnouncements,
    resumeHigherLower: LBC.resumeHigherLower,
    resumeTrivia: LBC.resumeCoupleTrivia
  };

  /*
   * The first existing Chat Message call becomes the central dispatcher.
   */
  LBC.onChatMessage = function (body, username, isOwner) {
    dispatchChat(body, username, isOwner);
  };

  /*
   * Existing individual handler calls become compatibility no-ops.
   * The controller has already invoked their original functions.
   */
  [
    "handleRoomGoalCommand",
    "handleRewardsCommand",
    "handleTipMenuCommand",
    "handleAnnouncementCommand",
    "handleCustomAnnouncementCommand",
    "handleGuessNumberGuidance",
    "handleHigherLowerCommand",
    "handleCoupleTriviaCommand"
  ].forEach(function (method) {
    if (typeof LBC[method] !== "function") return;

    LBC[method] = function () {
      if (activeDispatch === "chat") return;
      return originals[method] &&
        originals[method].apply(null, arguments);
    };
  });

  /*
   * Callback routing.
   */
  LBC.onCallback = function (label) {
    dispatchCallback(label);
  };

  [
    "onAnnouncementsCallback",
    "onHigherLowerCallback",
    "onCoupleTriviaCallback"
  ].forEach(function (method) {
    if (typeof LBC[method] !== "function") return;

    LBC[method] = function () {
      if (activeDispatch === "callback") return;
      return originals[method] &&
        originals[method].apply(null, arguments);
    };
  });

  /*
   * App Start routing.
   * The existing first recovery call triggers all recovery systems.
   */
  [
    "startAnnouncements",
    "resumeHigherLower",
    "resumeCoupleTrivia"
  ].forEach(function (method) {
    if (typeof LBC[method] !== "function") return;

    LBC[method] = function () {
      if (activeDispatch === "appstart") return;
      return originals[method] &&
        originals[method].apply(null, arguments);
    };
  });

  LBC.startAnnouncements = function () {
    dispatchAppStart();
  };

  /*
   * Public Game Library API.
   */
  LBC.gameLibrary = {

    version: "1.0",

    register: function (name, gameModule) {
      var id = String(name || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");

      if (!id || !gameModule || typeof gameModule !== "object") {
        return false;
      }

      modules[id] = gameModule;
      return true;
    },

    unregister: function (name) {
      var id = String(name || "").toLowerCase();
      if (!modules[id]) return false;

      delete modules[id];
      return true;
    },

    list: function () {
      return Object.keys(modules);
    },

    claim: claimGame,

    release: releaseGame,

    active: readActiveGame,

    isBusy: function () {
      var game = readActiveGame();
      return !!(game && game.active);
    },

    notice: function (message, options) {
      LBC.notice(message, options);
    },

    reloadPanel: function () {
      LBC.runtime.reloadPanel();
    }
  };

  LBC.notice("🖤 AFTERDARK BROTHERHOOD — Game Library online.");

}());

/*
 * AFTERDARK BROTHERHOOD — AFTER HOURS GAME PACK
 * Version 1.0
 *
 * Games:
 * 1. Codebreaker
 * 2. Word Scramble
 * 3. Dirty Would You Rather
 * 4. Position Impossible
 * 5. Dirty Charades
 *
 * All games use the central LBC Game Library.
 * One active game at a time.
 */

(function () {
  "use strict";

  if (LBC.__afterHoursPackInstalled) return;
  if (!LBC.gameLibrary) {
    LBC.notice("Game Library not found. After Hours Pack was not loaded.");
    return;
  }

  LBC.__afterHoursPackInstalled = true;

  var STATE_KEY = "lbc_afterhours_game_state";
  var ROUND_SECONDS = 75;
  var WYR_SECONDS = 45;
  var CALLBACK_PREFIX = "lbc_afterhours_timeout_";

  var state = null;

  function cleanName(value) {
    return String(value || "someone")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 25) || "someone";
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var parsed = raw ? JSON.parse(raw) : null;

      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.active !== true) return null;

      return parsed;
    } catch (err) {
      return null;
    }
  }

  function saveState() {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function clearState() {
    state = null;
    LBC.runtime.kvSet(STATE_KEY, "")
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffleWord(word) {
    var letters = String(word).split("");
    var result = String(word);

    for (var attempt = 0; attempt < 10 && result === word; attempt++) {
      for (var i = letters.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = letters[i];
        letters[i] = letters[j];
        letters[j] = temp;
      }
      result = letters.join("");
    }

    return result;
  }

  function legacyGameIsActive() {
    var keys = [
      "lbc_v1_game",
      "lbc_m3_higher_lower",
      "lbc_m3_trivia_state"
    ];

    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = LBC.runtime.kvGet(keys[i], "");
        if (!raw) continue;

        var parsed = JSON.parse(raw);
        if (parsed && parsed.active === true) return true;
      } catch (err) {
        // Ignore malformed legacy state and continue checking.
      }
    }

    return false;
  }

  function isOwnerCommand(body, command) {
    return body.toLowerCase() === command;
  }

  function finish(reason, winner) {
    if (!state || !state.active) return;

    var finished = state;
    state.active = false;
    saveState();

    if (finished.callbackLabel) {
      // Old callbacks become harmless because state is no longer active.
      finished.callbackLabel = "";
    }

    LBC.gameLibrary.release(finished.id);
    if (winner && LBC.rewards) LBC.rewards.award(winner, 5, finished.name + " win", "win:afterhours:" + finished.startedAt + ":" + String(winner).toLowerCase());

    if (finished.id === "would-you-rather") {
      var a = Object.keys(finished.votes || {}).filter(function (name) {
        return finished.votes[name] === "a";
      }).length;

      var b = Object.keys(finished.votes || {}).filter(function (name) {
        return finished.votes[name] === "b";
      }).length;

      var total = a + b;

      LBC.notice(
        "🖤 WOULD YOU RATHER — RESULTS\n" +
        "A: " + a + " vote" + (a === 1 ? "" : "s") + "\n" +
        "B: " + b + " vote" + (b === 1 ? "" : "s") + "\n" +
        "Total votes: " + total + "\n" +
        (a === b ? "A perfect tie. Nobody can make a decision." :
          (a > b ? "Option A takes it." : "Option B takes it."))
      );
    } else if (winner) {
      LBC.notice(
        "🏆 " + finished.name.toUpperCase() + "\n" +
        cleanName(winner) + " got it first. Nicely done. 🖤\n" +
        (finished.answer ? "Answer: " + finished.answer : "")
      );
    } else {
      var message = reason === "timeout"
        ? "⏰ Time's up."
        : "🛑 Round ended.";

      LBC.notice(
        message + " " + finished.name.toUpperCase() + "\n" +
        (finished.answer ? "The answer was: " + finished.answer : "The round is over.")
      );
    }

    clearState();
    LBC.runtime.reloadPanel();
  }

  function schedule(seconds) {
    var label = CALLBACK_PREFIX +
      Date.now() + "_" +
      Math.floor(Math.random() * 1000000);

    state.callbackLabel = label;
    state.endsAt = Math.floor(Date.now() / 1000) + seconds;

    saveState();
    LBC.runtime.createCallback(label, seconds)
  }

  function startGame(id, name, data, seconds) {
    var current = readState();

    if (current && current.active) {
      LBC.notice(
        current.name + " is already running. Finish that round first."
      );
      return false;
    }

    if (legacyGameIsActive()) {
      LBC.notice(
        "Another brotherhood game is already running. Finish it before starting " +
        name + "."
      );
      return false;
    }

    if (!LBC.gameLibrary.claim(id, name)) return false;

    state = {
      id: id,
      name: name,
      active: true,
      callbackLabel: "",
      endsAt: 0,
      startedAt: Math.floor(Date.now() / 1000)
    };

    Object.keys(data || {}).forEach(function (key) {
      state[key] = data[key];
    });

    schedule(seconds || ROUND_SECONDS);
    LBC.runtime.reloadPanel();
    return true;
  }

  function stopIfLegacyGameStarts(body, isOwner) {
    if (!isOwner || !state || !state.active) return false;

    var command = String(body || "").trim().toLowerCase();

    var legacyStarts = [
      "/ab start",
      "/ab higher start",
      "/ab trivia start"
    ];

    if (legacyStarts.indexOf(command) !== -1) {
      finish("interrupted");
      return true;
    }

    return false;
  }

  function startNotice(text) {
    LBC.notice(text);
    LBC.runtime.reloadPanel()
  }

  /*
   * GAME 1 — CODEBREAKER
   */

  var codebreakerPrompts = [
    "Four digits. Crack the combination.",
    "The lock is set. Find the four-digit code.",
    "Four unique digits stand between you and victory."
  ];

  function createCode() {
    var digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    var result = "";

    while (result.length < 4) {
      var index = Math.floor(Math.random() * digits.length);
      result += digits.splice(index, 1)[0];
    }

    return result;
  }

  function codeFeedback(secret, guess) {
    var exact = 0;
    var misplaced = 0;

    for (var i = 0; i < 4; i++) {
      if (guess.charAt(i) === secret.charAt(i)) {
        exact++;
      } else if (secret.indexOf(guess.charAt(i)) !== -1) {
        misplaced++;
      }
    }

    return exact + " correct position · " +
      misplaced + " correct digit, wrong position";
  }

  function handleCodebreaker(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab codebreaker start") {
      var secret = createCode();

      if (startGame("codebreaker", "Codebreaker", {
        secret: secret,
        attempts: {},
        answer: secret
      }, 90)) {
        startNotice(
          "🔐 AFTERDARK BROTHERHOOD — CODEBREAKER\n" +
          randomItem(codebreakerPrompts) + "\n" +
          "Send !code followed by four unique digits.\n" +
          "Example: !code 4821\n" +
          "Each player gets up to six attempts. 90 seconds."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab codebreaker stop") {
      if (state && state.id === "codebreaker") finish("manual");
      else LBC.notice("Codebreaker isn't running.");
      return true;
    }

    if (lower === "!codehelp") {
      LBC.notice(
        "🔐 CODEBREAKER: Send !code followed by four unique digits. " +
        "You'll receive private feedback. Up to six attempts per player.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!code\s+([0-9]{4})$/i);
    if (!match) return false;

    if (!state || state.id !== "codebreaker" || !state.active) {
      LBC.notice("No Codebreaker round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var guess = match[1];
    if (new Set(guess.split("")).size !== 4) {
      LBC.notice("Use four different digits. No repeats.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var player = cleanName(username).toLowerCase();
    var attempts = Number(state.attempts[player]) || 0;

    if (attempts >= 6) {
      LBC.notice("You've used all six attempts this round.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    attempts++;
    state.attempts[player] = attempts;
    saveState();

    if (guess === state.secret) {
      finish("winner", username);
      return true;
    }

    LBC.notice(
      "Attempt " + attempts + "/6 — " +
      codeFeedback(state.secret, guess),
      { toUsername: cleanName(username) }
    );

    return true;
  }

  /*
   * GAME 2 — WORD SCRAMBLE
   */

  var wordDeck = [
    { word: "MIDNIGHT", hint: "When the trouble usually starts." },
    { word: "WHISPER", hint: "A very quiet way to communicate." },
    { word: "DANGEROUS", hint: "Proceed at your own risk." },
    { word: "CHEMISTRY", hint: "You either have it or you don't." },
    { word: "TEASE", hint: "A little anticipation never hurt." },
    { word: "AFTERHOURS", hint: "The club doesn't close." },
    { word: "MYSTERY", hint: "Nobody knows what's coming." },
    { word: "TEMPTATION", hint: "The questionable decision." },
    { word: "SECRET", hint: "Keep this between us." },
    { word: "ELECTRIC", hint: "The feeling in the room." },
    { word: "MISCHIEF", hint: "A little trouble." },
    { word: "UNFILTERED", hint: "No holding back." }
  ];

  function handleWordScramble(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab scramble start") {
      var selected = randomItem(wordDeck);

      var started = startGame("word-scramble", "Word Scramble", {
        answer: selected.word,
        scrambled: shuffleWord(selected.word),
        hint: selected.hint
      }, 75);

      if (started) {
        startNotice(
          "🔤 AFTERDARK BROTHERHOOD — WORD SCRAMBLE\n" +
          "Unscramble this word:\n\n" +
          state.scrambled + "\nHint: " + state.hint +
          "\nFirst correct answer wins. Send !word <answer>."
        );
      }

      if (state && state.id === "word-scramble") {
        LBC.notice(
          "🔤 " + state.scrambled +
          "\nHint: " + state.hint +
          "\nFirst correct answer wins. Send !word <answer>."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab scramble stop") {
      if (state && state.id === "word-scramble") finish("manual");
      else LBC.notice("Word Scramble isn't running.");
      return true;
    }

    if (lower === "!wordhelp") {
      LBC.notice(
        "🔤 WORD SCRAMBLE: Unscramble the displayed word. " +
        "Send !word followed by your answer. First correct answer wins.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!word\s+(.+)$/i);
    if (!match) return false;

    if (!state || state.id !== "word-scramble" || !state.active) {
      LBC.notice("No Word Scramble round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    if (normalize(match[1]) === normalize(state.answer)) {
      finish("winner", username);
    } else {
      LBC.notice("Not quite. Keep trying.", {
        toUsername: cleanName(username)
      });
    }

    return true;
  }

  /*
   * GAME 3 — DIRTY WOULD YOU RATHER
   */

  var wyrDeck = [
    ["A slow, teasing kiss that lasts forever", "A sudden kiss that catches you completely off guard"],
    ["A secret admirer who leaves clues", "A confident flirt who says exactly what they want"],
    ["A weekend away with no plans", "A night out that turns into an adventure"],
    ["Being the one who makes the first move", "Having someone else make the first move"],
    ["A long late-night conversation", "A look across the room that says everything"],
    ["A playful challenge", "A dangerously charming compliment"],
    ["A private rooftop date", "A hidden little bar after midnight"],
    ["Someone who makes you laugh", "Someone who makes you blush"],
    ["A slow dance in an empty room", "A spontaneous midnight road trip"],
    ["A little mystery", "A little mischief"],
    ["A partner who is unpredictable", "A partner who always has a plan"],
    ["A flirty text at 2 AM", "A surprise visit at midnight"]
  ];

  function handleWouldYouRather(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab wyr start") {
      var options = randomItem(wyrDeck);

      if (startGame("would-you-rather", "Dirty Would You Rather", {
        optionA: options[0],
        optionB: options[1],
        votes: {}
      }, WYR_SECONDS)) {
        startNotice(
          "😈 DIRTY WOULD YOU RATHER\n" +
          "A: " + options[0] + "\n" +
          "B: " + options[1] + "\n\n" +
          "Vote with !a or !b. One vote per person. " +
          WYR_SECONDS + " seconds."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab wyr stop") {
      if (state && state.id === "would-you-rather") finish("manual");
      else LBC.notice("Would You Rather isn't running.");
      return true;
    }

    if (lower === "!wyrhelp") {
      LBC.notice(
        "😈 WOULD YOU RATHER: Read options A and B. Vote !a or !b. " +
        "One vote per person. Results appear when time runs out.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    if (lower !== "!a" && lower !== "!b") return false;

    if (!state || state.id !== "would-you-rather" || !state.active) {
      LBC.notice("No Would You Rather round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var player = cleanName(username).toLowerCase();

    if (state.votes[player]) {
      LBC.notice("Your vote is already locked in.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    state.votes[player] = lower === "!a" ? "a" : "b";
    saveState();

    LBC.notice("Your vote is locked in. 😈", {
      toUsername: cleanName(username)
    });

    return true;
  }

  /*
   * GAME 4 — POSITION IMPOSSIBLE
   */

  var positionDeck = [
    {
      clue: "The name sounds like a piece of furniture. You're definitely not assembling it.",
      answer: "couch",
      aliases: ["the couch", "couch position"]
    },
    {
      clue: "A classic name involving a piece of furniture and a very questionable angle.",
      answer: "reverse cowgirl",
      aliases: ["reverse cowgirl position"]
    },
    {
      clue: "A position named after a common household exercise.",
      answer: "standing",
      aliases: ["standing position", "standing up"]
    },
    {
      clue: "The name suggests a person who spends a lot of time behind a desk.",
      answer: "desk",
      aliases: ["the desk", "desk position"]
    },
    {
      clue: "A position named after a piece of furniture you might find in a bedroom.",
      answer: "bed",
      aliases: ["the bed", "bed position"]
    },
    {
      clue: "The name sounds like a dance move, but nobody is keeping rhythm.",
      answer: "spooning",
      aliases: ["spoon"]
    },
    {
      clue: "A position that suggests someone is taking a seat.",
      answer: "sitting",
      aliases: ["sitting down", "seated"]
    },
    {
      clue: "A name that sounds like a yoga pose after a very long night.",
      answer: "lotus",
      aliases: ["lotus position"]
    }
  ];

  function handlePosition(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab position start") {
      var selected = randomItem(positionDeck);

      if (startGame("position-impossible", "Position Impossible", {
        clue: selected.clue,
        answer: selected.answer,
        aliases: selected.aliases
      }, 75)) {
        startNotice(
          "🧩 POSITION IMPOSSIBLE\n" +
          selected.clue + "\n\n" +
          "Name the position. Send !position <answer>.\n" +
          "First correct answer wins."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab position stop") {
      if (state && state.id === "position-impossible") finish("manual");
      else LBC.notice("Position Impossible isn't running.");
      return true;
    }

    if (lower === "!positionhelp") {
      LBC.notice(
        "🧩 POSITION IMPOSSIBLE: Solve the clue and send !position followed by your answer. First correct answer wins.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!position\s+(.+)$/i);
    if (!match) return false;

    if (!state || state.id !== "position-impossible" || !state.active) {
      LBC.notice("No Position Impossible round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var submitted = normalize(match[1]);
    var accepted = [state.answer].concat(state.aliases || []);
    var correct = accepted.some(function (answer) {
      return submitted === normalize(answer);
    });

    if (correct) finish("winner", username);
    else LBC.notice("Not that one. Try again.", {
      toUsername: cleanName(username)
    });

    return true;
  }

  /*
   * GAME 5 — DIRTY CHARADES
   */

  var charadesDeck = [
    { clue: "🍑 🔥 👀", answer: "hot seat", aliases: ["the hot seat"] },
    { clue: "💋 🌙 🕯️", answer: "midnight kiss", aliases: ["a midnight kiss"] },
    { clue: "😈 🎲 🛏️", answer: "bedroom games", aliases: ["bedroom game"] },
    { clue: "🍸 💬 ❤️", answer: "flirting", aliases: ["flirt"] },
    { clue: "🚪 🌙 🤫", answer: "sneaking out", aliases: ["sneak out"] },
    { clue: "🕺 💃 🔥", answer: "dirty dancing", aliases: ["dancing"] },
    { clue: "📱 🌙 💌", answer: "late night text", aliases: ["late night texting"] },
    { clue: "🙈 💋 😳", answer: "stolen kiss", aliases: ["a stolen kiss"] },
    { clue: "🛋️ 🍿 😉", answer: "movie night", aliases: ["movies"] },
    { clue: "🕶️ 🚗 🌃", answer: "night drive", aliases: ["midnight drive"] },
    { clue: "🤫 ❤️ 🔥", answer: "secret crush", aliases: ["a secret crush"] },
    { clue: "🍓 🍫 😘", answer: "sweet talk", aliases: ["sweet talking"] }
  ];

  function handleCharades(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab charades start") {
      var selected = randomItem(charadesDeck);

      if (startGame("dirty-charades", "Dirty Charades", {
        clue: selected.clue,
        answer: selected.answer,
        aliases: selected.aliases
      }, 75)) {
        startNotice(
          "🎭 DIRTY CHARADES\n" +
          selected.clue + "\n\n" +
          "What does it mean? Send !charade <answer>.\n" +
          "First correct answer wins."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab charades stop") {
      if (state && state.id === "dirty-charades") finish("manual");
      else LBC.notice("Dirty Charades isn't running.");
      return true;
    }

    if (lower === "!charadeshelp") {
      LBC.notice(
        "🎭 DIRTY CHARADES: Decode the emoji clue. Send !charade followed by your answer. First correct answer wins.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!charade\s+(.+)$/i);
    if (!match) return false;

    if (!state || state.id !== "dirty-charades" || !state.active) {
      LBC.notice("No Dirty Charades round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var submitted = normalize(match[1]);
    var accepted = [state.answer].concat(state.aliases || []);
    var correct = accepted.some(function (answer) {
      return submitted === normalize(answer);
    });

    if (correct) finish("winner", username);
    else LBC.notice("Not quite. Decode those emojis again.", {
      toUsername: cleanName(username)
    });

    return true;
  }

  /*
   * CENTRAL ROUTING
   */

  function onChatMessage(body, username, isOwner, gameId) {
    body = String(body || "").trim();

    if (stopIfLegacyGameStarts(body, isOwner)) return;
    if (!isOwner && state && state.active && state.id === gameId && LBC.rewards) {
      var validEntry = (gameId === "codebreaker" && /^!code\s+[0-9]{4}$/i.test(body)) ||
        (gameId === "word-scramble" && /^!word\s+\S[\s\S]*$/i.test(body)) ||
        (gameId === "would-you-rather" && /^!(a|b)$/i.test(body)) ||
        (gameId === "position-impossible" && /^!position\s+\S[\s\S]*$/i.test(body)) ||
        (gameId === "dirty-charades" && /^!charade\s+\S[\s\S]*$/i.test(body));
      if (validEntry) LBC.rewards.award(username, 1, gameId + " participation", "play:afterhours:" + state.startedAt + ":" + gameId + ":" + String(username).toLowerCase());
    }

    if (gameId === "codebreaker") {
      handleCodebreaker(body, username, isOwner);
    } else if (gameId === "word-scramble") {
      handleWordScramble(body, username, isOwner);
    } else if (gameId === "would-you-rather") {
      handleWouldYouRather(body, username, isOwner);
    } else if (gameId === "position-impossible") {
      handlePosition(body, username, isOwner);
    } else if (gameId === "dirty-charades") {
      handleCharades(body, username, isOwner);
    }
  }

  function onCallback(label) {
    if (!state || !state.active) return;
    if (String(label || "") !== state.callbackLabel) return;

    finish("timeout");
  }

  var appStartRecovered = false;

  function onAppStart() {
    if (appStartRecovered) return;
    appStartRecovered = true;

    state = readState();
    if (!state || !state.active) return;

    var remaining = state.endsAt -
      Math.floor(Date.now() / 1000);

    if (remaining <= 0) {
      finish("timeout");
      return;
    }

    if (!LBC.gameLibrary.claim(state.id, state.name)) {
      finish("interrupted");
      return;
    }

    schedule(remaining);

    LBC.notice(
      "🖤 " + state.name + " resumed after the brotherhood restart."
    );
  }

  /*
   * Register each game with the shared controller.
   * New games can be added using this same pattern.
   */

  LBC.gameLibrary.register("codebreaker", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "codebreaker");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("word-scramble", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "word-scramble");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("would-you-rather", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "would-you-rather");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("position-impossible", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "position-impossible");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("dirty-charades", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "dirty-charades");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.afterHours = {
    version: "1.0",

    games: function () {
      return [
        "Codebreaker",
        "Word Scramble",
        "Dirty Would You Rather",
        "Position Impossible",
        "Dirty Charades"
      ];
    },

    status: function () {
      return readState();
    }
  };

  LBC.notice(
    "🖤 AFTER HOURS GAME PACK loaded. Five games registered with the Game Library."
  );

}());
