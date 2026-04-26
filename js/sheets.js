const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzpC7xt8OYQKvlo0hVGQGvW8ptcZGmpOkxnpZy9UQL4b17yvhcJnvjuJdDV9sM7oB2e/exec';

function sendToSheet(allData, userCode) {
  if (!SHEETS_ENDPOINT) {
    console.log('[Sheets] No endpoint configured, skipping push.');
    return Promise.resolve({ status: 'no-endpoint' });
  }
  return fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ data: allData, timestamp: Date.now(), user_code: userCode || '' })
  })
    .then(r => r.json())
    .then(j => {
      console.log('[Sheets] Response:', j);
      return j;
    })
    .catch(e => {
      console.error('[Sheets] Failed:', e);
      return { status: 'error', message: e.message };
    });
}

function sendFeedback(message, email, userCode) {
  if (!SHEETS_ENDPOINT) {
    return Promise.resolve({ status: 'no-endpoint' });
  }
  return fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      type: 'feedback',
      message: String(message || ''),
      email: String(email || ''),
      user_code: userCode || '',
      timestamp: Date.now()
    })
  })
    .then(r => r.json())
    .then(j => {
      console.log('[Feedback] Response:', j);
      return j;
    })
    .catch(e => {
      console.error('[Feedback] Failed:', e);
      return { status: 'error', message: e.message };
    });
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
