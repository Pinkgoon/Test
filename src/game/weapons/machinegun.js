// src/game/weapons/machinegun.js
// 기관총 — 15발 탄창, 장전 5초, 탄 있을 때 0.1초 간격으로 단발 연사
import { calcMods } from '../Addons.js';
import blaster from './blaster.js';

const BLASTER_RANGE = blaster?.baseRange ?? 520;

export default {
  id: 'wpn_machinegun',
  name: '기관총',
  desc: '빠른 단발 연사. 탄창 15발, 장전 5초',
  icon: 'assets/weapons/wpn_machinegun.png',
  maxLvl: 5,
  tags: ['무기','비관통','발사','원거리','탄창'],

  baseInterval: 0.10,              // 탄 있을 땐 0.1초마다 발사
  baseRange: BLASTER_RANGE,        // 기본 사거리: 블래스터 계열
  magCap: 15,
  reloadTime: 5.0,

  create(){
    return {
      id:this.id, type:'machinegun', lvl:1, cd:0, addons:[],
      mag:this.magCap, magCap:this.magCap,
      reloading:false, reloadT:0, reloadTime:this.reloadTime,
    };
  },

  update(inst, api){
    const { player, dt, pushBullet, findNearestEnemy, ejectMag } = api;
    const mods = calcMods(inst);
    // 레벨에 따른 미세 조정(연사간격 약간 단축)
    const levelMul = Math.pow(0.99, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    if (inst.reloading){
      inst.reloadT -= dt;
      if (inst.reloadT <= 0){ inst.reloading=false; inst.mag=inst.magCap; }
      return;
    }

    inst.cd -= dt; if (inst.cd>0) return;
    if (inst.mag<=0){ inst.reloading=true; inst.reloadT=this.reloadTime; return; }

    // 조준
    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    // 탄당 데미지: 블래스터보다 약, 레벨/애드온 반영
    const baseDmg = player.dmg * (0.38 + 0.06*(inst.lvl-1)) * (mods.dmgMul||1);
    const spd = 780;
    const pierceAdd = (mods.pierceAdd||0);
    const tri = !!(mods.tri || mods.triSplit);
    const extraN = (mods.projAdd||0);
    const shots = 1 + extraN + (tri?2:0);
    const spread = tri ? 0.12 : 0.05;

    for(let i=0;i<shots;i++){
      const ang = dir + (i - (shots-1)/2) * spread;
      pushBullet({
        x: player.x, y: player.y,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        r: 3,
        dmg: baseDmg,
        color: '#b7ffb0',
        pierce: pierceAdd>0 ? pierceAdd : 0,
        maxDist: this.baseRange * (mods.rangeMul||1),
        kb: 95, // 약한 넉백
      });
    }

    // 슬롯별 배출(현재 남은 칸에서 하나 소모)
    const consumedIdx = Math.max(0, (inst.mag|0) - 1);
    ejectMag(this, player, consumedIdx, inst);

    inst.mag -= 1;
    inst.cd = interval;

    if (inst.mag<=0){ inst.reloading=true; inst.reloadT=this.reloadTime; }
  }
};
