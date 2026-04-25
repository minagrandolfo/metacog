// === Setup instructions ===
// 1. Crée un Google Sheet vide. Copie l'ID dans l'URL (la longue chaîne entre /d/ et /edit).
// 2. Va sur https://script.google.com → "Nouveau projet"
// 3. Colle ce code, remplace SHEET_ID par le tien
// 4. Ajoute la ligne d'en-tête manuellement dans le Sheet (voir HEADERS ci-dessous)
// 5. Deploy → New deployment → Type: Web app → Execute as: Me → Who has access: Anyone → Deploy
// 6. Copie l'URL du Web app, colle-la dans js/sheets.js comme SHEETS_ENDPOINT

const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

// HEADERS (à mettre en ligne 1 du Sheet) :
// timestamp | session_id | mode | trial_n | orientation | staircase_level | response | correct | rt | confidence | conf_rt | sleep_hours | ld_freq | age

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    const payload = JSON.parse(e.postData.contents);
    const sessionId = Utilities.getUuid();
    const ts = new Date(payload.timestamp);

    const q = payload.data.find(t => t.task === 'questionnaire');
    const sleep = q && q.response ? q.response.sleep_hours : '';
    const ld = q && q.response ? q.response.ld_freq : '';
    const age = q && q.response ? q.response.age : '';

    const stims = payload.data.filter(t => t.task === 'gabor_2afc');
    const confs = payload.data.filter(t => t.task === 'confidence');

    for (let i = 0; i < stims.length; i++) {
      const s = stims[i];
      const c = confs[i] || {};
      sheet.appendRow([
        ts,
        sessionId,
        s.mode,
        i + 1,
        s.orientation,
        s.staircase_level,
        s.response,
        s.correct,
        s.rt,
        c.confidence,
        c.rt,
        sleep,
        ld,
        age
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'ok', n: stims.length}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
