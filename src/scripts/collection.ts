/* =========================================================================
   VERSO — Collection browser (client)
   Client-side filtering, search, sort, and pagination over the catalogue.
   Filter/sort state is mirrored to the URL for shareable, back-button-safe
   results. Data is read from the page-embedded #works-data JSON blob (the
   page serializes getArtworks() there), so this script needs no global.
   ========================================================================= */

interface Work {
  id: string;
  slug: string;
  title: string;
  artistId: string;
  artistName: string;
  artistSlug: string;
  year: number;
  medium: string;
  category: string;
  subject: string;
  dimensions: string;
  ratio: string;
  availability: 'Available' | 'Inquire' | 'Sold';
  image: string;
}

(function () {
  'use strict';

  const dataEl = document.getElementById('works-data');
  const artworks: Work[] = JSON.parse((dataEl && dataEl.textContent) || '[]');
  // Derive category/subject vocabularies from the data (no global needed).
  const uniqueSorted = (field: 'category' | 'subject'): string[] =>
    Array.from(new Set(artworks.map((w) => w[field]).filter(Boolean))).sort();
  const D = {
    artworks,
    categories: uniqueSorted('category'),
    subjects: uniqueSorted('subject'),
  };

  const PER_PAGE = 24;

  type FilterKey = 'availability' | 'category' | 'subject' | 'artist';
  interface State {
    q: string;
    availability: Set<string>;
    category: Set<string>;
    subject: Set<string>;
    artist: Set<string>;
    sort: string;
    page: number;
  }

  const state: State = {
    q: '',
    availability: new Set<string>(),
    category: new Set<string>(),
    subject: new Set<string>(),
    artist: new Set<string>(),
    sort: 'featured',
    page: 1,
  };

  const els = {
    results: document.getElementById('results') as HTMLElement,
    count: document.getElementById('resultCount') as HTMLElement,
    pagination: document.getElementById('pagination') as HTMLElement,
    active: document.getElementById('activeFilters') as HTMLElement,
    empty: document.getElementById('empty') as HTMLElement,
    search: document.getElementById('search') as HTMLInputElement,
    sort: document.getElementById('sort') as HTMLSelectElement,
  };

  /* ---- Card renderer (matches ArtworkCard.astro markup) ---- */
  function esc(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function card(w: Work): string {
    const alt = `${w.title} (${w.year}), ${w.medium}, by ${w.artistName}`;
    return `<a class="art-card reveal is-visible" href="/works/${esc(w.slug)}">
      <span class="frame frame--hover" data-ratio="${esc(w.ratio)}">
        <img src="${esc(w.image)}" alt="${esc(alt)}" loading="lazy" width="700" height="700" />
      </span>
      <span class="artist-name">${esc(w.artistName)}</span>
      <span class="art-title">${esc(w.title)}</span><span class="art-meta">, ${w.year}</span>
      <div class="art-meta">${esc(w.medium)}</div>
      <div class="art-status">${esc(w.availability)}</div>
    </a>`;
  }

  /* ---- Build filter option lists ---- */
  const AVAILABILITY = ['Available', 'Inquire', 'Sold'];
  function counts(field: keyof Work): Record<string, number> {
    const m: Record<string, number> = {};
    D.artworks.forEach((w) => {
      const v = String(w[field]);
      m[v] = (m[v] || 0) + 1;
    });
    return m;
  }
  function buildFilter(id: string, field: keyof Work, values: string[]): void {
    const c = counts(field);
    const host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = values
      .map(
        (v) => `
      <label class="filter-opt">
        <input type="checkbox" value="${esc(v)}" data-field="${field}">
        <span>${esc(v)}</span>
        <span style="margin-left:auto;opacity:.6;">${c[v] || 0}</span>
      </label>`
      )
      .join('');
  }
  buildFilter('filter-availability', 'availability', AVAILABILITY);
  buildFilter('filter-category', 'category', D.categories.slice().sort());
  buildFilter('filter-subject', 'subject', D.subjects.slice().sort());
  // Artist filter: by name, preserving artwork order of first appearance.
  (function () {
    const c: Record<string, number> = {};
    const order: string[] = [];
    D.artworks.forEach((w) => {
      if (!(w.artistName in c)) order.push(w.artistName);
      c[w.artistName] = (c[w.artistName] || 0) + 1;
    });
    const names = order.slice().sort();
    const host = document.getElementById('filter-artist');
    if (host) {
      host.innerHTML = names
        .map(
          (n) => `
      <label class="filter-opt">
        <input type="checkbox" value="${esc(n)}" data-field="artistName">
        <span>${esc(n)}</span>
        <span style="margin-left:auto;opacity:.6;">${c[n] || 0}</span>
      </label>`
        )
        .join('');
    }
  })();

  /* ---- URL <-> state ---- */
  function readURL(): void {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.sort = p.get('sort') || 'featured';
    state.page = parseInt(p.get('page') || '', 10) || 1;
    (['availability', 'category', 'subject', 'artist'] as FilterKey[]).forEach((k) => {
      const raw = p.get(k);
      state[k] = new Set(raw ? raw.split('|') : []);
    });
    els.search.value = state.q;
    els.sort.value = state.sort;
    syncCheckboxes();
  }
  function syncCheckboxes(): void {
    document.querySelectorAll<HTMLInputElement>('.filter-opt input').forEach((cb) => {
      const f = cb.dataset.field;
      const key = (f === 'artistName' ? 'artist' : f) as FilterKey;
      cb.checked = state[key].has(cb.value);
    });
  }
  function writeURL(): void {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', String(state.page));
    (['availability', 'category', 'subject', 'artist'] as FilterKey[]).forEach((k) => {
      if (state[k].size) p.set(k, [...state[k]].join('|'));
    });
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  /* ---- Filtering + sorting ---- */
  function filtered(): Work[] {
    const q = state.q.trim().toLowerCase();
    let list = D.artworks.filter((w) => {
      if (state.availability.size && !state.availability.has(w.availability)) return false;
      if (state.category.size && !state.category.has(w.category)) return false;
      if (state.subject.size && !state.subject.has(w.subject)) return false;
      if (state.artist.size && !state.artist.has(w.artistName)) return false;
      if (q) {
        const hay = (
          w.artistName +
          ' ' +
          w.title +
          ' ' +
          w.medium +
          ' ' +
          w.category +
          ' ' +
          w.subject +
          ' ' +
          w.year
        ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir: Record<string, (a: Work, b: Work) => number> = {
      'year-desc': (a, b) => b.year - a.year,
      'year-asc': (a, b) => a.year - b.year,
      artist: (a, b) => a.artistName.localeCompare(b.artistName),
    };
    if (dir[state.sort]) list = list.slice().sort(dir[state.sort]);
    return list;
  }

  /* ---- Active filter chips ---- */
  function renderChips(): void {
    const chips: { k: string; v: string }[] = [];
    (['availability', 'category', 'subject', 'artist'] as FilterKey[]).forEach((k) => {
      state[k].forEach((v) => chips.push({ k, v }));
    });
    if (state.q) chips.unshift({ k: 'q', v: '“' + state.q + '”' });
    els.active.innerHTML = chips
      .map(
        (c) =>
          `<span class="chip">${esc(c.v)}<button data-k="${esc(c.k)}" data-v="${esc(
            c.v
          )}" aria-label="Remove">×</button></span>`
      )
      .join('');
    els.active.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'q') {
          state.q = '';
          els.search.value = '';
        } else if (k) {
          state[k as FilterKey].delete(b.dataset.v || '');
        }
        state.page = 1;
        syncCheckboxes();
        render();
      });
    });
  }

  /* ---- Pagination ---- */
  function renderPagination(total: number): void {
    const pages = Math.ceil(total / PER_PAGE);
    if (pages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }
    const cur = state.page;
    let html = `<button ${cur === 1 ? 'disabled' : ''} data-p="${cur - 1}">←</button>`;
    const set = new Set([1, pages, cur, cur - 1, cur + 1]);
    let last = 0;
    [...set]
      .filter((n) => n >= 1 && n <= pages)
      .sort((a, b) => a - b)
      .forEach((n) => {
        if (n - last > 1) html += `<span style="padding:0 .3rem;color:var(--ink-soft);">…</span>`;
        html += `<button ${n === cur ? 'aria-current="true"' : ''} data-p="${n}">${n}</button>`;
        last = n;
      });
    html += `<button ${cur === pages ? 'disabled' : ''} data-p="${cur + 1}">→</button>`;
    els.pagination.innerHTML = html;
    els.pagination.querySelectorAll<HTMLButtonElement>('button[data-p]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        state.page = parseInt(b.dataset.p || '1', 10);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ---- Render ---- */
  function render(): void {
    const list = filtered();
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * PER_PAGE;
    const slice = list.slice(start, start + PER_PAGE);

    els.empty.classList.toggle('hidden', total !== 0);
    els.results.innerHTML = slice.map(card).join('');

    const shownFrom = total ? start + 1 : 0;
    const shownTo = Math.min(start + PER_PAGE, total);
    els.count.innerHTML = total
      ? `Showing <strong>${shownFrom}–${shownTo}</strong> of <strong>${total.toLocaleString()}</strong> works`
      : '';
    renderChips();
    renderPagination(total);
    writeURL();
  }

  /* ---- Events ---- */
  let t: ReturnType<typeof setTimeout>;
  els.search.addEventListener('input', (e) => {
    clearTimeout(t);
    const target = e.target as HTMLInputElement;
    t = setTimeout(() => {
      state.q = target.value;
      state.page = 1;
      render();
    }, 180);
  });
  els.sort.addEventListener('change', (e) => {
    state.sort = (e.target as HTMLSelectElement).value;
    state.page = 1;
    render();
  });
  document.querySelectorAll<HTMLInputElement>('.filter-opt input').forEach((cb) => {
    cb.addEventListener('change', () => {
      const f = cb.dataset.field;
      const key = (f === 'artistName' ? 'artist' : f) as FilterKey;
      if (cb.checked) state[key].add(cb.value);
      else state[key].delete(cb.value);
      state.page = 1;
      render();
    });
  });
  document.getElementById('clearAll')?.addEventListener('click', () => {
    state.q = '';
    els.search.value = '';
    (['availability', 'category', 'subject', 'artist'] as FilterKey[]).forEach((k) =>
      state[k].clear()
    );
    state.page = 1;
    syncCheckboxes();
    render();
  });
  // Mobile filter drawer
  const filters = document.getElementById('filters');
  document
    .getElementById('openFilters')
    ?.addEventListener('click', () => filters?.classList.add('is-open'));
  document
    .getElementById('closeFilters')
    ?.addEventListener('click', () => filters?.classList.remove('is-open'));

  /* ---- Init ---- */
  readURL();
  render();
})();
