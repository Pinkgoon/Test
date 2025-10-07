// src/game/weapons/grenade.js
// 수류탄 — ★사거리(maxDist) 또는 타임아웃으로 폭발 (rangeMul 애드온 대응)
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_grenade',
  name: '수류탄',
  desc: '일정 거리(또는 시간) 후 폭발',
  icon: 'assets/weapons/wpn_grenade.png',
  maxLvl: 5,
  tags: ['무기','발사','원거리','폭발'],

  baseInterval: 1.05,
  baseThrowSpeed: 520,
  baseRange: 280, // ★ 이전 체감과 유사한 투척 거리(px)
  baseFuse: null, // 시간 타이머(선택). null이면 거리로만 터짐

  create(){
    return { id:this.id, type:'grenade', lvl:1, cd:0, addons:[] };
  },

  update(inst, api){
    const { player, dt, findNearestEnemy, state } = api;
    const mods = calcMods(inst);
    const levelMul = Math.pow(0.985, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    inst.cd -= dt; if (inst.cd>0) return;

    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    const spd = this.baseThrowSpeed;
    const maxDist = this.baseRange * (mods.rangeMul||1); // ★ 애드온으로 증가 예정
    const exR = 88 + 6*(inst.lvl-1);
    const exD = player.dmg * (1.05 + 0.12*(inst.lvl-1)) * (mods.dmgMul||1);

    // 수류탄 생성 (index.js에서 travel 누적/폭발 처리)
    state.grenades ??= [];
    state.grenades.push({
      x: player.x, y: player.y,
      vx: Math.cos(dir)*spd, vy: Math.sin(dir)*spd,
      explodeRadius: exR,
      explodeDmg: exD,
      // ★ 사거리 기반 폭발
      maxDist,
      travel: 0,
      // 하위호환: 퓨즈 타임(설정 시 거리와 경쟁)
      t: this.baseFuse,
    });

    inst.cd = interval;
  }
};
