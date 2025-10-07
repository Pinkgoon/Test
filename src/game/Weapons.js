// src/game/Weapons.js
// 무기 정의(태그/아이콘/기본쿨) + 발사 로직
// 오비탈/부메랑 + ★레이저/번개사슬/수류탄/미사일/좀비 + (샷건/미사일) 탄창 시스템

import { calcMods } from './Addons.js';

const TAU = Math.PI * 2;

function fanAngles(a, tri) { return tri ? [a - 0.20, a, a + 0.20] : [a]; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

export const WEAPON_DEFS = [
  // ───────────────────────── 기존 4종
  {
    id: 'wpn_blaster',
    name: '블래스터',
    desc: '기본 자동 조준 사격',
    icon: 'assets/weapons/wpn_blaster.png',
    maxLvl: 5,
    tags: ['무기','비관통','발사','원거리'],
    baseInterval: 0.45,
    create() { return { id:'wpn_blaster', type:'blaster', lvl:1, cd:0, addons:[] }; },
    update(inst, api) {
      const mods = calcMods(inst); const tri = !!mods.tri;
      inst.cd -= api.dt; if (inst.cd > 0) return;
      inst.cd = Math.max(0.06, (this.baseInterval * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const tgt = api.findNearestEnemy(api.player.x, api.player.y); if(!tgt) return;
      const a0 = Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x);
      const shots = (api.player.projectiles||1) + mods.proj;
      const spread = Math.min(0.18, 0.08 + 0.02*(shots-1));
      const speed  = api.player.bulletSpd || 520;
      const dmg    = api.player.dmg * Math.pow(1.0, inst.lvl-1) * mods.dmgMul;
      const pierce = ((api.player.pierce||0) + (mods.pierce||0))|0;

      for (let i=0;i<shots;i++){
        const t = shots===1 ? 0 : (i/(shots-1)-0.5);
        const a = a0 + t*spread;
        for (const ang of fanAngles(a, tri)) {
          api.pushBullet({
            x: api.player.x, y: api.player.y,
            vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed,
            r: 4, dmg, life: 1.0, pierce,
            burn: mods.burn, freeze: mods.freeze,
            color: '#cfe8ff'
          });
        }
      }
    }
  },
  // ── ★ 탄창 무기: 샷건
  {
    id: 'wpn_shotgun',
    name: '샷건',
    desc: '주기적으로 산탄 발사 (탄창 2 / 장전 3초)',
    icon: 'assets/weapons/wpn_shotgun.png',
    maxLvl: 5,
    // ★ 탄창 태그 추가
    tags: ['무기','비관통','발사','원거리','탄창'],
    baseInterval: 0.9,
    // ★ 탄창 파라미터
    magCap: 2,
    reloadTime: 3.0,
    create() {
      return { id:'wpn_shotgun', type:'shotgun', lvl:1, cd:0, addons:[],
        magCap: this.magCap, mag: this.magCap, reloadTime: this.reloadTime, reloadT:0, reloading:false };
    },
    update(inst, api) {
      const mods = calcMods(inst); const tri = !!mods.tri;

      // ── ★ 장전 처리
      if (inst.reloading) {
        inst.reloadT -= api.dt;
        if (inst.reloadT <= 0) { inst.reloading = false; inst.mag = inst.magCap; }
        return;
      }

      // 쿨타임
      inst.cd -= api.dt; if (inst.cd > 0) return;

      // 탄약 확인 → 0이면 장전 시작
      if ((inst.mag|0) <= 0) {
        inst.reloading = true; inst.reloadT = inst.reloadTime;
        return;
      }

      // 발사
      const levelMul = Math.pow(0.92, inst.lvl-1);
      inst.cd = Math.max(0.12, (this.baseInterval * levelMul * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const tgt = api.findNearestEnemy(api.player.x, api.player.y); if(!tgt) return;
      const a0 = Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x);

      const pellets = 6 + (inst.lvl-1) + mods.proj;
      const spread  = 0.35;
      const speed   = 520;
      const dmg     = api.player.dmg * (0.70 * (1 + 0.10*(inst.lvl-1))) * mods.dmgMul; // 약간 상향
      const pierce  = ((api.player.pierce||0) + (mods.pierce||0))|0;

      for(let k=0;k<pellets;k++){
        const t = pellets===1?0:(k/(pellets-1)-0.5);
        const a = a0 + t*spread;
        for (const ang of fanAngles(a, tri)) {
          api.pushBullet({
            x: api.player.x, y: api.player.y,
            vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed,
            r: 4, dmg, life: 0.75, pierce,
            burn: mods.burn, freeze: mods.freeze,
            color: '#ffcf9a'
          });
        }
      }

      // 탄 한 발 소모
      inst.mag = Math.max(0, (inst.mag|0) - 1);
      if (inst.mag === 0) { inst.reloading = true; inst.reloadT = inst.reloadTime; }
    }
  },
  {
    id: 'wpn_boomerang',
    name: '부메랑',
    desc: '되돌아오는 투척체',
    icon: 'assets/weapons/wpn_boomerang.png',
    maxLvl: 5,
    tags: ['무기','관통','발사','원거리'],
    baseInterval: 1.2,
    create() { return { id:'wpn_boomerang', type:'boomerang', lvl:1, cd:0, addons:[] }; },
    update(inst, api) {
      const mods = calcMods(inst); const tri = !!mods.tri;
      inst.cd -= api.dt; if (inst.cd > 0) return;
      inst.cd = Math.max(0.18, (this.baseInterval * Math.pow(0.92, inst.lvl-1) * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const tgt = api.findNearestEnemy(api.player.x, api.player.y); if(!tgt) return;
      const a0 = Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x);
      const spd = 340 + 15*(inst.lvl-1);
      const dmg = Math.max(10, api.player.dmg * (1.10 * (1 + 0.12*(inst.lvl-1))) * mods.dmgMul);

      for (const ang of fanAngles(a0, tri)) {
        api.state.booms.push({
          x: api.player.x, y: api.player.y,
          vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
          r: 8, dmg, life: 0.65, returning: false, lvl: inst.lvl,
          burn: mods.burn, freeze: mods.freeze,
          color: '#9be7ff'
        });
      }
    }
  },
  {
    id: 'wpn_orbital',
    name: '오비탈',
    desc: '플레이어 주변 위성 지속 피해',
    icon: 'assets/weapons/wpn_orbital.png',
    maxLvl: 5,
    tags: ['무기','소환','원거리'],
    baseInterval: 999,
    create() { return { id:'wpn_orbital', type:'orbital', lvl:1, angle:0, addons:[] }; },
    update(inst, api) {
      const want = 2 + Math.floor((inst.lvl - 1) / 2);
      api.ensureOrbitals(want);
    }
  },

  // ───────────────────────── 신규 5종
  // 1) 레이저 — 가장 먼 적을 향해 관통 직선 레이저
  {
    id: 'wpn_laser',
    name: '레이저',
    desc: '가장 먼 적을 관통하는 직선 레이저',
    icon: 'assets/weapons/wpn_laser.png',
    maxLvl: 5,
    tags: ['무기','관통','발사','원거리'],
    baseInterval: 1.0,
    create() { return { id:'wpn_laser', type:'laser', lvl:1, cd:0, addons:[] }; },
    update(inst, api) {
      const mods = calcMods(inst);
      inst.cd -= api.dt; if(inst.cd>0) return;
      const levelMul = Math.pow(0.95, inst.lvl-1);
      inst.cd = Math.max(0.15, (this.baseInterval * levelMul * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const far = findFarthestEnemy(api.state.enemies, api.player.x, api.player.y);
      if (far < 0) return;
      const eT = api.state.enemies[far];
      const x1 = api.player.x, y1 = api.player.y;
      const x2 = eT.x, y2 = eT.y;
      const ux = (x2-x1), uy=(y2-y1); const len = Math.hypot(ux,uy)||1; const vx=ux/len, vy=uy/len;

      const halfW = 6;
      const dmg = api.player.dmg * (1.10 + 0.05*(inst.lvl-1)) * mods.dmgMul;

      for(let i=api.state.enemies.length-1;i>=0;i--){
        const e=api.state.enemies[i];
        const dx=e.x-x1, dy=e.y-y1;
        const proj = dx*vx + dy*vy;
        if (proj < 0 || proj > len+12) continue;
        const px = x1 + vx*proj, py = y1 + vy*proj;
        const d2 = dist2(px,py,e.x,e.y);
        if (d2 <= (e.r + halfW)*(e.r + halfW)) {
          e.hp -= dmg;
          if (e.hp <= 0) { api.state.enemies.splice(i,1); api.state.score+=25; api.dropGem(e.x,e.y); }
        }
      }

      api.state.beams.push({ x1, y1, x2, y2, t: 0.08, w: halfW*2, color: '#9ff0ff' });
    }
  },

  // 2) 번개사슬 — 가까운 적부터 사거리 내 연쇄
  {
    id: 'wpn_chain',
    name: '번개사슬',
    desc: '가장 가까운 적부터 사거리 내 연쇄 타격',
    icon: 'assets/weapons/wpn_chain.png',
    maxLvl: 5,
    tags: ['무기','비관통','원거리'],
    baseInterval: 1.05,
    create() { return { id:'wpn_chain', type:'chain', lvl:1, cd:0, addons:[] }; },
    update(inst, api) {
      const mods = calcMods(inst);
      inst.cd -= api.dt; if(inst.cd>0) return;
      inst.cd = Math.max(0.16, (this.baseInterval * Math.pow(0.96, inst.lvl-1) * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const startIdx = api.findNearestIdx(api.player.x, api.player.y);
      if (startIdx < 0) return;

      const chainByLvl = [3,4,4,5,5];
      const hops = chainByLvl[clamp(inst.lvl-1,0,4)];
      const range = 220 + 30*(inst.lvl-1);
      const dmg = api.player.dmg * (0.85 + 0.08*(inst.lvl-1)) * mods.dmgMul;

      const used = new Set();
      let curIdx = startIdx;
      const segs = [];
      let fromX = api.player.x, fromY = api.player.y;
      for(let h=0; h<hops; h++){
        if (curIdx < 0) break;
        const e = api.state.enemies[curIdx];
        used.add(curIdx);

        e.hp -= dmg;
        if (e.hp <= 0) { api.state.enemies.splice(curIdx,1); api.state.score+=25; api.dropGem(e.x,e.y); }

        segs.push({ x1: fromX, y1: fromY, x2: e.x, y2: e.y });
        fromX = e.x; fromY = e.y;

        let best=-1,bestD=1e15;
        for(let i=0;i<api.state.enemies.length;i++){
          if (used.has(i)) continue;
          const d2 = dist2(fromX,fromY, api.state.enemies[i].x, api.state.enemies[i].y);
          if (d2 < bestD && d2 <= range*range){ bestD=d2; best=i; }
        }
        curIdx = best;
      }

      if (segs.length){
        api.state.arcs.push({ segs, t: 0.10, color:'#a6d2ff' });
      }
    }
  },

  // 3) 수류탄 — 일정 시간 뒤 폭발
  {
    id: 'wpn_grenade',
    name: '수류탄',
    desc: '던져서 터뜨린다 (범위 피해)',
    icon: 'assets/weapons/wpn_grenade.png',
    maxLvl: 5,
    tags: ['무기','비관통','발사','원거리'],
    baseInterval: 1.25,
    create() { return { id:'wpn_grenade', type:'grenade', lvl:1, cd:0, addons:[] }; },
    update(inst, api) {
      const mods = calcMods(inst);
      inst.cd -= api.dt; if(inst.cd>0) return;
      inst.cd = Math.max(0.28, (this.baseInterval * Math.pow(0.95, inst.lvl-1) * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const tgt = api.findNearestEnemy(api.player.x, api.player.y); if(!tgt) return;
      const a = Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x);
      const spd = 300;
      const travel = 0.7 + 0.05*(inst.lvl-1);
      const rad = 70 + 8*(inst.lvl-1);
      const dmg = api.player.dmg * (1.20 + 0.12*(inst.lvl-1)) * mods.dmgMul;

      api.state.grenades.push({
        x: api.player.x, y: api.player.y,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        t: travel, r: 6,
        explodeRadius: rad, explodeDmg: dmg
      });
    }
  },

  // 4) ★ 탄창 무기: 미사일 런쳐 — 직선 비행, 피격/소멸 시 폭발
  {
    id: 'wpn_missile',
    name: '미사일 런쳐',
    desc: '직선 비행 후 폭발 (탄창 1 / 장전 2초)',
    icon: 'assets/weapons/wpn_missile.png',
    maxLvl: 5,
    tags: ['무기','비관통','발사','원거리','탄창'],
    baseInterval: 0.85,
    // ★ 탄창 파라미터
    magCap: 1,
    reloadTime: 2.0,
    create() {
      return { id:'wpn_missile', type:'missile', lvl:1, cd:0, addons:[],
        magCap: this.magCap, mag: this.magCap, reloadTime: this.reloadTime, reloadT:0, reloading:false };
    },
    update(inst, api) {
      const mods = calcMods(inst);

      // ── ★ 장전 처리
      if (inst.reloading) {
        inst.reloadT -= api.dt;
        if (inst.reloadT <= 0) { inst.reloading = false; inst.mag = inst.magCap; }
        return;
      }

      inst.cd -= api.dt; if(inst.cd>0) return;

      if ((inst.mag|0) <= 0) {
        inst.reloading = true; inst.reloadT = inst.reloadTime;
        return;
      }

      inst.cd = Math.max(0.22, (this.baseInterval * Math.pow(0.96, inst.lvl-1) * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const tgt = api.findNearestEnemy(api.player.x, api.player.y); if(!tgt) return;
      const a = Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x);
      const spd = 420;
      const dmg = api.player.dmg * (0.80 + 0.10*(inst.lvl-1)) * mods.dmgMul; // 약간 상향
      const rad = 60 + 8*(inst.lvl-1);

      api.pushBullet({
        x: api.player.x, y: api.player.y,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        r: 5, dmg, life: 1.2, pierce: 0,
        color:'#ffb3b3',
        explodeOnHit: true, explodeOnEnd: true,
        explodeRadius: rad, explodeDmg: dmg*1.6
      });

      inst.mag = Math.max(0, (inst.mag|0) - 1);
      if (inst.mag === 0) { inst.reloading = true; inst.reloadT = inst.reloadTime; }
    }
  },

  // 5) 좀비 소환서 — 일정 주기로 소환
  {
    id: 'wpn_zbook',
    name: '좀비 소환서',
    desc: '좀비를 소환하여 적에게 돌진시키는 소환 무기',
    icon: 'assets/weapons/wpn_zbook.png',
    maxLvl: 5,
    tags: ['무기','소환','원거리'],
    baseInterval: 2.2,
    create() { return { id:'wpn_zbook', type:'zbook', lvl:1, cd:0, addons:[] }; },
    update(inst, api) {
      const mods = calcMods(inst);
      inst.cd -= api.dt; if(inst.cd>0) return;
      inst.cd = Math.max(0.8, (this.baseInterval * Math.pow(0.94, inst.lvl-1) * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul));

      const zLife = 6.0 + 0.4*(inst.lvl-1);
      const zSpd  = 150 + 6*(inst.lvl-1);
      const zDmg  = api.player.dmg * (0.45 + 0.1*(inst.lvl-1)) * mods.dmgMul;

      api.state.zombies.push({
        x: api.player.x, y: api.player.y, r: 10,
        life: zLife, speed: zSpd, dmg: zDmg,
        hitCd: 0
      });
    }
  },
];

// ──────────────────────────────────────────────────────────────────────────
// 헬퍼들
export function getWeaponById(id) { return WEAPON_DEFS.find(w => w.id === id) || null; }
export function createWeaponInstance(id) { const def = getWeaponById(id); return def ? def.create() : null; }

function findFarthestEnemy(arr, x, y){
  let idx=-1, best=-1;
  for(let i=0;i<arr.length;i++){
    const e=arr[i]; const d2=dist2(x,y,e.x,e.y);
    if (d2>best){ best=d2; idx=i; }
  }
  return idx;
}

// ──────────────────────────────────────────────────────────────────────────
// 메인 업데이트 훅 (장착 무기 → 각 무기 update 호출 + 보조 시스템들)
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
  };

  for(const w of state.inventory.equipped.weapons){
    const def = getWeaponById(w.id);
    if(def?.update) def.update.call(def, w, api);
  }

  // ── 오비탈 균등 회전 & 피해
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
            state.texts.push({x:e.x,y:e.y-e.r-6,t:`-${Math.round(dmgTick)}`,a:1});
            if(e.hp<=0){ state.enemies.splice(ni,1); state.score+=25; helpers.dropGem(e.x,e.y); }
          }
        }
      }
    }
  } else state._orbitalVis = [];

  // ── 부메랑 이동/충돌
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
        if (b.burn) { e._burn = { t: b.burn.dur, dps: (e._burn?.dps||0)+b.burn.dps }; }
        if (b.freeze && Math.random()<b.freeze.chance) { e._freeze = { t: b.freeze.dur, slowMul: b.freeze.slowMul }; }
        if(e.hp<=0){ state.enemies.splice(j,1); state.score+=25; helpers.dropGem(e.x,e.y); }
      }
    }
  }

  // ── 수류탄 이동/폭발
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

  // ── 좀비 소환수
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
        if (e.hp <= 0) { state.enemies.splice(ni,1); state.score+=25; helpers.dropGem(e.x,e.y); }
      }
    }
  }

  // ── 레이저/라이트닝 비주얼 수명
  state.beams ??= []; state.arcs ??= [];
  for (let i=state.beams.length-1;i>=0;i--){ const b=state.beams[i]; b.t-=dt; if(b.t<=0) state.beams.splice(i,1); }
  for (let i=state.arcs.length-1;i>=0;i--){ const a=state.arcs[i]; a.t-=dt; if(a.t<=0) state.arcs.splice(i,1); }
}
