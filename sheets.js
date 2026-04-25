const SHEETS_ENDPOINT = '';

function sendToSheet(allData) {
  if (!SHEETS_ENDPOINT) {
    console.log('[Sheets] No endpoint configured, skipping push.');
    return;
  }
  fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: allData, timestamp: Date.now() })
  })
    .then(() => console.log('[Sheets] Sent.'))
    .catch(e => console.warn('[Sheets] Failed:', e));
}
