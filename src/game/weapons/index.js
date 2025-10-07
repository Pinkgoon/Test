// src/game/weapons/index.js
// 무기 모듈 등록/조회/업데이트 + 런타임(오비탈/부메랑/수류탄/좀비/근접)
// + 탄창 UI(줄바꿈/자동 스케일, cap>10이면 '최소 크기' 강제 적용) + 슬롯별 앵커 수집
// + 배출 탄창 시뮬 + 근접/이펙트 렌더

import blaster from './blaster.js';
import shotgun from './shotgun.js';
import boomerang from './boomerang.js';
import orbital from './orbital.js';
import laser from './laser.js';
import chain from './chain.js';
import grenade from './grenade.js';
import missile from './missile.js';
import zbook from './zbook.js';
import greatsword from './melee_greatsword.js';
import rapier from './melee_rapier.js';
import machinegun from './machinegun.js';
import gatling from './gatling.js';

import { clamp, applyKnockback } from '../Systems.js';

export const WEAPON_DEFS = [
  blaster, shotgun, boomerang, orbital,
  laser, chain, grenade, missile, zbook,
  greatsword, rapier,
  machinegun, gatling,
];

export function allWeapons(){ return WEAPON_DEFS; }
export function getWeaponById(id){ return allWeapons().find(w=>w.id===id)||null; }
export function createWeaponInstance(id){ const d=getWeaponById(id); return d?d.create():null; }

