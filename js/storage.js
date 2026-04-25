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

function savePartialTrial(sessionId, mode, trial) {
  try {
    const key = `metacog_partial_${sessionId}`;
    const existing = JSON.parse(localStorage.getItem(key) || JSON.stringify({mode: mode, started: Date.now(), trials: []}));
    existing.trials.push(trial);
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
        if (data.trials && data.trials.length > 0) {
          partials.push({ key: k, sessionId: k.replace('metacog_partial_', ''), ...data });
        }
      }
    }
  } catch (e) {}
  return partials;
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jour${days > 1 ? 's' : ''}`;
}
