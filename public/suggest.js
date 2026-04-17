// Filibrary "Suggest an edit" modal — small additions to an existing filament.
// Exposes window.openSuggest(slug, tab) for other scripts to call.
(function () {
  var SUPABASE_URL  = window.__SUPABASE_URL__;
  var SUPABASE_ANON = window.__SUPABASE_ANON__;

  var fingerprint = (function () {
    try {
      var key = 'filibrary_fp';
      var v = localStorage.getItem(key);
      if (!v) {
        v = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(key, v);
      }
      return v;
    } catch (_) { return null; }
  })();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ytThumb(url) {
    var m = /(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/.exec(String(url || ''));
    return m ? 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' : '';
  }

  var TABS = [
    { key: 'vendor', label: 'Vendor',  desc: 'A shop or brand that sells this filament.' },
    { key: 'video',  label: 'Video',   desc: 'A YouTube review or guide for this material.' },
    { key: 'stats',  label: 'Ratings', desc: 'Rate each property 0–100. All six values required.' },
    { key: 'note',   label: 'Note',    desc: 'Anything else — we\'ll read and review.' },
  ];

  function buildModal(slug, activeTab) {
    var active = activeTab && TABS.some(function (t) { return t.key === activeTab; }) ? activeTab : 'vendor';
    var wrap = document.createElement('div');
    wrap.className = 'suggest-modal-wrap';
    wrap.innerHTML =
      '<div class="suggest-modal-backdrop" data-close></div>'
      + '<div class="suggest-modal" role="dialog" aria-modal="true" aria-label="Suggest an edit">'
        + '<div class="suggest-modal-head">'
          + '<div>'
            + '<h3>Suggest an edit</h3>'
            + '<p class="suggest-sub">Adding to <strong>' + esc(slug) + '</strong>. Thanks for helping keep the library accurate.</p>'
          + '</div>'
          + '<button type="button" class="report-close" data-close aria-label="Close">'
            + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          + '</button>'
        + '</div>'

        + '<p class="suggest-prompt">What needs fixing?</p>'
        + '<div class="suggest-tabs" role="tablist">'
          + TABS.map(function (t) {
              var cls = t.key === active ? 'suggest-tab active' : 'suggest-tab';
              return '<button type="button" class="' + cls + '" data-tab="' + t.key + '" role="tab">' + esc(t.label) + '</button>';
            }).join('')
        + '</div>'

        + '<p class="suggest-desc" id="suggest-desc"></p>'

        + '<form class="suggest-form">'
          // Vendor pane
          + '<div class="suggest-pane" data-pane="vendor">'
            + '<label class="form-label">Vendor or brand name</label>'
            + '<input class="form-input" name="vendor_label" placeholder="e.g. Polymaker" maxlength="80" />'
            + '<label class="form-label" style="margin-top:0.75rem">Product or store URL</label>'
            + '<input type="url" class="form-input" name="vendor_url" placeholder="https://shop.polymaker.com/..." required />'
          + '</div>'

          // Video pane
          + '<div class="suggest-pane hidden" data-pane="video">'
            + '<label class="form-label">YouTube URL</label>'
            + '<input type="url" class="form-input" name="video_url" placeholder="https://youtu.be/..." required />'
            + '<label class="form-label" style="margin-top:0.75rem">Video title (optional)</label>'
            + '<input class="form-input" name="video_title" placeholder="e.g. PLA vs PETG comparison" maxlength="120" />'
          + '</div>'

          // Stats pane
          + '<div class="suggest-pane hidden" data-pane="stats">'
            + '<div class="stats-grid">'
              + ['Strength','Heat','Printability','Weather','Flex','Finish'].map(function (lbl) {
                  return (
                    '<div class="stat-slider">'
                      + '<label for="s-' + lbl + '"><span>' + lbl + '</span><output data-out="' + lbl + '">50</output></label>'
                      + '<input type="range" id="s-' + lbl + '" data-stat="' + lbl + '" min="0" max="100" value="50" />'
                    + '</div>'
                  );
                }).join('')
            + '</div>'
            + '<label class="form-label" style="margin-top:0.75rem">Source (optional)</label>'
            + '<input class="form-input" name="stats_source" placeholder="e.g. Polymaker TDS, my own testing" maxlength="160" />'
          + '</div>'

          // Note pane
          + '<div class="suggest-pane hidden" data-pane="note">'
            + '<label class="form-label">What should we change or add?</label>'
            + '<textarea class="form-textarea" name="note" maxlength="800" placeholder="Tell us in plain English — we\'ll review." required></textarea>'
          + '</div>'

          + '<div class="report-msg" aria-live="polite"></div>'
          + '<div class="report-actions">'
            + '<button type="button" class="btn btn-outline" data-close>Cancel</button>'
            + '<button type="submit" class="btn btn-primary">Send suggestion</button>'
          + '</div>'
        + '</form>'
      + '</div>';

    return wrap;
  }

  function showTab(modal, key) {
    modal.querySelectorAll('.suggest-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === key);
    });
    modal.querySelectorAll('.suggest-pane').forEach(function (p) {
      p.classList.toggle('hidden', p.getAttribute('data-pane') !== key);
    });
    var desc = modal.querySelector('#suggest-desc');
    var t = TABS.find(function (x) { return x.key === key; });
    if (desc && t) desc.textContent = t.desc;
    modal.dataset.tab = key;
  }

  async function submitContribution(slug, tab, form) {
    var payload = {};
    if (tab === 'vendor') {
      var vLabel = form.querySelector('[name="vendor_label"]').value.trim();
      var vUrl   = form.querySelector('[name="vendor_url"]').value.trim();
      if (!vUrl) throw new Error('Vendor URL is required.');
      payload = { label: vLabel, url: vUrl };
    } else if (tab === 'video') {
      var vidUrl = form.querySelector('[name="video_url"]').value.trim();
      if (!vidUrl) throw new Error('Video URL is required.');
      payload = {
        title: form.querySelector('[name="video_title"]').value.trim(),
        url: vidUrl,
        thumbnailUrl: ytThumb(vidUrl),
      };
    } else if (tab === 'stats') {
      var stats = [];
      ['Strength','Heat','Printability','Weather','Flex','Finish'].forEach(function (lbl) {
        var el = form.querySelector('[data-stat="' + lbl + '"]');
        var v = el ? parseInt(el.value, 10) : 50;
        stats.push({ label: lbl, value: isNaN(v) ? 50 : Math.max(0, Math.min(100, v)) });
      });
      payload = {
        stats: stats,
        statsSource: form.querySelector('[name="stats_source"]').value.trim(),
      };
    } else if (tab === 'note') {
      var note = form.querySelector('[name="note"]').value.trim();
      if (!note) throw new Error('Please tell us what you\'d like changed.');
      payload = { note: note };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON) {
      throw new Error('Suggestions are not configured yet.');
    }
    var res = await fetch(SUPABASE_URL + '/rest/v1/filament_contributions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: 'Bearer ' + SUPABASE_ANON,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        filament_slug: slug,
        type: tab,
        payload: payload,
        contributor_fingerprint: fingerprint,
      }),
    });
    if (!res.ok) {
      var body = await res.text();
      throw new Error(body || ('HTTP ' + res.status));
    }
  }

  function openSuggest(slug, tab) {
    var modal = buildModal(slug, tab);
    document.body.appendChild(modal);
    showTab(modal, modal.dataset.tab || 'vendor');
    requestAnimationFrame(function () { modal.classList.add('open'); });

    // Live-update stats outputs
    modal.querySelectorAll('[data-stat]').forEach(function (inp) {
      var lbl = inp.getAttribute('data-stat');
      var out = modal.querySelector('[data-out="' + lbl + '"]');
      inp.addEventListener('input', function () { if (out) out.textContent = inp.value; });
    });

    function close() {
      modal.classList.remove('open');
      setTimeout(function () { modal.remove(); }, 220);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    modal.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.closest && t.closest('[data-close]')) close();
    });

    modal.querySelectorAll('.suggest-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showTab(modal, btn.getAttribute('data-tab'));
      });
    });

    var form = modal.querySelector('.suggest-form');
    var msg  = modal.querySelector('.report-msg');
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      msg.textContent = '';
      msg.className = 'report-msg';
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      try {
        await submitContribution(slug, modal.dataset.tab, form);
        msg.textContent = 'Thanks — we\'ll review your suggestion.';
        msg.classList.add('ok');
        setTimeout(close, 1200);
      } catch (err) {
        msg.textContent = (err && err.message) || 'Failed to send suggestion.';
        msg.classList.add('error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send suggestion';
      }
    });
  }

  window.openSuggest = openSuggest;

  // Event delegation for [data-suggest] triggers anywhere on the page.
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-suggest]');
    if (btn) {
      ev.preventDefault();
      var slug = btn.getAttribute('data-suggest') || '';
      var tab  = btn.getAttribute('data-suggest-tab') || 'vendor';
      if (slug) openSuggest(slug, tab);
    }
  });
})();
