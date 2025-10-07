// src/main.js
import { Renderer } from './engine/Renderer.js';
import { Input } from './engine/Input.js';
import { Assets } from './engine/Assets.js';
import { HUD } from './ui/HUD.js';

import { makePlayer, xpFor } from './game/Player.js';
import { spawnEnemy } from './game/Enemy.js';
import { updateSpawn } from './game/Spawner.js';
import { clamp, tryShoot, updateBullets, updateEnemies, updateGems, updateExplosions } from './game/Systems.js';

// 무기 집계/런타임 + 위젯/근접 렌더러
import { WEAPON_DEFS, updateWeapons, renderMagWidgets, renderMelee } from './game/weapons/index.js';
import { PERK_DEFS } from './game/Perks.js';
import {
  createInventory, gainPerk, gainWeapon, rollLevelupOptions,
  equipPerk, equipWeapon, unequipPerk, unequipWeapon,
  recalcPlayerFromEquipment, pickupAddon, equipAddonToWeapon, unequipAddonFromWeapon
} from './game/Inventory.js';

import { ADDON_DEFS } from './game/Addons.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { DebugUI } from './ui/DebugUI.js';

const cvs = document.getElementById('game');
const hud = new HUD();
const renderer = new Renderer(cvs);
const input = new Input(document.getElementById('joy'));
const assets = new Assets(hud);

const state = {
  running:false, paused:false, over:false, inLevelup:false, inInventory:false, inDebug:false,
  last:0, dt:0, timeSurvived:0, score:0,
  spawnTimer:0,
  enemies:[], bullets:[], gems:[], texts:[],
  requestLevelup:false, gameOver:false,

  // 무기별 보조 컨테이너
  booms:[], orbitals:[], _orbitalVis:[],
  beams:[], arcs:[], grenades:[], zombies:[], explosions:[],

  // 근접 시스템 컨테이너
  melee: { tele: [], effects: [] },

  inventory: createInventory(),
  xpFor,
};

const player = makePlayer(cvs.clientWidth, cvs.clientHeight);

// 인벤토리 UI + defs 인덱스
const defsIndex = {
  perks: Object.fromEntries(PERK_DEFS.map(d=>[d.id, d])),
  weapons: Object.fromEntries(WEAPON_DEFS.map(d=>[d.id, d])),
  addons: Object.fromEntries(ADDON_DEFS.map(d=>[d.id, d])),
};

const invUI = new InventoryUI(document.getElementById('wrap'), {
  onEquipPerk: (id)=>{ if(equipPerk(state.inventory, player, id)) { recalcPlayerFromEquipment(player, state.inventory); invUI.render(state.inventory, defsIndex); renderInvIcons(); } },
  onEquipWeapon: (id)=>{ if(equipWeapon(state.inventory, player, id)) { recalcPlayerFromEquipment(player, state.inventory); invUI.render(state.inventory, defsIndex); renderInvIcons(); } },
  onUnequipPerk: (id)=>{ if(unequipPerk(state.inventory, player, id)) { recalcPlayerFromEquipment(player, state.inventory); invUI.render(state.inventory, defsIndex); renderInvIcons(); } },
  onUnequipWeapon: (id)=>{ if(unequipWeapon(state.inventory, player, id)) { recalcPlayerFromEquipment(player, state.inventory); invUI.render(state.inventory, defsIndex); renderInvIcons(); } },
  onDropAddon: ({weaponId, addonId})=>{ const r = equipAddonToWeapon(state.inventory, weaponId, addonId); if(!r.ok){ state.texts.push({x:player.x,y:player.y-20,t:r.reason,a:1}); } invUI.render(state.inventory, defsIndex); renderInvIcons(); },
  onRemoveAddon: ({weaponId, slot})=>{ const r = unequipAddonFromWeapon(state.inventory, weaponId, slot); if(!r.ok){ state.texts.push({x:player.x,y:player.y-20,t:r.reason,a:1}); } invUI.render(state.inventory, defsIndex); renderInvIcons(); },
  onClose: closeInventory
});

