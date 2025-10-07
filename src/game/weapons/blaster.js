// src/game/weapons/blaster.js
// 단발 보정 사격 — 기본 사거리 포함
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_blaster',
  name: '블래스터',
  desc: '표준 단발 사격',
  icon: 'assets/weapons/wpn_blaster.png',
  maxLvl: 5,
  tags: ['무기','비관통','발사','원거리'],
  baseInterval: 0.45,
  baseRange: 520, // ★ 사거리(px)

  create(){
    return { id:this.id, type:'blaster', lvl:1, cd:0, addons:[] };
  },

  update(inst, api){
    const { player, dt, pushBullet, findNearestEnemy } = api;
    const mods = calcMods(inst); // 최소 cdMul, dmgMul
    const levelMul = Math.pow(0.97, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    inst.cd -= dt; if (inst.cd > 0) return;

    // 타겟 방향
    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    const baseDmg = player.dmg * (1.0 + 0.10*(inst.lvl-1)) * (mods.dmgMul||1);
    const spd = 680;
    const pierceAdd = (mods.pierceAdd||0);

    // 트라이 스플리터/추가발(있으면)
    const extraN = (mods.projAdd||0);
    const tri = !!(mods.tri || mods.triSplit);
    const shots = 1 + extraN + (tri?2:0); // tri면 +2발

    const spread = tri ? 0.18 : 0.06; // tri는 더 벌려줌
    for(let i=0;i<shots;i++){
      const ang = dir + (i - (shots-1)/2) * spread;
      pushBullet({
        x: player.x, y: player.y,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        r: 4,
        dmg: baseDmg,
        color: '#bfe1ff',
        pierce: pierceAdd>0 ? pierceAdd : 0,
        // ★ 사거리(거리 기반)
        maxDist: this.baseRange,
        // 기본 넉백은 Systems에서 kb 없으면 110 사용
      });
    }

    inst.cd = interval;
  }
};
