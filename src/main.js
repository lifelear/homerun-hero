import * as THREE from 'three';
import { GameScene } from './scene/game-scene.js';
import { Stadium } from './scene/stadium.js';
import { BallVisual } from './scene/ball-visual.js';
import { Pitcher } from './scene/pitcher.js';
import { Batter } from './scene/batter.js';
import { StrikeZoneVisual } from './scene/strike-zone.js';
import { PitchTrajectory } from './physics/pitch-trajectory.js';
import { BallFlight } from './physics/ball-flight.js';
import { selectPitch, setDifficulty, getDifficultyLabel, rollKnuckleballer } from './physics/pitch-types.js';
import { evaluateSwing } from './physics/hit-physics.js';
import { determineOutcome } from './physics/outcome.js';
import { GameLoop } from './game/game-loop.js';
import { GameState, State } from './game/game-state.js';
import { ScoreTracker } from './game/score-tracker.js';
import { InputManager } from './input/input-manager.js';
import { HUD } from './ui/hud.js';
import { PitchTracker } from './ui/pitch-tracker.js';
import { M_TO_FT, MS_TO_MPH, STRIKE_ZONE } from './constants.js';
import { Crowd } from './scene/crowd.js';

// --- Init ---
const canvas = document.getElementById('game-canvas');
const gameScene = new GameScene(canvas);
const stadium = new Stadium(gameScene.scene);
const ballVisual = new BallVisual(gameScene.scene);
const pitcher = new Pitcher(gameScene.scene);
const batter = new Batter(gameScene.scene);
const strikeZone = new StrikeZoneVisual(gameScene.scene);
const pitchTraj = new PitchTrajectory();
const ballFlight = new BallFlight();
const gameState = new GameState();
const score = new ScoreTracker();
const input = new InputManager(canvas);
const hud = new HUD();
const pitchTracker = new PitchTracker();
const crowd = new Crowd(gameScene.scene);

// Pitch state
let currentPitch = null;
let recentPitchTypes = [];
let swingResult = null;
let currentOutcome = null;
let pitchFlightTime = 0;
let pitchTotalFlightTime = 0;
let lastMarkerX = 0;
let lastMarkerY = 0.75;
let swungAndMissed = false;
let didSwing = false;
let plateArrived = false;
let plateTimer = 0;
let plateFinalX = 0;
let plateFinalY = 0;
let hitBallClone = null;
let landedTimer = 0;

// 換局/事件暫停用
let pendingGameEvent = null;  // { event, label, className }

// UI elements
const titleScreen = document.getElementById('title-screen');
const gameOverScreen = document.getElementById('game-over');
const finalStatsEl = document.getElementById('final-stats');

function updateStats() {
  hud.update(score);
  stadium.updateScoreboard(score);
}

// --- Pause ---
const pauseScreen = document.getElementById('pause-screen');
let paused = false;

function togglePause() {
  if (gameState.current === State.TITLE || gameState.current === State.GAME_OVER) return;
  paused = !paused;
  if (paused) {
    loop.stop();
    pauseScreen.classList.remove('hidden');
  } else {
    pauseScreen.classList.add('hidden');
    loop.start();
  }
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  pauseScreen.classList.add('hidden');
  loop.start();
}

function restartGame() {
  paused = false;
  pauseScreen.classList.add('hidden');
  _cleanupBall();
  gameScene.resetCamera();
  hud.hideResultOverlay();
  strikeZone.hideBallMarker();
  strikeZone.hideClickMarker();
  pitchTraj.active = false;
  startGame();
  loop.start();
}

function goToMenu() {
  paused = false;
  pauseScreen.classList.add('hidden');
  _cleanupBall();
  gameScene.resetCamera();
  hud.hideResultOverlay();
  strikeZone.hideBallMarker();
  strikeZone.hideClickMarker();
  pitchTraj.active = false;
  pitchTracker.hide();
  titleScreen.classList.remove('hidden');
  gameState.transition(State.TITLE);
  loop.start();
}

function _cleanupBall() {
  if (hitBallClone) { hitBallClone.dispose(); hitBallClone = null; }
  ballVisual.hide();
  gameScene.stopTrackingBall();
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') togglePause();
});

// HUD pause button
document.getElementById('pause-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  togglePause();
});

document.getElementById('pause-resume').addEventListener('pointerdown', (e) => { e.stopPropagation(); resumeGame(); });
document.getElementById('pause-restart').addEventListener('pointerdown', (e) => { e.stopPropagation(); restartGame(); });
document.getElementById('pause-menu').addEventListener('pointerdown', (e) => { e.stopPropagation(); goToMenu(); });

