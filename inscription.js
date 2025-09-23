// inscription.js
// Extracted from inscription.html; preserves behavior and French UI text.

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.getElementById('hamburger');
  const headerNav = document.querySelector('.header-nav');
  if (hamburger && headerNav) {
    hamburger.addEventListener('click', function () {
      headerNav.classList.toggle('active');
      const spans = hamburger.querySelectorAll('span');
      if (headerNav.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });
  }
});

// Helpers
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function extractTitleFromDoc(doc) {
  let el = doc.querySelector('span[style*="font-size: 52px"], span[style*="font-size:52px"], [style*="font-size: 52px"], [style*="font-size:52px"]');
  if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
  el = doc.querySelector('font[size="7"]');
  if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
  el = doc.querySelector('h1, h2, h3');
  if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
  return '';
}

// Content dropdown + loader (only when not in preview mode)
document.addEventListener('DOMContentLoaded', function () {
  const selectEl = document.getElementById('contentSelect');
  const statusEl = document.getElementById('contentStatus');
  const targetEl = document.getElementById('loadedContent');

  async function syncDropdownLabels() {
    if (!selectEl) return;
    const opts = Array.from(selectEl.options).filter(o => o.value && o.value.endsWith('.html'));
    for (const opt of opts) {
      try {
        let syncFile = opt.value;
        if (syncFile === 'contenuDeGauche.html' || syncFile === 'teteSuperieure.html' || syncFile === 'contenuCentral.html' || syncFile === 'contenuDeDroite.html') {
          const res = await fetch(`${syncFile}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const html = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const title = extractTitleFromDoc(doc);
          if (title) opt.textContent = title;
        }
      } catch (e) {
        console.warn('Label sync failed for', opt.value, e);
      }
    }
  }

  function mapPageToFile(page) {
    switch (page) {
      case '1': return 'teteSuperieure.html';
      case '2': return 'contenuDeGauche.html';
      case '3': return 'contenuCentral.html';
      case '4': return 'contenuDeDroite.html';
      default: return '';
    }
  }

  async function loadSelected(path) {
    if (!path) { targetEl.innerHTML = ''; statusEl.textContent = ''; return; }
    statusEl.textContent = 'Chargement...';
    try {
      const res = await fetch(`${path}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const content = doc.querySelector('.newsletter-content') || doc.body;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = content ? content.innerHTML : html;
      wrapper.querySelectorAll('[contenteditable]').forEach(el => { el.removeAttribute('contenteditable'); el.contentEditable = 'false'; });
      ['input','textarea','select','button'].forEach(sel => {
        wrapper.querySelectorAll(sel).forEach(ctrl => { ctrl.setAttribute('disabled', ''); ctrl.setAttribute('tabindex', '-1'); });
      });
      targetEl.innerHTML = '';
      while (wrapper.firstChild) targetEl.appendChild(wrapper.firstChild);
      statusEl.textContent = '';
    } catch (e) {
      console.error('Load failed:', e);
      statusEl.textContent = 'Erreur de chargement';
    }
  }

  // Initialize loader
  syncDropdownLabels().then(() => {
    if (selectEl) {
      const page = getUrlParameter('page');
      const contentFile = mapPageToFile(page);
      if (contentFile) {
        selectEl.value = contentFile;
        loadSelected(contentFile);
      }
    }
  });

  if (selectEl) {
    selectEl.addEventListener('change', (e) => loadSelected(e.target.value));
  }
});

// Registration form + API submission
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('registerForm');
  const msg = document.getElementById('formMessage');
  if (!form || !msg) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = '#d32f2f';

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const company = document.getElementById('company').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const consent = document.getElementById('consent').checked;
    const optin = document.getElementById('newsletterOptin').checked;

    // Simple validations
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!firstName || !lastName || !email || !password || !confirmPassword) { msg.textContent = 'Merci de compléter tous les champs obligatoires.'; return; }
    if (!emailOk) { msg.textContent = "L'email n'est pas valide."; return; }
    if (password.length < 8) { msg.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
    if (password !== confirmPassword) { msg.textContent = 'Les mots de passe ne correspondent pas.'; return; }
    if (!consent) { msg.textContent = 'Vous devez accepter la politique de confidentialité.'; return; }

    fetch('api/register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, company, email, password, optin })
    }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then((res) => {
        msg.style.color = '#2e7d32';
        msg.textContent = 'Compte créé avec succès.';
        try { localStorage.setItem('registrationId', res.id); } catch (_) {}
        try { document.getElementById('calendarActions').style.display = 'block'; } catch(_) {}
        form.reset();
      })
      .catch((e) => {
        msg.style.color = '#d32f2f';
        msg.textContent = (e && e.error) ? e.error : 'Une erreur est survenue lors de l’inscription.';
      });
  });
});

