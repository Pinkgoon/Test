// src/game/Player.js
// 플레이어 기본 스탯 & 리셋, 레벨업 필요 경험치

export function xpFor(lv) {
  // 초반 완화 곡선
  const base = 15;
  const k = 1.18;
  return Math.round(base * Math.pow(k, Math.max(0, lv - 1)));
}

export function makePlayer(w, h) {
  return {
    x: w / 2, y: h / 2, r: 14,

    // ★ 체력: 베이스/현재 분리
    baseMaxHp: 100,
    maxHp: 100,
    hp: 100,
    regen: 0,

    speed: 140,           // 기본 이속
    speedMul: 1.0,        // 이속 배율(퍼크로 +됨)
    dmg: 20,              // 기본 공격력
    bulletSpd: 520,
    projectiles: 1,
    pierce: 0,
    pickup: 60,

    level: 1, xp: 0, nextXp: xpFor(1),

    iTime: 0,             // 피격 무적 시간

    // ★ 공속 배율: 1.0에서 시작, 포커스 코어 등으로 +되어 올라감
    attackSpeedMul: 1.0,
  };
}

export function resetStatsToBase(p) {
  // 파생 스탯 초기화
  p.speedMul = 1.0;
  p.dmg = 20;
  p.bulletSpd = 520;
  p.projectiles = 1;
  p.pierce = 0;
  p.pickup = 60;

  // ★ 최대 체력은 베이스로 되돌린 뒤 Perk로 다시 올린다
  p.maxHp = p.baseMaxHp;

  // ★ 공속 배율 초기화
  p.attackSpeedMul = 1.0;

  // 현재 체력은 새 최대 체력 범위로만 클램프 (갑자기 회복/감소 방지)
  if (p.hp > p.maxHp) p.hp = p.maxHp;
}
