// src/game/weapons/orbital.js
export default {
  id:'wpn_orbital',
  name:'오비탈',
  desc:'플레이어 주변 위성 지속 피해',
  icon:'assets/weapons/wpn_orbital.png',
  maxLvl:5,
  tags:['무기','소환','원거리'],
  baseInterval:999,
  create(){ return { id:this.id, type:'orbital', lvl:1, angle:0, addons:[] }; },
  update(inst, api){
    const want = 2 + Math.floor((inst.lvl - 1) / 2);
    api.ensureOrbitals(want);
  }
};