// Calendar helpers (buttons)
document.addEventListener('DOMContentLoaded', function () {
  const btnIcs = document.getElementById('btnIcs');
  const btnGoogle = document.getElementById('btnGoogle');
  const btnOutlook = document.getElementById('btnOutlook');
  const help = document.getElementById('calendarHelp');
  if (!btnIcs || !btnGoogle || !btnOutlook) return;

  const event = {
    title: 'Social media manager : comment garder le contrôle quand on porte plusieurs casquettes ?',
    startLocal: '2025-09-12T10:00:00',
    endLocal: '2025-09-12T11:00:00',
    timezone: 'Europe/Paris',
    location: window.location.origin + '/newsletter/contenuWebinars.html',
    description: 'Merci pour votre inscription au webinar Social media manager : comment garder le contrôle quand on porte plusieurs casquettes ?. Malheureusement le webinar est terminé, mais vous pouvez accéder au replay en cliquant sur le lien ci-dessus.',
    reminderMinutes: 10
  };

  function toIcsDate(dtLocal, tz) {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const parts = Object.fromEntries(fmt.formatToParts(new Date(dtLocal)).map(p => [p.type, p.value]));
      const y = parts.year, m = parts.month, d = parts.day;
      const hh = parts.hour, mm = parts.minute, ss = parts.second;
      const local = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
      const utc = new Date(local.toLocaleString('en-US', { timeZone: 'UTC' }));
      const pad = n => String(n).padStart(2, '0');
      const y2 = utc.getUTCFullYear();
      const m2 = pad(utc.getUTCMonth() + 1);
      const d2 = pad(utc.getUTCDate());
      const h2 = pad(utc.getUTCHours());
      const mi2 = pad(utc.getUTCMinutes());
      const s2 = pad(utc.getUTCSeconds());
      return `${y2}${m2}${d2}T${h2}${mi2}${s2}Z`;
    } catch {
      const dt = new Date(dtLocal);
      return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    }
  }

  function buildIcs(ev) {
    const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const dtStart = toIcsDate(ev.startLocal, ev.timezone);
    const dtEnd = toIcsDate(ev.endLocal, ev.timezone);
    const uid = (Math.random().toString(36).slice(2)) + '@kyocera.local';
    const escape = s => String(s || '').replace(/[\\,;"]/g, m => ({'\\':'\\\\', ',':'\\,', ';':'\\;', '"':'\\"'}[m])).replace(/\r?\n/g, '\\n');
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Kyocera Newsletter//FR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${uid}\r\nDTSTAMP:${dtStamp}\r\nDTSTART:${dtStart}\r\nDTEND:${dtEnd}\r\n`;
    ics += `SUMMARY:${escape(ev.title)}\r\n`;
    ics += `DESCRIPTION:${escape(ev.description)}\r\n`;
    if (ev.location) ics += `LOCATION:${escape(ev.location)}\r\n`;
    if (ev.reminderMinutes && ev.reminderMinutes > 0) {
      ics += 'BEGIN:VALARM\r\nACTION:DISPLAY\r\n';
      ics += `TRIGGER:-PT${ev.reminderMinutes}M\r\nEND:VALARM\r\n`;
    }
    ics += 'END:VEVENT\r\nEND:VCALENDAR\r\n';
    return ics;
  }

  function downloadIcs(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function googleCalendarUrl(ev) {
    const start = toIcsDate(ev.startLocal, ev.timezone);
    const end = toIcsDate(ev.endLocal, ev.timezone);
    const params = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, details: ev.description, location: ev.location || '', dates: `${start}/${end}` });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  }

  function outlookWebUrl(ev) {
    const start = new Date(ev.startLocal).toISOString();
    const end = new Date(ev.endLocal).toISOString();
    const params = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', startdt: start, enddt: end, subject: ev.title, body: ev.description, location: ev.location || '' });
    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  btnIcs.addEventListener('click', () => { const ics = buildIcs(event); downloadIcs('event.ics', ics); if (help) help.textContent = 'Fichier .ics téléchargé. Ouvrez-le avec Outlook, Apple Calendar ou autre.'; });
  btnGoogle.addEventListener('click', () => { window.open(googleCalendarUrl(event), '_blank'); });
  btnOutlook.addEventListener('click', () => { window.open(outlookWebUrl(event), '_blank'); });
});