const TAU=Math.PI*2;
const dist2=(ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const _dist2=dist2;
const withinSector=(px,py,cx,cy,dir,halfAng,rad)=>{
  const dx=px-cx, dy=py-cy; const d=Math.hypot(dx,dy); if(d>rad) return false;
  const ang=Math.atan2(dy,dx); let da=Math.atan2(Math.sin(ang-dir), Math.cos(ang-dir));
  return Math.abs(da) <= halfAng;
};
const linePointDist2=(x1,y1,x2,y2,px,py)=>{
  const vx=x2-x1, vy=y2-y1; const wx=px-x1, wy=py-y1;
  const c1 = vx*wx + vy*wy; if (c1 <= 0) return _dist2(px,py,x1,y1);
  const c2 = vx*vx + vy*vy; if (c2 <= c1) return _dist2(px,py,x2,y2);
  const b = c1 / c2; const bx = x1 + b*vx, by = y1 + b*vy;
  return _dist2(px,py,bx,by);
};

// ──────────────────────────────────────────────────────────────────────────
// 메인 업데이트(무기 + 특수 런타임들)
export function updateWeapons(state, player, dt, helpers){
  const api={
    dt, state, player,
    pushBullet(b){ state.bullets.push(b); },
    tryShootFromPlayer: helpers.tryShootFromPlayer,
    dropGem: helpers.dropGem,

    // 발사/소모 시 탄창 배출(슬롯 위치/크기까지 사용)
    ejectMag(def, playerRef, slotIdx=0, inst=null){
      state.ejectedMags ??= [];

      // 슬롯 앵커가 있으면 그 위치/크기 사용
      let sx = playerRef.x, sy = playerRef.y, mw = 12, mh = 20;
      if (state._magAnchors && inst){
        const anchorEntry = state._magAnchors.find(a => a.inst === inst);
        const pos = anchorEntry?.slots?.[slotIdx];
        if (pos){ sx = pos.x; sy = pos.y; mw = pos.w; mh = pos.h; }
      }

      // 앵커 방향으로 튕겨나가게 (조금 위로), 크기는 UI와 동일
      const dx = sx - playerRef.x, dy = sy - playerRef.y;
      const L  = Math.hypot(dx,dy) || 1;
      const nx = dx/L, ny = dy/L;

      const spd = 160 + Math.random()*120;
      const ux = nx*spd, uy = ny*spd - 140;

      state.ejectedMags.push({
        x: sx, y: sy,
        vx: ux, vy: uy,
        rot: Math.random()*TAU,
        vr: (-2+Math.random()*4),
        life: 3.8,
        kind: def.id,
        w: mw, h: mh,
      });
    },

    findNearestEnemy(x,y){
      let ni=-1, best=1e15;
      for(let i=0;i<state.enemies.length;i++){
        const e=state.enemies[i]; const dx=x-e.x, dy=y-e.y, d2=dx*dx+dy*dy;
        if(d2<best){best=d2; ni=i;}
      }
      return ni>=0?state.enemies[ni]:null;
    },
    findNearestIdx(x,y){
      let ni=-1, best=1e15;
      for(let i=0;i<state.enemies.length;i++){
        const e=state.enemies[i]; const dx=x-e.x, dy=y-e.y, d2=dx*dx+dy*dy;
        if(d2<best){best=d2; ni=i;}
      }
      return ni;
    },
    ensureOrbitals(min){ state.orbitals??=[]; while(state.orbitals.length<min) state.orbitals.push({tick:0}); if(state.orbitals.length>min) state.orbitals.length=min; },
    queueTelegraph(obj){ state.melee??={tele:[],effects:[]}; obj.elapsed=0; obj.fired=false; state.melee.tele.push(obj); },
  };

  // 장착 무기 업데이트
  for(const w of state.inventory.equipped.weapons){
    const def=getWeaponById(w.id);
    def?.update?.call(def, w, api);
  }

  // ── 오비탈(사거리 기반 반지름, 선속도 일정)
  const n=state.orbitals?.length||0;
  if(n>0){
    const rad=Math.max(12,state._orbitalRadius||36);
    const hitR=26;
    const linearSpeed=state._orbitalLin||65; // px/s
    const omega=linearSpeed/rad; // rad/s → 반지름이 커질수록 각속도 느려짐
    state.orbitalBase=(state.orbitalBase||0)+dt*omega;

    const lvlSum=state.inventory.equipped.weapons.filter(w=>w.id==='wpn_orbital').reduce((a,w)=>a+(w.lvl||1),0);
    const dmgTick=Math.max(6, player.dmg*(0.35+0.05*(lvlSum-1)));

    state._orbitalVis=[];
    for(let i=0;i<n;i++){
      const o=state.orbitals[i]; o.tick=(o.tick||0)+dt;
      const ang=(state.orbitalBase)+i*(TAU/n);
      const ox=player.x+Math.cos(ang)*rad, oy=player.y+Math.sin(ang)*rad;
      state._orbitalVis.push({x:ox,y:oy,r:hitR});
      if(o.tick>=0.15){
        o.tick=0;
        let ni=-1,best=1e15;
        for(let j=0;j<state.enemies.length;j++){
          const e=state.enemies[j]; const dx=ox-e.x, dy=oy-e.y, d2=dx*dx+dy*dy;
          if(d2<best){best=d2; ni=j;}
        }
        if(ni>=0){
          const e=state.enemies[ni];
          const rr=(hitR+e.r); const d2=_dist2(ox,oy,e.x,e.y);
          if(d2<=rr*rr){
            e.hp-=dmgTick;
            if(e.hp<=0){ state.enemies.splice(ni,1); state.score+=25; helpers.dropGem(e.x,e.y); }
          }
        }
      }
    }
  } else state._orbitalVis=[];

  // ── 부메랑(사거리 기반 복귀)
  state.booms??=[];
  for(let i=state.booms.length-1;i>=0;i--){
    const b=state.booms[i]; const px=b.x, py=b.y;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(!b.returning){
      const dx=b.x-px, dy=b.y-py; b.travel=(b.travel||0)+Math.hypot(dx,dy);
      if(b.travel>=(b.outRange||320)) b.returning=true;
    }
    if(b.returning){
      const dx=player.x-b.x, dy=player.y-b.y; const l=Math.hypot(dx,dy)||1;
      const sp=b.returnSpd||420; b.vx=dx/l*sp; b.vy=dy/l*sp;
      if(l<player.r+b.r){ state.booms.splice(i,1); continue; }
    }
    for(let j=state.enemies.length-1;j>=0;j--){
      const e=state.enemies[j]; const rr=b.r+e.r; const dx=b.x-e.x, dy=b.y-e.y;
      if(dx*dx+dy*dy<=rr*rr){
        e.hp-=b.dmg;
        if (b.burn) { e._burn = { t: b.burn.dur, dps: (e._burn?.dps||0)+b.burn.dps }; }
        if (b.freeze && Math.random()<b.freeze.chance) { e._freeze = { t: b.freeze.dur, slowMul: b.freeze.slowMul }; }
        if(e.hp<=0){ state.enemies.splice(j,1); state.score+=25; helpers.dropGem(e.x,e.y); }
      }
    }
  }

  // ── 수류탄 이동 → (사거리/퓨즈) 폭발
  state.grenades??=[];
  for(let i=state.grenades.length-1;i>=0;i--){
    const g=state.grenades[i]; const px=g.x, py=g.y;
    g.x+=g.vx*dt; g.y+=g.vy*dt;
    if(g.maxDist!=null){
      const dx=g.x-px, dy=g.y-py; g.travel=(g.travel||0)+Math.hypot(dx,dy);
      if(g.travel>=g.maxDist){ state.explosions.push({x:g.x,y:g.y,r:g.explodeRadius,dmg:g.explodeDmg,t:0.22,did:false}); state.grenades.splice(i,1); continue; }
    }
    if(g.t!=null){ g.t-=dt; if(g.t<=0){ state.explosions.push({x:g.x,y:g.y,r:g.explodeRadius,dmg:g.explodeDmg,t:0.22,did:false}); state.grenades.splice(i,1); continue; } }
  }

  // ── 소환(좀비) 근접
  state.zombies??=[];
  for(let i=state.zombies.length-1;i>=0;i--){
    const z=state.zombies[i]; z.life-=dt; if(z.life<=0){ state.zombies.splice(i,1); continue; }
    z.hitCd=Math.max(0,(z.hitCd||0)-dt);
    let ni=-1,best=1e15;
    for(let j=0;j<state.enemies.length;j++){
      const e=state.enemies[j]; const d2=_dist2(z.x,z.y,e.x,e.y); if(d2<best){best=d2; ni=j;}
    }
    if(ni>=0){
      const e=state.enemies[ni]; const dx=e.x-z.x, dy=e.y-z.y; const l=Math.hypot(dx,dy)||1;
      z.x+=dx/l*z.speed*dt; z.y+=dy/l*z.speed*dt;
      const rr=(z.r||10)+(e.r||12);
      if(_dist2(z.x,z.y,e.x,e.y)<=rr*rr && z.hitCd<=0){
        e.hp-=z.dmg; z.hitCd=0.35; applyKnockback(e, z.x,z.y, 120);
        if(e.hp<=0){ state.enemies.splice(ni,1); state.score+=25; helpers.dropGem(e.x,e.y); }
      }
    }
  }

  // ── 근접 텔레그래프/피해/넉백
  state.melee??={tele:[],effects:[]};
  const tele=state.melee.tele;
  for(let i=tele.length-1;i>=0;i--){
    const t=tele[i]; t.elapsed+=dt;
    if(!t.fired && t.elapsed>=t.delay){
      t.fired=true;
      const cx=t.track?player.x:(t.cx??player.x);
      const cy=t.track?player.y:(t.cy??player.y);
      for(let j=state.enemies.length-1;j>=0;j--){
        const e=state.enemies[j]; let hit=false;
        if(t.type==='arc'){ if(withinSector(e.x,e.y,cx,cy,t.dir,t.halfAng,t.radius)) hit=true; }
        else if(t.type==='line'){
          const x2=cx+Math.cos(t.dir)*t.length, y2=cy+Math.sin(t.dir)*t.length;
          const d2=linePointDist2(cx,cy,x2,y2,e.x,e.y);
          if (d2 <= (t.halfW + e.r)*(t.halfW + e.r)) hit=true;
        }
        if(hit){
          e.hp-=t.dmg; applyKnockback(e, cx,cy, t.kb??240);
          if(e.hp<=0){ state.enemies.splice(j,1); state.score+=25; helpers.dropGem(e.x,e.y); }
        }
      }
      state.melee.effects.push({
        type:t.type, t:0.12,
        cx:(t.track?player.x:(t.cx??player.x)), cy:(t.track?player.y:(t.cy??player.y)),
        dir:t.dir, halfAng:t.halfAng, radius:t.radius, length:t.length, halfW:t.halfW,
        color:t.effectColor||(t.type==='arc'?'#ffe3a1':'#ffd7c0')
      });
    }
    if(t.elapsed>=(t.delay+(t.after||0.05))) tele.splice(i,1);
  }

  // ── 레이저/체인/근접 이펙트 수명
  state.beams??=[]; state.arcs??=[];
  for(let i=state.beams.length-1;i>=0;i--){ const b=state.beams[i]; b.t-=dt; if(b.t<=0) state.beams.splice(i,1); }
  for(let i=state.arcs.length-1;i>=0;i--){ const a=state.arcs[i]; a.t-=dt; if(a.t<=0) state.arcs.splice(i,1); }

  // ── 배출된 탄창(물리 업데이트)
  state.ejectedMags??=[];
  for(let i=state.ejectedMags.length-1;i>=0;i--){
    const m=state.ejectedMags[i];
    m.life -= dt; if(m.life<=0){ state.ejectedMags.splice(i,1); continue; }
    // 중력/마찰
    m.vy += 900*dt;
    m.vx *= 0.985; m.vy *= 0.985;
    m.x += m.vx*dt; m.y += m.vy*dt;
    m.rot += m.vr*dt;
  }

  // 근접 효과 수명
  const eff=state.melee.effects;
  for(let i=eff.length-1;i>=0;i--){ const e=eff[i]; e.t-=dt; if(e.t<=0) eff.splice(i,1); }
}

// ──────────────────────────────────────────────────────────────────────────
// 탄창 위젯(줄바꿈/자동 스케일) + 슬롯별 앵커 수집 + 배출 탄창 렌더
//  - 줄바꿈: 한 줄 최대 10칸
//  - cap > 10 이면 '최소 크기' 강제 적용 (요청사항)
//  - cap ≤ 10 은 기존 자동 스케일(그룹 폭 제한 내)
export function renderMagWidgets(ctx, state, player){
  const mags = state.inventory.equipped.weapons
    .map(w => ({ inst:w, def: getWeaponById(w.id)}))
    .filter(x => (x.def?.tags||[]).includes('탄창'));
  const n = mags.length;

  // 앵커 배열 초기화
  state._magAnchors = [];

  // 배출 탄창 먼저 그리기
  renderEjectedMags(ctx, state);

  if(!n) return;

  // 플레이어 주변 배치
  const baseR = 56;
  const startAng = -Math.PI * 0.65;
  const endAng   = -Math.PI * 0.35;
  const step = n===1 ? 0 : (endAng - startAng) / (n - 1);

  // 그룹 전체 폭 제한 및 크기 파라미터
  const MAX_GROUP_W = 150;   // 그룹 목표 최대 폭(px)
  const MIN_W = 1.2;         // 최소 가로폭(이전 대비 5배 축소)
  const MAX_W = 14;
  const GAP_BASE = 3;        // 칸 간격(기준)
  const ROW_GAP  = 4;        // 줄 간격
  const PAD      = 8;        // 프레임 패딩
  const HW_ASPECT = 20/12;   // H:W 비율(기본)

  // 무기별 작은 식별 포인트 컬러
  const tipColorForKind = (kind)=>{
    if (kind==='wpn_missile') return '#ffd5a6';
    if (kind==='wpn_shotgun') return '#ffe4b8';
    if (kind==='wpn_machinegun') return '#b7ffb0';
    if (kind==='wpn_gatling') return '#b0d4ff';
    return '#a8e1ff';
  };

  for(let i=0;i<n;i++){
    const {inst, def} = mags[i];
    const cap = Math.max(1, inst.magCap|0);
    const rows = Math.ceil(cap / 10);
    const perRow = (r)=> (r < rows-1 ? 10 : (cap - 10*(rows-1)));

    // cap>10 인 무기는 무조건 최소 크기 적용
    const atMin = cap > 10;

    // 각 줄의 칸 수 중 최대치로 폭 산정
    const maxCols = rows>1 ? 10 : cap;

    // 기본 폭 산출(목표 그룹 폭을 넘지 않도록). 단, cap>10이면 최소 고정
    let MAG_W = atMin
      ? MIN_W
      : Math.min(MAX_W, Math.max(MIN_W,
          (MAX_GROUP_W - PAD - (maxCols-1)*GAP_BASE) / Math.max(1, maxCols)
        ));
    // 세로는 비율로 계산(최소 높이 보장)
    let MAG_H = Math.max(MIN_W*HW_ASPECT, MAG_W * HW_ASPECT);
    // 간격: 최소 크기일 때는 너무 벌어지지 않게 1px로
    const GAP = atMin ? 1 : Math.max(1, Math.min(6, GAP_BASE * (MAG_W/12)));

    // 그룹 폭/높이 계산
    let maxRowW = 0;
    for(let r=0;r<rows;r++){
      const cols = perRow(r);
      const rowW = cols*MAG_W + (cols-1)*GAP;
      if (rowW > maxRowW) maxRowW = rowW;
    }
    const contentH = rows*MAG_H + (rows-1)*ROW_GAP;
    const groupW = maxRowW + PAD;
    const groupH = contentH + PAD;

    const ang = n===1 ? -Math.PI/2 : (startAng + step*i);
    const x = player.x + Math.cos(ang) * baseR;
    const y = player.y + Math.sin(ang) * baseR;
    const theta = ang + Math.PI/2; // 그룹 회전(바깥을 향함)

    // 그룹 컨테이너
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(theta);

    // 프레임
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fillRect(-groupW/2, -groupH/2, groupW, groupH);

    const slotsWorld = [];

    // 줄 단위로 그리기
    let yTop = -contentH/2;
    for(let r=0;r<rows;r++){
      const cols = perRow(r);
      const rowW = cols*MAG_W + (cols-1)*GAP;
      let xLeft = -rowW/2;

      for(let c=0;c<cols;c++){
        const k = r*10 + c; // 슬롯 인덱스
        if (k >= cap) break;

        const tlx = xLeft + c*(MAG_W+GAP);
        const tly = yTop;

        const isFull = (!inst.reloading && k < (inst.mag|0));
        const fracReload = (inst.reloading && inst.reloadTime>0) ? (1 - (inst.reloadT / inst.reloadTime)) : 0;
        const frac = inst.reloading ? fracReload : (isFull ? 1 : 0);

        drawMagRectTL(ctx, tlx, tly, MAG_W, MAG_H, frac,
          'rgba(230,230,240,0.85)',
          inst.reloading ? '#ffd05b' : '#a8e1ff',
          tipColorForKind(def.id)
        );

        // 로컬 중심 좌표 → 월드 좌표 변환(회전 포함)
        const lcX = tlx + MAG_W/2, lcY = tly + MAG_H/2;
        const wx = x + (lcX*Math.cos(theta) - lcY*Math.sin(theta));
        const wy = y + (lcX*Math.sin(theta) + lcY*Math.cos(theta));
        slotsWorld.push({ x: wx, y: wy, w: MAG_W, h: MAG_H });
      }
      yTop += MAG_H + ROW_GAP;
    }

    // 앵커 저장
    state._magAnchors.push({ inst, slots: slotsWorld });

    // 무기 레이블(그룹 아래 중앙, 회전 원복 후 쓰기)
    ctx.rotate(-theta);
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.font='10px ui-monospace,monospace';
    const abbr = def?.name?.slice(0,2) || inst.id.slice(4,6).toUpperCase();
    const tw = ctx.measureText(abbr).width;
    ctx.fillText(abbr, -tw/2, (groupH/2) + 12);

    ctx.restore();
  }
}

// 라운드 직사각형(Top-Left 기반) + 아래→위 채우기 + 상단 포인트
//  - 아주 작아졌을 때도 보기 좋게: 선두께/내부 여백/상단 포인트 두께 자동 스케일
function drawMagRectTL(ctx, tlx, tly, w, h, frac, outlineColor, fillColor, tipColor){
  roundRectTL(ctx, tlx, tly, w, h, Math.min(3, Math.max(0.6, Math.min(w,h)*0.25)), outlineColor);

  // 내부 여백(양쪽/위아래) — 너무 작아질 때 음수 방지
  const m = Math.max(0.5, Math.min(2, Math.min(w, h) * 0.15));
  const ih = Math.max(0, Math.min(1, frac)) * Math.max(0, (h - 2*m));
  if (ih > 0){
    ctx.fillStyle = fillColor;
    ctx.fillRect(tlx + m, (tly + (h - m - ih)), Math.max(0.5, w - 2*m), ih);
  }

  // 상단 포인트(두께 자동 스케일)
  const tipH = Math.max(0.5, Math.min(2, h * 0.12));
  ctx.fillStyle = tipColor;
  ctx.fillRect(tlx, tly, w, tipH);
}

function roundRectTL(ctx, x, y, w, h, r, strokeColor){
  const r2 = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r2, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r2);
  ctx.arcTo(x+w, y+h, x,   y+h, r2);
  ctx.arcTo(x,   y+h, x,   y,   r2);
  ctx.arcTo(x,   y,   x+w, y,   r2);
  ctx.closePath();
  ctx.strokeStyle = strokeColor;
  // 선 두께도 크기에 맞춰 자동 스케일
  ctx.lineWidth = Math.max(0.6, Math.min(1.5, Math.min(w,h) * 0.12));
  ctx.stroke();
}

