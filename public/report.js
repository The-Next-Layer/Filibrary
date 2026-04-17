// Filibrary report flow — opens a small modal and posts to Supabase.
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

  function buildModal(slug) {
    var wrap = document.createElement('div');
    wrap.className = 'report-modal-wrap';
    wrap.innerHTML =
      '<div class="report-modal-backdrop" data-close></div>'
      + '<div class="report-modal" role="dialog" aria-modal="true" aria-label="Report an issue">'
        + '<div class="report-modal-head">'
          + '<h3>Report an issue</h3>'
          + '<button type="button" class="report-close" data-close aria-label="Close">'
            + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          + '</button>'
        + '</div>'
        + '<p class="report-sub">Reporting <strong>' + esc(slug) + '</strong>. We\'ll review and update the entry if needed.</p>'
        + '<form class="report-form">'
          + '<label class="form-label">What\'s wrong?</label>'
          + '<select name="reason" class="form-select" required>'
            + '<option value="inaccurate_info">Inaccurate information</option>'
            + '<option value="broken_link">Broken purchase link</option>'
            + '<option value="wrong_tag">Wrong tag / classification</option>'
            + '<option value="outdated">Outdated — product changed</option>'
            + '<option value="other">Other</option>'
          + '</select>'
          + '<label class="form-label" style="margin-top:0.8rem">Details (optional)</label>'
          + '<textarea name="comment" class="form-textarea" maxlength="800" placeholder="Tell us what should be changed, or paste a source..."></textarea>'
          + '<div class="report-msg" aria-live="polite"></div>'
          + '<div class="report-actions">'
            + '<button type="button" class="btn btn-outline" data-close>Cancel</button>'
            + '<button type="submit" class="btn btn-primary">Send report</button>'
          + '</div>'
        + '</form>'
      + '</div>';
    return wrap;
  }

  function openReport(slug) {
    var modal = buildModal(slug);
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('open'); });

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

    var form = modal.querySelector('.report-form');
    var msg  = modal.querySelector('.report-msg');
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      msg.textContent = '';
      msg.className = 'report-msg';
      if (!SUPABASE_URL || !SUPABASE_ANON) {
        msg.textContent = 'Reporting is not configured yet.';
        msg.classList.add('error');
        return;
      }
      var reason = form.querySelector('[name="reason"]').value;
      var comment = form.querySelector('[name="comment"]').value.trim();
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      try {
        var res = await fetch(SUPABASE_URL + '/rest/v1/filament_reports', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: SUPABASE_ANON,
            Authorization: 'Bearer ' + SUPABASE_ANON,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            filament_slug: slug,
            reason: reason,
            comment: comment || null,
            reporter_fingerprint: fingerprint,
          }),
        });
        if (!res.ok) {
          var body = await res.text();
          throw new Error(body || ('HTTP ' + res.status));
        }
        msg.textContent = 'Thanks — report received.';
        msg.classList.add('ok');
        setTimeout(close, 1200);
      } catch (err) {
        msg.textContent = (err && err.message) || 'Failed to send report.';
        msg.classList.add('error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send report';
      }
    });
  }

  // Event delegation so the button inside the dynamic panel works.
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t) return;
    var btn = t.closest ? t.closest('.report-btn') : null;
    if (btn) {
      ev.preventDefault();
      var slug = btn.getAttribute('data-slug') || '';
      if (slug) openReport(slug);
    }
  });
})();
