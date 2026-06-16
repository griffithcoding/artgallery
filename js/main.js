/* =========================================================================
   VERSO — Shared site behavior
   Injects header/footer, handles nav, scroll reveals, inquire modal,
   and exposes small render helpers used across pages.
   ========================================================================= */

(function () {
  'use strict';

  /* Central brand config — single source of truth for surface values. */
  const BRAND = window.VERSO_BRAND = {
    name: 'VERSO',
    tagline: 'Contemporary Art Gallery',
    city: 'Brooklyn, New York',
    addressLine: '312 Wythe Avenue',
    addressCity: 'Brooklyn, NY 11249',
    neighborhood: 'Williamsburg',
    hours: 'Tue–Sat, 11am–6pm',
    email: 'hello@versogallery.com',
    phone: '+1 (718) 555-0142',
    instagram: 'https://www.instagram.com/',
    domain: 'https://www.versogallery.com',
  };

  const NAV = [
    { href: 'exhibitions.html', label: 'Exhibitions' },
    { href: 'artists.html', label: 'Artists' },
    { href: 'collection.html', label: 'Works' },
    { href: 'events.html', label: 'Events' },
    { href: 'press.html', label: 'Press' },
    { href: 'resources.html', label: 'Resources' },
    { href: 'about.html', label: 'About' },
    { href: 'visit.html', label: 'Visit' },
  ];

  function currentPage() {
    const p = location.pathname.split('/').pop();
    return p === '' ? 'index.html' : p;
  }

  /* ---------- Header ---------- */
  function renderHeader() {
    const active = currentPage();
    const links = NAV.map((n) =>
      `<a href="${n.href}"${n.href === active ? ' aria-current="page"' : ''}>${n.label}</a>`
    ).join('');
    const el = document.getElementById('site-header');
    if (!el) return;
    el.className = 'site-header';
    el.innerHTML = `
      <div class="wrap">
        <nav class="nav" id="nav">
          <a class="brand" href="index.html" aria-label="${BRAND.name} home">
            ${BRAND.name}<small>${BRAND.city}</small>
          </a>
          <div class="nav-links">${links}</div>
          <div class="nav-actions">
            <a class="link-underline" href="contact.html">Inquire</a>
            <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </nav>
      </div>`;

    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Footer ---------- */
  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const year = new Date().getFullYear();
    el.className = 'site-footer';
    el.innerHTML = `
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">${BRAND.name}</div>
            <p style="color:#b7b3a9;margin-top:1rem;max-width:34ch;font-size:.9rem;">
              An independent contemporary art gallery in ${BRAND.neighborhood}, ${BRAND.city}, representing emerging and mid-career artists.
            </p>
            <form class="newsletter mt-2" onsubmit="return VERSO.onNewsletter(event)">
              <input type="email" required placeholder="Email for openings & new works" aria-label="Email address" />
              <button type="submit">Join</button>
            </form>
          </div>
          <div>
            <h4>Visit</h4>
            <ul>
              <li>${BRAND.addressLine}</li>
              <li>${BRAND.addressCity}</li>
              <li>${BRAND.hours}</li>
              <li><a href="visit.html">Directions →</a></li>
            </ul>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><a href="exhibitions.html">Exhibitions</a></li>
              <li><a href="artists.html">Artists</a></li>
              <li><a href="collection.html">Works</a></li>
              <li><a href="viewing-rooms.html">Viewing Rooms</a></li>
              <li><a href="events.html">Events</a></li>
              <li><a href="resources.html">Resources</a></li>
              <li><a href="press.html">Press</a></li>
            </ul>
          </div>
          <div>
            <h4>Connect</h4>
            <ul>
              <li><a href="mailto:${BRAND.email}">${BRAND.email}</a></li>
              <li><a href="tel:${BRAND.phone.replace(/[^+\d]/g, '')}">${BRAND.phone}</a></li>
              <li><a href="${BRAND.instagram}" rel="noopener" target="_blank">Instagram</a></li>
              <li><a href="contact.html">Contact & advisory</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${year} ${BRAND.name}. All artworks © the respective artists.</span>
          <span>${BRAND.addressLine}, ${BRAND.addressCity}</span>
        </div>
      </div>`;
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach((e) => e.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Render helpers ---------- */
  function formatAvailability(w) {
    if (w.availability === 'Sold') return 'Sold';
    if (w.availability === 'Inquire') return 'Inquire';
    return 'Available';
  }

  function artworkCard(w) {
    return `
      <a class="art-card reveal" href="artwork.html?id=${encodeURIComponent(w.slug)}">
        <span class="frame frame--hover" data-ratio="${w.ratio}">
          <img src="${w.image}" alt="${w.title} (${w.year}), ${w.medium}, by ${w.artistName}" loading="lazy" width="700" height="700" />
        </span>
        <span class="artist-name">${w.artistName}</span>
        <span class="art-title">${w.title}</span><span class="art-meta">, ${w.year}</span>
        <div class="art-meta">${w.medium}</div>
        <div class="art-status">${formatAvailability(w)}</div>
      </a>`;
  }

  function artistCard(a, sampleWork) {
    const img = sampleWork ? sampleWork.image : (window.VERSO_DATA ? window.VERSO_DATA.artSVG(a.id, 'portrait') : '');
    return `
      <a class="artist-card reveal" href="artist.html?slug=${encodeURIComponent(a.slug)}">
        <span class="frame frame--hover" data-ratio="portrait">
          <img src="${img}" alt="Work by ${a.name}" loading="lazy" />
        </span>
        <h3 class="display">${a.name}</h3>
        <p>${a.birth} · ${a.discipline}</p>
      </a>`;
  }

  /* ---------- Inquire modal ---------- */
  function ensureModal() {
    let m = document.getElementById('inquireModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'inquireModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:500;display:none;align-items:center;justify-content:center;background:rgba(20,18,12,.55);padding:1.5rem;';
    m.innerHTML = `
      <div style="background:var(--paper);max-width:520px;width:100%;padding:clamp(1.5rem,4vw,3rem);position:relative;">
        <button id="inqClose" aria-label="Close" style="position:absolute;top:1rem;right:1.2rem;background:none;border:none;font-size:1.5rem;">×</button>
        <p class="eyebrow">Inquire</p>
        <h3 class="display" style="margin:.4rem 0 .3rem;" id="inqTitle">Request information</h3>
        <p class="muted" id="inqSub" style="font-size:.9rem;margin-bottom:1.4rem;"></p>
        <form onsubmit="return VERSO.submitInquiry(event)">
          <div class="form-grid">
            <div class="field"><label>Name</label><input name="name" required></div>
            <div class="field"><label>Email</label><input type="email" name="email" required></div>
            <div class="field full"><label>Message</label><textarea name="message" rows="3" placeholder="I'd like to learn more about this work, including availability."></textarea></div>
          </div>
          <button class="btn btn--solid mt-2" type="submit" style="width:100%;justify-content:center;">Send inquiry</button>
          <p class="muted" style="font-size:.74rem;margin-top:1rem;">A gallery representative typically replies within one business day.</p>
        </form>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('#inqClose').addEventListener('click', () => { m.style.display = 'none'; });
    m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    return m;
  }

  function openInquiry(title) {
    const m = ensureModal();
    m.querySelector('#inqSub').textContent = title ? 'Regarding: ' + title : 'Tell us what you are looking for.';
    m.style.display = 'flex';
  }

  /* ---------- Public namespace ---------- */
  window.VERSO = {
    BRAND, NAV, formatAvailability, artworkCard, artistCard, openInquiry,
    getParam: (k) => new URLSearchParams(location.search).get(k),
    onNewsletter: function (e) {
      e.preventDefault();
      const input = e.target.querySelector('input');
      e.target.innerHTML = '<span style="color:#d9d6cd;font-size:.9rem;">Thank you — you’re on the list.</span>';
      return false;
    },
    submitInquiry: function (e) {
      e.preventDefault();
      const form = e.target;
      form.innerHTML = '<p class="lead" style="font-size:1.2rem;">Thank you. Your inquiry has been received — we’ll be in touch shortly.</p>';
      return false;
    },
    init: function () {
      renderHeader();
      renderFooter();
      initReveal();
    },
  };

  document.addEventListener('DOMContentLoaded', window.VERSO.init);
})();