document.getElementById('gameover-menu').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  gameOverScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  gameState.transition(State.TITLE);
});

// --- Difficulty selector ---
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    setDifficulty(btn.dataset.diff);
    const labelEl = document.getElementById('diff-label');
    if (labelEl) labelEl.textContent = btn.textContent;
  });
});

// --- Title screen ---
function startGame() {
  score.reset();
  recentPitchTypes = [];
  pendingGameEvent = null;
  updateStats();
  titleScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  pitchTracker.show();
  const isKB = rollKnuckleballer();
  pitcher.setCapColor(isKB ? 0xcc2222 : 0x1c2841);
  gameState.transition(State.WAITING);
}

/** Convert screen click NDC to world position on the strike zone plane (Z=0) */
function clickToStrikeZonePlane(clickNDC) {
  const ndc = new THREE.Vector3(clickNDC.x, clickNDC.y, 0.5);
  ndc.unproject(gameScene.camera);
  const dir = ndc.sub(gameScene.camera.position).normalize();
  const camPos = gameScene.camera.position;
  if (Math.abs(dir.z) < 0.001) return null;
  const t = -camPos.z / dir.z;
  if (t < 0) return null;
  return new THREE.Vector3(
    camPos.x + dir.x * t,
    camPos.y + dir.y * t,
    0
  );
}

// ── 棒球規則事件處理 ─────────────────────────────────────────────

/**
 * 處理 score-tracker 回傳的 gameEvent，更新 UI 並決定下一步
 * @returns {boolean} 是否觸發了「需要等待顯示」的事件
 */
function handleGameEvent(evt) {
  if (!evt) return false;

  switch (evt.event) {
    case 'OUT':
    case 'GROUNDOUT':
    case 'FLYOUT':
    case 'STRIKEOUT': {
      const label = evt.type === 'STRIKEOUT' ? '三振出局！' :
                    evt.type === 'GROUNDOUT' ? '滾地出局' : '飛球出局';
      updateStats();
      if (score.outs >= 3) {
        // 已換局（_endInning 在 _recordOut 裡呼叫）
        // 但 _recordOut 會先把 outs 設回 0，所以要看 INNING_OVER
      }
      hud.showEventFlash(label, 'out');
      return true;
    }
    case 'INNING_OVER': {
      updateStats();
      hud.showEventFlash(`第 ${score.inning - 1} 局結束！得 ${evt.runs} 分`, 'hit');
      return true;
    }
    case 'WALK': {
      updateStats();
      const walkMsg = evt.scored > 0
        ? `四壞保送！壘包推進，得 ${evt.scored} 分！`
        : '四壞保送！';
      hud.showEventFlash(walkMsg, 'hit');
      return true;
    }
    default:
      return false;
  }
}

