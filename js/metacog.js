const CONFIDENCE_PROBS = [null, 0.5625, 0.6875, 0.8125, 0.9375];

function confLabel(level) { return t('conf' + level); }

function pairTrialsWithConfidence(allTrials) {
  const stims = allTrials.filter(tr => tr.task === 'stim');
  const confs = allTrials.filter(tr => tr.task === 'confidence');
  const paired = [];
  for (let i = 0; i < Math.min(stims.length, confs.length); i++) {
    paired.push({
      direction: stims[i].direction,
      coherence: stims[i].coherence,
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
    const inBin = trials.filter(tr => tr.confidence === level);
    const correctCount = inBin.filter(tr => tr.correct).length;
    return {
      level,
      label: confLabel(level),
      n: inBin.length,
      accuracy: inBin.length > 0 ? correctCount / inBin.length : null,
      expected: CONFIDENCE_PROBS[level]
    };
  });
}

function brierScore(trials) {
  if (trials.length === 0) return null;
  let sum = 0;
  trials.forEach(tr => {
    const p = CONFIDENCE_PROBS[tr.confidence];
    const o = tr.correct ? 1 : 0;
    sum += (p - o) ** 2;
  });
  return sum / trials.length;
}

function aurocType2(trials) {
  const correct = trials.filter(tr => tr.correct);
  const incorrect = trials.filter(tr => !tr.correct);
  if (correct.length === 0 || incorrect.length === 0) return null;
  let sum = 0;
  for (const c of correct) {
    for (const i of incorrect) {
      if (c.confidence > i.confidence) sum += 1;
      else if (c.confidence === i.confidence) sum += 0.5;
    }
  }
  return sum / (correct.length * incorrect.length);
}

// Inverse normal CDF (Wichura's algorithm, accurate to ~1e-10)
function normInv(p) {
  if (p <= 0 || p >= 1) return null;
  const a1=-3.969683028665376e+01, a2=2.209460984245205e+02, a3=-2.759285104469687e+02, a4=1.383577518672690e+02, a5=-3.066479806614716e+01, a6=2.506628277459239;
  const b1=-5.447609879822406e+01, b2=1.615858368580409e+02, b3=-1.556989798598866e+02, b4=6.680131188771972e+01, b5=-1.328068155288572e+01;
  const c1=-7.784894002430293e-03, c2=-3.223964580411365e-01, c3=-2.400758277161838, c4=-2.549732539343734, c5=4.374664141464968, c6=2.938163982698783;
  const d1=7.784695709041462e-03, d2=3.224671290700398e-01, d3=2.445134137142996, d4=3.754408661907416;
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q / (((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1);
  }
}

function dPrime(trials) {
  const N = trials.length;
  if (N < 10) return null;
  const adj = 0.5;
  const s2trials = trials.filter(tr => tr.correct_response === 1);
  const s1trials = trials.filter(tr => tr.correct_response === 0);
  if (s1trials.length === 0 || s2trials.length === 0) return null;
  const hits = s2trials.filter(tr => tr.response === 1).length;
  const fas = s1trials.filter(tr => tr.response === 1).length;
  const H = (hits + adj) / (s2trials.length + 2 * adj);
  const FA = (fas + adj) / (s1trials.length + 2 * adj);
  if (H <= 0 || H >= 1 || FA <= 0 || FA >= 1) return null;
  return normInv(H) - normInv(FA);
}

function metaDPrime(trials) {
  const dp = dPrime(trials);
  if (dp === null || dp <= 0) return null;
  const auc = aurocType2(trials);
  if (auc === null || auc <= 0.5) return { dPrime: dp, metaD: 0, mRatio: 0 };
  const aucClamped = Math.min(0.999, auc);
  const metaD = Math.SQRT2 * normInv(aucClamped);
  return { dPrime: dp, metaD: metaD, mRatio: metaD / dp };
}

function metaDPrimeWithCI(trials, nBoot) {
  nBoot = nBoot ?? 300;
  const point = metaDPrime(trials);
  if (!point) return null;
  const mRatios = [], metaDs = [], dPrimes = [];
  for (let b = 0; b < nBoot; b++) {
    const resampled = [];
    for (let i = 0; i < trials.length; i++) {
      resampled.push(trials[Math.floor(Math.random() * trials.length)]);
    }
    const r = metaDPrime(resampled);
    if (r && isFinite(r.mRatio)) {
      mRatios.push(r.mRatio);
      metaDs.push(r.metaD);
      dPrimes.push(r.dPrime);
    }
  }
  if (mRatios.length < 10) return { ...point, mRatio_ci_lo: null, mRatio_ci_hi: null };
  mRatios.sort((a,b) => a-b);
  metaDs.sort((a,b) => a-b);
  dPrimes.sort((a,b) => a-b);
  const lo = Math.floor(0.025 * mRatios.length);
  const hi = Math.floor(0.975 * mRatios.length);
  return {
    ...point,
    mRatio_ci_lo: mRatios[lo],
    mRatio_ci_hi: mRatios[hi],
    metaD_ci_lo: metaDs[lo],
    metaD_ci_hi: metaDs[hi],
    dPrime_ci_lo: dPrimes[lo],
    dPrime_ci_hi: dPrimes[hi]
  };
}

function aurocType2WithCI(trials, nBoot) {
  nBoot = nBoot ?? 200;
  const point = aurocType2(trials);
  if (point === null || trials.length < 10) return { point, ci_lo: null, ci_hi: null };
  const aucs = [];
  for (let b = 0; b < nBoot; b++) {
    const resampled = [];
    for (let i = 0; i < trials.length; i++) {
      resampled.push(trials[Math.floor(Math.random() * trials.length)]);
    }
    const auc = aurocType2(resampled);
    if (auc !== null) aucs.push(auc);
  }
  if (aucs.length < 10) return { point, ci_lo: null, ci_hi: null };
  aucs.sort((a, b) => a - b);
  return {
    point: point,
    ci_lo: aucs[Math.floor(0.025 * aucs.length)],
    ci_hi: aucs[Math.floor(0.975 * aucs.length)]
  };
}

function calibrationDiagnostic(bins) {
  const messages = [];
  bins.forEach(bin => {
    if (bin.n < 3 || bin.accuracy === null) return;
    const diff = bin.accuracy - bin.expected;
    const vars = {
      label: bin.label,
      acc: (bin.accuracy*100).toFixed(0),
      exp: (bin.expected*100).toFixed(0)
    };
    if (diff < -0.15) messages.push(t('overconfidentMsg', vars));
    else if (diff > 0.15) messages.push(t('underconfidentMsg', vars));
  });
  if (messages.length === 0) messages.push(t('calibAligned'));
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

  svg += `<text x="${padL + plotW/2}" y="${height - 8}" text-anchor="middle" fill="#222" font-size="13" font-weight="500">${t('svgXLabel')}</text>`;
  svg += `<text x="18" y="${padT + plotH/2}" text-anchor="middle" fill="#222" font-size="13" font-weight="500" transform="rotate(-90, 18, ${padT + plotH/2})">${t('svgYLabel')}</text>`;

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
    if (bin.n === 0 || bin.accuracy === null) { prev = null; return; }
    const x = padL + plotW * (i + 0.5) / bins.length;
    const y = padT + plotH * (1 - bin.accuracy);
    if (prev) svg += `<line x1="${prev.x}" y1="${prev.y}" x2="${x}" y2="${y}" stroke="#2a8" stroke-width="2.5"/>`;
    const r = Math.min(10, 4 + bin.n / 3);
    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="#2a8" stroke="white" stroke-width="2"/>`;
    svg += `<text x="${x}" y="${y - r - 4}" text-anchor="middle" font-size="10" fill="#222">${(bin.accuracy*100).toFixed(0)}% (n=${bin.n})</text>`;
    prev = {x, y};
  });

  svg += `</svg>`;
  return svg;
}