const debugUI = new DebugUI(document.getElementById('wrap'), {
  onClose: closeDebug,
  onPickPerk: (id)=>{ if (gainPerk(state.inventory, player, id)) { recalcPlayerFromEquipment(player, state.inventory); invUI.render(state.inventory, defsIndex); renderInvIcons(); state.texts.push({x:player.x,y:player.y-22,t:`획득: ${defsIndex.perks[id]?.name||id}`,a:1}); } else { state.texts.push({x:player.x,y:player.y-22,t:'퍼크 추가 실패',a:1}); } },
  onPickWeapon: (id)=>{ if (gainWeapon(state.inventory, player, id)) { recalcPlayerFromEquipment(player, state.inventory); invUI.render(state.inventory, defsIndex); renderInvIcons(); state.texts.push({x:player.x,y:player.y-22,t:`획득: ${defsIndex.weapons[id]?.name||id}`,a:1}); } else { state.texts.push({x:player.x,y:player.y-22,t:'무기 추가 실패',a:1}); } },
  onPickAddon: (id)=>{ if (pickupAddon(state.inventory, id)) { invUI.render(state.inventory, defsIndex); renderInvIcons(); state.texts.push({x:player.x,y:player.y-22,t:'애드온 획득',a:1}); } else { state.texts.push({x:player.x,y:player.y-22,t:'애드온 가방 가득참',a:1}); } }
});

// 드랍 유틸
state.dropFunc = (x, y) => dropAt(x, y);
state.pickupAddonFunc = (addonId) => { const ok = pickupAddon(state.inventory, addonId); if (ok) invUI.render(state.inventory, defsIndex); return ok; };

function pushXpGem(x, y){
  const v = Math.random() < 0.12 ? 5 : 2;
  const ang = Math.random() * Math.PI * 2, spd = 40 + Math.random()*40;
  state.gems.push({ kind:'xp', x, y, r:6, v, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd });
}
function dropAt(x, y){
  pushXpGem(x, y);
  if (Math.random() < 0.15) {
    const list = Object.values(defsIndex.addons); const pick = list[(Math.random()*list.length)|0];
    const ang = Math.random() * Math.PI * 2, spd = 40 + Math.random()*40;
    state.gems.push({ kind:'addon', addonId: pick.id, unique: !!pick.unique, x, y, r:7, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd });
  }
}

