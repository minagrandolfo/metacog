const STORAGE_KEY = 'metacog_history';
const USER_CODE_KEY = 'metacog_user_code';

function generateUserCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.slice(0, 3) + '-' + s.slice(3);
}

function getUserCode() {
  try {
    let code = localStorage.getItem(USER_CODE_KEY);
    if (!code) {
      code = generateUserCode();
      localStorage.setItem(USER_CODE_KEY, code);
    }
    return code;
  } catch (e) { return generateUserCode(); }
}

function setUserCode(code) {
  try { localStorage.setItem(USER_CODE_KEY, String(code).toUpperCase()); } catch (e) {}
}

function saveSession(summary) {
  const history = getSessionHistory();
  history.push({ timestamp: Date.now(), ...summary });
  if (history.length > 50) history.shift();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('localStorage failed:', e);
  }
}

function getSessionHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function lastSession() {
  const h = getSessionHistory();
  return h.length > 0 ? h[h.length - 1] : null;
}

function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function nextSessionNumber() {
  try {
    const key = 'metacog_session_counter_' + getUserCode();
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const next = (isNaN(current) ? 0 : current) + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch (e) { return 1; }
}

function savePartialTrial(sessionId, mode, trial, staircaseState, totalTrials, sessionNumber) {
  try {
    const key = `metacog_partial_${sessionId}`;
    const existing = JSON.parse(localStorage.getItem(key) || JSON.stringify({
      mode: mode,
      started: Date.now(),
      total_trials: totalTrials,
      session_number: sessionNumber,
      trials: [],
      staircase_state: null
    }));
    if (sessionNumber && !existing.session_number) existing.session_number = sessionNumber;
    existing.trials.push(trial);
    existing.staircase_state = staircaseState;
    existing.last_update = Date.now();
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    console.warn('savePartialTrial failed:', e);
  }
}

function clearPartialSession(sessionId) {
  try {
    localStorage.removeItem(`metacog_partial_${sessionId}`);
  } catch (e) {}
}

function listPartialSessions() {
  const partials = [];
  const stale = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('metacog_partial_')) {
        const data = JSON.parse(localStorage.getItem(k));
        if (data && data.trials && data.trials.length > 0 && data.staircase_state && typeof data.staircase_state.level === 'number') {
          partials.push({
            key: k,
            sessionId: k.replace('metacog_partial_', ''),
            ...data
          });
        } else {
          stale.push(k);
        }
      }
    }
    stale.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  } catch (e) {}
  return partials.sort((a, b) => (b.last_update || 0) - (a.last_update || 0));
}

function loadPartialSession(sessionId) {
  try {
    return JSON.parse(localStorage.getItem(`metacog_partial_${sessionId}`));
  } catch (e) { return null; }
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return t('justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('minutesAgo', {n: minutes});
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', {n: hours});
  const days = Math.floor(hours / 24);
  return t('daysAgo', {n: days, s: days > 1 ? 's' : ''});
}

function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessionEvolutionSVG(sessions, metric) {
  const valid = sessions.filter(s => s[metric] != null && isFinite(s[metric]));
  if (valid.length === 0) return '';
  const width = 400, height = 240;
  const padL = 55, padR = 20, padT = 20, padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const values = valid.map(s => s[metric]);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (metric === 'mRatio') { yMin = Math.min(0, yMin); yMax = Math.max(1.5, yMax); }
  else if (metric === 'accuracy') { yMin = 0.4; yMax = 1; }
  if (yMax === yMin) yMax = yMin + 0.1;
  const yRange = yMax - yMin;
  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;background:white;border-radius:8px;display:block;margin:0 auto">`;
  svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="#333" stroke-width="1.5"/>`;
  svg += `<line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="#333" stroke-width="1.5"/>`;
  for (let i = 0; i <= 4; i++) {
    const v = yMin + yRange * i / 4;
    const y = padT + plotH * (1 - i/4);
    svg += `<text x="${padL-8}" y="${y+4}" text-anchor="end" font-size="10" fill="#333">${v.toFixed(2)}</text>`;
    svg += `<line x1="${padL-4}" y1="${y}" x2="${padL}" y2="${y}" stroke="#333"/>`;
  }
  if (metric === 'mRatio') {
    const yOpt = padT + plotH * (1 - (1 - yMin) / yRange);
    if (yOpt >= padT && yOpt <= padT + plotH) {
      svg += `<line x1="${padL}" y1="${yOpt}" x2="${padL+plotW}" y2="${yOpt}" stroke="#aaa" stroke-dasharray="4,4"/>`;
    }
  }
  let prev = null;
  valid.forEach((s, i) => {
    const x = padL + plotW * (valid.length === 1 ? 0.5 : i / (valid.length - 1));
    const y = padT + plotH * (1 - (s[metric] - yMin) / yRange);
    if (prev) svg += `<line x1="${prev.x}" y1="${prev.y}" x2="${x}" y2="${y}" stroke="#2a8" stroke-width="2.5"/>`;
    svg += `<circle cx="${x}" cy="${y}" r="5" fill="#2a8" stroke="white" stroke-width="2"/>`;
    svg += `<text x="${x}" y="${padT+plotH+15}" text-anchor="middle" font-size="10" fill="#333">${i+1}</text>`;
    prev = {x, y};
  });
  svg += `</svg>`;
  return svg;
}
