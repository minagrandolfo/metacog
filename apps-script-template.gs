// === Setup instructions ===
// 1. Crée un Google Sheet vide. Copie l'ID dans l'URL (la longue chaîne entre /d/ et /edit).
// 2. Va sur https://script.google.com → "Nouveau projet"
// 3. Colle ce code, remplace SHEET_ID par le tien
// 4. Ajoute la ligne d'en-tête manuellement dans le Sheet (voir HEADERS ci-dessous)
// 5. Deploy → New deployment → Type: Web app → Execute as: Me → Who has access: Anyone → Deploy
// 6. Copie l'URL du Web app, colle-la dans js/sheets.js comme SHEETS_ENDPOINT

const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

// Onglet principal "Data" (ou Feuille1) HEADERS (20 colonnes) :
// timestamp | session_id | mode | trial_n | direction | coherence | staircase_level | response | correct | rt | confidence | conf_rt | global_pre | global_post | sleep_hours | ld_freq | age | sex | user_code | session_number
//
// IMPORTANT : ajoute manuellement la colonne T1 = "session_number" si tu mets à jour un Sheet existant.
//
// Un onglet "Feedback" sera créé automatiquement à la première soumission de feedback
// HEADERS Feedback : timestamp | user_code | email | message

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.type === 'feedback') {
      return handleFeedback(payload);
    }
    return handleSession(payload);

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function handleSession(payload) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const sessionId = payload.client_session_id || Utilities.getUuid();
  const sessionNumber = payload.session_number || '';
  const ts = new Date(payload.timestamp);
  const userCode = payload.user_code || '';

  const q = payload.data.find(t => t.task === 'questionnaire');
  const sleep = q && q.response ? q.response.sleep_hours : '';
  const ld = q && q.response ? q.response.ld_freq : '';
  const age = q && q.response ? q.response.age : '';
  const sex = q && q.response ? q.response.sex : '';

  const pre = payload.data.find(t => t.task === 'global_pre');
  const post = payload.data.find(t => t.task === 'global_post');
  const globalPre = pre && pre.response ? pre.response.prediction : '';
  const globalPost = post && post.response ? post.response.prediction : '';

  const stims = payload.data.filter(t => t.task === 'stim');
  const confs = payload.data.filter(t => t.task === 'confidence');

  // Dedupe: delete existing rows with the same session_id (early-send + final-send pattern)
  deleteRowsBySessionId(sheet, sessionId);

  const rows = [];
  for (let i = 0; i < stims.length; i++) {
    const s = stims[i];
    const c = confs[i] || {};
    rows.push([
      ts,
      sessionId,
      s.mode,
      i + 1,
      s.direction,
      s.coherence,
      s.staircase_level,
      s.response,
      s.correct,
      s.rt,
      c.confidence,
      c.rt,
      globalPre,
      globalPost,
      sleep,
      ld,
      age,
      sex,
      userCode,
      sessionNumber
    ]);
  }
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  return jsonResponse({ status: 'ok', n: stims.length, session_id: sessionId, session_number: sessionNumber });
}

function deleteRowsBySessionId(sheet, sessionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const sidIdx = headers.indexOf('session_id');
  if (sidIdx === -1) return;
  const sids = sheet.getRange(2, sidIdx + 1, lastRow - 1, 1).getValues();
  const rowsToDelete = [];
  for (let i = 0; i < sids.length; i++) {
    if (sids[i][0] === sessionId) rowsToDelete.push(i + 2);
  }
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }
}

function handleFeedback(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Feedback');
  if (!sheet) {
    sheet = ss.insertSheet('Feedback');
    sheet.appendRow(['timestamp', 'user_code', 'email', 'message']);
  }
  sheet.appendRow([
    new Date(payload.timestamp || Date.now()),
    String(payload.user_code || ''),
    String(payload.email || ''),
    String(payload.message || '')
  ]);
  return jsonResponse({ status: 'ok', type: 'feedback' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// doGet : retourne les sessions associées à un user_code
function doGet(e) {
  try {
    const userCode = (e.parameter.user_code || '').toUpperCase();
    if (!userCode) {
      return jsonResponse({ status: 'error', message: 'no user_code' });
    }
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return jsonResponse({ status: 'ok', sessions: [] });
    }
    const headers = data[0];
    const idx = (name) => headers.indexOf(name);
    if (idx('user_code') === -1) {
      return jsonResponse({ status: 'error', message: 'user_code column missing in sheet header' });
    }
    const grouped = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[idx('user_code')]).toUpperCase() !== userCode) continue;
      const sid = row[idx('session_id')];
      if (!grouped[sid]) {
        grouped[sid] = {
          session_id: sid,
          timestamp: row[idx('timestamp')],
          mode: row[idx('mode')],
          n_trials: 0,
          n_correct: 0,
          conf_correct: [],
          conf_incorrect: []
        };
      }
      grouped[sid].n_trials++;
      const isCorrect = row[idx('correct')] === true || String(row[idx('correct')]).toLowerCase() === 'true';
      const conf = parseInt(row[idx('confidence')]);
      if (isCorrect) grouped[sid].n_correct++;
      if (!isNaN(conf)) {
        if (isCorrect) grouped[sid].conf_correct.push(conf);
        else grouped[sid].conf_incorrect.push(conf);
      }
    }
    const list = Object.values(grouped).map(s => {
      const acc = s.n_trials > 0 ? s.n_correct / s.n_trials : null;
      let auc = null;
      if (s.conf_correct.length > 0 && s.conf_incorrect.length > 0) {
        let sum = 0;
        for (const cc of s.conf_correct) {
          for (const ci of s.conf_incorrect) {
            if (cc > ci) sum += 1;
            else if (cc === ci) sum += 0.5;
          }
        }
        auc = sum / (s.conf_correct.length * s.conf_incorrect.length);
      }
      return {
        session_id: s.session_id,
        timestamp: s.timestamp,
        mode: s.mode,
        n_trials: s.n_trials,
        accuracy: acc,
        auroc2: auc
      };
    }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return jsonResponse({ status: 'ok', sessions: list });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}
