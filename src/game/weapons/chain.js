// src/game/weapons/chain.js
// 번개사슬 — 사거리 기반 타게팅 & 연쇄.
// 요구사항: 사거리 = 블래스터 사거리의 2/3, 연쇄 사거리도 비례 증가.
import { calcMods } from '../Addons.js';
import blaster from './blaster.js';

const BLASTER_RANGE = blaster?.baseRange ?? 520;

export default {
  id: 'wpn_chain',
  name: '번개사슬',
  desc: '가장 가까운 적에게 번개를 내리고 주변으로 연쇄',
  icon: 'assets/weapons/wpn_chain.png',
  maxLvl: 5,
  tags: ['무기','발사','원거리'],

  baseInterval: 0.9,
  // ★ 블래스터 사거리의 2/3
  baseRange: Math.round(BLASTER_RANGE * 2 / 3), // 347 (BLASTER=520 일 때)
  // 연쇄 사거리는 유효 사거리 * 이 비율 (사거리 애드온에 함께 비례함)
  linkRangeFactor: 0.70,

  create(){
    return { id:this.id, type:'chain', lvl:1, cd:0, addons:[] };
  },

  update(inst, api){
    const { dt, player, state, dropGem } = api;
    const mods = calcMods(inst); // rangeMul, dmgMul, cdMul
    const levelMul = Math.pow(0.985, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    inst.cd -= dt; if (inst.cd > 0) return;

    // 유효 사거리/연쇄 사거리 (애드온 rangeMul 반영)
    const range = this.baseRange * (mods.rangeMul || 1);
    const linkRange = range * (this.linkRangeFactor || 0.7);

    // 사거리 내 최단거리 적 탐색
    let first = null, best = 1e15;
    for (const e of state.enemies){
      const dx = e.x - player.x, dy = e.y - player.y, d2 = dx*dx + dy*dy;
      if (d2 <= range*range && d2 < best){ best = d2; first = e; }
    }
    if (!first){ inst.cd = interval*0.4; return; }

    // 레벨별 연쇄 횟수: 3 / 4 / 4 / 5 / 5
    const jumpsByLvl = [3,4,4,5,5];
    const jumps = jumpsByLvl[Math.min(inst.lvl-1, jumpsByLvl.length-1)];
    const dmg = player.dmg * (0.85 + 0.10*(inst.lvl-1)) * (mods.dmgMul||1);

    const visited = new Set();
    const pushArc = (x1,y1,x2,y2)=>{
      state.arcs ??= [];
      state.arcs.push({ x1,y1,x2,y2, t:0.08 });
    };

    // 1타 (플레이어 → 첫 대상)
    pushArc(player.x, player.y, first.x, first.y);
    first.hp -= dmg;
    if (first.hp <= 0){
      const ix = state.enemies.indexOf(first);
      if (ix>=0){ state.enemies.splice(ix,1); state.score+=25; dropGem(first.x,first.y); }
    } else visited.add(first);

    // 연쇄
    let last = first;
    for (let k=1; k<jumps; k++){
      // 마지막 대상에서 linkRange 내 미방문 적 탐색
      let next = null, best2 = 1e15;
      for (const e of state.enemies){
        if (visited.has(e)) continue;
        const dx = e.x - last.x, dy = e.y - last.y, d2 = dx*dx + dy*dy;
        if (d2 <= linkRange*linkRange && d2 < best2){ best2 = d2; next = e; }
      }
      if (!next) break;

      pushArc(last.x, last.y, next.x, next.y);
      next.hp -= dmg;
      if (next.hp <= 0){
        const ix = state.enemies.indexOf(next);
        if (ix>=0){ state.enemies.splice(ix,1); state.score+=25; dropGem(next.x,next.y); }
      } else visited.add(next);
      last = next;
    }

    inst.cd = interval;
  }
};
