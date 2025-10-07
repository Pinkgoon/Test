// src/game/weapons/shotgun.js
// 산탄 — 탄창/재장전 + 사거리 + 슬롯별 배출 (발사 때마다)
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_shotgun',
  name: '샷건',
  desc: '산탄을 퍼뜨려 발사. 탄창 무기',
  icon: 'assets/weapons/wpn_shotgun.png',
  maxLvl: 5,
  tags: ['무기','비관통','발사','원거리','탄창'],

  baseInterval: 0.65,
  baseRange: 380,
  magCap: 2,
  reloadTime: 3.0,

  create(){
    return {
      id:this.id, type:'shotgun', lvl:1, cd:0, addons:[],
      mag:this.magCap, magCap:this.magCap,
      reloading:false, reloadT:0, reloadTime:this.reloadTime,
    };
  },

  update(inst, api){
    const { player, dt, pushBullet, findNearestEnemy, ejectMag } = api;
    const mods = calcMods(inst);
    const levelMul = Math.pow(0.98, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    // 재장전 처리
    if (inst.reloading){
      inst.reloadT -= dt;
      if (inst.reloadT <= 0){ inst.reloading = false; inst.mag = inst.magCap; }
      return;
    }

    inst.cd -= dt; if (inst.cd > 0) return;
    if (inst.mag <= 0){ inst.reloading = true; inst.reloadT = inst.reloadTime; return; }

    // 발사
    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    const pellets = 6 + Math.floor((mods.projAdd||0));
    const spread = 0.35;
    const spd = 720;
    const baseDmg = player.dmg * (0.55 + 0.08*(inst.lvl-1)) * (mods.dmgMul||1);
    const pierceAdd = (mods.pierceAdd||0);

    for(let i=0;i<pellets;i++){
      const ang = dir + (Math.random()-0.5) * spread;
      pushBullet({
        x: player.x, y: player.y,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        r: 3,
        dmg: baseDmg,
        color: '#ffe4b8',
        pierce: pierceAdd>0 ? pierceAdd : 0,
        kb: 140,
        maxDist: this.baseRange,
      });
    }

    // ★ 슬롯별 배출: 소모될 슬롯 인덱스(현재 mag-1)를 기준으로 배출
    const consumedIdx = Math.max(0, (inst.mag|0) - 1);
    ejectMag(this, player, consumedIdx, inst);

    inst.mag -= 1;
    inst.cd = interval;

    if (inst.mag <= 0){ inst.reloading = true; inst.reloadT = inst.reloadTime; }
  }
};
