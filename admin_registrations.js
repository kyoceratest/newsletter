// admin_registrations.js
// Extracted from admin_registrations.html; no UI/behavior change.

async function fetchRegistrations(attended) {
  const q = attended === '' ? '' : `?attended=${attended}`;
  const res = await fetch(`api/registrations.php${q}`);
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
}

async function markAttendance(id, attended) {
  const res = await fetch('api/attendance.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, attended })
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

function renderRows(items, term) {
  const tbody = document.getElementById('rows');
  tbody.innerHTML = '';
  const t = (term || '').toLowerCase();
  items.filter(r => {
    const s = `${r.firstName||''} ${r.lastName||''} ${r.email||''} ${r.company||''}`.toLowerCase();
    return !t || s.includes(t);
  }).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${(r.firstName||'') + ' ' + (r.lastName||'')}</td>
      <td>${r.email||''}</td>
      <td>${r.company||''}</td>
      <td class="nowrap">${r.emailOpenCount||0}</td>
      <td class="nowrap">${r.downloadCount||0}</td>
      <td class="nowrap">${r.attended ? '<span class="tag green">Oui</span>' : '<span class="tag gray">Non</span>'}</td>
      <td class="nowrap">
        <button class="kyo-button secondary" data-id="${r.id}" data-attended="${!r.attended}">${r.attended ? 'Marquer non' : 'Marquer oui'}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function load() {
  const attended = document.getElementById('filterAttended').value;
  const list = await fetchRegistrations(attended);
  renderRows(list, document.getElementById('search').value);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('filterAttended').addEventListener('change', load);
  document.getElementById('refresh').addEventListener('click', load);
  document.getElementById('search').addEventListener('input', async () => { await load(); });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const attended = btn.getAttribute('data-attended') === 'true';
    try {
      await markAttendance(id, attended);
      await load();
    } catch (_) {
      alert("Échec de la mise à jour de la participation");
    }
  });

  load().catch(() => alert('Impossible de charger les inscriptions'));
});
