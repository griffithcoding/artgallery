/* =========================================================================
   VERSO — Placeholder data layer
   Generates a deterministic catalogue of artists + artworks so the UI can
   demonstrate browsing a very large inventory (designed to scale to 20,000
   works; this demo generates a representative subset client-side).
   No external image services are used — artwork visuals are generated as
   inline SVG "placeholder" compositions seeded from each work's id.
   ========================================================================= */

(function (global) {
  'use strict';

  /* ---- Seeded PRNG (mulberry32) for deterministic placeholders ---- */
  function seeded(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---- Vocabulary for synthetic-but-plausible placeholder metadata ---- */
  const FIRST = ['Mara','Idris','Lena','Tobias','Noor','Caleb','Yuki','Imani','Sølve','Renata','Otis','Priya','Hale','Dao','Beatriz','Quinn','Amara','Felix','Saoirse','Jonah','Wren','Cosima','Emeka','Lilou','Bram','Talia','Casper','Naomi','Reza','Ingrid','Marcus','Aiko','Dimitri','Esme','Kwame','Lucia','Hadi','Petra','Soren','Nadia'];
  const LAST = ['Okafor','Voss','Marchetti','Ahn','Calderón','Lindqvist','Bauer','Nakamura','Delacroix','Osei','Rivera','Holloway','Petrova','Mwangi','Fontaine','Sørensen','Castellano','Ng','Abadi','Kowalski','Brandt','Mehta','Ferreira','Lindgren','Aziz','Romano','Haas','Eze','Bergström','Nakashima','Vidal','Cho','Larkin','Salgado','Weiss','Pham','Ito','Andersson','Quaye','Reyes'];
  const MEDIUMS = ['Oil on canvas','Acrylic on linen','Archival pigment print','Bronze','Mixed media on panel','Graphite on paper','Silkscreen on paper','Ceramic and glaze','Cast resin','Welded steel','Watercolor on paper','Photographic C-print','Oil and wax on canvas','Charcoal on paper','Cyanotype','Cast aluminum','Hand-dyed textile','Found-object assemblage','Inkjet on aluminum','Encaustic on board'];
  const CATEGORIES = ['Painting','Sculpture','Photography','Works on Paper','Prints','Textile','Mixed Media','Ceramic'];
  const SUBJECTS = ['Abstraction','Figuration','Landscape','Portraiture','Still Life','Geometric','Color Field','Conceptual','Minimalism','Surreal'];
  const TITLE_A = ['Untitled','Threshold','Interval','Field Notes','Slow Tide','Quiet Index','Echo','Aperture','Residue','Verso','Common Ground','Half-Light','Soft Architecture','Provisional','Night Garden','After Image','Low Frequency','Inventory','Margin','Tideline','Open Form','Lateral','Undertow','Daylighting','Counterweight','Holding Pattern','Loose Constellation'];
  const TITLE_B = ['No. 4','(Brooklyn)','II','in Ochre','at Dusk','for E.','VII','no. 12','(Study)','III','in Two Parts','at Noon','(Reprise)','IX','no. 3','in Blue','(Diptych)','VI'];
  const CITIES = ['b. Lagos','b. Brooklyn','b. Milan','b. Seoul','b. Mexico City','b. Stockholm','b. Berlin','b. Osaka','b. Nairobi','b. London','b. São Paulo','b. Manila','b. Tehran','b. Warsaw','b. Accra','b. Mumbai'];

  const PALETTES = [
    ['#1c3a3a','#8a8f7d','#d9d6cd','#c0492f'],
    ['#2b2b2e','#6c6f7a','#b9bcc6','#e3b23c'],
    ['#3a2d28','#a6705a','#d8c3a5','#1f4e4a'],
    ['#101418','#3d5a6c','#8aa1b1','#d6cfc4'],
    ['#5a1f1a','#b5562f','#e8c39e','#243b30'],
    ['#222','#555','#999','#cfcabb'],
    ['#1b2a4a','#516b8b','#a9bcd0','#e6d3a3'],
    ['#2f3b2f','#6b8e5a','#cdd6b8','#9c3b2e'],
  ];

  /* ---- Generate an inline SVG placeholder that reads as abstract "art" ---- */
  function artSVG(seedKey, ratio) {
    const rnd = seeded(hashStr(seedKey));
    const dims = ratio === 'portrait' ? [600, 800] : ratio === 'landscape' ? [800, 600] : ratio === 'tall' ? [560, 840] : [700, 700];
    const [w, h] = dims;
    const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
    const bg = pal[3];
    let shapes = '';
    const style = Math.floor(rnd() * 4);
    if (style === 0) { /* color blocks */
      const cols = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < cols; i++) {
        shapes += `<rect x="${(w / cols) * i}" y="0" width="${w / cols + 1}" height="${h}" fill="${pal[Math.floor(rnd() * 3)]}" opacity="${0.6 + rnd() * 0.4}"/>`;
      }
    } else if (style === 1) { /* circles / orbits */
      for (let i = 0; i < 5; i++) {
        shapes += `<circle cx="${rnd() * w}" cy="${rnd() * h}" r="${30 + rnd() * (w / 3)}" fill="${pal[Math.floor(rnd() * 3)]}" opacity="${0.35 + rnd() * 0.5}"/>`;
      }
    } else if (style === 2) { /* gestural strokes */
      for (let i = 0; i < 6; i++) {
        const x1 = rnd() * w, y1 = rnd() * h, x2 = rnd() * w, y2 = rnd() * h;
        shapes += `<path d="M${x1} ${y1} Q ${rnd() * w} ${rnd() * h} ${x2} ${y2}" stroke="${pal[Math.floor(rnd() * 3)]}" stroke-width="${4 + rnd() * 26}" fill="none" stroke-linecap="round" opacity="${0.5 + rnd() * 0.5}"/>`;
      }
    } else { /* geometric grid */
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n * n; i++) {
        if (rnd() > 0.45) {
          const cw = w / n, ch = h / n;
          shapes += `<rect x="${(i % n) * cw}" y="${Math.floor(i / n) * ch}" width="${cw}" height="${ch}" fill="${pal[Math.floor(rnd() * 3)]}" opacity="${0.5 + rnd() * 0.5}"/>`;
        }
      }
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'><rect width='${w}' height='${h}' fill='${bg}'/>${shapes}</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /* ---- Build artists ---- */
  const RATIOS = ['portrait', 'landscape', 'square', 'tall'];
  const ARTIST_COUNT = 28;
  const artists = [];
  for (let i = 0; i < ARTIST_COUNT; i++) {
    const r = seeded(1000 + i * 7);
    const first = FIRST[Math.floor(r() * FIRST.length)];
    const last = LAST[i % LAST.length];
    const name = first + ' ' + last;
    const slug = (name.toLowerCase().replace(/[^a-z]+/g, '-'));
    artists.push({
      id: 'a' + i,
      name,
      slug,
      birth: CITIES[Math.floor(r() * CITIES.length)] + ', ' + (1955 + Math.floor(r() * 45)),
      discipline: CATEGORIES[Math.floor(r() * CATEGORIES.length)],
      bio: `${name} is a contemporary artist whose practice moves between ${SUBJECTS[Math.floor(r() * SUBJECTS.length)].toLowerCase()} and ${SUBJECTS[Math.floor(r() * SUBJECTS.length)].toLowerCase()}. Working primarily in ${MEDIUMS[Math.floor(r() * MEDIUMS.length)].toLowerCase()}, the work investigates memory, material, and the architecture of everyday space. ${first}'s work has been exhibited internationally and is held in private and institutional collections.`,
    });
  }
  artists.sort((a, b) => a.name.localeCompare(b.name));

  /* ---- Build artworks (demo subset; architecture scales to 20k) ---- */
  const TOTAL_INVENTORY = 20000;      // headline catalogue size
  const DEMO_COUNT = 312;             // generated client-side for the demo
  const artworks = [];
  for (let i = 0; i < DEMO_COUNT; i++) {
    const r = seeded(50000 + i * 13);
    const artist = artists[Math.floor(r() * artists.length)];
    const ratio = RATIOS[Math.floor(r() * RATIOS.length)];
    const cat = CATEGORIES[Math.floor(r() * CATEGORIES.length)];
    const subject = SUBJECTS[Math.floor(r() * SUBJECTS.length)];
    const medium = MEDIUMS[Math.floor(r() * MEDIUMS.length)];
    const year = 2008 + Math.floor(r() * 18);
    let title = TITLE_A[Math.floor(r() * TITLE_A.length)];
    if (r() > 0.5) title += ' ' + TITLE_B[Math.floor(r() * TITLE_B.length)];
    const wIn = 12 + Math.floor(r() * 60), hIn = 12 + Math.floor(r() * 72);
    const availTier = r();
    let availability;
    if (availTier > 0.82) availability = 'Sold';
    else if (availTier > 0.55) availability = 'Inquire';
    else availability = 'Available';
    const id = 'w' + String(i).padStart(4, '0');
    artworks.push({
      id,
      slug: id,
      title,
      artistId: artist.id,
      artistName: artist.name,
      artistSlug: artist.slug,
      year,
      medium,
      category: cat,
      subject,
      dimensions: `${hIn} × ${wIn} in`,
      ratio,
      availability,
      image: artSVG(id, ratio),
    });
  }

  /* ---- Exhibitions ---- */
  const exhibitions = [
    { id: 'ex1', slug: 'soft-architecture', title: 'Soft Architecture', subtitle: 'New paintings and works on paper', status: 'On View', dates: 'May 22 – Jul 12, 2026', year: 2026, artistIds: [artists[0].id, artists[3].id, artists[7].id], blurb: 'A group exhibition examining the porous boundary between built space and the body, bringing together six painters who treat the surface as a kind of dwelling.' },
    { id: 'ex2', slug: 'low-frequency', title: 'Low Frequency', subtitle: artists[2].name + ', solo exhibition', status: 'Upcoming', dates: 'Jul 24 – Sep 6, 2026', year: 2026, artistIds: [artists[2].id], blurb: 'The gallery presents the first New York solo exhibition of new sculpture and wall reliefs, extending an ongoing inquiry into resonance, weight, and quiet.' },
    { id: 'ex3', slug: 'tideline', title: 'Tideline', subtitle: 'Photography and cyanotype', status: 'Past', dates: 'Mar 6 – May 10, 2026', year: 2026, artistIds: [artists[5].id, artists[9].id], blurb: 'Two artists working at the edge of land and water, mapping erosion, time, and the photographic trace.' },
    { id: 'ex4', slug: 'common-ground', title: 'Common Ground', subtitle: 'Group exhibition', status: 'Past', dates: 'Jan 10 – Feb 28, 2026', year: 2026, artistIds: [artists[1].id, artists[4].id, artists[6].id, artists[8].id], blurb: 'Eight Brooklyn-based artists consider land, labor, and belonging across painting, textile, and assemblage.' },
    { id: 'ex5', slug: 'night-garden', title: 'Night Garden', subtitle: artists[10].name + ', solo exhibition', status: 'Past', dates: 'Oct 18 – Dec 14, 2025', year: 2025, artistIds: [artists[10].id], blurb: 'A luminous body of nocturnes in oil and wax, made over two years in the artist’s Greenpoint studio.' },
    { id: 'ex6', slug: 'inventory', title: 'Inventory', subtitle: 'Works on paper', status: 'Past', dates: 'Jun 7 – Aug 30, 2025', year: 2025, artistIds: [artists[11].id, artists[12].id], blurb: 'A summer survey of drawing as thinking — studies, fragments, and finished sheets.' },
  ];

  /* ---- Art fairs ---- */
  const fairs = [
    { name: 'The Armory Show', city: 'New York', booth: 'Booth 214', dates: 'Sep 4 – 7, 2026', status: 'Upcoming' },
    { name: 'NADA Miami', city: 'Miami Beach', booth: 'Booth N12', dates: 'Dec 2 – 6, 2026', status: 'Upcoming' },
    { name: 'Independent', city: 'New York', booth: 'Spring Studios', dates: 'May 7 – 10, 2026', status: 'Past' },
    { name: 'Frieze London', city: 'London', booth: 'Focus, Booth F8', dates: 'Oct 15 – 19, 2025', status: 'Past' },
  ];

  /* ---- Press ---- */
  const press = [
    { outlet: 'Artforum', headline: '“VERSO’s Soft Architecture finds tenderness in structure”', date: 'June 2026', kind: 'Review' },
    { outlet: 'The New York Times', headline: 'A Williamsburg gallery puts its whole program in the open', date: 'May 2026', kind: 'Feature' },
    { outlet: 'Hyperallergic', headline: 'The best gallery shows in Brooklyn this month', date: 'May 2026', kind: 'Listing' },
    { outlet: 'Cultured', headline: '15 emerging artists to watch, according to their dealers', date: 'Apr 2026', kind: 'Feature' },
    { outlet: 'ARTnews', headline: 'How small galleries are using open access to court collectors', date: 'Mar 2026', kind: 'Feature' },
    { outlet: 'Brooklyn Magazine', headline: 'Inside VERSO, the gallery that put its back room in the open', date: 'Feb 2026', kind: 'Profile' },
  ];

  /* ---- Public API ---- */
  global.VERSO_DATA = {
    artists, artworks, exhibitions, fairs, press,
    categories: CATEGORIES, subjects: SUBJECTS, mediums: MEDIUMS,
    totalInventory: TOTAL_INVENTORY,
    demoCount: DEMO_COUNT,
    artSVG,
    artistById: (id) => artists.find((a) => a.id === id),
    artistBySlug: (s) => artists.find((a) => a.slug === s),
    artworkBySlug: (s) => artworks.find((w) => w.slug === s),
    worksByArtist: (id) => artworks.filter((w) => w.artistId === id),
    exhibitionBySlug: (s) => exhibitions.find((e) => e.slug === s),
  };
})(typeof window !== 'undefined' ? window : this);
