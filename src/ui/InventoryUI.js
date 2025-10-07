// src/ui/InventoryUI.js
// 인벤토리 패널: 무기 카드(태그 칩/아이콘/이름·레벨/애드온 3슬롯/해제) + 가방(드래그)
// ★ 고유(unique) 애드온은 노란색 강조

import { getAddonById } from '../game/Addons.js';
import { getWeaponById } from '../game/weapons/index.js';

export class InventoryUI {
  constructor(rootEl, handlers){
    this.root = rootEl;
    this.h = handlers || {};
    this._build();
  }

  _build(){
    this.wrap = document.createElement('div');
    this.wrap.className = 'inv-overlay';
    Object.assign(this.wrap.style,{
      position:'fixed', inset:'0', display:'none', zIndex: 99999,
      background:'rgba(10,14,20,0.86)', color:'#fff'
    });

    const panel = document.createElement('div');
    panel.className = 'panel';
    Object.assign(panel.style,{
      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      width:'min(1120px, 92vw)', height:'min(80vh, 720px)',
      border:'1px solid rgba(255,255,255,0.12)', borderRadius:'18px',
      background:'rgba(255,255,255,0.04)', backdropFilter:'blur(4px)', boxShadow:'0 10px 30px rgba(0,0,0,0.35)',
      display:'grid', gridTemplateRows:'auto 1fr', overflow:'hidden'
    });

    const header = document.createElement('div');
    Object.assign(header.style,{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.10)', background:'rgba(0,0,0,.2)'
    });
    const title = document.createElement('div'); title.textContent = '인벤토리';
    Object.assign(title.style,{ fontWeight:'700', letterSpacing:'0.3px' });

    const closeBtn = document.createElement('button'); closeBtn.textContent = '닫기 (ESC)';
    Object.assign(closeBtn.style,{ padding:'6px 10px', borderRadius:'10px', background:'rgba(255,255,255,.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.18)', cursor:'pointer' });
    closeBtn.onclick = ()=>this.h.onClose?.();

    const body = document.createElement('div');
    Object.assign(body.style,{
      display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:'12px', padding:'12px'
    });

    // 왼쪽: 장착 중 무기 4칸
    const left = document.createElement('div');
    const leftTitle = document.createElement('div'); leftTitle.textContent='장착 무기 (최대 4개)'; leftTitle.className='muted';
    this.weaponsGrid = document.createElement('div');
    Object.assign(this.weaponsGrid.style,{
      display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'10px', marginTop:'8px'
    });
    left.append(leftTitle, this.weaponsGrid);

    // 오른쪽: 애드온 가방
    const right = document.createElement('div');
    const rightTitle = document.createElement('div'); rightTitle.textContent='애드온 가방 (최대 15개)'; rightTitle.className='muted';
    this.addonBag = document.createElement('div');
    Object.assign(this.addonBag.style,{
      display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'8px', marginTop:'8px'
    });
    right.append(rightTitle, this.addonBag);

    body.append(left, right);
    header.append(title, closeBtn);
    panel.append(header, body);
    this.wrap.append(panel);
    this.root.append(this.wrap);
  }

  show(){ this.wrap.style.display='block'; }
  hide(){ this.wrap.style.display='none'; }

  tagChip(t){
    const chip = document.createElement('span'); chip.textContent=t;
    chip.className='chip'; chip.style.marginRight='6px';
    return chip;
  }

  _weaponCard(wInst){
    const wdef = getWeaponById(wInst.id) || {};
    const card = document.createElement('div'); card.className='card';

    const tags = document.createElement('div');
    for(const t of (wdef.tags||[])) tags.appendChild(this.tagChip(t));

    const head = document.createElement('div');
    Object.assign(head.style,{ display:'grid', gridTemplateColumns:'64px 1fr auto', gap:'12px', alignItems:'center', margin:'8px 0 10px 0' });

    const icon = document.createElement('img');
    Object.assign(icon.style,{ width:'64px', height:'64px', objectFit:'contain', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)' });
    icon.src = wdef.icon || '';

    const name = document.createElement('div');
    name.innerHTML = `<h4>${wdef.name||wInst.id}</h4><div class="muted">${wdef.desc||''}</div>`;

    const lvl = document.createElement('div');
    Object.assign(lvl.style,{ display:'flex', alignItems:'center', gap:'8px' });
    const lvlChip = document.createElement('span'); lvlChip.textContent=`Lv. ${wInst.lvl||1}`; lvlChip.className='chip';
    const unBtn = document.createElement('button'); unBtn.textContent='해제'; unBtn.className='unlink';
    unBtn.onclick = ()=>this.h.onUnequipWeapon?.(wInst.id);
    lvl.append(lvlChip, unBtn);

    head.append(icon, name, lvl);

    // 애드온 슬롯 3개
    const slots = document.createElement('div');
    Object.assign(slots.style,{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px' });

    const makeSlot = (idx)=>{
      const slot = document.createElement('div'); slot.className='slot'; slot.dataset.slot=String(idx);
      Object.assign(slot.style,{ height:'52px', border:'1px dashed rgba(255,255,255,.18)', borderRadius:'12px', display:'grid', placeItems:'center', background:'rgba(255,255,255,.03)' });
      slot.ondragover = e=>{ e.preventDefault(); slot.style.background='rgba(255,255,255,.06)'; };
      slot.ondragleave = e=>{ slot.style.background='rgba(255,255,255,.03)'; };
      slot.ondrop = e=>{
        e.preventDefault(); slot.style.background='rgba(255,255,255,.03)';
        const aid = e.dataTransfer.getData('text/addon-id');
        if (aid) this.h.onEquipAddon?.(wInst.id, aid);
      };
      const cell = (wInst.addons||[])[idx];
      if (cell) slot.appendChild(this._addonCell(cell));
      return slot;
    };

    for (let i=0;i<3;i++) slots.appendChild(makeSlot(i));

    card.append(tags, head, slots);
    return card;
  }

  _addonCell(a){
    const def = getAddonById(a.id) || {};
    const cell = document.createElement('div'); cell.className='adn'; if (def.unique) cell.classList.add('unique'); // ★ 고유 강조
    cell.draggable=true;
    const img = document.createElement('img'); img.src = def.icon || ''; cell.appendChild(img);
    cell.title = `${def.name||a.id}\n${def.desc||''}\n[태그] ${def.tags?.join(', ')||'-'}${def.unique?' · 고유':''}`;
    cell.ondragstart = (e)=>{ e.dataTransfer.setData('text/addon-id', a.id); };
    return cell;
  }

  render(inv){
    this.weaponsGrid.innerHTML='';
    for (const w of inv.equipped.weapons) this.weaponsGrid.appendChild(this._weaponCard(w));
    this.addonBag.innerHTML='';
    for (const a of inv.bag.addons) this.addonBag.appendChild(this._addonCell(a));
  }
}
