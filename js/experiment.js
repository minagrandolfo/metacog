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
  const resumedTrials = resumeData ? resumeData.trials : [];
  const remainingTrials = TOTAL_TRIALS - resumedTrials.length;

  const staircase = new StaircaseTwoDownOneUp({
    startLevel: resumeData ? resumeData.staircase_state.level : 30,
    minLevel: 1,
    maxLevel: 100,
    stepSizes: [10, 5, 2, 1]
  });
  if (resumeData && resumeData.staircase_state) {
    staircase.consecutiveCorrect = resumeData.staircase_state.consecutiveCorrect || 0;
    staircase.lastDirection = resumeData.staircase_state.lastDirection || null;
    staircase.reversalCount = resumeData.staircase_state.reversalCount || 0;
  }

  let currentTrial = {};
  let lastStimData = null;

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
        savePartialTrial(sessionId, mode, trialRecord, state, TOTAL_TRIALS);
      }
    }
  };

  const trialBlock = {
    timeline: [stim, confidence],
    repetitions: remainingTrials
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
      const diagnostic = calibrationDiagnostic(bins);
      const curve = calibrationCurveSVG(bins);

      saveSession({
        mode: mode,
        n_trials: total,
        accuracy: accuracy,
        brier: brier,
        staircase_final: staircase.level
      });

      const tipsBlock = mode === 'train'
        ? `<div style="background:#fff8dc;color:#333;padding:14px;border-radius:6px;margin-top:14px;text-align:left;max-width:520px;margin-left:auto;margin-right:auto">
             <b>${t('diagnosticTitle')}</b><br>${diagnostic.map(m => '• ' + m).join('<br>')}
           </div>`
        : '';

      return `
        <h2 style="color:white">${t('resultsTitle')}</h2>
        <div style="display:flex;gap:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
          <div style="background:white;color:#222;padding:18px;border-radius:8px;min-width:240px;max-width:320px;text-align:left">
            <p style="margin:4px 0"><b>${t('accuracy')}</b> ${(accuracy*100).toFixed(0)}% (${correct}/${total})</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('accuracyExplain')}</p>

            <p style="margin:4px 0"><b>${t('brier')}</b> ${brier !== null ? brier.toFixed(3) : 'n/a'}</p>
            <p style="margin:0 0 14px 0;font-size:12px;color:#666;line-height:1.4">${t('brierExplain')}</p>

            <p style="margin:4px 0"><b>${t('difficultyFinal')}</b> ${staircase.level.toFixed(1)}${t('coherenceUnit')}</p>
            <p style="margin:0;font-size:12px;color:#666;line-height:1.4">${t('coherenceExplain')}</p>
          </div>
          <div>${curve}</div>
        </div>
        ${tipsBlock}
        <p style="font-size:12px;color:#ccc;margin-top:20px">${t('finalDisclaimer')}</p>
      `;
    },
    choices: [t('btnFinish')],
    on_finish: function() {
      sendToSheet(jsPsych.data.get().values());
      clearPartialSession(sessionId);
    }
  };

  const timeline = [welcome, trialBlock, finalQuestions, results];
  jsPsych.run(timeline);
}
