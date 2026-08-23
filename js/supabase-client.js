/* Shakambhari Group — Supabase form submission client.
   Requires the Supabase JS CDN script (@supabase/supabase-js@2) to be loaded
   before this file. Safe to include on any page: forms this file doesn't
   find on the current page are silently skipped. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://lrxumjimkdduwhtmzzxm.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kWeEmSs2WYQYDNj7k4FJjw_fANF5V-s';
  var SUCCESS_MESSAGE = 'Thank you! We have received your request.';
  var ERROR_MESSAGE = "Something went wrong. Please try again, or email info@shakambharigroup.in.";

  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.error('[supabase-client] Supabase JS library not found — check that the CDN <script> tag loads before /js/supabase-client.js.');
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  injectSpinnerStyles();

  // ---- Option 1: Newsletter (newsletter_subscribers) ----
  function newsletterPayload(fd) {
    return { email: String(fd.get('email') || '').trim() };
  }
  wireForm('newsletterForm', 'newsletter_subscribers', newsletterPayload, 'Subscribing…');
  wireForm('reachNewsletter', 'newsletter_subscribers', newsletterPayload, 'Subscribing…');

  // ---- Option 2: Callback request (callback_requests) ----
  wireForm('reachCallback', 'callback_requests', function (fd) {
    return {
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim()
    };
  }, 'Requesting…');

  // ---- Option 3: Detailed enquiry (detailed_enquiries) ----
  wireForm('reachEnquiry', 'detailed_enquiries', function (fd) {
    return {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      specification: String(fd.get('message') || '').trim()
    };
  }, 'Sending…');

  // Product-page enquiry forms (aluminium foil / ferro alloys) carry extra
  // "company" and "product" fields with no dedicated column in
  // detailed_enquiries, so they're folded into the specification text
  // rather than dropped.
  function productEnquiryPayload(fd) {
    var parts = [];
    var product = fd.get('product');
    var company = fd.get('company');
    if (product) parts.push('Product interest: ' + product);
    if (company) parts.push('Company: ' + company);
    var message = String(fd.get('message') || '').trim();
    if (message) parts.push(message);
    return {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      specification: parts.join('\n')
    };
  }
  wireForm('aluContactForm', 'detailed_enquiries', productEnquiryPayload, 'Sending…');
  wireForm('ferroContactForm', 'detailed_enquiries', productEnquiryPayload, 'Sending…');

  // ---------------------------------------------------------------------

  function wireForm(formId, table, buildPayload, loadingLabel) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var token = getTurnstileToken(form);
      if (!token) {
        showResult(form, false, 'Please complete the verification challenge before submitting.');
        return;
      }

      var payload = buildPayload(new FormData(form));
      setLoading(form, true, loadingLabel);
      clearResult(form);

      // Inserts go through the submit-form Edge Function, which verifies the
      // Turnstile token server-side before writing to the table — a client-side
      // check alone can't stop a script that calls the Supabase API directly.
      sb.functions.invoke('submit-form', { body: { table: table, payload: payload, token: token } })
        .then(function (res) {
          if (res.error) throw res.error;
          if (res.data && res.data.error) throw new Error(res.data.error);
          showResult(form, true, SUCCESS_MESSAGE);
          form.reset();
        })
        .catch(function (err) {
          console.error('[supabase-client] submit to "' + table + '" failed:', err);
          showResult(form, false, ERROR_MESSAGE);
        })
        .finally(function () {
          setLoading(form, false);
          resetTurnstile(form);
        });
    });
  }

  // Turnstile auto-renders a hidden input named "cf-turnstile-response" inside
  // the .cf-turnstile container once solved.
  function getTurnstileToken(form) {
    var input = form.querySelector('input[name="cf-turnstile-response"]');
    return input && input.value ? input.value : null;
  }

  function resetTurnstile(form) {
    var widget = form.querySelector('.cf-turnstile');
    if (widget && window.turnstile) window.turnstile.reset(widget);
  }

  // Two inline-status UX patterns exist across the site:
  //   A) a single <p class="*-status" hidden> toggled via class + hidden
  //   B) separate .cnl-success / .cnl-error elements toggled via a "show" class
  function findStatusTargets(form) {
    return {
      statusEl: form.querySelector('.reach-status, .newsletter-status, .alu-form-status, .ferro-form-status'),
      successEl: form.querySelector('.cnl-success'),
      errorEl: form.querySelector('.cnl-error')
    };
  }

  function showResult(form, ok, message) {
    var t = findStatusTargets(form);
    if (t.statusEl) {
      // Two CSS conventions exist for the *-status paragraph: some rely on
      // the `hidden` attribute (.reach-status, .newsletter-status), others
      // on display:none + a "show" class (.alu-form-status, .ferro-form-status).
      // Covering both is harmless — the unused one is simply not matched by CSS.
      t.statusEl.hidden = false;
      t.statusEl.classList.add('show');
      t.statusEl.textContent = message;
      t.statusEl.classList.remove('success', 'error');
      t.statusEl.classList.add(ok ? 'success' : 'error');
    }
    if (t.successEl) t.successEl.classList.toggle('show', ok);
    if (t.errorEl) {
      t.errorEl.textContent = ok ? '' : message;
      t.errorEl.classList.toggle('show', !ok);
    }
  }

  function clearResult(form) {
    var t = findStatusTargets(form);
    if (t.statusEl) t.statusEl.classList.remove('success', 'error');
    if (t.errorEl) t.errorEl.classList.remove('show');
    if (t.successEl) t.successEl.classList.remove('show');
  }

  function setLoading(form, isLoading, loadingLabel) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="sb-spinner" aria-hidden="true"></span> ' + (loadingLabel || 'Sending…');
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalLabel || btn.innerHTML;
    }
  }

  function injectSpinnerStyles() {
    if (document.getElementById('sb-spinner-styles')) return;
    var style = document.createElement('style');
    style.id = 'sb-spinner-styles';
    style.textContent =
      '.sb-spinner{display:inline-block;width:.9em;height:.9em;border:2px solid currentColor;' +
      'border-right-color:transparent;border-radius:50%;vertical-align:-.15em;margin-right:.4em;' +
      'animation:sb-spin .6s linear infinite;}' +
      '@keyframes sb-spin{to{transform:rotate(360deg);}}';
    document.head.appendChild(style);
  }
})();
