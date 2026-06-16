/* =========================================================================
   VERSO — Collection browser
   Client-side filtering, search, sort, and pagination over the catalogue.
   Architected so the same UI scales to a 20,000-work inventory backed by a
   search index (e.g. Pagefind/FlexSearch) or a paginated API in production.
   Filter/sort state is mirrored to the URL for shareable, back-button-safe
   results.
   ========================================================================= */

(function () {
  'use strict';
  const D = window.VERSO_DATA;
  const PER_PAGE = 24;

  const state = {
    q: '',
    availability: new Set(),
    category: new Set(),
    subject: new Set(),
    artist: new Set(),
    sort: 'featured',
    page: 1,
  };

  const els = {
    results: document.getElementById('results'),
    count: document.getElementById('resultCount'),
    pagination: document.getElementById('pagination'),
    active: document.getElementById('activeFilters'),
    empty: document.getElementById('empty'),
    search: document.getElementById('search'),
    sort: document.getElementById('sort'),
  };

  /* ---- Build filter option lists ---- */
  const AVAILABILITY = ['Available', 'Inquire', 'Sold'];
  function counts(field) {
    const m = {};
    D.artworks.forEach((w) => { const v = w[field]; m[v] = (m[v] || 0) + 1; });
    return m;
  }
  function buildFilter(id, field, values) {
    const c = counts(field);
    const host = document.getElementById(id);
    host.innerHTML = values.map((v) => `
      <label class="filter-opt">
        <input type="checkbox" value="${v}" data-field="${field}">
        <span>${v}</span>
        <span style="margin-left:auto;opacity:.6;">${c[v] || 0}</span>
      </label>`).join('');
  }
  buildFilter('filter-availability', 'availability', AVAILABILITY);
  buildFilter('filter-category', 'category', D.categories.slice().sort());
  buildFilter('filter-subject', 'subject', D.subjects.slice().sort());
  // Artist filter: by name
  (function () {
    const c = {};
    D.artworks.forEach((w) => { c[w.artistName] = (c[w.artistName] || 0) + 1; });
    const names = D.artists.map((a) => a.name).filter((n) => c[n]);
    document.getElementById('filter-artist').innerHTML = names.map((n) => `
      <label class="filter-opt">
        <input type="checkbox" value="${n}" data-field="artistName">
        <span>${n}</span>
        <span style="margin-left:auto;opacity:.6;">${c[n] || 0}</span>
      </label>`).join('');
  })();

  /* ---- URL <-> state ---- */
  function readURL() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.sort = p.get('sort') || 'featured';
    state.page = parseInt(p.get('page'), 10) || 1;
    ['availability', 'category', 'subject', 'artist'].forEach((k) => {
      const raw = p.get(k);
      state[k] = new Set(raw ? raw.split('|') : []);
    });
    // also support ?artist=Name deep links and category
    els.search.value = state.q;
    els.sort.value = state.sort;
    syncCheckboxes();
  }
  function fieldKey(stateKey) { return stateKey === 'artist' ? 'artistName' : stateKey; }
  function syncCheckboxes() {
    document.querySelectorAll('.filter-opt input').forEach((cb) => {
      const f = cb.dataset.field;
      const key = f === 'artistName' ? 'artist' : f;
      cb.checked = state[key].has(cb.value);
    });
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', state.page);
    ['availability', 'category', 'subject', 'artist'].forEach((k) => {
      if (state[k].size) p.set(k, [...state[k]].join('|'));
    });
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  /* ---- Filtering + sorting ---- */
  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = D.artworks.filter((w) => {
      if (state.availability.size && !state.availability.has(w.availability)) return false;
      if (state.category.size && !state.category.has(w.category)) return false;
      if (state.subject.size && !state.subject.has(w.subject)) return false;
      if (state.artist.size && !state.artist.has(w.artistName)) return false;
      if (q) {
        const hay = (w.artistName + ' ' + w.title + ' ' + w.medium + ' ' + w.category + ' ' + w.subject + ' ' + w.year).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = { 'year-desc': (a, b) => b.year - a.year, 'year-asc': (a, b) => a.year - b.year,
      'artist': (a, b) => a.artistName.localeCompare(b.artistName) };
    if (dir[state.sort]) list = list.slice().sort(dir[state.sort]);
    return list;
  }

  /* ---- Active filter chips ---- */
  function renderChips() {
    const chips = [];
    ['availability', 'category', 'subject', 'artist'].forEach((k) => {
      state[k].forEach((v) => chips.push({ k, v }));
    });
    if (state.q) chips.unshift({ k: 'q', v: '“' + state.q + '”' });
    els.active.innerHTML = chips.map((c) =>
      `<span class="chip">${c.v}<button data-k="${c.k}" data-v="${c.v}" aria-label="Remove">×</button></span>`).join('');
    els.active.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'q') { state.q = ''; els.search.value = ''; }
        else { state[k].delete(b.dataset.v); }
        state.page = 1; syncCheckboxes(); render();
      });
    });
  }

  /* ---- Pagination ---- */
  function renderPagination(total) {
    const pages = Math.ceil(total / PER_PAGE);
    if (pages <= 1) { els.pagination.innerHTML = ''; return; }
    const cur = state.page;
    let html = `<button ${cur === 1 ? 'disabled' : ''} data-p="${cur - 1}">←</button>`;
    const set = new Set([1, pages, cur, cur - 1, cur + 1]);
    let last = 0;
    [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n) => {
      if (n - last > 1) html += `<span style="padding:0 .3rem;color:var(--ink-soft);">…</span>`;
      html += `<button ${n === cur ? 'aria-current="true"' : ''} data-p="${n}">${n}</button>`;
      last = n;
    });
    html += `<button ${cur === pages ? 'disabled' : ''} data-p="${cur + 1}">→</button>`;
    els.pagination.innerHTML = html;
    els.pagination.querySelectorAll('button[data-p]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        state.page = parseInt(b.dataset.p, 10);
        render(); window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ---- Render ---- */
  function render() {
    const list = filtered();
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * PER_PAGE;
    const slice = list.slice(start, start + PER_PAGE);

    els.empty.classList.toggle('hidden', total !== 0);
    els.results.innerHTML = slice.map(VERSO.artworkCard).join('');
    els.results.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible'));

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
  let t;
  els.search.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value; state.page = 1; render(); }, 180);
  });
  els.sort.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; render(); });
  document.querySelectorAll('.filter-opt input').forEach((cb) => {
    cb.addEventListener('change', () => {
      const f = cb.dataset.field;
      const key = f === 'artistName' ? 'artist' : f;
      if (cb.checked) state[key].add(cb.value); else state[key].delete(cb.value);
      state.page = 1; render();
    });
  });
  document.getElementById('clearAll').addEventListener('click', () => {
    state.q = ''; els.search.value = '';
    ['availability', 'category', 'subject', 'artist'].forEach((k) => state[k].clear());
    state.page = 1; syncCheckboxes(); render();
  });
  // Mobile filter drawer
  const filters = document.getElementById('filters');
  document.getElementById('openFilters').addEventListener('click', () => filters.classList.add('is-open'));
  document.getElementById('closeFilters').addEventListener('click', () => filters.classList.remove('is-open'));

  /* ---- Init ---- */
  readURL();
  render();
})();
