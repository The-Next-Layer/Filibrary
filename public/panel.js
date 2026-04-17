(function () {
  var data = [];
  try {
    var el = document.getElementById('filament-data');
    if (el) data = JSON.parse(el.textContent || '[]');
  } catch (e) { data = []; }

  var bySlug = {};
  data.forEach(function (f) { bySlug[f.slug] = f; });

  var panel    = document.getElementById('detail-panel');
  var backdrop = document.getElementById('panel-backdrop');
  var inner    = document.getElementById('panel-inner');
  if (!panel || !backdrop || !inner) return;

  var lastFocused = null;

  function tagClass(tag) {
    return 'tag tag-' + tag.replace(/\s+/g, '-').replace(/\//g, '-');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderRadar(stats) {
    if (!stats || stats.length === 0) return '';
    var size = 320, cx = size / 2, cy = size / 2, r = 100;
    var n = stats.length;
    var angleFor = function (i) { return (Math.PI * 2 * i / n) - Math.PI / 2; };

    var rings = '';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var a = angleFor(i);
        pts.push((cx + r * f * Math.cos(a)).toFixed(1) + ',' + (cy + r * f * Math.sin(a)).toFixed(1));
      }
      var cls = f === 1 ? 'radar-ring radar-ring-outer' : 'radar-ring';
      rings += '<polygon points="' + pts.join(' ') + '" class="' + cls + '" />';
    });

    var axes = '';
    for (var i = 0; i < n; i++) {
      var aa = angleFor(i);
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r * Math.cos(aa)).toFixed(1) + '" y2="' + (cy + r * Math.sin(aa)).toFixed(1) + '" class="radar-axis" />';
    }

    var dataPts = [];
    var dots = '';
    for (var j = 0; j < n; j++) {
      var ang = angleFor(j);
      var val = Math.max(0, Math.min(100, stats[j].value || 0));
      var rr  = r * (val / 100);
      var px = cx + rr * Math.cos(ang);
      var py = cy + rr * Math.sin(ang);
      dataPts.push(px.toFixed(1) + ',' + py.toFixed(1));
      dots += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.2" class="radar-dot" />';
    }

    var labels = '';
    for (var k = 0; k < n; k++) {
      var la = angleFor(k);
      var lx = cx + (r + 24) * Math.cos(la);
      var ly = cy + (r + 24) * Math.sin(la);
      var anchor = 'middle';
      if (Math.cos(la) > 0.35) anchor = 'start';
      else if (Math.cos(la) < -0.35) anchor = 'end';
      labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" class="radar-label" text-anchor="' + anchor + '" dominant-baseline="middle">' + esc(stats[k].label) + '</text>';
      var vx = cx + (r + 24) * Math.cos(la);
      var vy = cy + (r + 24) * Math.sin(la) + 14;
      labels += '<text x="' + vx.toFixed(1) + '" y="' + vy.toFixed(1) + '" class="radar-value" text-anchor="' + anchor + '" dominant-baseline="middle">' + esc(stats[k].value) + '</text>';
    }

    return '<div class="radar-wrap"><svg viewBox="0 0 ' + size + ' ' + size + '" class="radar" role="img" aria-label="Filament performance radar">'
      + rings + axes
      + '<polygon points="' + dataPts.join(' ') + '" class="radar-data" />'
      + dots + labels
      + '</svg></div>';
  }

  function renderPanel(f) {
    var tagsHtml = (f.tags || []).map(function (t) {
      return '<span class="' + tagClass(t) + '">' + esc(t) + '</span>';
    }).join('');

    var statsBlock;
    if (f.stats && f.stats.length > 0) {
      statsBlock =
        '<section class="panel-section">'
          + '<h3>Performance</h3>'
          + renderRadar(f.stats)
          + (f.statsSource ? '<p class="stat-source">Source: ' + esc(f.statsSource) + '</p>' : '')
        + '</section>';
    } else {
      statsBlock =
        '<section class="panel-section stats-empty">'
          + '<h3>Performance</h3>'
          + '<p>Detailed ratings for this material aren\'t available yet. '
            + '<button class="link-btn" type="button" data-suggest="' + esc(f.slug) + '" data-suggest-tab="stats">Suggest ratings</button>.'
          + '</p>'
        + '</section>';
    }

    var buyBlock = '';
    if (f.purchaseLinks && f.purchaseLinks.length > 0) {
      buyBlock =
        '<section class="panel-section">'
          + '<h3>Where to Buy</h3>'
          + '<div class="buy-list">'
            + f.purchaseLinks.map(function (l) {
                return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer sponsored" class="btn-buy">'
                  + '<span>' + esc(l.label) + '</span><span class="btn-buy-arrow">→</span></a>';
              }).join('')
          + '</div>'
        + '</section>';
    } else {
      buyBlock =
        '<section class="panel-section">'
          + '<h3>Where to Buy</h3>'
          + '<p class="no-links">No purchase links yet. '
            + '<button class="link-btn" type="button" data-suggest="' + esc(f.slug) + '" data-suggest-tab="vendor">Suggest a vendor</button>.'
          + '</p>'
        + '</section>';
    }

    var videosBlock = '';
    if (f.videoReferences && f.videoReferences.length > 0) {
      videosBlock =
        '<section class="panel-section">'
          + '<h3>Referenced In</h3>'
          + '<div class="video-grid">'
            + f.videoReferences.map(function (v) {
                return '<a href="' + esc(v.url) + '" target="_blank" rel="noopener noreferrer" class="video-card">'
                  + '<div class="video-thumb">'
                    + '<img src="' + esc(v.thumbnailUrl) + '" alt="' + esc(v.title) + '" loading="lazy" />'
                    + '<span class="video-play">▶</span>'
                  + '</div>'
                  + '<p class="video-title">' + esc(v.title) + '</p>'
                + '</a>';
              }).join('')
          + '</div>'
        + '</section>';
    }

    var related = data.filter(function (r) {
      return r.slug !== f.slug && r.tags.some(function (t) { return (f.tags || []).indexOf(t) >= 0; });
    }).slice(0, 4);

    var relatedBlock = '';
    if (related.length > 0) {
      relatedBlock =
        '<section class="panel-section">'
          + '<h3>Related</h3>'
          + '<ul class="related-list">'
            + related.map(function (r) {
                return '<li><button class="related-link" data-goto="' + esc(r.slug) + '" type="button">'
                  + '<span class="related-short">' + esc(r.shortName) + '</span>'
                  + '<span class="related-full">' + esc(r.fullName) + '</span>'
                + '</button></li>';
              }).join('')
          + '</ul>'
        + '</section>';
    }

    var reportBlock =
      '<section class="panel-footer-row">'
        + '<button class="suggest-link" type="button" data-suggest="' + esc(f.slug) + '" data-suggest-tab="vendor">'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
          + 'Suggest an edit'
        + '</button>'
        + '<button class="report-btn" id="report-btn" type="button" data-slug="' + esc(f.slug) + '">'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>'
          + 'Report an issue'
        + '</button>'
      + '</section>';

    inner.innerHTML =
      '<div class="panel-top">'
        + '<button class="panel-close" id="panel-close" aria-label="Close panel" type="button">'
          + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        + '</button>'
      + '</div>'
      + '<header class="panel-header">'
        + '<div class="panel-title-row">'
          + '<span class="panel-short">' + esc(f.shortName) + '</span>'
          + '<div class="panel-tags">' + tagsHtml + '</div>'
        + '</div>'
        + '<h2 class="panel-full">' + esc(f.fullName) + '</h2>'
        + '<p class="panel-summary">' + esc(f.summary) + '</p>'
      + '</header>'
      + statsBlock
      + buyBlock
      + videosBlock
      + relatedBlock
      + reportBlock;

    var closeBtn = document.getElementById('panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    var relBtns = inner.querySelectorAll('[data-goto]');
    for (var m = 0; m < relBtns.length; m++) {
      relBtns[m].addEventListener('click', function (ev) {
        var slug = ev.currentTarget.getAttribute('data-goto');
        if (slug) openPanel(slug);
      });
    }
    panel.scrollTop = 0;
  }

  function openPanel(slug) {
    var f = bySlug[slug];
    if (!f) return;
    lastFocused = document.activeElement;
    renderPanel(f);
    panel.classList.add('open');
    backdrop.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('f', slug);
      history.replaceState({}, '', url.pathname + url.search);
    } catch (e) {}
    var closeBtn = document.getElementById('panel-close');
    if (closeBtn) closeBtn.focus();
  }

  function closePanel() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('f');
      history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    } catch (e) {}
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // Wire up cards.
  var cards = document.querySelectorAll('.filament-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener('click', function (ev) {
      var slug = ev.currentTarget.getAttribute('data-slug');
      if (slug) openPanel(slug);
    });
  }

  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && panel.classList.contains('open')) closePanel();
  });

  // Deep link on load.
  try {
    var params = new URL(window.location.href).searchParams;
    var initial = params.get('f');
    if (initial && bySlug[initial]) openPanel(initial);
  } catch (e) {}

  // ── Search + filter ──
  var searchInput = document.getElementById('search');
  var filterTags  = document.querySelectorAll('.filter-tag');
  var countEl     = document.getElementById('results-count');
  var noResults   = document.getElementById('no-results');
  var clearBtn    = document.getElementById('clear-btn');

  var activeTag = 'all';
  var searchQuery = '';

  function applyFilters() {
    var visible = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var tagsData = [];
      try { tagsData = JSON.parse(card.getAttribute('data-tags') || '[]'); } catch (e) {}
      var search = (card.getAttribute('data-search') || '');
      var tagMatch = activeTag === 'all' || tagsData.indexOf(activeTag) >= 0;
      var searchMatch = !searchQuery || search.indexOf(searchQuery.toLowerCase()) >= 0;
      var show = tagMatch && searchMatch;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    if (countEl) countEl.textContent = visible + ' material' + (visible !== 1 ? 's' : '');
    if (noResults) noResults.classList.toggle('hidden', visible > 0);
  }

  for (var t = 0; t < filterTags.length; t++) {
    filterTags[t].addEventListener('click', function (ev) {
      activeTag = ev.currentTarget.getAttribute('data-tag') || 'all';
      for (var x = 0; x < filterTags.length; x++) {
        filterTags[x].classList.toggle('active', filterTags[x].getAttribute('data-tag') === activeTag);
      }
      applyFilters();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value.trim();
      applyFilters();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      activeTag = 'all';
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      for (var x = 0; x < filterTags.length; x++) {
        filterTags[x].classList.toggle('active', filterTags[x].getAttribute('data-tag') === 'all');
      }
      applyFilters();
    });
  }
})();
