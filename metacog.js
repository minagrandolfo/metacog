const CONFIDENCE_PROBS = [null, 0.5625, 0.6875, 0.8125, 0.9375];
const CONFIDENCE_LABELS = [null, 'Je devine', 'Peu sûr', 'Assez sûr', 'Très sûr'];

function pairTrialsWithConfidence(allTrials) {
  const stims = allTrials.filter(t => t.task === 'gabor_2afc');
  const confs = allTrials.filter(t => t.task === 'confidence');
  const paired = [];
  for (let i = 0; i < Math.min(stims.length, confs.length); i++) {
    paired.push({
      orientation: stims[i].orientation,
      correct: stims[i].correct,
      response: stims[i].response,
      rt: stims[i].rt,
      confidence: confs[i].confidence,
      staircase_level: stims[i].staircase_level
    });
  }
  return paired;
}

function computeCalibration(trials) {
  return [1, 2, 3, 4].map(level => {
    const inBin = trials.filter(t => t.confidence === level);
    const correctCount = inBin.filter(t => t.correct).length;
    return {
      level,
      label: CONFIDENCE_LABELS[level],
      n: inBin.length,
      accuracy: inBin.length > 0 ? correctCount / inBin.length : null,
      expected: CONFIDENCE_PROBS[level]
    };
  });
}

function brierScore(trials) {
  if (trials.length === 0) return null;
  let sum = 0;
  trials.forEach(t => {
    const p = CONFIDENCE_PROBS[t.confidence];
    const o = t.correct ? 1 : 0;
    sum += (p - o) ** 2;
  });
  return sum / trials.length;
}

function calibrationDiagnostic(bins) {
  const messages = [];
  bins.forEach(bin => {
    if (bin.n < 3 || bin.accuracy === null) return;
    const diff = bin.accuracy - bin.expected;
    if (diff < -0.15) {
      messages.push(`Quand tu réponds <b>"${bin.label}"</b>, tu as raison ${(bin.accuracy*100).toFixed(0)}% du temps (attendu ~${(bin.expected*100).toFixed(0)}%) → tu es <b>surconfiant</b> à ce niveau.`);
    } else if (diff > 0.15) {
      messages.push(`Quand tu réponds <b>"${bin.label}"</b>, tu as raison ${(bin.accuracy*100).toFixed(0)}% du temps (attendu ~${(bin.expected*100).toFixed(0)}%) → tu es <b>sous-confiant</b> à ce niveau.`);
    }
  });
  if (messages.length === 0) {
    messages.push('Ta calibration est plutôt bien alignée sur tous les niveaux.');
  }
  return messages;
}

function calibrationCurveSVG(bins) {
  const width = 380;
  const height = 300;
  const padL = 55, padR = 20, padT = 20, padB = 50;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;background:white;border-radius:8px;display:block;margin:0 auto">`;

  svg += `<line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT}" stroke="#bbb" stroke-dasharray="5,4"/>`;
  svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+plotH}" stroke="#333" stroke-width="1.5"/>`;
  svg += `<line x1="${padL}" y1="${padT+plotH}" x2="${padL+plotW}" y2="${padT+plotH}" stroke="#333" stroke-width="1.5"/>`;

  svg += `<text x="${padL + plotW/2}" y="${height - 8}" text-anchor="middle" fill="#222" font-size="13" font-weight="500">Niveau de confiance</text>`;
  svg += `<text x="18" y="${padT + plotH/2}" text-anchor="middle" fill="#222" font-size="13" font-weight="500" transform="rotate(-90, 18, ${padT + plotH/2})">Accuracy réelle</text>`;

  bins.forEach((bin, i) => {
    const x = padL + plotW * (i + 0.5) / bins.length;
    svg += `<text x="${x}" y="${padT + plotH + 18}" text-anchor="middle" font-size="11" fill="#333">${bin.level}</text>`;
    svg += `<text x="${x}" y="${padT + plotH + 32}" text-anchor="middle" font-size="9" fill="#777">${bin.label}</text>`;
    const yExp = padT + plotH * (1 - bin.expected);
    svg += `<circle cx="${x}" cy="${yExp}" r="3" fill="#bbb"/>`;
  });

  [0, 0.25, 0.5, 0.75, 1].forEach(v => {
    const y = padT + plotH * (1 - v);
    svg += `<line x1="${padL - 5}" y1="${y}" x2="${padL}" y2="${y}" stroke="#333"/>`;
    svg += `<text x="${padL - 9}" y="${y + 4}" text-anchor="end" font-size="11" fill="#333">${(v * 100).toFixed(0)}%</text>`;
  });

  let prev = null;
  bins.forEach((bin, i) => {
    if (bin.n === 0 || bin.accuracy === null) {
      prev = null;
      return;
    }
    const x = padL + plotW * (i + 0.5) / bins.length;
    const y = padT + plotH * (1 - bin.accuracy);
    if (prev) {
      svg += `<line x1="${prev.x}" y1="${prev.y}" x2="${x}" y2="${y}" stroke="#2a8" stroke-width="2.5"/>`;
    }
    const r = Math.min(10, 4 + bin.n / 3);
    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="#2a8" stroke="white" stroke-width="2"/>`;
    svg += `<text x="${x}" y="${y - r - 4}" text-anchor="middle" font-size="10" fill="#222">${(bin.accuracy*100).toFixed(0)}% (n=${bin.n})</text>`;
    prev = {x, y};
  });

  svg += `</svg>`;
  return svg;
}
