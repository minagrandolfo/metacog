const STORAGE_KEY = 'metacog_history';

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

function savePartialTrial(sessionId, mode, trial, staircaseState, totalTrials) {
  try {
    const key = `metacog_partial_${sessionId}`;
    const existing = JSON.parse(localStorage.getItem(key) || JSON.stringify({
      mode: mode,
      started: Date.now(),
      total_trials: totalTrials,
      trials: [],
      staircase_state: null
    }));
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
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('metacog_partial_')) {
        const data = JSON.parse(localStorage.getItem(k));
        if (data && data.trials && data.trials.length > 0) {
          partials.push({
            key: k,
            sessionId: k.replace('metacog_partial_', ''),
            ...data
          });
        }
      }
    }
  } catch (e) {}
  return partials.sort((a, b) => b.last_update - a.last_update);
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
