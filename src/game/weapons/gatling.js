// src/game/weapons/gatling.js
// 개틀링건 — 100발, 장전 15초, 발사 간격은 1.0초에서 시작해 10~15발 내에 0.05초까지 서서히 단축
import { calcMods } from '../Addons.js';
import blaster from './blaster.js';

const BLASTER_RANGE = blaster?.baseRange ?? 520;

export default {
  id: 'wpn_gatling',
  name: '개틀링건',
  desc: '발사 시작은 느리지만 금방 0.05초 간격으로 가속되는 대용량 탄창',
  icon: 'assets/weapons/wpn_gatling.png',
  maxLvl: 5,
  tags: ['무기','비관통','발사','원거리','탄창'],

  // 가변 연사: 아래 값들은 "기초 곡선"에 쓰임
  baseSlowInterval: 1.0,   // 시작 간격 (초/발)
  baseFastInterval: 0.05,  // 도달 간격
  warmUpShots: 12,         // 이 수만큼 쏘면 fast에 거의 근접

  baseRange: BLASTER_RANGE,
  magCap: 100,
  reloadTime: 15.0,

  create(){
    return {
      id:this.id, type:'gatling', lvl:1, cd:0, addons:[],
      mag:this.magCap, magCap:this.magCap,
      reloading:false, reloadT:0, reloadTime:this.reloadTime,
      warmShots: 0, // 재장전 후 다시 0부터
    };
  },

  _currentInterval(inst, player, mods){
    // warmShots가 0→warmUpShots까지 선형으로 1.0 → 0.05로 감소
    const slow = this.baseSlowInterval;
    const fast = this.baseFastInterval;
    const prog = Math.max(0, Math.min(1, inst.warmShots / this.warmUpShots));
    const base = slow*(1-prog) + fast*prog;

    // 레벨/애드온/공속 반영
    const levelMul = Math.pow(0.99, inst.lvl-1);
    const final = (base * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);
    return final;
  },

  update(inst, api){
    const { player, dt, pushBullet, findNearestEnemy, ejectMag } = api;
    const mods = calcMods(inst);

    if (inst.reloading){
      inst.reloadT -= dt;
      if (inst.reloadT <= 0){
        inst.reloading=false; inst.mag=inst.magCap; inst.warmShots=0;
      }
      return;
    }

    inst.cd -= dt; if (inst.cd>0) return;
    if (inst.mag<=0){ inst.reloading=true; inst.reloadT=this.reloadTime; return; }

    // 현재 간격 산출(가변)
    const interval = this._currentInterval(inst, player, mods);

    // 조준
    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    // 탄당 데미지: 기관총보다 조금 약하게, 레벨/애드온 반영
    const baseDmg = player.dmg * (0.30 + 0.045*(inst.lvl-1)) * (mods.dmgMul||1);
    const spd = 800;
    const pierceAdd = (mods.pierceAdd||0);
    const tri = !!(mods.tri || mods.triSplit);
    const extraN = (mods.projAdd||0);
    const shots = 1 + extraN + (tri?2:0);
    const spread = tri ? 0.12 : 0.04;

    for(let i=0;i<shots;i++){
      const ang = dir + (i - (shots-1)/2) * spread;
      pushBullet({
        x: player.x, y: player.y,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        r: 3,
        dmg: baseDmg,
        color: '#b0d4ff',
        pierce: pierceAdd>0 ? pierceAdd : 0,
        maxDist: this.baseRange * (mods.rangeMul||1),
        kb: 85,
      });
    }

    // 슬롯별 배출(현재 남은 칸에서 하나 소모)
    const consumedIdx = Math.max(0, (inst.mag|0) - 1);
    ejectMag(this, player, consumedIdx, inst);

    inst.mag -= 1;
    inst.warmShots += 1;
    inst.cd = interval;

    if (inst.mag<=0){ inst.reloading=true; inst.reloadT=this.reloadTime; }
  }
};
