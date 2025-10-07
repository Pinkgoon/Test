// src/game/weapons/orbital.js
// 오비탈 — 사거리(baseRange) 기반 반지름 제공, 선속도 일정(각속도는 반비례)
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_orbital',
  name: '오비탈',
  desc: '플레이어를 중심으로 회전하는 소환체',
  icon: 'assets/weapons/wpn_orbital.png',
  maxLvl: 5,
  tags: ['무기','소환','원거리'],

  baseRange: 36,   // 기본 반지름(px) — 예전 체감과 동일
  baseLinSpd: 65,  // 선형 속도(px/s) — 커져도 선속도는 동일(각속도는 r에 반비례)

  create(){
    return { id:this.id, type:'orbital', lvl:1, cd:0, addons:[] };
  },

  update(inst, api){
    const { state } = api;
    const mods = calcMods(inst); // rangeMul, dmgMul, cdMul 등

    // 오비탈 개수(레벨 기반) — 기존과 유사하게 레벨 수만큼 유지
    api.ensureOrbitals(Math.max(1, inst.lvl|0));

    // 유효 반지름(사거리) = baseRange * rangeMul (레벨에 따른 추가 반지름은 옵션)
    const effRadius = this.baseRange * (mods.rangeMul || 1);

    // index.js 런타임이 사용할 구성값 전달
    state._orbitalRadius = effRadius;
    state._orbitalLin = this.baseLinSpd;
  }
};
