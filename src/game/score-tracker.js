import { MAX_STRIKES, MAX_BALLS, MAX_OUTS, MAX_INNINGS } from '../constants.js';

/**
 * ScoreTracker — 完整棒球規則（9局制）
 * bases[0]=一壘, bases[1]=二壘, bases[2]=三壘
 */
export class ScoreTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.balls = 0;
    this.strikes = 0;
    this.outs = 0;
    this.bases = [false, false, false];

    this.score = 0;        // 本局得分（換局後歸零）
    this.totalScore = 0;   // 累計得分
    this.inning = 1;
    this.hits = 0;
    this.homeRuns = 0;
    this.singles = 0;
    this.doubles = 0;
    this.triples = 0;
    this.totalOuts = 0;
    this.fouls = 0;
    this.bestDistance = 0;
    this.totalPitches = 0;
    this.walks = 0;
    this.hbp = 0;          // 觸身球次數
    this.gameOver = false;
  }

  // ── 打席計數 ──────────────────────────────────────────────────

  addCalledStrike() {
    this.strikes++;
    return this._checkStrikeout();
  }

  addSwingingStrike() {
    this.strikes++;
    return this._checkStrikeout();
  }

  addFoul() {
    this.fouls++;
    if (this.strikes < 2) this.strikes++;
  }

  addBall() {
    this.balls++;
    if (this.balls >= MAX_BALLS) return this._walk();
    return null;
  }

  /** 觸身球 — 直接上一壘，打席計數清除 */
  addHBP() {
    this.hbp++;
    const scored = this._advanceBases_walk();
    this._resetCount();
    return { event: 'HBP', scored };
  }

  _checkStrikeout() {
    if (this.strikes >= MAX_STRIKES) return this._recordOut('STRIKEOUT');
    return null;
  }

  // ── 出局 ──────────────────────────────────────────────────────

  _recordOut(type) {
    this.outs++;
    this.totalOuts++;
    this._resetCount();
    if (this.outs >= MAX_OUTS) return this._endInning();
    return { event: 'OUT', type };
  }

  _endInning() {
    const runsThisInning = this.score;
    this.totalScore += this.score;
    this.score = 0;
    this.inning++;
    this.outs = 0;
    this.bases = [false, false, false];
    this._resetCount();

    // 9局結束 → 遊戲結束
    if (this.inning > MAX_INNINGS) {
      this.gameOver = true;
      return { event: 'GAME_OVER', runs: runsThisInning };
    }

    return { event: 'INNING_OVER', runs: runsThisInning };
  }

  // ── 保送 ──────────────────────────────────────────────────────

  _walk() {
    this.walks++;
    const scored = this._advanceBases_walk();
    this._resetCount();
    return { event: 'WALK', scored };
  }

  _advanceBases_walk() {
    let scored = 0;
    if (this.bases[0] && this.bases[1] && this.bases[2]) {
      scored = 1;
      this.score += 1;
    }
    if (this.bases[1] && this.bases[0]) this.bases[2] = true;
    if (this.bases[0]) this.bases[1] = true;
    this.bases[0] = true;
    return scored;
  }

  // ── 打擊結果 ──────────────────────────────────────────────────

  addResult(outcome) {
    if (outcome.distanceFt && outcome.distanceFt > this.bestDistance) {
      this.bestDistance = outcome.distanceFt;
    }

    switch (outcome.type) {
      case 'HOME_RUN': return this._homeRun();
      case 'TRIPLE':   return this._hit(3);
      case 'DOUBLE':   return this._hit(2);
      case 'SINGLE':   return this._hit(1);
      case 'OUT':      return this._hitOut(outcome);
      case 'FOUL':     return { event: 'FOUL', scored: 0 };
      default:         return { event: 'NONE', scored: 0 };
    }
  }

  _homeRun() {
    this.hits++;
    this.homeRuns++;
    const runners = this.bases.filter(Boolean).length;
    const scored = runners + 1;
    this.score += scored;
    this.bases = [false, false, false];
    this._resetCount();
    return { event: 'HIT', type: 'HOME_RUN', scored };
  }

  _hit(bases) {
    this.hits++;
    if (bases === 1) this.singles++;
    if (bases === 2) this.doubles++;
    if (bases === 3) this.triples++;
    const scored = this._advanceBases_hit(bases);
    this._resetCount();
    return { event: 'HIT', type: ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][bases], scored };
  }

  _advanceBases_hit(advanceBy) {
    let scored = 0;
    const newBases = [false, false, false];
    for (let i = 2; i >= 0; i--) {
      if (this.bases[i]) {
        const newPos = i + advanceBy;
        if (newPos >= 3) { scored++; this.score++; }
        else newBases[newPos] = true;
      }
    }
    const batterPos = advanceBy - 1;
    if (batterPos >= 3) { scored++; this.score++; }
    else newBases[batterPos] = true;
    this.bases = newBases;
    return scored;
  }

  _hitOut(outcome) {
    return this._recordOut(outcome.label?.includes('滾地') ? 'GROUNDOUT' : 'FLYOUT');
  }

  _resetCount() {
    this.balls = 0;
    this.strikes = 0;
  }

  isGameOver() {
    return this.gameOver;
  }
}
