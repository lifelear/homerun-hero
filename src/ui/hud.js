import { MAX_STRIKES, MAX_BALLS, MAX_OUTS, MS_TO_MPH } from '../constants.js';

export class HUD {
  constructor() {
    this._pitchInfoEl = document.getElementById('pitch-info');
    this._pitchInfoTimer = null;
    this._initDots();
  }

  _initDots() {
    // 出局點（紅）
    this._buildDots('hud-outs', MAX_OUTS, 'out-dot');
    // 好球點（黃）
    this._buildDots('hud-strikes', MAX_STRIKES, 'strike-dot');
    // 壞球點（綠）
    this._buildDots('hud-balls', MAX_BALLS, 'ball-dot');
  }

  _buildDots(containerId, count, cls) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div');
      d.className = `count-dot ${cls}`;
      el.appendChild(d);
    }
  }

  update(score) {
    this._setText('hud-inning', score.inning);
    this._setText('hud-score', (score.totalScore || 0) + (score.score || 0));
    this._updateDots('hud-outs', score.outs, MAX_OUTS);
    this._updateDots('hud-strikes', score.strikes, MAX_STRIKES);
    this._updateDots('hud-balls', score.balls, MAX_BALLS);
    this._setText('hud-hits', `安打: ${score.hits}`);
    this._setText('hud-hr', `全壘打: ${score.homeRuns}`);
    this._setText('hud-best', `最遠: ${Math.round(score.bestDistance)} ft`);
    this._updateBase('base-1', score.bases[0]);
    this._updateBase('base-2', score.bases[1]);
    this._updateBase('base-3', score.bases[2]);
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _updateDots(containerId, active, max) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('.count-dot').forEach((d, i) => {
      d.classList.toggle('active', i < active);
    });
  }

  _updateBase(id, occupied) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('occupied', !!occupied);
  }

  showPitchInfo(pitch) {
    this._pitchInfoEl.textContent = `${pitch.name}  ${Math.round(pitch.speedMph)} mph`;
    this._pitchInfoEl.classList.add('visible');
    clearTimeout(this._pitchInfoTimer);
    this._pitchInfoTimer = setTimeout(() => {
      this._pitchInfoEl.classList.remove('visible');
    }, 1500);
  }

  showResultOverlay(outcome, exitSpeed, launchAngle, distanceFt) {
    const typeEl = document.getElementById('result-type');
    const statsEl = document.getElementById('result-stats');
    const overlay = document.getElementById('result-overlay');
    if (!typeEl || !overlay) return;

    typeEl.textContent = outcome.label;
    typeEl.className = '';

    switch (outcome.type) {
      case 'HOME_RUN': typeEl.classList.add('home-run'); break;
      case 'SINGLE':
      case 'DOUBLE':
      case 'TRIPLE':   typeEl.classList.add('hit'); break;
      case 'OUT':      typeEl.classList.add('out'); break;
      case 'FOUL':     typeEl.classList.add('foul'); break;
      default:         typeEl.classList.add('strike'); break;
    }

    const exitMph = Math.round(exitSpeed * MS_TO_MPH);
    statsEl.innerHTML = `Exit Velo: ${exitMph} mph<br>Launch Angle: ${Math.round(launchAngle)}&deg;<br>Distance: ${Math.round(distanceFt)} ft`;
    overlay.classList.remove('hidden');
  }

  hideResultOverlay() {
    const overlay = document.getElementById('result-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  showEventFlash(label, className = 'strike') {
    const typeEl = document.getElementById('result-type');
    const statsEl = document.getElementById('result-stats');
    const overlay = document.getElementById('result-overlay');
    if (!typeEl || !overlay) return;

    typeEl.textContent = label;
    typeEl.className = className;
    statsEl.innerHTML = '';
    overlay.classList.remove('hidden');
  }

  /** 舊介面相容 */
  showStrikeFlash(label) {
    this.showEventFlash(label, 'strike');
  }
}
