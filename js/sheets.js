const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxU6PpY9wMYKaC8xwbC18st2f5YHt6Df3wH6t0O_2zHgGY6mGCCY29xQ905TvWdH5Ox/exec';

function sendToSheet(allData, userCode) {
  if (!SHEETS_ENDPOINT) {
    console.log('[Sheets] No endpoint configured, skipping push.');
    return;
  }
  fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: allData, timestamp: Date.now(), user_code: userCode || '' })
  })
    .then(() => console.log('[Sheets] Sent.'))
    .catch(e => console.warn('[Sheets] Failed:', e));
}

async function fetchUserHistory(userCode) {
  if (!SHEETS_ENDPOINT) return null;
  if (!userCode) return null;
  try {
    const url = SHEETS_ENDPOINT + '?user_code=' + encodeURIComponent(userCode);
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'ok') return data.sessions || [];
    console.warn('[Sheets] fetch returned error:', data.message);
    return null;
  } catch (e) {
    console.warn('[Sheets] fetch failed:', e);
    return null;
  }
}
