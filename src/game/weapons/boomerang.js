// src/game/weapons/boomerang.js
// 부메랑 — ★사거리(outRange) 기반 왕복 (rangeMul 애드온 대응)
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_boomerang',
  name: '부메랑',
  desc: '던졌다가 돌아오는 관통 무기',
  icon: 'assets/weapons/wpn_boomerang.png',
  maxLvl: 5,
  tags: ['무기','관통','발사','원거리'],

  baseInterval: 0.95,
  baseOutSpeed: 480,
  baseOutRange: 330, // ★ 이전 life≈0.65s 체감과 유사한 거리

  create(){
    return { id:this.id, type:'boomerang', lvl:1, cd:0, addons:[] };
  },

  update(inst, api){
    const { player, dt, findNearestEnemy, state } = api;
    const mods = calcMods(inst); // dmgMul, cdMul, rangeMul 등(없으면 1)
    const levelMul = Math.pow(0.98, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    inst.cd -= dt; if (inst.cd>0) return;

    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    const dmg = player.dmg * (0.9 + 0.10*(inst.lvl-1)) * (mods.dmgMul||1);
    const spd = this.baseOutSpeed;
    const outRange = this.baseOutRange * (mods.rangeMul||1); // ★ 애드온으로 증가 예정

    // 부메랑 한 개 생성
    state.booms ??= [];
    state.booms.push({
      x: player.x, y: player.y,
      vx: Math.cos(dir)*spd, vy: Math.sin(dir)*spd,
      r: 12,
      dmg,
      burn: mods.burn || null,
      freeze: mods.freeze || null,
      returning: false,
      // ★ 사거리 기반 복귀용 상태
      outRange,
      travel: 0,
      returnSpd: 420,
    });

    inst.cd = interval;
  }
};
