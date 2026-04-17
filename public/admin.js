// Filibrary admin — thin client that talks to the admin-api edge function.
(function () {
  var SUPABASE_URL = window.__SUPABASE_URL__ || '';
  var API_URL = SUPABASE_URL ? SUPABASE_URL + '/functions/v1/admin-api' : '';
  var ANON = window.__SUPABASE_ANON__ || '';
  var PW_KEY = 'filibrary_admin_pw';

  var TAG_OPTIONS = [
    'Abrasive','Aesthetic','Beginner Friendly','Challenging','Chemical Resistant','Composite',
    'Core Material','Durable','Eco / Bio-Based','Electronics','Engineering','Exotic','Flexible',
    'High Heat','Hygroscopic','Lightweight','Outdoor','Print Enclosed',
    'Specialty','Support',
  ];
  var STAT_LABELS = ['Strength','Heat','Printability','Weather','Flex','Finish'];

  var gate      = document.getElementById('admin-gate');
  var dash      = document.getElementById('admin-dash');
  var loginF    = document.getElementById('login-form');
  var pwIn      = document.getElementById('admin-password');
  var errEl     = document.getElementById('admin-error');
  var subList   = document.getElementById('submissions-list');
  var repList   = document.getElementById('reports-list');
  var conList   = document.getElementById('contributions-list');
  var subEmpty  = document.getElementById('submissions-empty');
  var repEmpty  = document.getElementById('reports-empty');
  var conEmpty  = document.getElementById('contributions-empty');
  var cntSub    = document.getElementById('count-submissions');
  var cntRep    = document.getElementById('count-reports');
  var cntCon    = document.getElementById('count-contributions');
  var toast     = document.getElementById('admin-toast');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ts(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch (_) { return iso; }
  }
  function showToast(msg, kind) {
    toast.textContent = msg;
    toast.className = 'admin-toast show ' + (kind || '');
    setTimeout(function () { toast.className = 'admin-toast'; }, 3000);
  }

  async function api(action, body) {
    if (!API_URL) throw new Error('Supabase is not configured.');
    var pw = localStorage.getItem(PW_KEY) || '';
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: ANON,
        Authorization: 'Bearer ' + ANON,
      },
      body: JSON.stringify(Object.assign({ action: action, password: pw }, body || {})),
    });
    var text = await res.text();
    var j; try { j = text ? JSON.parse(text) : {}; } catch (_) { j = { error: text }; }
    if (!res.ok) {
      if (res.status === 401) { localStorage.removeItem(PW_KEY); showGate(); }
      throw new Error(j.error || ('HTTP ' + res.status));
    }
    return j;
  }

  // ── Auth flow ──
  function showGate() {
    gate.classList.remove('hidden');
    dash.classList.add('hidden');
  }
  function showDash() {
    gate.classList.add('hidden');
    dash.classList.remove('hidden');
    refresh();
  }

  loginF.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    errEl.textContent = '';
    var pw = pwIn.value.trim();
    if (!pw) return;
    localStorage.setItem(PW_KEY, pw);
    try {
      await api('list_pending');
      showDash();
    } catch (err) {
      errEl.textContent = err.message || 'Sign-in failed.';
    }
  });
  document.getElementById('signout-btn').addEventListener('click', function () {
    localStorage.removeItem(PW_KEY);
    pwIn.value = '';
    showGate();
  });
  document.getElementById('refresh-btn').addEventListener('click', refresh);

  // ── Tabs ──
  document.querySelectorAll('.admin-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var key = btn.getAttribute('data-tab');
      document.getElementById('tab-submissions').classList.toggle('hidden', key !== 'submissions');
      document.getElementById('tab-contributions').classList.toggle('hidden', key !== 'contributions');
      document.getElementById('tab-reports').classList.toggle('hidden', key !== 'reports');
    });
  });

  // ── Renderers ──
  function slugify(s) {
    return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function ytThumb(url) {
    var m = /(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/.exec(String(url || ''));
    return m ? 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' : '';
  }

  function renderSubmissionCard(s) {
    var id = s.id;
    var defaultSlug = slugify(s.short_name || '');
    var submittedTags = Array.isArray(s.tags) ? s.tags : [];
    var stats = Array.isArray(s.stats) ? s.stats : [];
    var statsBy = {};
    stats.forEach(function (p) { if (p && p.label) statsBy[p.label] = p.value; });

    var statsHtml = STAT_LABELS.map(function (lbl) {
      var v = typeof statsBy[lbl] === 'number' ? statsBy[lbl] : 50;
      return (
        '<div class="admin-stat">'
          + '<label><span>' + lbl + '</span><output data-stat-out="' + lbl + '">' + v + '</output></label>'
          + '<input type="range" min="0" max="100" value="' + v + '" data-stat="' + lbl + '" />'
        + '</div>'
      );
    }).join('');

    var tagsHtml = TAG_OPTIONS.map(function (t) {
      var checked = submittedTags.indexOf(t) >= 0 ? ' checked' : '';
      return (
        '<label class="checkbox-label">'
          + '<input type="checkbox" value="' + esc(t) + '"' + checked + ' />'
          + esc(t)
        + '</label>'
      );
    }).join('');

    var videoUrl = '';
    var videoTitle = '';
    if (Array.isArray(s.source_links) && s.source_links[0]) {
      videoUrl = s.source_links[0].url || '';
      videoTitle = s.source_links[0].title || '';
    }

    var el = document.createElement('div');
    el.className = 'admin-item';
    el.dataset.id = id;
    el.innerHTML =
      '<div class="admin-item-head">'
        + '<span class="admin-item-short">' + esc(s.short_name || '') + '</span>'
        + '<span class="admin-item-full">' + esc(s.full_name || '') + '</span>'
        + '<span class="admin-item-meta">Submitted ' + esc(ts(s.created_at)) + '</span>'
      + '</div>'

      + '<div class="admin-row-2">'
        + '<div class="admin-field"><label>Slug (URL)</label>'
          + '<input class="form-input" data-f="slug" value="' + esc(defaultSlug) + '" />'
        + '</div>'
        + '<div class="admin-field"><label>Short name</label>'
          + '<input class="form-input" data-f="shortName" value="' + esc(s.short_name || '') + '" />'
        + '</div>'
      + '</div>'

      + '<div class="admin-field"><label>Full name</label>'
        + '<input class="form-input" data-f="fullName" value="' + esc(s.full_name || '') + '" />'
      + '</div>'

      + '<div class="admin-field"><label>Summary</label>'
        + '<textarea class="form-textarea" data-f="summary">' + esc(s.summary || '') + '</textarea>'
      + '</div>'

      + '<div class="admin-field"><label>Tags</label>'
        + '<div class="admin-tag-grid" data-tags>' + tagsHtml + '</div>'
      + '</div>'

      + '<div class="admin-row-2">'
        + '<div class="admin-field"><label>Purchase link label</label>'
          + '<input class="form-input" data-f="purchaseLabel" placeholder="e.g. Polymaker" />'
        + '</div>'
        + '<div class="admin-field"><label>Purchase URL</label>'
          + '<input class="form-input" data-f="purchaseUrl" value="' + esc(s.purchase_link || '') + '" />'
        + '</div>'
      + '</div>'

      + '<div class="admin-row-2">'
        + '<div class="admin-field"><label>Video URL</label>'
          + '<input class="form-input" data-f="videoUrl" value="' + esc(videoUrl) + '" />'
        + '</div>'
        + '<div class="admin-field"><label>Video title</label>'
          + '<input class="form-input" data-f="videoTitle" value="' + esc(videoTitle) + '" />'
        + '</div>'
      + '</div>'

      + '<div class="admin-field"><label>Performance ratings</label>'
        + '<div class="admin-stats-grid">' + statsHtml + '</div>'
      + '</div>'

      + '<div class="admin-field"><label>Stats source</label>'
        + '<input class="form-input" data-f="statsSource" value="' + esc(s.stats_source || '') + '" placeholder="e.g. Polymaker TDS, community testing" />'
      + '</div>'

      + '<div class="admin-actions">'
        + '<button type="button" class="btn btn-ghost" data-action="reject">Reject</button>'
        + '<button type="button" class="btn btn-primary" data-action="approve">Approve & publish</button>'
      + '</div>';

    // Wire up sliders → output labels
    el.querySelectorAll('[data-stat]').forEach(function (inp) {
      var lbl = inp.getAttribute('data-stat');
      var out = el.querySelector('[data-stat-out="' + lbl + '"]');
      inp.addEventListener('input', function () { if (out) out.textContent = inp.value; });
    });

    el.querySelector('[data-action="approve"]').addEventListener('click', function () {
      approveItem(el);
    });
    el.querySelector('[data-action="reject"]').addEventListener('click', function () {
      rejectItem(el);
    });

    return el;
  }

  function readSubmissionForm(el) {
    function get(f) {
      var e = el.querySelector('[data-f="' + f + '"]');
      return e ? String(e.value || '').trim() : '';
    }
    var tags = [];
    el.querySelectorAll('[data-tags] input[type="checkbox"]:checked').forEach(function (c) {
      tags.push(c.value);
    });
    var stats = STAT_LABELS.map(function (lbl) {
      var inp = el.querySelector('[data-stat="' + lbl + '"]');
      var v = inp ? parseInt(inp.value, 10) : 50;
      if (isNaN(v)) v = 50;
      return { label: lbl, value: Math.max(0, Math.min(100, v)) };
    });
    var purchaseLinks = [];
    var pLabel = get('purchaseLabel');
    var pUrl = get('purchaseUrl');
    if (pUrl) purchaseLinks.push({ label: pLabel || pUrl, url: pUrl });

    var videoReferences = [];
    var vUrl = get('videoUrl');
    if (vUrl) {
      videoReferences.push({
        title: get('videoTitle') || vUrl,
        url: vUrl,
        thumbnailUrl: ytThumb(vUrl),
      });
    }

    return {
      slug: get('slug'),
      shortName: get('shortName'),
      fullName: get('fullName'),
      summary: get('summary'),
      tags: tags,
      purchaseLinks: purchaseLinks,
      videoReferences: videoReferences,
      stats: stats,
      statsSource: get('statsSource'),
    };
  }

  async function approveItem(el) {
    var id = el.dataset.id;
    var payload = readSubmissionForm(el);
    if (!payload.slug) { showToast('Slug is required.', 'error'); return; }
    if (!payload.shortName || !payload.fullName || !payload.summary) {
      showToast('Short name, full name and summary are required.', 'error');
      return;
    }
    var btn = el.querySelector('[data-action="approve"]');
    btn.disabled = true; btn.textContent = 'Publishing…';
    try {
      await api('approve_submission', Object.assign({ submission_id: id }, payload));
      showToast('Approved. Deploy will rebuild the site in ~90s.', 'ok');
      el.remove();
      updateCounts();
    } catch (err) {
      showToast(err.message || 'Approval failed', 'error');
      btn.disabled = false; btn.textContent = 'Approve & publish';
    }
  }
  async function rejectItem(el) {
    var id = el.dataset.id;
    var reason = prompt('Reason for rejection (optional):') || '';
    var btn = el.querySelector('[data-action="reject"]');
    btn.disabled = true; btn.textContent = 'Rejecting…';
    try {
      await api('reject_submission', { submission_id: id, reviewed_notes: reason });
      showToast('Rejected.', 'ok');
      el.remove();
      updateCounts();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
      btn.disabled = false; btn.textContent = 'Reject';
    }
  }

  var REASON_LABELS = {
    inaccurate_info: 'Inaccurate info',
    broken_link: 'Broken link',
    wrong_tag: 'Wrong tag',
    outdated: 'Outdated',
    other: 'Other',
  };

  function renderReportCard(r) {
    var el = document.createElement('div');
    el.className = 'admin-item';
    el.dataset.id = r.id;
    el.innerHTML =
      '<div class="admin-item-head">'
        + '<span class="admin-item-short">' + esc(r.filament_slug || '') + '</span>'
        + '<span class="report-reason">' + esc(REASON_LABELS[r.reason] || r.reason) + '</span>'
        + '<span class="admin-item-meta">Reported ' + esc(ts(r.created_at)) + '</span>'
      + '</div>'
      + (r.comment ? '<div class="report-comment">' + esc(r.comment) + '</div>' : '')
      + '<div class="admin-actions">'
        + '<a class="btn btn-outline" href="/filaments/' + encodeURIComponent(r.filament_slug) + '" target="_blank" rel="noopener">Open filament ↗</a>'
        + '<button type="button" class="btn btn-ghost" data-action="dismiss">Dismiss</button>'
        + '<button type="button" class="btn btn-primary" data-action="resolve">Mark resolved</button>'
      + '</div>';

    el.querySelector('[data-action="dismiss"]').addEventListener('click', function () {
      updateReport(el, 'dismiss_report');
    });
    el.querySelector('[data-action="resolve"]').addEventListener('click', function () {
      updateReport(el, 'resolve_report');
    });
    return el;
  }

  async function updateReport(el, action) {
    var id = el.dataset.id;
    var note = action === 'resolve_report'
      ? (prompt('Resolution note (optional):') || '')
      : (prompt('Why dismiss? (optional):') || '');
    var verb = action === 'resolve_report' ? 'Resolving…' : 'Dismissing…';
    var btn = el.querySelector('.btn-primary, .btn-ghost');
    try {
      await api(action, { report_id: id, resolved_notes: note });
      showToast(verb.replace('…', 'd.'), 'ok');
      el.remove();
      updateCounts();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    }
  }

  // ── Contributions ──
  var CONTRIB_TYPE_LABELS = {
    vendor: 'New vendor',
    video:  'New video',
    stats:  'Performance ratings',
    note:   'Note',
  };

  function renderContributionCard(c) {
    var el = document.createElement('div');
    el.className = 'admin-item';
    el.dataset.id = c.id;
    var payload = c.payload || {};
    var detailHtml = '';

    if (c.type === 'vendor') {
      detailHtml =
        '<div class="admin-field"><label>Label</label>'
          + '<input class="form-input" data-f="label" value="' + esc(payload.label || '') + '" />'
        + '</div>'
        + '<div class="admin-field"><label>URL</label>'
          + '<input class="form-input" data-f="url" value="' + esc(payload.url || '') + '" />'
        + '</div>';
    } else if (c.type === 'video') {
      detailHtml =
        '<div class="admin-row-2">'
          + '<div class="admin-field"><label>Title</label>'
            + '<input class="form-input" data-f="title" value="' + esc(payload.title || '') + '" />'
          + '</div>'
          + '<div class="admin-field"><label>URL</label>'
            + '<input class="form-input" data-f="url" value="' + esc(payload.url || '') + '" />'
          + '</div>'
        + '</div>'
        + '<div class="admin-field"><label>Thumbnail</label>'
          + '<input class="form-input" data-f="thumbnailUrl" value="' + esc(payload.thumbnailUrl || '') + '" />'
        + '</div>';
    } else if (c.type === 'stats') {
      var stats = Array.isArray(payload.stats) ? payload.stats : [];
      var byLabel = {};
      stats.forEach(function (p) { if (p && p.label) byLabel[p.label] = p.value; });
      var sliders = STAT_LABELS.map(function (lbl) {
        var v = typeof byLabel[lbl] === 'number' ? byLabel[lbl] : 50;
        return (
          '<div class="admin-stat">'
            + '<label><span>' + lbl + '</span><output data-stat-out="' + lbl + '">' + v + '</output></label>'
            + '<input type="range" min="0" max="100" value="' + v + '" data-stat="' + lbl + '" />'
          + '</div>'
        );
      }).join('');
      detailHtml =
        '<div class="admin-field"><label>Performance ratings</label>'
          + '<div class="admin-stats-grid">' + sliders + '</div>'
        + '</div>'
        + '<div class="admin-field"><label>Source</label>'
          + '<input class="form-input" data-f="statsSource" value="' + esc(payload.statsSource || '') + '" />'
        + '</div>';
    } else if (c.type === 'note') {
      detailHtml = '<div class="report-comment">' + esc(payload.note || '') + '</div>';
    }

    var applyBtn = c.type === 'note'
      ? '<button type="button" class="btn btn-primary" data-action="dismiss">Dismiss</button>'
      : '<button type="button" class="btn btn-primary" data-action="apply">Apply to filament</button>';

    el.innerHTML =
      '<div class="admin-item-head">'
        + '<span class="admin-item-short">' + esc(c.filament_slug || '') + '</span>'
        + '<span class="report-reason">' + esc(CONTRIB_TYPE_LABELS[c.type] || c.type) + '</span>'
        + '<span class="admin-item-meta">Submitted ' + esc(ts(c.created_at)) + '</span>'
      + '</div>'
      + detailHtml
      + '<div class="admin-actions">'
        + '<a class="btn btn-outline" href="/filaments/' + encodeURIComponent(c.filament_slug) + '" target="_blank" rel="noopener">Open filament ↗</a>'
        + (c.type !== 'note' ? '<button type="button" class="btn btn-ghost" data-action="dismiss">Dismiss</button>' : '')
        + applyBtn
      + '</div>';

    el.querySelectorAll('[data-stat]').forEach(function (inp) {
      var lbl = inp.getAttribute('data-stat');
      var out = el.querySelector('[data-stat-out="' + lbl + '"]');
      inp.addEventListener('input', function () { if (out) out.textContent = inp.value; });
    });

    var applyBtnEl = el.querySelector('[data-action="apply"]');
    if (applyBtnEl) applyBtnEl.addEventListener('click', function () { applyContribution(el, c); });
    var dismissBtnEl = el.querySelector('[data-action="dismiss"]');
    if (dismissBtnEl) dismissBtnEl.addEventListener('click', function () { dismissContribution(el); });

    return el;
  }

  function readContributionPayload(el, c) {
    function get(f) {
      var e = el.querySelector('[data-f="' + f + '"]');
      return e ? String(e.value || '').trim() : '';
    }
    if (c.type === 'vendor') {
      var url = get('url');
      if (!url) throw new Error('URL is required.');
      return { label: get('label') || url, url: url };
    }
    if (c.type === 'video') {
      var vurl = get('url');
      if (!vurl) throw new Error('URL is required.');
      return { title: get('title') || vurl, url: vurl, thumbnailUrl: get('thumbnailUrl') };
    }
    if (c.type === 'stats') {
      var stats = STAT_LABELS.map(function (lbl) {
        var inp = el.querySelector('[data-stat="' + lbl + '"]');
        var v = inp ? parseInt(inp.value, 10) : 50;
        return { label: lbl, value: isNaN(v) ? 50 : Math.max(0, Math.min(100, v)) };
      });
      return { stats: stats, statsSource: get('statsSource') };
    }
    return {};
  }

  async function applyContribution(el, c) {
    var btn = el.querySelector('[data-action="apply"]');
    var payload;
    try { payload = readContributionPayload(el, c); }
    catch (err) { showToast(err.message, 'error'); return; }
    btn.disabled = true; btn.textContent = 'Applying…';
    try {
      await api('apply_contribution', {
        contribution_id: c.id,
        filament_slug: c.filament_slug,
        type: c.type,
        payload: payload,
      });
      showToast('Applied. Deploy will rebuild in ~90s.', 'ok');
      el.remove();
      updateCounts();
    } catch (err) {
      showToast(err.message || 'Failed to apply', 'error');
      btn.disabled = false; btn.textContent = 'Apply to filament';
    }
  }

  async function dismissContribution(el) {
    var id = el.dataset.id;
    var note = prompt('Reason for dismissing (optional):') || '';
    try {
      await api('dismiss_contribution', { contribution_id: id, applied_notes: note });
      showToast('Dismissed.', 'ok');
      el.remove();
      updateCounts();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    }
  }

  function updateCounts() {
    var n1 = subList.children.length;
    var n2 = repList.children.length;
    var n3 = conList.children.length;
    cntSub.textContent = n1;
    cntRep.textContent = n2;
    cntCon.textContent = n3;
    subEmpty.classList.toggle('hidden', n1 > 0);
    repEmpty.classList.toggle('hidden', n2 > 0);
    conEmpty.classList.toggle('hidden', n3 > 0);
  }

  async function refresh() {
    subList.innerHTML = '';
    repList.innerHTML = '';
    conList.innerHTML = '';
    try {
      var subs = await api('list_pending');
      (subs.rows || []).forEach(function (s) { subList.appendChild(renderSubmissionCard(s)); });
    } catch (err) {
      showToast(err.message || 'Failed to load submissions', 'error');
    }
    try {
      var cons = await api('list_contributions');
      (cons.rows || []).forEach(function (c) { conList.appendChild(renderContributionCard(c)); });
    } catch (err) {
      showToast(err.message || 'Failed to load contributions', 'error');
    }
    try {
      var reps = await api('list_reports');
      (reps.rows || []).forEach(function (r) { repList.appendChild(renderReportCard(r)); });
    } catch (err) {
      showToast(err.message || 'Failed to load reports', 'error');
    }
    updateCounts();
  }

  // Boot
  if (localStorage.getItem(PW_KEY)) {
    showDash();
  } else {
    showGate();
  }
})();
