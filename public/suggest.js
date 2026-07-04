// Filibrary "Suggest an edit" modal — users can fill in any of the tabs
// (vendor, video, ratings, tags, note) and each filled tab is submitted as
// its own contribution row.
// Exposes window.openSuggest(slug, tab) for other scripts to call.
(function () {
  var T = window.__T || {};
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
    { key: 'vendor', label: T.tabVendor || 'Vendor',  desc: T.tabVendorDesc || 'A shop or brand that sells this filament.' },
    { key: 'video',  label: T.tabVideo || 'Video',   desc: T.tabVideoDesc || 'A YouTube review or guide for this material.' },
    { key: 'stats',  label: T.tabRatings || 'Ratings', desc: T.tabRatingsDesc || 'Rate each property 0–100.' },
    { key: 'tags',   label: T.tabTags || 'Tags',    desc: T.tabTagsDesc || 'Tags you think should be on this filament.' },
    { key: 'note',   label: T.tabNote || 'Note',    desc: T.tabNoteDesc || 'Anything else — we\'ll read and review.' },
  ];
  var STAT_LABELS = ['Strength','Heat','Printability','Weather','Flex','Finish'];
  var STAT_DISPLAY = T.statLabels || {};
  var ALL_TAGS = [
    'Abrasive','Aesthetic','Beginner Friendly','Challenging','Chemical Resistant','Composite',
    'Core Material','Durable','Eco / Bio-Based','Electronics','Engineering','ESD Safe','Exotic',
    'Fire Retardant','Flexible','High Heat','Hygroscopic','Lightweight','MMU/AMS Safe',
    'Outdoor','Print Enclosed','Specialty','Support',
  ];
  var TAG_DISPLAY = T.tags || {};

  function buildModal(slug, activeTab) {
    var active = activeTab && TABS.some(function (t) { return t.key === activeTab; }) ? activeTab : 'vendor';
    var wrap = document.createElement('div');
    wrap.className = 'suggest-modal-wrap';
    wrap.innerHTML =
      '<div class="suggest-modal-backdrop" data-close></div>'
      + '<div class="suggest-modal" role="dialog" aria-modal="true" aria-label="' + esc(T.suggestTitle || 'Suggest an edit') + '">'
        + '<div class="suggest-modal-head">'
          + '<div>'
            + '<h3>' + (T.suggestTitle || 'Suggest an edit') + '</h3>'
            + '<p class="suggest-sub">' + (T.suggestSubPre || 'Adding to ') + '<strong>' + esc(slug) + '</strong>' + (T.suggestSubPost || '. Fill in anything you like across the tabs — we\'ll review each.') + '</p>'
          + '</div>'
          + '<button type="button" class="report-close" data-close aria-label="Close">'
            + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          + '</button>'
        + '</div>'

        + '<p class="suggest-prompt">' + (T.suggestPrompt || 'What needs fixing?') + '</p>'
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
            + '<label class="form-label">' + (T.vendorLabel || 'Vendor or brand name') + '</label>'
            + '<input class="form-input" name="vendor_label" placeholder="' + esc(T.vendorPlaceholder || 'e.g. Polymaker') + '" maxlength="80" />'
            + '<label class="form-label" style="margin-top:0.75rem">' + (T.vendorUrlLabel || 'Product or store URL') + '</label>'
            + '<input type="url" class="form-input" name="vendor_url" placeholder="https://shop.polymaker.com/..." />'
          + '</div>'

          // Video pane
          + '<div class="suggest-pane hidden" data-pane="video">'
            + '<label class="form-label">' + (T.youtubeUrl || 'YouTube URL') + '</label>'
            + '<input type="url" class="form-input" name="video_url" placeholder="https://youtu.be/..." />'
            + '<label class="form-label" style="margin-top:0.75rem">' + (T.videoTitleLabel || 'Video title (optional)') + '</label>'
            + '<input class="form-input" name="video_title" placeholder="' + esc(T.videoPlaceholder || 'e.g. PLA vs PETG comparison') + '" maxlength="120" />'
          + '</div>'

          // Stats pane
          + '<div class="suggest-pane hidden" data-pane="stats">'
            + '<p class="suggest-hint">' + (T.slidersHint || 'Only included if you move at least one slider.') + '</p>'
            + '<div class="stats-grid">'
              + STAT_LABELS.map(function (lbl) {
                  var display = STAT_DISPLAY[lbl] || lbl;
                  return (
                    '<div class="stat-slider">'
                      + '<label for="s-' + lbl + '"><span>' + display + '</span><output data-out="' + lbl + '">50</output></label>'
                      + '<input type="range" id="s-' + lbl + '" data-stat="' + lbl + '" min="0" max="100" value="50" data-touched="0" />'
                    + '</div>'
                  );
                }).join('')
            + '</div>'
            + '<label class="form-label" style="margin-top:0.75rem">' + (T.sourceOptional || 'Source (optional)') + '</label>'
            + '<input class="form-input" name="stats_source" placeholder="' + esc(T.sourcePlaceholder || 'e.g. Polymaker TDS, my own testing') + '" maxlength="160" />'
          + '</div>'

          // Tags pane
          + '<div class="suggest-pane hidden" data-pane="tags">'
            + '<div class="suggest-tag-grid">'
              + ALL_TAGS.map(function (tag) {
                  var display = TAG_DISPLAY[tag] || tag;
                  return (
                    '<label class="checkbox-label">'
                      + '<input type="checkbox" name="tags" value="' + esc(tag) + '" />'
                      + esc(display)
                    + '</label>'
                  );
                }).join('')
            + '</div>'
          + '</div>'

          // Note pane
          + '<div class="suggest-pane hidden" data-pane="note">'
            + '<label class="form-label">' + (T.noteLabel || 'What should we change or add?') + '</label>'
            + '<textarea class="form-textarea" name="note" maxlength="800" placeholder="' + esc(T.notePlaceholder || 'Tell us in plain English — we\'ll review.') + '"></textarea>'
          + '</div>'

          + '<div class="report-msg" aria-live="polite"></div>'
          + '<div class="report-actions">'
            + '<button type="button" class="btn btn-outline" data-close>' + (T.cancel || 'Cancel') + '</button>'
            + '<button type="submit" class="btn btn-primary">' + (T.sendSuggestion || 'Send suggestion') + '</button>'
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

  // Returns { type, payload } for each tab that has meaningful data, in order.
  function collectContributions(form) {
    var out = [];
    var vLabel = form.querySelector('[name="vendor_label"]').value.trim();
    var vUrl   = form.querySelector('[name="vendor_url"]').value.trim();
    if (vUrl) out.push({ type: 'vendor', payload: { label: vLabel, url: vUrl } });

    var vidUrl = form.querySelector('[name="video_url"]').value.trim();
    if (vidUrl) {
      out.push({
        type: 'video',
        payload: {
          title: form.querySelector('[name="video_title"]').value.trim(),
          url: vidUrl,
          thumbnailUrl: ytThumb(vidUrl),
        },
      });
    }

    var sliderTouched = false;
    var stats = STAT_LABELS.map(function (lbl) {
      var el = form.querySelector('[data-stat="' + lbl + '"]');
      if (el && el.getAttribute('data-touched') === '1') sliderTouched = true;
      var v = el ? parseInt(el.value, 10) : 50;
      return { label: lbl, value: isNaN(v) ? 50 : Math.max(0, Math.min(100, v)) };
    });
    var statsSource = form.querySelector('[name="stats_source"]').value.trim();
    if (sliderTouched || statsSource) {
      out.push({ type: 'stats', payload: { stats: stats, statsSource: statsSource } });
    }

    var tags = Array.prototype.slice
      .call(form.querySelectorAll('input[name="tags"]:checked'))
      .map(function (cb) { return cb.value; });
    if (tags.length) out.push({ type: 'tags', payload: { tags: tags } });

    var note = form.querySelector('[name="note"]').value.trim();
    if (note) out.push({ type: 'note', payload: { note: note } });

    return out;
  }

  async function postContribution(slug, contribution) {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      throw new Error(T.suggestionsNotConfigured || 'Suggestions are not configured yet.');
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
        type: contribution.type,
        payload: contribution.payload,
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

    // Live-update stats outputs + mark sliders as touched when user moves them.
    modal.querySelectorAll('[data-stat]').forEach(function (inp) {
      var lbl = inp.getAttribute('data-stat');
      var out = modal.querySelector('[data-out="' + lbl + '"]');
      inp.addEventListener('input', function () {
        if (out) out.textContent = inp.value;
        inp.setAttribute('data-touched', '1');
      });
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

      var items = collectContributions(form);
      if (items.length === 0) {
        msg.textContent = T.fillOneTab || 'Fill in at least one tab before sending.';
        msg.classList.add('error');
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = T.sending || 'Sending…';
      try {
        for (var i = 0; i < items.length; i++) {
          await postContribution(slug, items[i]);
        }
        if (T.thanksSuggestion) {
          msg.textContent = T.thanksSuggestion;
        } else {
          var word = items.length === 1 ? 'suggestion' : 'suggestions';
          msg.textContent = 'Thanks — we\'ll review your ' + items.length + ' ' + word + '.';
        }
        msg.classList.add('ok');
        setTimeout(close, 1400);
      } catch (err) {
        msg.textContent = (err && err.message) || (T.failedSuggestion || 'Failed to send suggestion.');
        msg.classList.add('error');
        submitBtn.disabled = false;
        submitBtn.textContent = T.sendSuggestion || 'Send suggestion';
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
