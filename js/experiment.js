let activeKbHandler = null;
function setupKbShortcuts(map) {
  cleanupKbShortcuts();
  activeKbHandler = (e) => {
    const idx = map[e.key] !== undefined ? map[e.key] : map[e.key.toLowerCase()];
    if (idx !== undefined) {
      const buttons = document.querySelectorAll('.jspsych-btn');
      if (buttons[idx]) {
        e.preventDefault();
        buttons[idx].click();
      }
    }
  };
  document.addEventListener('keydown', activeKbHandler);
}
function cleanupKbShortcuts() {
  if (activeKbHandler) document.removeEventListener('keydown', activeKbHandler);
  activeKbHandler = null;
}

let currentRDK = null;

function runExperiment(mode, resumeData) {
  const jsPsych = initJsPsych({});

  const TOTAL_TRIALS = mode === 'evaluate' ? 60 : 30;
  const sessionId = resumeData ? resumeData.sessionId : generateSessionId();
  const sessionNumber = resumeData && resumeData.sessionNumber ? resumeData.sessionNumber : nextSessionNumber();
  const resumedTrials = resumeData ? resumeData.trials : [];
  const remainingTrials = TOTAL_TRIALS - resumedTrials.length;
  let earlySent = false;

  const validResume = resumeData && resumeData.staircase_state && typeof resumeData.staircase_state.level === 'number';
  const staircase = new StaircaseTwoDownOneUp({
    startLevel: validResume ? resumeData.staircase_state.level : 30,
    minLevel: 1,
    maxLevel: 100,
    stepSizes: [10, 5, 2, 1]
  });
  if (validResume) {
    staircase.consecutiveCorrect = resumeData.staircase_state.consecutiveCorrect || 0;
    staircase.lastDirection = resumeData.staircase_state.lastDirection || null;
    staircase.reversalCount = resumeData.staircase_state.reversalCount || 0;
  }

  let currentTrial = {};
  let lastStimData = null;
  let haveExtended = false;
  let wantExtension = false;

  const modeTitle = mode === 'evaluate' ? t('titleEvaluate') : t('titleTrain');
  const modeIntro = resumeData
    ? `<p>${t('introResume', {n: remainingTrials})}</p>`
    : (mode === 'evaluate'
        ? `<p>${t('introEvaluate', {n: TOTAL_TRIALS})}</p>`
        : `<p>${t('introTrain', {n: TOTAL_TRIALS})}</p>`);

  const welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <h2>${modeTitle}</h2>
      ${modeIntro}
      <p>${t('welcomeInstructions')}</p>
      <p>${t('welcomeConfidence')}</p>
      <p style="font-size:13px;color:#bbb;margin-top:14px">${t('welcomeKeys')}</p>
      <p style="font-size:14px;color:#ddd;margin-top:14px">${t('welcomeAdaptive')}</p>
    `,
    choices: [t('btnStart')]
  };

  const stim = {
    type: jsPsychCanvasButtonResponse,
    canvas_size: [350, 350],
    on_start: function() {
      const sign = Math.random() < 0.5 ? -1 : 1;
      currentTrial = {
        direction: sign > 0 ? 0 : Math.PI,
        coherence: staircase.level / 100,
        correct_response: sign > 0 ? 1 : 0,
        staircase_level: staircase.level
      };
    },
    stimulus: function(c) {
      if (currentRDK) currentRDK.stop();
      currentRDK = new RDKAnimator(c, {
        coherence: currentTrial.coherence,
        direction: currentTrial.direction,
        nDots: 150,
        dotSize: 2.5,
        speed: 3,
        lifetime: 8
      });
      currentRDK.run();
    },
    choices: [t('btnLeft'), t('btnRight')],
    prompt: function() {
      const completed = jsPsych.data.get().filter({task: 'stim'}).count() + resumedTrials.length;
      return `<p style="font-size:13px;color:#888;margin-top:10px">${t('trialCounter', {n: completed + 1, total: TOTAL_TRIALS})}</p>`;
    },
    data: function() {
      return {
        task: 'stim',
        mode: mode,
        direction: currentTrial.direction,
        coherence: currentTrial.coherence,
        correct_response: currentTrial.correct_response,
        staircase_level: currentTrial.staircase_level
      };
    },
    on_load: function() {
      setupKbShortcuts({
        'ArrowLeft': 0, 'ArrowRight': 1,
        'g': 0, 'd': 1, 'q': 0, 'p': 1
      });
    },
    on_finish: function(data) {
      if (currentRDK) { currentRDK.stop(); currentRDK = null; }
      cleanupKbShortcuts();
      data.correct = (data.response === data.correct_response);
      staircase.update(data.correct);
      lastStimData = data;
    }
  };

  const confidence = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<p style="font-size:20px;color:white">${t('confidencePrompt')}</p>`,
    choices: [t('conf1'), t('conf2'), t('conf3'), t('conf4')],
    data: { task: 'confidence', mode: mode },
    on_load: function() {
      setupKbShortcuts({'1': 0, '2': 1, '3': 2, '4': 3});
    },
    on_finish: function(data) {
      cleanupKbShortcuts();
      data.confidence = data.response + 1;
      if (lastStimData) {
        const trialRecord = {
          direction: lastStimData.direction,
          coherence: lastStimData.coherence,
          correct: lastStimData.correct,
          response: lastStimData.response,
          correct_response: lastStimData.correct_response,
          rt: lastStimData.rt,
          confidence: data.confidence,
          confidence_rt: data.rt,
          staircase_level: lastStimData.staircase_level,
          timestamp: Date.now()
        };
        const state = {
          level: staircase.level,
          consecutiveCorrect: staircase.consecutiveCorrect,
          lastDirection: staircase.lastDirection,
          reversalCount: staircase.reversalCount
        };
        savePartialTrial(sessionId, mode, trialRecord, state, TOTAL_TRIALS, sessionNumber);
      }
    }
  };

  const trialBlock = {
    timeline: [stim, confidence],
    repetitions: remainingTrials
  };

  const globalSliderHTML = (qKey, sliderId) => {
    const initVal = Math.floor(Math.random() * (TOTAL_TRIALS + 1));
    return `
    <div style="background:white;color:#222;padding:24px;border-radius:8px;text-align:center;max-width:520px;margin:0 auto;">
      <p style="font-size:17px;margin-bottom:24px">${t(qKey, {n: TOTAL_TRIALS})}</p>
      <input type="range" name="prediction" min="0" max="${TOTAL_TRIALS}" value="${initVal}"
             oninput="document.getElementById('${sliderId}').textContent=this.value;this.dataset.touched='1'"
             style="width:85%;height:10px;margin:14px 0">
      <div style="font-size:32px;font-weight:bold;color:#2a8;margin-top:8px">
        <span id="${sliderId}">?</span> ${t('globalSliderSuffix', {n: TOTAL_TRIALS})}
      </div>
    </div>
  `;};

  const globalPre = {
    type: jsPsychSurveyHtmlForm,
    preamble: `<h2 style="color:white">${t('globalPreTitle')}</h2><p style="color:white">${t('globalPreInstruction')}</p>`,
    html: globalSliderHTML('globalPreQ', 'pre_val'),
    button_label: t('btnConfirm'),
    data: { task: 'global_pre', mode: mode }
  };

  const globalPost = {
    type: jsPsychSurveyHtmlForm,
    preamble: `<h2 style="color:white">${t('globalPostTitle')}</h2><p style="color:white">${t('globalPostInstruction')}</p>`,
    html: globalSliderHTML('globalPostQ', 'post_val'),
    button_label: t('btnConfirm'),
    data: { task: 'global_post', mode: mode }
  };

  const finalQuestions = {
    type: jsPsychSurveyHtmlForm,
    preamble: `<h2 style="color:white">${t('questionsTitle')}</h2><p style="color:white">${t('questionsAnonymous')}</p>`,
    html: `
      <div style="background:white;color:#222;padding:24px;border-radius:8px;text-align:left;max-width:500px;margin:0 auto;">
        <p><b>${t('qSleep')}</b></p>
        <input type="number" name="sleep_hours" min="0" max="14" step="0.5" required style="width:80px;padding:6px;font-size:15px"> ${t('qSleepUnit')}

        <p style="margin-top:20px"><b>${t('qLD')}</b></p>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="never" required> ${t('ldNever')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="rare"> ${t('ldRare')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="monthly"> ${t('ldMonthly')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="weekly"> ${t('ldWeekly')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="multi"> ${t('ldMulti')}</label>

        <p style="margin-top:20px"><b>${t('qAge')}</b></p>
        <input type="number" name="age" min="10" max="100" style="width:80px;padding:6px;font-size:15px">

        <p style="margin-top:20px"><b>${t('qSex')}</b></p>
        <label style="display:block;padding:5px 0"><input type="radio" name="sex" value="female"> ${t('sexFemale')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="sex" value="male"> ${t('sexMale')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="sex" value="nonbinary"> ${t('sexNonBinary')}</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="sex" value="prefer_not_say"> ${t('sexPreferNotSay')}</label>
      </div>
    `,
    button_label: t('btnSubmitQuestions'),
    data: { task: 'questionnaire', mode: mode }
  };

  const results = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const allData = jsPsych.data.get().values();
      const newPaired = pairTrialsWithConfidence(allData);
      const allPaired = [...resumedTrials, ...newPaired];
      const correct = allPaired.filter(tr => tr.correct).length;
      const total = allPaired.length;
      const accuracy = total > 0 ? correct / total : 0;
      const bins = computeCalibration(allPaired);
      const brier = brierScore(allPaired);
      const auc = aurocType2WithCI(allPaired, 300);
      const meta = metaDPrimeWithCI(allPaired, 300);
      const diagnostic = calibrationDiagnostic(bins);
      const curve = calibrationCurveSVG(bins);
      const verdict = globalCalibrationVerdict(bins);
      const verdictMsg = t('verdict' + verdict.charAt(0).toUpperCase() + verdict.slice(1));
      const someMetricNull = (meta === null) || (meta && (meta.mRatio_ci_lo === null || meta.metaD === 0)) || (auc === null) || (auc && auc.point === null);

      const preData = jsPsych.data.get().filter({task: 'global_pre'}).values()[0];
      const postData = jsPsych.data.get().filter({task: 'global_post'}).values()[0];
      const predPre = preData && preData.response ? parseInt(preData.response.prediction) : null;
      const predPost = postData && postData.response ? parseInt(postData.response.prediction) : null;

      saveSession({
        mode: mode,
        n_trials: total,
        accuracy: accuracy,
        brier: brier,
        auroc2: auc.point,
        auroc2_ci_lo: auc.ci_lo,
        auroc2_ci_hi: auc.ci_hi,
        dprime: meta ? meta.dPrime : null,
        metaD: meta ? meta.metaD : null,
        mRatio: meta ? meta.mRatio : null,
        mRatio_ci_lo: meta ? meta.mRatio_ci_lo : null,
        mRatio_ci_hi: meta ? meta.mRatio_ci_hi : null,
        staircase_final: staircase.level,
        global_pre: predPre,
        global_post: predPost
      });

      let globalBlock = '';
      if (predPre !== null && predPost !== null) {
        const biasPost = predPost - correct;
        const updating = Math.abs(predPost - predPre);
        const biasMsg = biasPost > 1 ? t('globalBiasOver', {n: biasPost}) :
                        biasPost < -1 ? t('globalBiasUnder', {n: -biasPost}) :
                        t('globalBiasNone');
        const updateMsg = updating > 1 ? t('globalUpdating', {n: updating}) : t('globalNoUpdating');
        globalBlock = `
          <div style="background:white;color:#222;padding:16px 20px;border-radius:8px;margin-top:14px;text-align:left;max-width:520px;margin-left:auto;margin-right:auto">
            <b>${t('globalResultsTitle')}</b>
            <p style="margin:6px 0;font-size:14px">${t('globalPredictedPre')} <b>${predPre} / ${total}</b></p>
            <p style="margin:6px 0;font-size:14px">${t('globalPredictedPost')} <b>${predPost} / ${total}</b></p>
            <p style="margin:6px 0;font-size:14px">${t('globalActual')} <b>${correct} / ${total}</b></p>
            <p style="margin:10px 0 0 0;font-size:13px;color:#555;line-height:1.5">${biasMsg}<br>${updateMsg}</p>
          </div>
        `;
      }

      const verdictBlock = `<div style="background:#fff8dc;color:#333;padding:18px 20px;border-radius:10px;margin:0 auto 22px auto;text-align:left;max-width:560px;border:2px solid #d4b840;line-height:1.55">
           <p style="margin:0 0 8px 0;font-size:15px;color:#888;text-transform:uppercase;letter-spacing:0.05em"><b>${t('verdictTitle')}</b></p>
           <p style="margin:0;font-size:15px">${verdictMsg}</p>
         </div>`;

      const tipsBlock = `<div style="background:#f4f4f4;color:#333;padding:14px;border-radius:6px;margin-top:14px;text-align:left;max-width:560px;margin-left:auto;margin-right:auto;font-size:13px">
           <b>${t('diagnosticTitle')}</b><br>${diagnostic.map(m => '• ' + m).join('<br>')}
         </div>`;

      const ciWide = meta && isFinite(meta.mRatio_ci_lo) && isFinite(meta.mRatio_ci_hi)
        && (meta.mRatio_ci_hi - meta.mRatio_ci_lo) > 1.0;

      let nextStepMsg = '';
      if (someMetricNull) {
        nextStepMsg = t('nextStepIncomplete');
      } else if (ciWide) {
        nextStepMsg = t('nextStepWideCI');
      }

      const extensionBlock = (someMetricNull && !haveExtended)
        ? `<div style="background:#eef6ff;border:1px solid #4a8;color:#222;padding:14px 16px;border-radius:8px;margin:18px auto 0 auto;max-width:560px;font-size:14px;line-height:1.5">${t('extendOffer')}</div>`
        : '';

      const nextStepBlock = nextStepMsg
        ? `<div style="background:#eef6ff;border:1px solid #4a8;color:#222;padding:16px 18px;border-radius:8px;margin:18px auto 0 auto;max-width:560px;font-size:14px;line-height:1.55;text-align:center">
             <p style="margin:0 0 12px 0">${nextStepMsg}</p>
             <button id="rerun-btn" style="padding:9px 22px;font-size:14px;background:#2a8;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:500">${t('btnRerunSession')}</button>
           </div>`
        : '';

      const contactBlock = `<div style="margin:24px auto 0 auto;max-width:560px">
           <div style="background:white;color:#222;padding:16px 18px;border-radius:8px">
             <p style="margin:0 0 10px 0;font-size:14px;font-weight:600">${t('feedbackTitle')}</p>
             <textarea id="results-fb-msg" placeholder="${t('feedbackPlaceholder')}" style="width:100%;min-height:80px;padding:8px 10px;font-size:14px;font-family:inherit;border:1px solid #bbb;border-radius:4px;box-sizing:border-box;resize:vertical"></textarea>
             <input type="email" id="results-fb-email" placeholder="${t('feedbackEmailPlaceholder')}" style="width:100%;padding:8px 10px;font-size:14px;border:1px solid #bbb;border-radius:4px;box-sizing:border-box;margin-top:8px">
             <p style="font-size:12px;color:#777;margin:4px 0 10px 0;line-height:1.4">${t('feedbackEmailNote')}</p>
             <button id="results-fb-send" style="padding:9px 18px;font-size:14px;background:#2a8;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:500">${t('btnSendFeedback')}</button>
             <div id="results-fb-status" style="margin-top:8px;font-size:13px;min-height:18px"></div>
           </div>
           <p style="margin:14px auto 0 auto;max-width:520px;font-size:12px;color:#bbb;font-style:italic;text-align:center">${t('ethicsInProgress')}</p>
         </div>`;

      return `
        <h2 style="color:white">${t('resultsTitle')}</h2>
        ${verdictBlock}
        <div style="display:flex;gap:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
          <div style="background:white;color:#222;padding:18px;border-radius:8px;min-width:280px;max-width:380px;text-align:left">
            <p style="margin:4px 0"><b>${t('accuracy')}</b> ${(accuracy*100).toFixed(0)}% (${correct}/${total})</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('accuracyExplain')}</p>

            <p style="margin:4px 0"><b>${t('dprime')}</b> ${meta ? meta.dPrime.toFixed(2) : t('notComputable')}</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('dprimeExplain')}</p>

            <p style="margin:4px 0"><b>${t('metad')}</b> ${meta ? meta.metaD.toFixed(2) : t('notComputable')}</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('metadExplain')}</p>

            <p style="margin:4px 0"><b>${t('mratio')}</b> ${meta ? meta.mRatio.toFixed(2) : t('notComputable')}${meta && meta.mRatio_ci_lo !== null ? ` <span style="font-size:13px;color:#555">(95% CI: ${meta.mRatio_ci_lo.toFixed(2)}-${meta.mRatio_ci_hi.toFixed(2)})</span>` : ''}</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('mratioExplain')}</p>

            <p style="margin:4px 0"><b>${t('auroc2')}</b> ${auc.point !== null ? auc.point.toFixed(3) : t('notComputable')}${auc.ci_lo !== null ? ` <span style="font-size:13px;color:#555">(95% CI: ${auc.ci_lo.toFixed(3)}-${auc.ci_hi.toFixed(3)})</span>` : ''}</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('auroc2Explain')}</p>

            <p style="margin:4px 0"><b>${t('brier')}</b> ${brier !== null ? brier.toFixed(3) : t('notComputable')}</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('brierExplain')}</p>

            <p style="margin:4px 0"><b>${t('difficultyFinal')}</b> ${staircase.level.toFixed(1)}${t('coherenceUnit')}</p>
            <p style="margin:0;font-size:12px;color:#666;line-height:1.4">${t('coherenceExplain')}</p>
          </div>
          <div>${curve}</div>
        </div>
        ${globalBlock}
        ${tipsBlock}
        ${extensionBlock}
        ${nextStepBlock}
        ${contactBlock}
        <p style="font-size:12px;color:#ccc;margin-top:20px">${t('finalDisclaimer')}</p>
      `;
    },
    choices: function() {
      if (someMetricNullCache && !haveExtended) {
        return [t('btnFinishNoExtend'), t('btnExtend30')];
      }
      return [t('btnFinish')];
    },
    on_load: function() {
      const rerunBtn = document.getElementById('rerun-btn');
      if (rerunBtn) {
        rerunBtn.addEventListener('click', () => {
          clearPartialSession(sessionId);
          window.location.reload();
        });
      }

      const sendBtn = document.getElementById('results-fb-send');
      if (!sendBtn) return;
      sendBtn.addEventListener('click', async () => {
        const msgEl = document.getElementById('results-fb-msg');
        const emailEl = document.getElementById('results-fb-email');
        const statusEl = document.getElementById('results-fb-status');
        const message = (msgEl.value || '').trim();
        const email = (emailEl.value || '').trim();
        if (!message) {
          statusEl.style.color = '#c33';
          statusEl.textContent = t('feedbackEmpty');
          return;
        }
        sendBtn.disabled = true;
        statusEl.style.color = '#555';
        statusEl.style.fontStyle = 'italic';
        statusEl.textContent = t('feedbackSending');
        const result = await sendFeedback(message, email, getUserCode());
        if (result && result.status === 'ok') {
          statusEl.style.color = '#197';
          statusEl.style.fontStyle = 'normal';
          statusEl.textContent = t('feedbackSent');
          msgEl.value = '';
          emailEl.value = '';
        } else {
          statusEl.style.color = '#c33';
          statusEl.style.fontStyle = 'normal';
          statusEl.textContent = t('feedbackError');
        }
        sendBtn.disabled = false;
      });
    },
    on_finish: function(data) {
      if (someMetricNullCache && !haveExtended && data.response === 1) {
        wantExtension = true;
      } else {
        sendToSheet(jsPsych.data.get().values(), getUserCode(), sessionId, sessionNumber);
        clearPartialSession(sessionId);
      }
    }
  };

  const earlySend = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '',
    choices: 'NO_KEYS',
    trial_duration: 1,
    on_finish: function() {
      if (!earlySent) {
        earlySent = true;
        sendToSheet(jsPsych.data.get().values(), getUserCode(), sessionId, sessionNumber);
      }
    }
  };

  let someMetricNullCache = false;
  const recomputeMetricsCache = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '',
    choices: 'NO_KEYS',
    trial_duration: 1,
    on_finish: function() {
      const allData = jsPsych.data.get().values();
      const newPaired = pairTrialsWithConfidence(allData);
      const allPaired = [...resumedTrials, ...newPaired];
      const meta = metaDPrimeWithCI(allPaired, 100);
      const auc = aurocType2WithCI(allPaired, 100);
      someMetricNullCache = (meta === null) || (meta && (meta.mRatio_ci_lo === null || meta.metaD === 0)) || (auc === null) || (auc && auc.point === null);
    }
  };

  const extensionTrialBlock = {
    timeline: [stim, confidence],
    repetitions: 30,
    conditional_function: function() {
      if (wantExtension && !haveExtended) {
        haveExtended = true;
        wantExtension = false;
        return true;
      }
      return false;
    }
  };

  const extensionResults = {
    ...results,
    conditional_function: function() {
      return haveExtended;
    }
  };

  const timeline = [welcome];
  if (!resumeData) timeline.push(globalPre);
  timeline.push(trialBlock);
  if (!resumeData) timeline.push(globalPost);
  timeline.push(finalQuestions, earlySend, recomputeMetricsCache, results, extensionTrialBlock, extensionResults);
  jsPsych.run(timeline);
}