// ──────────────────────────────────────────────────────────────────────────
// 배출된 탄창 렌더(★ UI와 동일 외형/사이즈, 초소형일 때도 보기 좋게)
export function renderEjectedMags(ctx, state){
  state.ejectedMags ??= [];
  for(const m of state.ejectedMags){
    const a = Math.max(0, Math.min(1, m.life / 3.8));
    const MAG_W = m.w ?? 12, MAG_H = m.h ?? 20;
    const tipH = Math.max(0.5, Math.min(2, MAG_H * 0.12));
    const pad  = Math.max(0.5, Math.min(2, Math.min(MAG_W, MAG_H) * 0.15));

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);

    roundRectTL(ctx, -MAG_W/2, -MAG_H/2, MAG_W, MAG_H, Math.min(3, Math.max(0.6, Math.min(MAG_W,MAG_H)*0.25)), 'rgba(230,230,240,0.85)');
    ctx.fillStyle = 'rgba(60,60,70,0.85)';
    ctx.fillRect(-MAG_W/2 + pad, -MAG_H/2 + pad, Math.max(0.5, MAG_W - 2*pad), Math.max(0.5, MAG_H - 2*pad));

    // 상단 포인트(무기별)
    let tip = '#a8e1ff';
    if (m.kind==='wpn_missile') tip='#ffd5a6';
    else if (m.kind==='wpn_shotgun') tip='#ffe4b8';
    else if (m.kind==='wpn_machinegun') tip='#b7ffb0';
    else if (m.kind==='wpn_gatling') tip='#b0d4ff';
    ctx.fillStyle = tip;
    ctx.fillRect(-MAG_W/2, -MAG_H/2, MAG_W, tipH);

    ctx.restore();
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
