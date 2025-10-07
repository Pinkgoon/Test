export class HUD{
constructor(){
this.hpBar = document.getElementById('hpbar');
this.xpBar = document.getElementById('xpbar');
this.lvl = document.getElementById('lvl');
this.time = document.getElementById('time');
this.score = document.getElementById('score');
this.start = document.getElementById('start');
this.startBtn = document.getElementById('startBtn');
this.levelup = document.getElementById('levelup');
this.upgrid = document.getElementById('upgrid');
this.over = document.getElementById('gameover');
this.final = document.getElementById('finalStats');
this.pauseBtn = document.getElementById('pauseBtn');
this.restartBtn = document.getElementById('restartBtn');
this.skinBtn = document.getElementById('skinBtn');
this.skins = document.getElementById('skins');
this.pFile = document.getElementById('pFile'); this.pSize = document.getElementById('pSize'); this.pPrev = document.getElementById('pPrev'); this.pClear = document.getElementById('pClear');
this.eFile = document.getElementById('eFile'); this.eSize = document.getElementById('eSize'); this.ePrev = document.getElementById('ePrev'); this.eClear = document.getElementById('eClear');
this.skinClose = document.getElementById('skinClose');
}
}