class StaircaseTwoDownOneUp {
  constructor(opts) {
    opts = opts || {};
    this.level = opts.startLevel ?? 15;
    this.minLevel = opts.minLevel ?? 0.5;
    this.maxLevel = opts.maxLevel ?? 30;
    this.stepSizes = opts.stepSizes ?? [4, 2, 1];
    this.reversalCount = 0;
    this.lastDirection = null;
    this.consecutiveCorrect = 0;
    this.history = [];
  }

  currentStep() {
    const idx = Math.min(this.reversalCount, this.stepSizes.length - 1);
    return this.stepSizes[idx];
  }

  update(correct) {
    this.history.push({ level: this.level, correct });

    if (correct) {
      this.consecutiveCorrect++;
      if (this.consecutiveCorrect >= 2) {
        this.consecutiveCorrect = 0;
        if (this.lastDirection === 'up') this.reversalCount++;
        this.level = Math.max(this.minLevel, this.level - this.currentStep());
        this.lastDirection = 'down';
      }
    } else {
      this.consecutiveCorrect = 0;
      if (this.lastDirection === 'down') this.reversalCount++;
      this.level = Math.min(this.maxLevel, this.level + this.currentStep());
      this.lastDirection = 'up';
    }
    return this.level;
  }
}
