// Superadmin in-place editor. Loaded only on /admin/pages/[slug].
// Builds the top mode bar; Content mode wires contenteditable text + image swap.
interface Block { id: string; type: string; props: Record<string, unknown>; }
import { initLayout } from './composer-layout';

const root = document.getElementById('composer-root');
const dataEl = document.getElementById('composer-blocks');
if (root && dataEl) {
  const slug = root.dataset.slug!;
  const state: Block[] = JSON.parse(dataEl.textContent || '[]');
  const byId = new Map(state.map((b) => [b.id, b]));

  // ---- top mode bar ----
  const bar = document.createElement('div');
  bar.className = 'composer-bar';
  bar.innerHTML = `
    <span class="composer-brand">Composer</span>
    <button data-mode="content" class="composer-mode is-active">Content</button>
    <button data-mode="layout" class="composer-mode">Layout</button>
    <button class="composer-mode" disabled title="Coming in Type mode">Type</button>
    <button class="composer-mode" disabled title="Coming in Color mode">Color</button>
    <span class="composer-spacer"></span>
    <button class="composer-mode" id="composer-preview">Preview</button>
    <button class="composer-btn" id="composer-save">Save</button>
    <button class="composer-btn composer-btn--solid" id="composer-publish">Publish</button>
    <span class="composer-status" id="composer-status"></span>`;
  document.body.appendChild(bar);
  document.body.classList.add('composer-on');
  const status = bar.querySelector('#composer-status') as HTMLElement;

  // ---- content mode: editable text ----
  const textEls = root.querySelectorAll<HTMLElement>('[data-field="text"]');
  textEls.forEach((el) => {
    el.contentEditable = 'true';
    el.classList.add('composer-editable');
    el.addEventListener('input', () => {
      const b = byId.get(el.dataset.blockId!);
      if (!b) return;
      const prop = el.dataset.prop!;
      b.props[prop] = prop === 'html' ? el.innerHTML : el.textContent ?? '';
    });
  });

  // ---- content mode: image swap ----
  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = 'image/jpeg,image/png,image/webp';
  filePicker.style.display = 'none';
  document.body.appendChild(filePicker);
  let activeImg: HTMLImageElement | null = null;

  root.querySelectorAll<HTMLImageElement>('[data-field="image"]').forEach((img) => {
    img.classList.add('composer-editable-img');
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => { activeImg = img; filePicker.click(); });
  });

  filePicker.addEventListener('change', async () => {
    const file = filePicker.files?.[0];
    if (!file || !activeImg) return;
    status.textContent = 'Uploading…';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'pages');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) { status.textContent = 'Upload failed.'; return; }
      const { url } = await res.json();
      activeImg.src = url;
      activeImg.hidden = false;
      const b = byId.get(activeImg.dataset.blockId!);
      if (b) b.props[activeImg.dataset.prop!] = url;
      status.textContent = 'Image updated ✓';
    } catch { status.textContent = 'Upload failed.'; }
    filePicker.value = '';
  });

  // ---- save / publish ----
  async function send(publish: boolean) {
    status.textContent = publish ? 'Publishing…' : 'Saving…';
    try {
      const res = await fetch('/admin/pages/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, blocks: state, publish }),
      });
      status.textContent = res.ok ? (publish ? 'Published ✓' : 'Saved ✓') : 'Save failed.';
    } catch { status.textContent = 'Save failed.'; }
  }
  bar.querySelector('#composer-save')!.addEventListener('click', () => send(false));
  bar.querySelector('#composer-publish')!.addEventListener('click', () => send(true));

  // ---- mode switching (content | layout) ----
  function setMode(mode: string) {
    document.body.classList.toggle('composer-mode-layout', mode === 'layout');
    document.body.classList.toggle('composer-mode-content', mode === 'content');
    bar.querySelectorAll<HTMLElement>('.composer-mode[data-mode]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.mode === mode));
    textEls.forEach((el) => (el.contentEditable = mode === 'content' ? 'true' : 'false'));
  }
  bar.querySelectorAll<HTMLElement>('.composer-mode[data-mode]').forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.mode!)));
  setMode('content');

  // ---- layout mode ----
  initLayout({ root, state: state as any, byId: byId as any, status });

  // ---- preview toggle ----
  bar.querySelector('#composer-preview')!.addEventListener('click', () => {
    const on = document.body.classList.toggle('composer-preview');
    textEls.forEach((el) => (el.contentEditable = on ? 'false' : 'true'));
  });
}
