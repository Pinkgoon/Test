// src/game/Inventory.js
// 인벤/장착/가방 + 레벨업 제시 + 스탯 재계산

import { PERK_DEFS, getPerkById } from './Perks.js';
import { allWeapons, getWeaponById, createWeaponInstance } from './weapons/index.js';
import { ADDON_DEFS, getAddonById } from './Addons.js';
import { resetStatsToBase } from './Player.js';

export function createInventory() {
  return {
    bag: { perks: [], weapons: [], addons: [] },
    equipped: { perks: [], weapons: [] },
    limits: { perks: 4, weapons: 4, addonBag: 15, addonPerWeapon: 3 },
  };
}

export const findPerkIn   = (arr, id) => arr.find(p => p.id === id) || null;
export const findWeaponIn = (arr, id) => arr.find(w => w.id === id) || null;

export const findPerkAnywhere = (inv, id) => ({
  ref: findPerkIn(inv.equipped.perks, id) || findPerkIn(inv.bag.perks, id)
});
export const findWeaponAnywhere = (inv, id) => ({
  ref: findWeaponIn(inv.equipped.weapons, id) || findWeaponIn(inv.bag.weapons, id)
});

function hasAllTags(targetTags, requiredTags){
  if (!requiredTags || requiredTags.length===0) return true;
  const set = new Set(targetTags||[]);
  for (const t of requiredTags) if (!set.has(t)) return false;
  return true;
}

// ── 획득/장착
export function gainPerk(inv, player, id) {
  const def = getPerkById(id); if (!def) return false;
  const max = def.maxLvl || 5;
  const cur = findPerkAnywhere(inv, id).ref;
  if (cur) { if (cur.lvl >= max) return false; cur.lvl++; }
  else { inv.bag.perks.push({ id, lvl: 1 }); autoEquipIfSpace(inv, 'perk', id); }
  recalcPlayerFromEquipment(player, inv); return true;
}
export function gainWeapon(inv, player, id) {
  const def = getWeaponById(id); if (!def) return false;
  const max = def.maxLvl || 5;
  const cur = findWeaponAnywhere(inv, id).ref;
  if (cur) { if (cur.lvl >= max) return false; cur.lvl++; }
  else { const inst = createWeaponInstance(id); inst.addons = []; inv.bag.weapons.push(inst); autoEquipIfSpace(inv, 'weapon', id); }
  recalcPlayerFromEquipment(player, inv); return true;
}
export function pickupAddon(inv, addonId) {
  if (!getAddonById(addonId)) return false;
  if (inv.bag.addons.length >= inv.limits.addonBag) return false;
  inv.bag.addons.push({ id: addonId }); return true;
}

// ── 장착/해제
export function equipPerk(inv, player, id) {
  if (inv.equipped.perks.length >= inv.limits.perks) return false;
  const it = findPerkIn(inv.bag.perks, id); if (!it) return false;
  inv.bag.perks = inv.bag.perks.filter(p => p !== it);
  inv.equipped.perks.push(it);
  recalcPlayerFromEquipment(player, inv); return true;
}
export function unequipPerk(inv, player, id) {
  const it = findPerkIn(inv.equipped.perks, id); if (!it) return false;
  inv.equipped.perks = inv.equipped.perks.filter(p => p !== it);
  inv.bag.perks.push(it);
  recalcPlayerFromEquipment(player, inv); return true;
}
export function equipWeapon(inv, player, id) {
  if (inv.equipped.weapons.length >= inv.limits.weapons) return false;
  const it = findWeaponIn(inv.bag.weapons, id); if (!it) return false;
  inv.bag.weapons = inv.bag.weapons.filter(w => w !== it);
  inv.equipped.weapons.push(it);
  recalcPlayerFromEquipment(player, inv); return true;
}
export function unequipWeapon(inv, player, id) {
  const it = findWeaponIn(inv.equipped.weapons, id); if (!it) return false;
  inv.equipped.weapons = inv.equipped.weapons.filter(p => p !== it);
  inv.bag.weapons.push(it);
  recalcPlayerFromEquipment(player, inv); return true;
}

