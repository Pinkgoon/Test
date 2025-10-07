// src/game/Perks.js
// 모든 Perk는 "레벨당 합연산"으로 적용.
// apply(player, level) 1회 호출로 누적치를 반영한다.

export const PERK_DEFS = [
  {
    id: 'perk_fleet',
    name: '신속 부츠',
    icon: 'assets/perks/perk_fleet.png',
    stepDesc: '이동 속도 +10% (레벨당)',
    maxLvl: 5,
    // 이속 배율: 1.0 + 0.10 * L
    apply(p, L) { p.speedMul += 0.10 * L; }
  },
  {
    id: 'perk_magnet',
    name: '마그넷',
    icon: 'assets/perks/perk_magnet.png',
    stepDesc: '픽업 범위 +20 (레벨당)',
    maxLvl: 5,
    apply(p, L) { p.pickup += 20 * L; }
  },
  {
    id: 'perk_focus',
    name: '포커스 코어',
    icon: 'assets/perks/perk_focus.png',
    stepDesc: '공격 속도 +15% (레벨당)',
    maxLvl: 5,
    // 공속 배율: 1.0 + 0.15 * L
    apply(p, L) { p.attackSpeedMul += 0.15 * L; }
  },
  // ★ 추가: 아이언 하트 — 최대 체력 증가
  {
    id: 'perk_ironheart',
    name: '아이언 하트',
    icon: 'assets/perks/perk_ironheart.png',
    stepDesc: '최대 체력 +20 (레벨당)',
    maxLvl: 5,
    apply(p, L) {
      const prevMax = p.maxHp;
      p.maxHp += 20 * L;
      // 현재 체력은 그대로 두되, 최대값만 상승(과거보다 낮으면 그대로).
      // 필요하다면 아래 한 줄로 "증가분만큼 즉시 회복"도 가능:
      // p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMax));
      if (p.hp > p.maxHp) p.hp = p.maxHp;
    }
  },
];

export function getPerkById(id) {
  return PERK_DEFS.find(p => p.id === id) || null;
}
