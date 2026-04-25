function runExperiment(mode) {
  const jsPsych = initJsPsych({});

  const N_TRIALS = mode === 'evaluate' ? 50 : 30;

  const staircase = new StaircaseTwoDownOneUp({
    startLevel: 15,
    minLevel: 0.5,
    maxLevel: 30,
    stepSizes: [4, 2, 1]
  });

  let currentTrial = {};

  const modeTitle = mode === 'evaluate' ? 'Évaluation' : 'Entraînement';
  const modeIntro = mode === 'evaluate'
    ? `<p>${N_TRIALS} essais. Pas de feedback pendant la tâche.</p>`
    : `<p>${N_TRIALS} essais. Tu verras ta calibration à la fin.</p>`;

  const welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <h2>${modeTitle}</h2>
      ${modeIntro}
      <p>Tu vois un Gabor (tache rayée floue). Touche <b>"Gauche"</b> s'il penche à gauche, <b>"Droite"</b> s'il penche à droite.</p>
      <p>Puis indique ta <b>confiance</b> (4 niveaux).</p>
    `,
    choices: ['Commencer']
  };

  const stim = {
    type: jsPsychCanvasButtonResponse,
    canvas_size: [300, 300],
    on_start: function() {
      const sign = Math.random() < 0.5 ? -1 : 1;
      currentTrial = {
        orientation: sign * staircase.level,
        correct_response: sign > 0 ? 1 : 0,
        staircase_level: staircase.level
      };
    },
    stimulus: function(c) {
      drawGabor(c, { orientation: currentTrial.orientation });
    },
    choices: ['Gauche', 'Droite'],
    data: function() {
      return {
        task: 'gabor_2afc',
        mode: mode,
        orientation: currentTrial.orientation,
        correct_response: currentTrial.correct_response,
        staircase_level: currentTrial.staircase_level
      };
    },
    on_finish: function(data) {
      data.correct = (data.response === data.correct_response);
      staircase.update(data.correct);
    }
  };

  const confidence = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:20px;color:white">Confiance ?</p>',
    choices: ['Je devine', 'Peu sûr', 'Assez sûr', 'Très sûr'],
    data: { task: 'confidence', mode: mode },
    on_finish: function(data) {
      data.confidence = data.response + 1;
    }
  };

  const trialBlock = {
    timeline: [stim, confidence],
    repetitions: N_TRIALS
  };

  const finalQuestions = {
    type: jsPsychSurveyHtmlForm,
    preamble: '<h2 style="color:white">Quelques questions rapides</h2><p style="color:white">Tout est anonyme.</p>',
    html: `
      <div style="background:white;color:#222;padding:24px;border-radius:8px;text-align:left;max-width:500px;margin:0 auto;">
        <p><b>Combien d'heures as-tu dormi cette nuit ?</b></p>
        <input type="number" name="sleep_hours" min="0" max="14" step="0.5" required style="width:80px;padding:6px;font-size:15px"> heures

        <p style="margin-top:20px"><b>À quelle fréquence fais-tu des rêves lucides</b> (où tu sais que tu rêves) ?</p>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="never" required> Jamais</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="rare"> Moins d'une fois par mois</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="monthly"> Environ 1x par mois</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="weekly"> Environ 1x par semaine</label>
        <label style="display:block;padding:5px 0"><input type="radio" name="ld_freq" value="multi"> Plusieurs fois par semaine</label>

        <p style="margin-top:20px"><b>Âge</b> (optionnel) :</p>
        <input type="number" name="age" min="10" max="100" style="width:80px;padding:6px;font-size:15px">
      </div>
    `,
    button_label: 'Voir mes résultats',
    data: { task: 'questionnaire', mode: mode }
  };

  const results = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const allData = jsPsych.data.get().values();
      const paired = pairTrialsWithConfidence(allData);
      const correct = paired.filter(t => t.correct).length;
      const total = paired.length;
      const accuracy = total > 0 ? correct / total : 0;
      const bins = computeCalibration(paired);
      const brier = brierScore(paired);
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
             <b>Diagnostic :</b><br>${diagnostic.map(m => '• ' + m).join('<br>')}
           </div>`
        : '';

      return `
        <h2 style="color:white">Tes résultats</h2>
        <div style="display:flex;gap:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
          <div style="background:white;color:#222;padding:18px;border-radius:8px;min-width:200px;text-align:left">
            <p style="margin:4px 0"><b>Accuracy :</b> ${(accuracy*100).toFixed(0)}% (${correct}/${total})</p>
            <p style="margin:4px 0"><b>Brier score :</b> ${brier !== null ? brier.toFixed(3) : 'n/a'}</p>
            <p style="margin:4px 0;font-size:12px;color:#666">Plus bas = mieux calibré (0 = parfait)</p>
            <p style="margin:4px 0"><b>Difficulté finale :</b> ${staircase.level.toFixed(1)}°</p>
          </div>
          <div>${curve}</div>
        </div>
        ${tipsBlock}
        <p style="font-size:12px;color:#ccc;margin-top:20px">Outil expérimental, à but pédagogique.</p>
      `;
    },
    choices: ['Terminer'],
    on_finish: function() {
      sendToSheet(jsPsych.data.get().values());
    }
  };

  const timeline = [welcome, trialBlock, finalQuestions, results];
  jsPsych.run(timeline);
}
