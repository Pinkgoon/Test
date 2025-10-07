// src/game/weapons/melee_greatsword.js
// 대검: 반달 베기 2회 → 직선 찌르기 1회 → 반복
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_greatsword',
  name: '대검',
  desc: '반달 베기 두 번, 직선 찌르기 한 번을 반복하는 근접 무기',
  icon: 'assets/weapons/wpn_greatsword.png',
  maxLvl: 5,
  tags: ['무기','근접'],
  baseTempo: 0.9,
  create(){
    return { id:this.id, type:'melee_greatsword', lvl:1, cd:0, step:0, addons:[] };
  },
  update(inst, api){
    const mods = calcMods(inst);
    const levelMul = Math.pow(0.96, inst.lvl-1);
    const tempo = (this.baseTempo * levelMul * mods.cdMul) / Math.max(0.1, api.player.attackSpeedMul);

    inst.cd -= api.dt; if (inst.cd > 0) return;

    const tgt = api.findNearestEnemy(api.player.x, api.player.y);
    const dir = tgt ? Math.atan2(tgt.y - api.player.y, tgt.x - api.player.x) : 0;

    const dmgBase = api.player.dmg * (1.30 + 0.08*(inst.lvl-1)) * mods.dmgMul;
    const radius = 72 + 6*(inst.lvl-1);

    if (inst.step === 0) { // 왼베기
      api.queueTelegraph({
        type:'arc', delay: tempo*0.55, after:0.06, track:true,
        cx: api.player.x, cy: api.player.y, dir: dir - 0.5,
        halfAng: 0.9, radius,
        dmg: dmgBase,
        kb: 260, // ★ 강한 넉백
        effectColor:'#ffe4ad'
      });
      inst.step=1; inst.cd=tempo*0.70;
    } else if (inst.step === 1) { // 오른베기
      api.queueTelegraph({
        type:'arc', delay: tempo*0.55, after:0.06, track:true,
        cx: api.player.x, cy: api.player.y, dir: dir + 0.5,
        halfAng: 0.9, radius,
        dmg: dmgBase,
        kb: 260, // ★ 강한 넉백
        effectColor:'#ffe4ad'
      });
      inst.step=2; inst.cd=tempo*0.70;
    } else { // 찌르기
      api.queueTelegraph({
        type:'line', delay: tempo*0.45, after:0.06, track:true,
        cx: api.player.x, cy: api.player.y, dir,
        length: 95 + 10*(inst.lvl-1), halfW:12,
        dmg: dmgBase * 1.15,
        kb: 300, // ★ 매우 강한 넉백(찌르기 타격감)
        effectColor:'#ffd2b0'
      });
      inst.step=0; inst.cd=tempo*0.9;
    }
  }
};