// ── 애드온(무기당 3칸, unique=무기당 1개, 태그 검사)
export function equipAddonToWeapon(inv, weaponId, addonId) {
  const w = findWeaponIn(inv.equipped.weapons, weaponId); if (!w) return { ok:false, reason:'무기없음' };
  w.addons ||= [];
  if (w.addons.length >= inv.limits.addonPerWeapon) return { ok:false, reason:'무기 슬롯풀' };

  const def = ADDON_DEFS.find(a=>a.id===addonId); if (!def) return { ok:false, reason:'애드온없음' };
  if (def.unique && w.addons.some(a => a.id === def.id)) return { ok:false, reason:'고유: 해당 무기에 이미 있음' };

  const wTags = (getWeaponById(w.id)?.tags)||[]; const aTags = def.tags || [];
  if (!hasAllTags(wTags, aTags)) return { ok:false, reason:`태그 불일치 (${aTags.join(', ')})` };

  const idx = inv.bag.addons.findIndex(a => a.id === addonId); if (idx < 0) return { ok:false, reason:'가방에 없음' };
  const [a] = inv.bag.addons.splice(idx, 1); w.addons.push(a); return { ok:true };
}
export function unequipAddonFromWeapon(inv, weaponId, slotIdx) {
  const w = findWeaponIn(inv.equipped.weapons, weaponId); if (!w) return { ok:false, reason:'무기없음' };
  w.addons ||= [];
  if (slotIdx < 0 || slotIdx >= w.addons.length) return { ok:false, reason:'슬롯없음' };
  if (inv.bag.addons.length >= inv.limits.addonBag) return { ok:false, reason:'가방가득' };
  const [a] = w.addons.splice(slotIdx, 1); inv.bag.addons.push(a); return { ok:true };
}

// ── 자동 장착
export function autoEquipIfSpace(inv, kind, id) {
  if (kind === 'perk') {
    if (inv.equipped.perks.length < inv.limits.perks) {
      const item = findPerkIn(inv.bag.perks, id);
      if (item) { inv.bag.perks = inv.bag.perks.filter(p => p !== item); inv.equipped.perks.push(item); }
    }
  } else {
    if (inv.equipped.weapons.length < inv.limits.weapons) {
      const item = findWeaponIn(inv.bag.weapons, id);
      if (item) { inv.bag.weapons = inv.bag.weapons.filter(w => w !== item); inv.equipped.weapons.push(item); }
    }
  }
}

// ── 레벨업 제시(3개 랜덤) — ★모든 무기(근접 포함)를 최신 레지스트리에서 읽음
export function rollLevelupOptions(inv) {
  const pool = [];

  for (const p of PERK_DEFS) {
    const cur = findPerkAnywhere(inv, p.id).ref;
    const max = p.maxLvl ?? 5;
    if (cur) {
      if ((cur.lvl ?? 1) < max) pool.push({ kind:'perk', id:p.id, name:`${p.name} Lv.${cur.lvl} → Lv.${cur.lvl+1}`, desc:p.stepDesc });
    } else {
      pool.push({ kind:'perk', id:p.id, name:`${p.name} Lv.1`, desc:p.stepDesc });
    }
  }

  // ★ allWeapons() 사용 (정적 배열 직접 참조 금지)
  for (const w of allWeapons()) {
    const cur = findWeaponAnywhere(inv, w.id).ref;
    const max = w.maxLvl ?? 5;
    if (cur) {
      if ((cur.lvl ?? 1) < max) pool.push({ kind:'weapon', id:w.id, name:`${w.name} Lv.${cur.lvl} → Lv.${cur.lvl+1}`, desc:w.desc });
    } else {
      pool.push({ kind:'weapon', id:w.id, name:`${w.name} Lv.1`, desc:w.desc });
    }
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// ── 스탯 재계산(퍼크는 합연산)
export function recalcPlayerFromEquipment(player, inv) {
  resetStatsToBase(player);
  for (const p of inv.equipped.perks) {
    const def = getPerkById(p.id); if (!def) continue;
    const L = Math.max(1, p.lvl || 1);
    def.apply?.(player, L);
  }
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

export function summarize(inv){
  const perkNames = inv.equipped.perks.map(p=>{
    const d = PERK_DEFS.find(x=>x.id===p.id); return `${d?.name||p.id} Lv.${p.lvl||1}`;
  });
  const weaponNames = inv.equipped.weapons.map(w=>{
    const d = allWeapons().find(x=>x.id===w.id); return `${d?.name||w.id} Lv.${w.lvl||1}`;
  });
  return { perks: perkNames, weapons: weaponNames };
}