// --- Physics tick ---
function physicsTick(dt) {
  gameState.tick(dt);
  pitcher.update(dt);
  batter.update(dt);

  const st = gameState.current;

  const swing = input.consumeSwing();
  if (swing) {
    if (st === State.TITLE || st === State.GAME_OVER) {
      startGame();
    } else {
      batter.swing();
      if (st === State.PITCHING) didSwing = true;

      const clickWorld = clickToStrikeZonePlane(swing);
      if (clickWorld) {
        pitchTracker.setClickPosition(clickWorld.x, clickWorld.y);
        strikeZone.showClickMarker(clickWorld.x, clickWorld.y);
      }

      if (st === State.PITCHING && pitchTraj.active && clickWorld && !swungAndMissed) {
        const result = evaluateSwing(
          { x: clickWorld.x, y: clickWorld.y },
          { x: lastMarkerX, y: lastMarkerY },
          pitchTraj.position.z,
          currentPitch.speedMs
        );

        if (result.isWhiff) {
          // 揮棒落空
          swungAndMissed = true;
          const evt = score.addSwingingStrike();
          updateStats();
          if (handleGameEvent(evt)) {
            // 三振出局或換局會在 RESULT 後處理
          } else {
            hud.showEventFlash('揮棒落空！', 'strike');
          }
        } else {
          // 打到球
          hud.showPitchInfo(currentPitch);
          swingResult = result;
          ballFlight.launch(
            pitchTraj.position.clone(),
            result.exitVelocity,
            result.spinVector
          );
          pitchTraj.active = false;
          pitchTracker.clearBall();
          strikeZone.hideBallMarker();
          strikeZone.hideClickMarker();
          currentOutcome = null;
          if (hitBallClone) hitBallClone.dispose();
          hitBallClone = ballVisual.spawnHitBall();
          ballVisual.hide();
          gameScene.startTrackingBall(hitBallClone.mesh);
          gameState.transition(State.BALL_IN_PLAY);
        }
      }
    }
  }

  // ── WAITING：準備下一球 ────────────────────────────────────────
  if (st === State.WAITING) {
    if (gameState.stateTime > 1.0) {
      currentPitch = selectPitch(recentPitchTypes);
      recentPitchTypes.push(currentPitch.key);
      if (recentPitchTypes.length > 5) recentPitchTypes.shift();
      score.totalPitches++;

      pitcher.startWindup(() => {
        const releasePoint = pitcher.getReleasePoint();
        swungAndMissed = false;
        didSwing = false;
        plateArrived = false;
        pitchTraj.launch(currentPitch, releasePoint);
        ballVisual.show(releasePoint);
        pitchTracker.clearTrail();

        const dist = releasePoint.distanceTo(new THREE.Vector3(currentPitch.targetX, currentPitch.targetY, 0));
        pitchTotalFlightTime = dist / currentPitch.speedMs;
        pitchFlightTime = 0;

        lastMarkerX = currentPitch.targetX;
        lastMarkerY = currentPitch.targetY;
        strikeZone.updateBallMarker(lastMarkerX, lastMarkerY);
      });

      gameState.transition(State.PITCHING);
    }
  }

  // ── PITCHING：球在飛行中 ───────────────────────────────────────
  if (st === State.PITCHING) {
    pitchTraj.step(dt);

    if (pitchTraj.active) {
      pitchFlightTime += dt;

      ballVisual.update(
        pitchTraj.position,
        new THREE.Vector3(currentPitch.spinAxis.x, currentPitch.spinAxis.y, currentPitch.spinAxis.z),
        currentPitch.spinRads,
        dt
      );

      const t = Math.min(pitchFlightTime / pitchTotalFlightTime, 1);

      if (currentPitch.breakSegments) {
        const segs = currentPitch.breakSegments;
        let accumX = 0, accumY = 0;
        const segLen = 1 / 3;
        for (let i = 0; i < 3; i++) {
          const segStart = i * segLen;
          const segEnd = segStart + segLen;
          if (t >= segEnd) {
            accumX += segs[i].dx;
            accumY += segs[i].dy;
          } else if (t > segStart) {
            const st2 = (t - segStart) / segLen;
            accumX += segs[i].dx * st2;
            accumY += segs[i].dy * st2;
          }
        }
        lastMarkerX = currentPitch.targetX + accumX;
        lastMarkerY = currentPitch.targetY + accumY;
      } else {
        const eased = t * t;
        lastMarkerX = currentPitch.targetX + currentPitch.breakX * eased;
        lastMarkerY = currentPitch.targetY + currentPitch.breakY * eased;
      }

      strikeZone.updateBallMarker(lastMarkerX, lastMarkerY);
      pitchTracker.setBallPosition(lastMarkerX, lastMarkerY);
    }

    // 球過本壘板
    if (pitchTraj.reachedPlate && !plateArrived) {
      plateFinalX = pitchTraj.position.x;
      plateFinalY = pitchTraj.position.y;
      pitchTracker.setCrossingPosition(plateFinalX, plateFinalY);
      pitchTracker.clearBall();
      strikeZone.updateBallMarker(plateFinalX, plateFinalY);
      hud.showPitchInfo(currentPitch);
      pitchTraj.active = false;
      pitchTraj.reachedPlate = false;
      ballVisual.hide();
      plateArrived = true;
      plateTimer = 0;
    }

    // 等 200ms 讓玩家可以揮棒
    if (plateArrived && gameState.current === State.PITCHING) {
      plateTimer += dt;
      if (plateTimer >= 0.2) {
        const inZone = plateFinalX >= -0.25 && plateFinalX <= 0.25 &&
                       plateFinalY >= 0.45 && plateFinalY <= 1.1;

        if (swungAndMissed) {
          swungAndMissed = false;
          // 已在揮棒時處理
        } else if (didSwing) {
          // 揮棒但沒打到（不在好球帶也算揮棒落空）
          const evt = score.addSwingingStrike();
          updateStats();
          if (!handleGameEvent(evt)) {
            hud.showEventFlash('揮棒落空！', 'strike');
          }
        } else if (inZone) {
          // 好球帶內沒揮棒 = 被叫好球
          const evt = score.addCalledStrike();
          updateStats();
          if (!handleGameEvent(evt)) {
            hud.showEventFlash('好球！', 'strike');
          }
        } else {
          // 壞球
          const evt = score.addBall();
          updateStats();
          if (!handleGameEvent(evt)) {
            hud.showEventFlash('壞球', 'ball-flash');
          }
        }

        didSwing = false;
        plateArrived = false;
        gameState.transition(State.RESULT);
      }
    }
  }

  // ── BALL_IN_PLAY：打擊後球飛行 ────────────────────────────────
  if (st === State.BALL_IN_PLAY) {
    ballFlight.step(dt);

    if (ballFlight.active && hitBallClone) {
      hitBallClone.update(ballFlight.position);
    }

    if (ballFlight.landed && !currentOutcome) {
      currentOutcome = determineOutcome(
        ballFlight,
        swingResult.launchAngle,
        swingResult.exitSpeed,
        swingResult.contactQuality
      );

      const distFt = ballFlight.getDistance() * M_TO_FT;

      // 界外球特殊處理：加計數但不結束打席
      if (currentOutcome.type === 'FOUL') {
        score.addFoul();
        updateStats();
        hud.showResultOverlay(currentOutcome, swingResult.exitSpeed, swingResult.launchAngle, distFt);
      } else {
        // 安打/出局/全壘打：完整處理
        const evt = score.addResult(currentOutcome);
        updateStats();
        hud.showResultOverlay(currentOutcome, swingResult.exitSpeed, swingResult.launchAngle, distFt);
        handleGameEvent(evt);
        if (currentOutcome.type === 'HOME_RUN') crowd.celebrate();
      }

      landedTimer = 0;
    }

    if (ballFlight.landed) {
      landedTimer += dt;
      if (landedTimer >= 1.0) {
        gameState.transition(State.RESULT);
      }
    }
  }

  // Keep hit ball rolling during RESULT
  if (st === State.RESULT && ballFlight.active && hitBallClone) {
    ballFlight.step(dt);
    hitBallClone.update(ballFlight.position);
  }

  // ── RESULT：展示結果後繼續 ────────────────────────────────────
  if (st === State.RESULT) {
    if (gameState.stateTime > 1.5) {
      hud.hideResultOverlay();
      ballVisual.hide();
      gameScene.stopTrackingBall();
      if (hitBallClone) { hitBallClone.dispose(); hitBallClone = null; }
      strikeZone.hideBallMarker();
      strikeZone.hideClickMarker();

      // 生存模式永遠繼續
      gameScene.resetCamera();
      gameState.transition(State.WAITING);
    }
  }
}

