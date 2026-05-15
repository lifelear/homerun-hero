import { MAX_STRIKES, MAX_BALLS, MAX_OUTS } from '../constants.js';

/**
 * ScoreTracker — 完整棒球規則狀態
 *
 * 壘包: bases[0]=一壘, bases[1]=二壘, bases[2]=三壘  (true = 有人)
 * 計分邏輯: 打擊結果推進壘包，回本壘得分
 */
export class ScoreTracker {
  constructor() {
    this.reset();
  }

  reset() {
    // 當前打席計數
    this.balls = 0;
    this.strikes = 0;
    this.outs = 0;

    // 壘包 [1B, 2B, 3B]
    this.bases = [false, false, false];

    // 統計
    this.score = 0;          // 本局得分
    this.totalScore = 0;     // 累計得分
    this.inning = 1;
    this.hits = 0;
    this.homeRuns = 0;
    this.singles = 0;
    this.doubles = 0;
    this.triples = 0;
    this.totalOuts = 0;      // 全場累計出局
    this.fouls = 0;
    this.bestDistance = 0;
    this.totalPitches = 0;
    this.walks = 0;
  }

  // ── 打席計數 ──────────────────────────────────────────────────

  /** 投好球（球未揮棒過好球帶）*/
  addCalledStrike() {
    this.strikes++;
    return this._checkStrikeout();
  }

  /** 揮棒落空 */
  addSwingingStrike() {
    this.strikes++;
    return this._checkStrikeout();
  }

  /** 界外球（兩好球以後界外不算三振）*/
  addFoul() {
    this.fouls++;
    if (this.strikes < 2) this.strikes++;
    // 界外不三振，strikes 最多累積到 2
  }

  /** 投壞球 */
  addBall() {
    this.balls++;
    if (this.balls >= MAX_BALLS) {
      return this._walk();
    }
    return null;
  }

  _checkStrikeout() {
    if (this.strikes >= MAX_STRIKES) {
      return this._recordOut('STRIKEOUT');
    }
    return null;
  }

  // ── 出局 ──────────────────────────────────────────────────────

  _recordOut(type) {
    this.outs++;
    this.totalOuts++;
    this._resetCount();
    if (this.outs >= MAX_OUTS) {
      return this._endInning();
    }
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
    return { event: 'INNING_OVER', runs: runsThisInning };
  }

  // ── 保送 ──────────────────────────────────────────────────────

  _walk() {
    this.walks++;
    // 壘包推進（只推有人的壘）
    const scored = this._advanceBases_walk();
    this._resetCount();
    return { event: 'WALK', scored };
  }

  /** 保送推壘：只有連續滿壘時才強迫得分 */
  _advanceBases_walk() {
    let scored = 0;
    if (this.bases[0] && this.bases[1] && this.bases[2]) {
      // 滿壘保送 → 三壘跑者回來得分
      scored = 1;
      this.score += 1;
    }
    // 推進壘包（從三壘往回推）
    if (this.bases[1] && this.bases[0]) this.bases[2] = true;
    if (this.bases[0]) this.bases[1] = true;
    this.bases[0] = true; // 打者上一壘
    return scored;
  }

  // ── 打擊結果 ──────────────────────────────────────────────────

  /**
   * 處理打擊結果，推進壘包，回傳得分數
   * @param {Object} outcome  determineOutcome() 的回傳值
   * @returns {{ event, scored, gameEvent }} 
   */
  addResult(outcome) {
    if (outcome.distanceFt && outcome.distanceFt > this.bestDistance) {
      this.bestDistance = outcome.distanceFt;
    }

    switch (outcome.type) {
      case 'HOME_RUN':
        return this._homeRun();
      case 'TRIPLE':
        return this._hit(3);
      case 'DOUBLE':
        return this._hit(2);
      case 'SINGLE':
        return this._hit(1);
      case 'OUT':
        return this._hitOut(outcome);
      case 'FOUL':
        // 界外球不結束打席，由 addFoul() 處理計數
        return { event: 'FOUL', scored: 0 };
      default:
        return { event: 'NONE', scored: 0 };
    }
  }

  _homeRun() {
    this.hits++;
    this.homeRuns++;
    // 全壘打：打者 + 所有壘上跑者都得分
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

    // 推進壘包
    const scored = this._advanceBases_hit(bases);
    this._resetCount();
    return { event: 'HIT', type: ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][bases], scored };
  }

  /**
   * 簡化壘包推進：每個跑者推進 `bases` 個壘
   * 超過三壘（本壘）就得分
   */
  _advanceBases_hit(advanceBy) {
    let scored = 0;
    // 從三壘往一壘處理（避免重複計算）
    const newBases = [false, false, false];

    for (let i = 2; i >= 0; i--) {
      if (this.bases[i]) {
        const newPos = i + advanceBy; // 0-indexed, 新位置
        if (newPos >= 3) {
          scored++;
          this.score++;
        } else {
          newBases[newPos] = true;
        }
      }
    }

    // 打者上壘
    const batterPos = advanceBy - 1;
    if (batterPos >= 3) {
      scored++;
      this.score++;
    } else {
      newBases[batterPos] = true;
    }

    this.bases = newBases;
    return scored;
  }

  _hitOut(outcome) {
    // 飛球出局：跑者可以得點（簡化：不實作犧牲飛球）
    // 滾地出局、飛球出局都直接 out
    return this._recordOut(outcome.label?.includes('Ground') ? 'GROUNDOUT' : 'FLYOUT');
  }

  // ── 輔助 ──────────────────────────────────────────────────────

  _resetCount() {
    this.balls = 0;
    this.strikes = 0;
  }

  isGameOver() {
    // 生存模式：永不結束（只要沒有外部條件）
    // 可以由外部根據 inning 或 totalOuts 決定
    return false;
  }

  /** 壘包字串，用於 HUD 顯示 */
  basesString() {
    return [
      this.bases[2] ? '3' : '-',
      this.bases[1] ? '2' : '-',
      this.bases[0] ? '1' : '-',
    ].join('');
  }
}
