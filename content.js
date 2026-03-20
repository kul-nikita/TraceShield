(function () {
  'use strict';

  if (window.__traceShieldInjected) return;
  window.__traceShieldInjected = true;

  const reportedDataTypes = new Set();
  const reportedTrackers  = new Set();
  const reportedPerms     = new Set();

  function send(type, payload) {
    try { chrome.runtime.sendMessage({ type, ...payload }); } catch (_) {}
  }

  // pii
  const FIELD_PATTERNS = [
    { key: 'email',       test: (el, lbl) => el.type === 'email'    || /email/i.test(el.name + el.id + lbl) },
    { key: 'phone',       test: (el, lbl) => el.type === 'tel'      || /phone|tel|mobile/i.test(el.name + el.id + lbl) },
    { key: 'password',    test: (el)      => el.type === 'password' },
    { key: 'creditCard',  test: (el, lbl) => /card|cc-num|cc.?number|pan|cardnumber/i.test(el.name + el.id + el.autocomplete + lbl) },
    { key: 'ssn',         test: (el, lbl) => /ssn|social.?security/i.test(el.name + el.id + lbl) },
    { key: 'dateOfBirth', test: (el, lbl) => /dob|birth.?date|birthday|date.?of.?birth/i.test(el.name + el.id + lbl) },
    { key: 'address',     test: (el, lbl) => /address|street|city|zip|postal|postcode/i.test(el.name + el.id + el.autocomplete + lbl) },
    { key: 'name',        test: (el, lbl) => /firstname|lastname|fullname|given.?name|family.?name/i.test(el.name + el.id + el.autocomplete + lbl) },
  ];

  function getLabelText(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent;
    }
    const lbl = el.closest('label');
    return lbl ? lbl.textContent : '';
  }

  function detectFieldType(el) {
    const lbl = getLabelText(el);
    for (const { key, test } of FIELD_PATTERNS) {
      if (test(el, lbl) && !reportedDataTypes.has(key)) {
        reportedDataTypes.add(key);
        send('DATA_DETECTED', { dataType: key });
      }
    }
  }

  function attachFocusListener(el) {
    if (el.__tsListening) return;
    el.__tsListening = true;
    el.addEventListener('focus', () => detectFieldType(el), { once: true });
  }

  function scanInputs(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('input, select, textarea').forEach(attachFocusListener);
  }

  // trackers
  const TRACKER_PATTERNS = [
    { name: 'google-analytics',   re: /google-analytics\.com|googletagmanager\.com|gtag\/js|gtm\.js|ga\.js|googletag|\/gtag\// },
    { name: 'doubleclick',        re: /doubleclick\.net|googleadservices\.com|googlesyndication\.com|adservice\.google\.|pagead2\.googlesyndication/ },
    { name: 'facebook-pixel',     re: /connect\.facebook\.net|fbevents\.js|facebook\.com\/tr/ },
    { name: 'hotjar',             re: /hotjar\.com|hjid|hj\.js/ },
    { name: 'mixpanel',           re: /mixpanel\.com/ },
    { name: 'segment',            re: /segment\.com|segment\.io/ },
    { name: 'amplitude',          re: /amplitude\.com|amplitude\.js/ },
    { name: 'heap-analytics',     re: /heap-analytics\.com|heapanalytics\.com/ },
    { name: 'intercom',           re: /intercom\.io|intercomcdn\.com/ },
    { name: 'hubspot',            re: /hubspot\.com|hs-scripts\.com|hsforms\.com/ },
    { name: 'linkedin-insight',   re: /snap\.licdn\.com|linkedin\.com\/px|licdn\.com/ },
    { name: 'twitter-pixel',      re: /static\.ads-twitter\.com|t\.co\/i\/adsct|ads-twitter\.com/ },
    { name: 'amazon-ads',         re: /amazon-adsystem\.com/ },
    { name: 'criteo',             re: /criteo\.com|criteo\.net/ },
    { name: 'optimizely',         re: /optimizely\.com/ },
    { name: 'clarity',            re: /clarity\.ms/ },
    { name: 'tiktok-pixel',       re: /analytics\.tiktok\.com/ },
    { name: 'pinterest-tag',      re: /pintrk|pinterest\.com\/ct/ },
    { name: 'new-relic',          re: /newrelic\.com|nr-data\.net/ },
    { name: 'sentry',             re: /sentry\.io|browser\.sentry-cdn\.com/ },
    { name: 'datadog',            re: /datadoghq\.com|datadoghq-browser-agent/ },
    { name: 'quantcast',          re: /quantserve\.com|quantcount\.com/ },
    { name: 'scorecard-research', re: /scorecardresearch\.com/ },
    { name: 'comscore',           re: /comscore\.com|sb\.scorecardresearch/ },
  ];

  function checkScriptForTrackers(content) {
    if (!content) return;
    for (const { name, re } of TRACKER_PATTERNS) {
      if (!reportedTrackers.has(name) && re.test(content)) {
        reportedTrackers.add(name);
        send('TRACKERS_DETECTED', { trackerName: name });
      }
    }
  }

  function scanScripts(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('script').forEach(s => {
      if (s.src)         checkScriptForTrackers(s.src);
      if (s.textContent) checkScriptForTrackers(s.textContent);
    });
  }

  function scanPageSignals() {
    const snippet = document.documentElement.innerHTML.slice(0, 50000);
    checkScriptForTrackers(snippet);
    document.querySelectorAll('iframe[src]').forEach(el => checkScriptForTrackers(el.src));
    document.querySelectorAll('img[src]').forEach(el => checkScriptForTrackers(el.src));
  }

  //permissions
  function reportPermission(name) {
    if (!reportedPerms.has(name)) {
      reportedPerms.add(name);
      send('PERMISSION_REQUESTED', { permissionName: name });
    }
  }

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const _orig = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function (desc) {
        reportPermission(desc && desc.name ? desc.name : 'unknown');
        return _orig(desc);
      };
    }
  } catch (_) {}

  try {
    if (navigator.geolocation) {
      const _get   = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      const _watch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = function (...a) { reportPermission('geolocation'); return _get(...a); };
      navigator.geolocation.watchPosition      = function (...a) { reportPermission('geolocation'); return _watch(...a); };
    }
  } catch (_) {}

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const _orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function (constraints) {
        if (constraints) {
          if (constraints.video) reportPermission('camera');
          if (constraints.audio) reportPermission('microphone');
        }
        return _orig(constraints);
      };
    }
  } catch (_) {}

  try {
    const _legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (_legacy) {
      navigator.getUserMedia = function (constraints, ...rest) {
        if (constraints) {
          if (constraints.video) reportPermission('camera');
          if (constraints.audio) reportPermission('microphone');
        }
        return _legacy.call(navigator, constraints, ...rest);
      };
    }
  } catch (_) {}

  try {
    if ('Notification' in window && Notification.requestPermission) {
      const _origReq = Notification.requestPermission.bind(Notification);
      Notification.requestPermission = function (...a) {
        reportPermission('notifications');
        return _origReq(...a);
      };
    }
  } catch (_) {}

  try {
    if (navigator.clipboard) {
      ['read', 'readText'].forEach(method => {
        if (navigator.clipboard[method]) {
          const _o = navigator.clipboard[method].bind(navigator.clipboard);
          navigator.clipboard[method] = function (...a) { reportPermission('clipboard-read'); return _o(...a); };
        }
      });
      ['write', 'writeText'].forEach(method => {
        if (navigator.clipboard[method]) {
          const _o = navigator.clipboard[method].bind(navigator.clipboard);
          navigator.clipboard[method] = function (...a) { reportPermission('clipboard-write'); return _o(...a); };
        }
      });
    }
  } catch (_) {}

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName)) attachFocusListener(node);
        if (node.querySelectorAll) scanInputs(node);
        if (node.tagName === 'SCRIPT') checkScriptForTrackers(node.src || node.textContent || '');
        if (node.querySelectorAll)    scanScripts(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  scanInputs(document);
  scanScripts(document);
  setTimeout(scanPageSignals, 1500);
  setTimeout(scanPageSignals, 4000);

})();