// --- Render ---
function renderFrame(dt) {
  gameScene.updateCamera(dt);
  ballVisual.updateTrail(dt);
  pitchTracker.update(dt);
  crowd.update(dt);
  gameScene.render();
}

function showGameOver() {
  // 生存模式不會呼叫，保留備用
  const totalScore = score.totalScore + score.score;
  finalStatsEl.innerHTML = [
    `得分: ${totalScore}`,
    `全壘打: ${score.homeRuns}`,
    `安打: ${score.hits}`,
    `最遠: ${Math.round(score.bestDistance)} ft`,
    `打了 ${score.inning - 1} 局`,
  ].join('<br>');

  const diff = getDifficultyLabel();
  const entry = {
    score: totalScore,
    hr: score.homeRuns,
    hits: score.hits,
    best: Math.round(score.bestDistance),
    innings: score.inning - 1,
    date: new Date().toLocaleDateString(),
  };
  const storageKey = `homerun-hero-lb-${diff}`;
  const board = JSON.parse(localStorage.getItem(storageKey) || '[]');
  board.push(entry);
  board.sort((a, b) => b.score - a.score || b.hr - a.hr || b.best - a.best);
  board.length = Math.min(board.length, 10);
  localStorage.setItem(storageKey, JSON.stringify(board));

  const currentIdx = board.findIndex(e => e === entry);
  const lbEl = document.getElementById('leaderboard');
  let rows = '';
  board.forEach((e, i) => {
    const cls = i === currentIdx ? ' class="current"' : '';
    rows += `<tr${cls}><td>${i + 1}</td><td>${e.score}</td><td>${e.hr} HR</td><td>${e.innings}局</td></tr>`;
  });
  lbEl.innerHTML = `
    <h2>LEADERBOARD - ${diff}</h2>
    <table>
      <tr><th>#</th><th>得分</th><th>全壘打</th><th>局數</th></tr>
      ${rows}
    </table>
  `;

  gameOverScreen.classList.remove('hidden');
}

// --- Start ---
const loop = new GameLoop(physicsTick, renderFrame);
loop.start();
