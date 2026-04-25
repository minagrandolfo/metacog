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
