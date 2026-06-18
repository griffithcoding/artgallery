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
    const res = await fetch(`/admin/pages/render-block?type=${encodeURIComponent(block.type)}&id=${encodeURIComponent(block.id)}`);
    if (!res.ok) { status.textContent = 'Add failed.'; return null; }
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
