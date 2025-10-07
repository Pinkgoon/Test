// src/game/weapons/melee_rapier.js
// 레이피어: 빠른 3연속 찌르기 → 짧은 휴식 → 반복
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_rapier',
  name: '레이피어',
  desc: '긴 거리 3연속 빠른 찌르기 후 잠깐 쉬는 근접 무기',
  icon: 'assets/weapons/wpn_rapier.png',
  maxLvl: 5,
  tags: ['무기','근접'],
  baseTempo: 0.65,
  create(){
    return { id:this.id, type:'melee_rapier', lvl:1, cd:0, burst:0, addons:[] };
  },
  update(inst, api){
    const mods = calcMods(inst);
    const levelMul = Math.pow(0.97, inst.lvl-1);
    const tempo = (this.baseTempo * levelMul * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul);

    inst.cd -= api.dt; if (inst.cd > 0) return;

    const tgt = api.findNearestEnemy(api.player.x, api.player.y);
    const dir = tgt ? Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x) : 0;

    const dmgBase = api.player.dmg * (0.95 + 0.10*(inst.lvl-1)) * mods.dmgMul;
    const len = 120 + 12*(inst.lvl-1);

    api.queueTelegraph({
      type:'line', delay: tempo*0.28, after:0.05, track:true,
      cx: api.player.x, cy: api.player.y, dir,
      length: len, halfW: 8,
      dmg: dmgBase,
      kb: 220, // ★ 레이피어: 빠른 찌르기, 넉백은 대검보다 약간 낮게
      effectColor: '#fff0c4'
    });

    inst.burst = (inst.burst || 0) + 1;
    if (inst.burst < 3) {
      inst.cd = tempo * 0.35;
    } else {
      inst.burst = 0; inst.cd = tempo * 0.9;
    }
  }
};
