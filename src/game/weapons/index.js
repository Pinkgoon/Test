// src/game/weapons/index.js
// 모든 무기 모듈 등록/조회/업데이트 + 런타임(오비탈/부메랑/수류탄/좀비/근접) + 위젯/근접 렌더러 포함(단일 파일)

import blaster from './blaster.js';
import shotgun from './shotgun.js';
import boomerang from './boomerang.js';
import orbital from './orbital.js';
import laser from './laser.js';
import chain from './chain.js';
import grenade from './grenade.js';
import missile from './missile.js';
import zbook from './zbook.js';
// melee
import greatsword from './melee_greatsword.js';
import rapier from './melee_rapier.js';

import { clamp, applyKnockback } from '../Systems.js';

export const WEAPON_DEFS = [
  blaster, shotgun, boomerang, orbital,
  laser, chain, grenade, missile, zbook,
  // melee
  greatsword, rapier,
];

// 항상 최신 배열 반환(레벨업/디버그 UI에서 사용)
export function allWeapons(){ return WEAPON_DEFS; }
export function getWeaponById(id) { return allWeapons().find(w => w.id === id) || null; }
export function createWeaponInstance(id) { const def = getWeaponById(id); return def ? def.create() : null; }

// ──────────────────────────────────────────────────────────────────────────
// 런타임 유틸
const TAU = Math.PI*2;
const dist2=(ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const withinSector=(px,py,cx,cy,dir,halfAng,rad)=>{
  const dx=px-cx, dy=py-cy; const d=Math.hypot(dx,dy); if(d>rad) return false;
  const ang=Math.atan2(dy,dx); let da=Math.atan2(Math.sin(ang-dir), Math.cos(ang-dir));
  return Math.abs(da) <= halfAng;
};
const linePointDist2=(x1,y1,x2,y2,px,py)=>{
  const vx=x2-x1, vy=y2-y1; const wx=px-x1, wy=py-y1;
  const c1 = vx*wx + vy*wy;
  if (c1 <= 0) return dist2(px,py,x1,y1);
  const c2 = vx*vx + vy*vy;
  if (c2 <= c1) return dist2(px,py,x2,y2);
  const b = c1 / c2;
  const bx = x1 + b*vx, by = y1 + b*vy;
  return dist2(px,py,bx,by);
};

// ──────────────────────────────────────────────────────────────────────────
// 메인: 장착 무기 업데이트 + 각 서브시스템 처리
export function updateWeapons(state, player, dt, helpers) {
  const api = {
    dt, state, player,
    pushBullet(b){ state.bullets.push(b); },
    tryShootFromPlayer: helpers.tryShootFromPlayer,
    dropGem: helpers.dropGem,
    findNearestEnemy(x,y){
      let ni=-1, best=1e15;
      for(let i=0;i<state.enemies.length;i++){
        const e=state.enemies[i]; const dx=x-e.x, dy=y-e.y, d2=dx*dx+dy*dy;
        if(d2<best){best=d2; ni=i;}
      }
      return ni>=0 ? state.enemies[ni] : null;
    },
    findNearestIdx(x,y){
      let ni=-1, best=1e15;
      for(let i=0;i<state.enemies.length;i++){
        const e=state.enemies[i]; const dx=x-e.x, dy=y-e.y, d2=dx*dx+dy*dy;
        if(d2<best){best=d2; ni=i;}
      }
      return ni;
    },
    ensureOrbitals(min){
      if(!state.orbitals) state.orbitals=[];
      while(state.orbitals.length<min) state.orbitals.push({ tick:0 });
      if(state.orbitals.length>min) state.orbitals.length=min;
    },
    // 근접 텔레그래프 enqueue
    queueTelegraph(obj){
      state.melee ??= { tele:[], effects:[] };
      obj.elapsed = 0; obj.fired = false;
      state.melee.tele.push(obj);
    },
  };

  // 장착 무기 업데이트
  for(const w of state.inventory.equipped.weapons){
    const def = getWeaponById(w.id);
    def?.update?.call(def, w, api);
  }

  // ── 오비탈(균등 배치, 넉백 0)
  const n = state.orbitals?.length || 0;
  if (n > 0) {
    state.orbitalBase = (state.orbitalBase || 0) + dt * 1.8;
    const rad = 36, radiusHit = 26;
    const lvlSum = state.inventory.equipped.weapons.filter(w=>w.id==='wpn_orbital').reduce((a,w)=>a+(w.lvl||1),0);
    const dmgTick = Math.max(6, player.dmg * (0.35 + 0.05 * (lvlSum - 1)));

    state._orbitalVis = [];
    for (let i=0;i<n;i++) {
      const o = state.orbitals[i]; o.tick = (o.tick || 0) + dt;
      const ang = (state.orbitalBase) + i * (TAU / n);
      const ox = player.x + Math.cos(ang) * rad;
      const oy = player.y + Math.sin(ang) * rad;
      state._orbitalVis.push({ x: ox, y: oy, r: radiusHit });

      if (o.tick >= 0.15) {
        o.tick = 0;
        let ni=-1, best=1e15;
        for(let j=0;j<state.enemies.length;j++){
          const e=state.enemies[j]; const dx=ox-e.x, dy=oy-e.y, d2=dx*dx+dy*dy;
          if(d2<best){best=d2; ni=j;}
        }
        if (ni >= 0) {
          const e = state.enemies[ni];
          const d2 = dist2(ox,oy,e.x,e.y);
          const hitR = (radiusHit + e.r);
          if (d2 <= hitR*hitR) {
            e.hp -= dmgTick;
            // 오비탈 넉백 0 (요구사항)
            if(e.hp<=0){ state.enemies.splice(ni,1); state.score+=25; helpers.dropGem(e.x,e.y); }
          }
        }
      }
    }
  } else state._orbitalVis = [];

  // ── 부메랑(복귀형, 넉백 0)
  if(!state.booms) state.booms=[];
  for(let i=state.booms.length-1;i>=0;i--){
    const b=state.booms[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(!b.returning && b.life<=0){ b.returning=true; b.life=0.65; }
    if(b.returning){
      const dx=player.x-b.x, dy=player.y-b.y; const l=Math.hypot(dx,dy)||1;
      const spd=420; b.vx=dx/l*spd; b.vy=dy/l*spd;
      if(l<player.r+b.r){ state.booms.splice(i,1); continue; }
    }
    for(let j=state.enemies.length-1;j>=0;j--){
      const e=state.enemies[j]; const rr=b.r+e.r; const dx=b.x-e.x, dy=b.y-e.y;
      if(dx*dx+dy*dy<=rr*rr){
        e.hp-=b.dmg;
        // 부메랑 넉백 0 (요구사항)
        if (b.burn) { e._burn = { t: b.burn.dur, dps: (e._burn?.dps||0)+b.burn.dps }; }
        if (b.freeze && Math.random()<b.freeze.chance) { e._freeze = { t: b.freeze.dur, slowMul: b.freeze.slowMul }; }
        if(e.hp<=0){ state.enemies.splice(j,1); state.score+=25; helpers.dropGem(e.x,e.y); }
      }
    }
  }

  // ── 수류탄 이동 → 폭발(실제 피해/드랍은 Systems.updateExplosions가 담당; 넉백 0)
  state.grenades ??= [];
  for (let i=state.grenades.length-1;i>=0;i--){
    const g = state.grenades[i];
    g.t -= dt;
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.t <= 0) {
      state.explosions.push({ x:g.x, y:g.y, r:g.explodeRadius, dmg:g.explodeDmg, t:0.22, did:false });
      state.grenades.splice(i,1);
    }
  }

  // ── 소환(좀비): 근접 타격 + 소량 넉백
  state.zombies ??= [];
  for (let i=state.zombies.length-1;i>=0;i--){
    const z = state.zombies[i];
    z.life -= dt; if (z.life <= 0){ state.zombies.splice(i,1); continue; }
    z.hitCd = Math.max(0, (z.hitCd||0) - dt);

    let ni=-1, best=1e15;
    for(let j=0;j<state.enemies.length;j++){
      const e=state.enemies[j]; const d2=dist2(z.x,z.y,e.x,e.y);
      if(d2<best){best=d2; ni=j;}
    }
    if (ni>=0) {
      const e = state.enemies[ni];
      const dx=e.x-z.x, dy=e.y-z.y; const l=Math.hypot(dx,dy)||1;
      z.x += dx/l * z.speed * dt; z.y += dy/l * z.speed * dt;

      const rr = (z.r||10) + (e.r||12);
      if (dist2(z.x,z.y,e.x,e.y) <= rr*rr && z.hitCd<=0){
        e.hp -= z.dmg;
        z.hitCd = 0.35;
        // 소환 근접 넉백 (약)
        applyKnockback(e, z.x, z.y, 120);
        if (e.hp <= 0) { state.enemies.splice(ni,1); state.score+=25; helpers.dropGem(e.x,e.y); }
      }
    }
  }

  // ── 근접 텔레그래프/피해/넉백
  state.melee ??= { tele:[], effects:[] };
  const tele = state.melee.tele;
  for(let i=tele.length-1;i>=0;i--){
    const t = tele[i];
    t.elapsed += dt;
    if(!t.fired && t.elapsed >= t.delay){
      t.fired = true;
      const cx = t.track ? player.x : (t.cx ?? player.x);
      const cy = t.track ? player.y : (t.cy ?? player.y);

      for(let j=state.enemies.length-1;j>=0;j--){
        const e = state.enemies[j];
        let hit=false;
        if(t.type==='arc'){
          const ok = withinSector(e.x,e.y, cx,cy, t.dir, t.halfAng, t.radius);
          if(ok) hit=true;
        } else if(t.type==='line'){
          const x2 = cx + Math.cos(t.dir)*t.length;
          const y2 = cy + Math.sin(t.dir)*t.length;
          const d2 = linePointDist2(cx,cy, x2,y2, e.x,e.y);
          if (d2 <= (t.halfW + e.r)*(t.halfW + e.r)) hit=true;
        }
        if(hit){
          e.hp -= t.dmg;
          // 근접 넉백(원거리보다 강하게)
          const kb = t.kb ?? 240;
          applyKnockback(e, cx, cy, kb);
          if(e.hp<=0){ state.enemies.splice(j,1); state.score+=25; helpers.dropGem(e.x,e.y); }
        }
      }

      state.melee.effects.push({
        type: t.type, t: 0.12,
        cx: (t.track ? player.x : (t.cx ?? player.x)),
        cy: (t.track ? player.y : (t.cy ?? player.y)),
        dir: t.dir, halfAng: t.halfAng, radius: t.radius,
        length: t.length, halfW: t.halfW,
        color: t.effectColor || (t.type==='arc' ? '#ffe3a1' : '#ffd7c0')
      });
    }
    if(t.elapsed >= (t.delay + (t.after || 0.05))) tele.splice(i,1);
  }

  // 레이저/체인/근접 이펙트 수명
  state.beams ??= []; state.arcs ??= [];
  for (let i=state.beams.length-1;i>=0;i--){ const b=state.beams[i]; b.t-=dt; if(b.t<=0) state.beams.splice(i,1); }
  for (let i=state.arcs.length-1;i>=0;i--){ const a=state.arcs[i]; a.t-=dt; if(a.t<=0) state.arcs.splice(i,1); }
  const eff = state.melee.effects;
  for(let i=eff.length-1;i>=0;i--){ const e=eff[i]; e.t -= dt; if(e.t<=0) eff.splice(i,1); }
}

// ──────────────────────────────────────────────────────────────────────────
// 탄창 위젯(플레이어 주변 원형 배치)
export function renderMagWidgets(ctx, state, player){
  const mags = state.inventory.equipped.weapons
    .map(w => ({ inst:w, def: getWeaponById(w.id)}))
    .filter(x => (x.def?.tags||[]).includes('탄창'));
  const n = mags.length; if(!n) return;

  const baseR = 54;
  const startAng = -Math.PI * 0.65;
  const endAng   = -Math.PI * 0.35;
  const step = n===1 ? 0 : (endAng - startAng) / (n - 1);

  const clamp01=(v)=>Math.max(0,Math.min(1,v));

  for(let i=0;i<n;i++){
    const {inst, def} = mags[i];
    const ang = n===1 ? -Math.PI/2 : (startAng + step*i);
    const x = player.x + Math.cos(ang) * baseR;
    const y = player.y + Math.sin(ang) * baseR;

    const r = 14;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(x, y, r+2, 0, Math.PI*2); ctx.fill();

    if (inst.reloading && inst.reloadTime>0){
      const prog = clamp01(1 - (inst.reloadT/inst.reloadTime));
      ctx.strokeStyle = '#ffd05b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*prog);
      ctx.stroke();
    } else {
      const cap = inst.magCap || 0, cur = inst.mag|0;
      const pipW = 4, gap = 2;
      const totalW = cap*pipW + (cap-1)*gap;
      let sx = x - totalW/2, sy = y - 1;
      for(let k=0;k<cap;k++){
        ctx.fillStyle = k < cur ? '#a8e1ff' : 'rgba(168,225,255,.25)';
        ctx.fillRect(sx + k*(pipW+gap), sy + r-6, pipW, 6);
      }
      ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
    }

    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.font='10px ui-monospace,monospace';
    const abbr = def?.name?.slice(0,2) || inst.id.slice(4,6).toUpperCase();
    const tw = ctx.measureText(abbr).width;
    ctx.fillText(abbr, x - tw/2, y + 3);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 근접 텔레그래프/효과 렌더러
export function renderMelee(ctx, state, player){
  state.melee ??= { tele:[], effects:[] };
  const clamp01=(v)=>Math.max(0,Math.min(1,v));
  for(const t of state.melee.tele){
    const p = clamp01(t.elapsed / Math.max(0.0001, t.delay));
    const cx = t.track ? player.x : (t.cx ?? player.x);
    const cy = t.track ? player.y : (t.cy ?? player.y);

    if (t.type === 'arc'){
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t.dir);
      ctx.fillStyle = 'rgba(255,230,150,0.10)';
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0, t.radius, -t.halfAng, +t.halfAng);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd36b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0,0, t.radius, -t.halfAng, -t.halfAng + (t.halfAng*2)*p);
      ctx.stroke();
      ctx.restore();
    } else if (t.type === 'line'){
      const x1 = cx, y1 = cy;
      const x2 = cx + Math.cos(t.dir)*t.length*p;
      const y2 = cy + Math.sin(t.dir)*t.length*p;
      ctx.strokeStyle = '#ffd36b';
      ctx.lineWidth = (t.halfW||8)*2;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for(const e of state.melee.effects){
    const a = clamp01(e.t/0.12);
    ctx.globalAlpha = a;
    if (e.type === 'arc'){
      ctx.save();
      ctx.translate(e.cx, e.cy);
      ctx.rotate(e.dir);
      ctx.strokeStyle = e.color || '#ffe3a1';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0,0, e.radius, -e.halfAng, +e.halfAng);
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'line'){
      const x1 = e.cx, y1 = e.cy;
      const x2 = e.cx + Math.cos(e.dir)*e.length;
      const y2 = e.cy + Math.sin(e.dir)*e.length;
      ctx.strokeStyle = e.color || '#ffd7c0';
      ctx.lineWidth = (e.halfW||8)*2;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
