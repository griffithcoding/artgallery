// Layout-mode wiring for the composer. Imported + initialized by composer.ts.
// Operates on the shared in-memory `state` (mutated in place so composer.ts's
// Save/Publish sees the changes) and the rendered DOM.
import Sortable from 'sortablejs';
import { insertBlockAt, removeBlock, reorderByIds, defaultBlock, BLOCK_TYPES, type Block } from '../lib/blocks';

interface Ctx {
  root: HTMLElement;
  state: Block[];
  byId: Map<string, Block>;
  status: HTMLElement;
}

const LABELS: Record<string, string> = {
  hero: 'Hero', heading: 'Heading', richText: 'Rich text',
  image: 'Image', worksGrid: 'Works grid', quote: 'Quote', spacer: 'Spacer',
};

function uuid(): string {
  return (crypto as any).randomUUID ? (crypto as any).randomUUID() : 'b-' + Math.floor(performance.now() * 1000);
}

export function initLayout(ctx: Ctx) {
  const { root, state, byId, status } = ctx;
  const container = root.querySelector('main') as HTMLElement;
  if (!container) return;

  const setState = (next: Block[]) => { state.length = 0; state.push(...next); };

  async function renderFragment(block: Block): Promise<HTMLElement | null> {
    const p = encodeURIComponent(JSON.stringify(block.props ?? {}));
    const res = await fetch(`/admin/pages/render-block?type=${encodeURIComponent(block.type)}&id=${encodeURIComponent(block.id)}&props=${p}`);
    if (!res.ok) { status.textContent = 'Render failed.'; return null; }
    const tmp = document.createElement('div');
    tmp.innerHTML = (await res.text()).trim();
    return tmp.firstElementChild as HTMLElement | null;
  }

  function blockIndex(el: HTMLElement): number {
    return [...container.querySelectorAll('.cb-block')].indexOf(el);
  }

  function decorate(el: HTMLElement) {
    if (el.querySelector(':scope > .cb-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'cb-tools';
    tools.innerHTML =
      `<button type="button" class="cb-drag" title="Drag to reorder">☰</button>` +
      `<button type="button" class="cb-add" title="Add block below">＋</button>` +
      `<button type="button" class="cb-del" title="Delete block">✖</button>`;
    el.appendChild(tools);
    tools.querySelector('.cb-del')!.addEventListener('click', () => del(el));
    tools.querySelector('.cb-add')!.addEventListener('click', (e) => openAddMenu(el, e as MouseEvent));
    if (el.dataset.blockType === 'worksGrid') {
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'cb-pick';
      pick.title = 'Choose artworks';
      pick.textContent = 'Pick works';
      tools.insertBefore(pick, tools.querySelector('.cb-del'));
      pick.addEventListener('click', () => openWorksPicker(el));
    }
  }

  function del(el: HTMLElement) {
    const id = el.dataset.blockId!;
    setState(removeBlock(state, id));
    byId.delete(id);
    el.remove();
    status.textContent = 'Block deleted (unsaved)';
  }

  async function add(type: string, afterEl: HTMLElement | null) {
    if (!(BLOCK_TYPES as readonly string[]).includes(type)) return;
    const block = defaultBlock(type as any, uuid());
    const idx = afterEl ? blockIndex(afterEl) + 1 : state.length;
    setState(insertBlockAt(state, block, idx));
    byId.set(block.id, block);
    const node = await renderFragment(block);
    if (!node) { setState(removeBlock(state, block.id)); byId.delete(block.id); return; }
    decorate(node);
    container.insertBefore(node, afterEl ? afterEl.nextSibling : null);
    status.textContent = 'Block added (unsaved)';
  }

  let menu: HTMLElement | null = null;
  let dismissListener: ((e: MouseEvent) => void) | null = null;
  function closeMenu() {
    menu?.remove();
    menu = null;
    if (dismissListener) { document.removeEventListener('click', dismissListener); dismissListener = null; }
  }
  function openAddMenu(afterEl: HTMLElement | null, e: MouseEvent) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'cb-add-menu';
    menu.innerHTML = BLOCK_TYPES.map((t) => `<button type="button" data-type="${t}">${LABELS[t]}</button>`).join('');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    document.body.appendChild(menu);
    menu.querySelectorAll<HTMLButtonElement>('button[data-type]').forEach((b) =>
      b.addEventListener('click', () => { add(b.dataset.type!, afterEl); closeMenu(); }));
    setTimeout(() => { dismissListener = () => closeMenu(); document.addEventListener('click', dismissListener, { once: true }); }, 0);
  }

  const addEnd = document.createElement('button');
  addEnd.type = 'button';
  addEnd.className = 'cb-add-end';
  addEnd.textContent = '＋ Add block';
  addEnd.addEventListener('click', (e) => openAddMenu(null, e as MouseEvent));
  container.after(addEnd);

  let allWorks: { id: string; title: string; artistName: string }[] | null = null;
  async function loadWorks() {
    if (allWorks) return allWorks;
    const res = await fetch('/admin/pages/artworks.json');
    allWorks = res.ok ? await res.json() : [];
    return allWorks!;
  }

  async function reRender(el: HTMLElement, block: Block) {
    const node = await renderFragment(block);
    if (!node) return;
    decorate(node);
    el.replaceWith(node);
  }

  async function openWorksPicker(el: HTMLElement) {
    const block = byId.get(el.dataset.blockId!);
    if (!block) return;
    const works = await loadWorks();
    const selected: string[] = Array.isArray((block.props as any).workIds) ? [...(block.props as any).workIds] : [];
    const cols = Number((block.props as any).cols) || 3;

    const overlay = document.createElement('div');
    overlay.className = 'cb-modal';
    overlay.innerHTML =
      `<div class="cb-modal-card">` +
      `<h3>Choose artworks</h3>` +
      `<label class="cb-cols">Columns ` +
      `<select>${[2, 3, 4].map((c) => `<option value="${c}"${c === cols ? ' selected' : ''}>${c}</option>`).join('')}</select></label>` +
      `<ul class="cb-work-list">${works.map((w) =>
        `<li><label><input type="checkbox" value="${w.id}"${selected.includes(w.id) ? ' checked' : ''}> ${w.artistName} — ${w.title}</label></li>`).join('')}</ul>` +
      `<div class="cb-modal-actions"><button type="button" class="cb-cancel">Cancel</button><button type="button" class="cb-apply composer-btn--solid">Apply</button></div>` +
      `</div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.cb-cancel')!.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.cb-apply')!.addEventListener('click', async () => {
      const ids = [...overlay.querySelectorAll<HTMLInputElement>('.cb-work-list input:checked')].map((i) => i.value);
      const newCols = Number(overlay.querySelector<HTMLSelectElement>('.cb-cols select')!.value) || 3;
      (block.props as any).workIds = ids;
      (block.props as any).cols = newCols;
      close();
      status.textContent = 'Works updated (unsaved)';
      await reRender(el, block);
    });
  }

  root.querySelectorAll<HTMLElement>('.cb-block').forEach(decorate);
  Sortable.create(container, {
    handle: '.cb-drag',
    draggable: '.cb-block',
    animation: 150,
    onEnd: () => {
      const ids = [...container.querySelectorAll<HTMLElement>('.cb-block')].map((e) => e.dataset.blockId!);
      setState(reorderByIds(state, ids));
      status.textContent = 'Reordered (unsaved)';
    },
  });
}
