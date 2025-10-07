// src/game/Addons.js
// 애드온 정의(태그 포함) + 무기 인스턴스의 애드온들을 모아 실제 수치(calcMods)

export const ADDON_DEFS = [
  // 가속 모듈: 공격 속도(쿨감)
  {
    id: 'adn_haste',
    name: '가속 모듈',
    desc: '공격 속도 +10%',
    icon: 'assets/addons/adn_haste.png',
    tags: ['무기'],                // ← 해당 태그가 무기에 있어야 장착 가능
    apply(acc) { acc.cdMul *= 0.90; }
  },
  // 데미지 코어
  {
    id: 'adn_damage',
    name: '데미지 코어',
    desc: '데미지 +15%',
    icon: 'assets/addons/adn_damage.png',
    tags: ['무기'],
    apply(acc) { acc.dmgMul *= 1.15; }
  },
  // 관통 드릴: 비관통 + 발사 무기에만
  {
    id: 'adn_pierce',
    name: '관통 드릴',
    desc: '관통 +1 (비관통·발사 전용)',
    icon: 'assets/addons/adn_pierce.png',
    tags: ['비관통','발사'],
    apply(acc) { acc.pierce += 1; }
  },
  // 분열 어댑터: 발사 무기에만, 탄알 +1
  {
    id: 'adn_multishot',
    name: '분열 어댑터',
    desc: '발사체 +1 (발사 전용)',
    icon: 'assets/addons/adn_multishot.png',
    tags: ['발사'],
    apply(acc) { acc.proj += 1; }
  },
  // 연소
  {
    id: 'adn_burn',
    name: '연소 코팅',
    desc: '적에게 초당 8 화상(2초)',
    icon: 'assets/addons/adn_burn.png',
    tags: ['무기'],
    apply(acc) { acc.burn = { dps: (acc.burn?.dps||0)+8, dur: 2.0 }; }
  },
  // 동결
  {
    id: 'adn_freeze',
    name: '극저온 패키지',
    desc: '동결 확률 +10% (1.5초, 이속 30%)',
    icon: 'assets/addons/adn_freeze.png',
    tags: ['무기'],
    apply(acc) { 
      const base = { chance: 0, dur: 1.5, slowMul: 0.3 };
      const cur = acc.freeze || base;
      acc.freeze = { ...base, chance: (cur.chance||0) + 0.10 };
    }
  },
  // 고유: 3갈래
  {
    id: 'adn_tri',
    name: '트라이 스플리터',
    desc: '발사각 3갈래 (중첩/중복 불가, 발사 전용)',
    icon: 'assets/addons/adn_tri.png',
    tags: ['발사'],
    unique: true,
    apply(acc) { acc.tri = true; }
  },
];

export function getAddonById(id) {
  return ADDON_DEFS.find(a => a.id === id) || null;
}

// 무기 인스턴스(w.addons) → 실제 적용치 누적
export function calcMods(weaponInst) {
  const acc = {
    cdMul: 1, dmgMul: 1, pierce: 0, proj: 0,
    burn: null, freeze: null, tri: false
  };
  const list = weaponInst?.addons || [];
  for (const a of list) {
    const def = getAddonById(a.id);
    if (!def) continue;
    def.apply?.(acc);
  }
  return acc;
}