// ──────────────────────────────────────────────────────────────────────────
function updateHUD(){
  const hp = clamp(player.hp / player.maxHp, 0, 1);
  const xp = clamp(player.xp / player.nextXp, 0, 1);
  hud.hpBar.style.width = `${(hp*100).toFixed(1)}%`;
  hud.xpBar.style.width = `${(xp*100).toFixed(1)}%`;
  hud.lvl.textContent = `Lv. ${player.level}`;
  hud.score.textContent = `Score ${state.score|0}`;
  const t = state.timeSurvived|0; const m=(t/60)|0, s=(t%60)|0;
  hud.time.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function gameOver(){
  state.over=true; state.running=false; hud.over.classList.add('show');
  const t=state.timeSurvived|0; const m=(t/60)|0, s=(t%60)|0;
  hud.final.textContent = `생존 시간 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} · 점수 ${state.score|0} · 레벨 ${player.level}`;
}
function reset(){
  state.running=false; state.paused=false; state.over=false; state.inLevelup=false; state.inInventory=false; state.inDebug=false;
  state.last=0; state.dt=0; state.timeSurvived=0; state.score=0;
  state.enemies.length=0; state.bullets.length=0; state.gems.length=0; state.texts.length=0; state.spawnTimer=0;
  state.requestLevelup=false; state.gameOver=false;

  state.booms.length=0; state.orbitals.length=0; state._orbitalVis.length=0;
  state.beams.length=0; state.arcs.length=0; state.grenades.length=0; state.zombies.length=0; state.explosions.length=0;
  state.melee.tele.length=0; state.melee.effects.length=0;

  const basePlayer = makePlayer(cvs.clientWidth, cvs.clientHeight);
  Object.assign(player, basePlayer);

  state.inventory = createInventory();
  gainWeapon(state.inventory, player, 'wpn_blaster'); // 기본 지급
  recalcPlayerFromEquipment(player, state.inventory);

  renderInvIcons(); updateHUD();
}

// ──────────────────────────────────────────────────────────────────────────
// 우하단 아이콘 바 + 툴팁
const invBar = document.createElement('div');
Object.assign(invBar.style,{ position:'absolute', right:'12px', bottom:'12px', display:'flex', flexDirection:'column', gap:'10px', pointerEvents:'auto', zIndex:5 });
document.getElementById('wrap').appendChild(invBar);
const tip = document.createElement('div');
Object.assign(tip.style,{ position:'absolute', maxWidth:'260px', padding:'8px 10px', fontSize:'12px', background:'rgba(15,17,25,0.95)', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', boxShadow:'0 6px 24px rgba(0,0,0,.35)', display:'none', zIndex:50, pointerEvents:'none' });
document.getElementById('wrap').appendChild(tip);
function showTip(html,x,y){ tip.innerHTML=html; tip.style.left=`${x+12}px`; tip.style.top=`${y+12}px`; tip.style.display='block'; }
function hideTip(){ tip.style.display='none'; }
function makeIconCell(icon, lvl, html){
  const box=document.createElement('div'); Object.assign(box.style,{ width:'48px', height:'48px', position:'relative', borderRadius:'10px', overflow:'hidden', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)' });
  const img=document.createElement('img'); Object.assign(img.style,{width:'100%',height:'100%',objectFit:'contain',display:'block'}); img.src=icon||''; img.onerror=()=>{img.style.opacity='0.6';};
  const badge=document.createElement('div'); badge.textContent=`Lv.${lvl||1}`; Object.assign(badge.style,{ position:'absolute', right:'-6px', bottom:'-6px', background:'#2a2f3d', color:'#fff', border:'1px solid rgba(255,255,255,0.18)', fontSize:'11px', padding:'2px 6px', borderRadius:'999px' });
  box.appendChild(img); box.appendChild(badge);
  box.addEventListener('mouseenter',(e)=>showTip(html,e.clientX,e.clientY));
  box.addEventListener('mousemove', (e)=>showTip(html,e.clientX,e.clientY));
  box.addEventListener('mouseleave', hideTip);
  return box;
}
function renderInvIcons(){
  invBar.innerHTML='';
  const row=(label)=>{ const wrap=document.createElement('div'); const title=document.createElement('div'); title.textContent=label; Object.assign(title.style,{fontSize:'12px',opacity:.8,marginBottom:'4px',textAlign:'right'}); const grid=document.createElement('div'); Object.assign(grid.style,{display:'grid',gridTemplateColumns:'repeat(4,48px)',gap:'8px',justifyContent:'end'}); wrap.appendChild(title); wrap.appendChild(grid); invBar.appendChild(wrap); return grid; };
  const perks = row('PERK'); const weapons = row('WEAPON');
  for(const p of state.inventory.equipped.perks){
    const d = defsIndex.perks[p.id]||{}; const html = `<div style="font-weight:700;margin-bottom:4px">${d.name||p.id} · Lv.${p.lvl||1}</div><div style="opacity:.8">${d.stepDesc||''}</div>`;
    perks.appendChild(makeIconCell(d.icon, p.lvl, html));
  }
  for(const w of state.inventory.equipped.weapons){
    const d = defsIndex.weapons[w.id]||{}; const html = `<div style="font-weight:700;margin-bottom:4px">${d.name||w.id} · Lv.${w.lvl||1}</div><div style="opacity:.8">${d.desc||''}</div>`;
    weapons.appendChild(makeIconCell(d.icon, w.lvl, html));
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 레벨업
let levelKeyHandler=null;
function levelUp(){
  if(state.inLevelup) return; state.running=false; state.inLevelup=true;
  const opts = rollLevelupOptions(state.inventory); if(!opts.length){ resumeAfterLevelup(); return; }
  hud.levelup.classList.add('show'); hud.upgrid.innerHTML='';
  if(levelKeyHandler) window.removeEventListener('keydown', levelKeyHandler, true);
  levelKeyHandler=(e)=>{ if(!state.inLevelup){ window.removeEventListener('keydown', levelKeyHandler, true); levelKeyHandler=null; return; } if(e.key==='1'||e.key==='2'||e.key==='3'){ const i=Number(e.key)-1; const el=hud.upgrid.children[i]; if(el){ e.preventDefault(); el.click(); } } };
  window.addEventListener('keydown', levelKeyHandler, true);
  const iconFor=(opt)=> opt.kind==='perk' ? defsIndex.perks[opt.id]?.icon : defsIndex.weapons[opt.id]?.icon;
  for(const opt of opts){
    const el=document.createElement('div'); el.className='card';
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px">
      <img src="${iconFor(opt)||''}" style="width:40px;height:40px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.05)" onerror="this.style.opacity=0.6">
      <div style="flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-weight:700;color:var(--accent)">${opt.name}</div>
          <span class="chip" style="font-size:11px">${opt.kind.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:var(--sub);margin-top:6px">${opt.desc}</div>
      </div></div>`;
    el.onclick=()=>{ if(opt.kind==='perk'){ gainPerk(state.inventory, player, opt.id); } else { gainWeapon(state.inventory, player, opt.id); } recalcPlayerFromEquipment(player, state.inventory); renderInvIcons(); resumeAfterLevelup(); };
    hud.upgrid.appendChild(el);
  }
}
function resumeAfterLevelup(){ if(levelKeyHandler){ window.removeEventListener('keydown', levelKeyHandler, true); levelKeyHandler=null; } hud.levelup.classList.remove('show'); state.inLevelup=false; state.running=true; state.last=performance.now(); }

// ──────────────────────────────────────────────────────────────────────────
// 인벤/디버그 토글
function openInventory(){ if(state.inInventory||state.inLevelup||state.over||state.inDebug) return; state.inInventory=true; state.paused=true; invUI.render(state.inventory, defsIndex); invUI.show(); }
function closeInventory(){ if(!state.inInventory) return; invUI.hide(); state.inInventory=false; state.paused=false; state.last=performance.now(); renderInvIcons(); }
function openDebug(){ if(state.inDebug||state.inLevelup||state.over||state.inInventory) return; state.inDebug=true; state.paused=true; debugUI.render(); debugUI.show(); }
function closeDebug(){ if(!state.inDebug) return; debugUI.hide(); state.inDebug=false; state.paused=false; state.last=performance.now(); }

// ──────────────────────────────────────────────────────────────────────────
// Controls / UI
hud.pauseBtn.onclick=()=>{ if(state.over||state.inLevelup||state.inInventory||state.inDebug||!state.running) return; state.paused=!state.paused; hud.pauseBtn.textContent=state.paused?'계속':'일시정지'; };
hud.restartBtn.onclick=()=>{ reset(); hud.start.classList.add('show'); };
hud.startBtn.onclick=()=>{ hud.start.classList.remove('show'); state.running=true; state.last=performance.now(); };
document.getElementById('again').onclick=()=>{ hud.over.classList.remove('show'); reset(); hud.start.classList.remove('show'); state.running=true; state.last=performance.now(); };

hud.skinBtn.onclick=()=>hud.skins.classList.add('show');
hud.skinClose.onclick=()=>hud.skins.classList.remove('show');
hud.pSize.oninput=()=>{ assets.pSize=Number(hud.pSize.value); assets.save(); };
hud.eSize.oninput=()=>{ assets.eSize=Number(hud.eSize.value); assets.save(); };
hud.pFile.onchange=(e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ assets.p=img; hud.pPrev.src=r.result; assets.save(); }; img.src=r.result; }; r.readAsDataURL(f); };
hud.eFile.onchange=(e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ assets.e=img; hud.ePrev.src=r.result; assets.save(); }; img.src=r.result; }; r.readAsDataURL(f); };
hud.pClear.onclick=()=>{ assets.p=null; hud.pPrev.removeAttribute('src'); assets.save(); };
hud.eClear.onclick=()=>{ assets.e=null; hud.ePrev.removeAttribute('src'); assets.save(); };

window.addEventListener('keydown', (e)=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Space','w','a','s','d','W','A','S','D'].includes(e.key)) e.preventDefault();
  input.keys[e.key]=true;
  if(e.key==='p'||e.key==='P'){ if(!state.over&&!state.inLevelup&&!state.inInventory&&!state.inDebug&&state.running){ state.paused=!state.paused; hud.pauseBtn.textContent=state.paused?'계속':'일시정지'; } }
  if(e.key==='i'||e.key==='I'){ if(state.inInventory) closeInventory(); else openInventory(); }
  if(e.key==='Escape'){ if(state.inInventory) { closeInventory(); } else if(state.inDebug) { closeDebug(); } }
},{passive:false});
window.addEventListener('keyup',(e)=>{ input.keys[e.key]=false; });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') state.last=performance.now(); });

// ──────────────────────────────────────────────────────────────────────────
// Debug 버튼: “다시 시작” 버튼 옆에 배치
(function attachDebugButtonNextToRestart(){
  const btn = document.createElement('button');
  btn.textContent = 'Debug';
  Object.assign(btn.style, { marginLeft:'8px' });
  btn.className = hud.restartBtn.className || ''; // HUD 버튼 스타일 재사용
  hud.restartBtn.insertAdjacentElement('afterend', btn);
  btn.onclick = ()=>{ if(state.inDebug) closeDebug(); else openDebug(); };
})();

// ──────────────────────────────────────────────────────────────────────────
// 메인 루프
function step(){
  if(state.paused||state.inLevelup||state.inInventory||state.inDebug||!state.running) return;
  state.timeSurvived += state.dt; player.iTime = Math.max(0, player.iTime - state.dt);

  if(updateSpawn(state, state.dt)) spawnEnemy(state, cvs);

  const mv=input.getMove(); const sp=player.speed*player.speedMul;
  player.x = clamp(player.x + mv.x*sp*state.dt, player.r, cvs.clientWidth - player.r);
  player.y = clamp(player.y + mv.y*sp*state.dt, player.r, cvs.clientHeight - player.r);
  if(player.hp<player.maxHp) player.hp = Math.min(player.maxHp, player.hp + player.regen*state.dt);

  updateWeapons(state, player, state.dt, { tryShootFromPlayer: ()=>tryShoot(state, player, state.dt), dropGem: dropAt });
  updateBullets(state, cvs);
  updateEnemies(state, player, cvs);
  updateExplosions(state);
  if(state.gameOver){ gameOver(); return; }
  updateGems(state, player);

  if(state.requestLevelup && !state.inLevelup){ state.requestLevelup=false; levelUp(); }
  updateHUD();
}

function render(){
  const ctx=renderer.ctx;
  renderer.clear(); renderer.drawGrid();

  // player
  ctx.save(); ctx.translate(player.x, player.y);
  if(player.iTime>0){ ctx.fillStyle='rgba(122,203,255,0.25)'; ctx.beginPath(); ctx.arc(0,0,player.r+8,0,Math.PI*2); ctx.fill(); }
  if(assets.p){ const s=player.r*2*(assets.pSize||1); ctx.drawImage(assets.p, -s/2, -s/2, s, s); }
  else { ctx.fillStyle='#7acbff'; ctx.beginPath(); ctx.arc(0,0,player.r,0,Math.PI*2); ctx.fill(); }
  ctx.restore();

  // 탄창 위젯
  renderMagWidgets(renderer.ctx, state, player);

  // 근접 텔레그래프/효과
  renderMelee(renderer.ctx, state, player);

  // bullets
  for(const b of state.bullets){
    ctx.fillStyle = b.color || '#e7f0ff';
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
  }

  // boomerangs
  ctx.fillStyle='#9be7ff';
  for(const b of state.booms){ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); }

  // orbitals
  ctx.fillStyle='#8ef9d0'; for(const o of state._orbitalVis){ ctx.beginPath(); ctx.arc(o.x,o.y,6,0,Math.PI*2); ctx.fill(); }

  // grenades
  ctx.fillStyle='#a7ffd1';
  for(const g of state.grenades){ ctx.beginPath(); ctx.arc(g.x,g.y,g.r||6,0,Math.PI*2); ctx.fill(); }

  // zombies
  for(const z of state.zombies){
    ctx.fillStyle='#baff8c'; ctx.beginPath(); ctx.arc(z.x,z.y, z.r||10, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=1; ctx.stroke();
  }

  // beams (laser)
  for(const b of state.beams){
    const a = clamp(b.t/0.08, 0, 1);
    ctx.globalAlpha = a;
    ctx.strokeStyle = b.color || '#9ff0ff';
    ctx.lineWidth = b.w || 8;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // arcs (chain lightning)
  for(const a of state.arcs){
    const alpha = clamp(a.t/0.10, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = a.color || '#a6d2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(const s of a.segs){ ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); }
    ctx.stroke(); ctx.globalAlpha=1;
  }

  // explosions
  for(const ex of state.explosions){
    const alpha = clamp(ex.t/0.22, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,196,120,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r||60, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // enemies
  for(const e of state.enemies){
    if(assets.e){ const s=e.r*2*(assets.eSize||1); ctx.drawImage(assets.e, e.x-s/2, e.y-s/2, s, s); }
    else { ctx.fillStyle='#ff7575'; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); }
    const ratio=clamp(e.hp/e.maxHp,0,1);
    ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(e.x,e.y,e.r+3,-Math.PI/2,-Math.PI/2+ratio*Math.PI*2); ctx.stroke();
  }

  // drops
  for(const g of state.gems){
    if (g.kind === 'addon') {
      const isUnique = g.unique;
      const x=g.x-6, y=g.y-6, w=12, h=12, r=3;
      if (renderer.ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
        ctx.fillStyle = isUnique ? '#ffd64a' : '#b28cff'; ctx.fill();
        if (isUnique) { ctx.strokeStyle = 'rgba(255,214,74,.9)'; ctx.lineWidth = 1; ctx.stroke(); }
      } else {
        ctx.fillStyle = isUnique ? '#ffd64a' : '#b28cff'; ctx.fillRect(x,y,w,h);
      }
    } else {
      ctx.fillStyle='#59e3a7';
      ctx.beginPath(); ctx.arc(g.x,g.y,g.r||6,0,Math.PI*2); ctx.fill();
    }
  }

  // texts
  for(let i=state.texts.length-1;i>=0;i--){
    const f=state.texts[i]; f.y-=24*state.dt; f.a=(f.a??1)-1.2*state.dt;
    ctx.globalAlpha=Math.max(0,f.a); ctx.fillStyle='#fff'; ctx.font='12px ui-monospace,monospace'; ctx.fillText(f.t, f.x, f.y); ctx.globalAlpha=1;
    if(f.a<=0) state.texts.splice(i,1);
  }
}

function loop(now){
  const dt=Math.min(0.033,(now-(state.last||now))/1000);
  state.last=now; state.dt=Number.isFinite(dt)&&dt>=0?dt:0;
  if(state.running && !state.paused) step();
  render();
  requestAnimationFrame(loop);
}

function boot(){
  reset();
  assets.loadSaved().then(()=>assets.loadDefaultsIfEmpty());
  renderInvIcons();
  requestAnimationFrame(loop);
}
boot();
