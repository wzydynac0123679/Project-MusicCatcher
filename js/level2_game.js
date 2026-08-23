// 方向快手（關卡二）- 遊戲流程與資料記錄邏輯
(function () {
  "use strict";

  // ==========================================
  // 常數設定
  // ==========================================
  var DIRECTIONS = ["up", "down", "left", "right"];

  var DIRECTION_NAMES = {
    up: "上",
    down: "下",
    left: "左",
    right: "右",
  };

  var TOTAL_TRIALS = 30;
  var MAX_CONSECUTIVE_SAME_DIRECTION = 2; // 假隨機：同一方向最多連續出現 2 次
  var CUE_DURATION_MS = 3000; // 提示亮條顯示 3 秒（第 1 秒閃爍 2 下，後 2 秒恆亮，對應 CSS 的 edgeCuePulse 動畫）
  var COUNTDOWN_STEP_MS = 1000;
  var GO_TEXT_MS = 800;
  var FEEDBACK_MS = 250; // 按鍵按下後的短暫互動回饋時間
  var NAV_DELAY_MS = 150; // 與 scripts.js 的跳頁延遲一致，讓點擊音效播完

  // ==========================================
  // 小工具
  // ==========================================
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 假隨機：檢查最近 N 筆紀錄是否都是同一個方向（N = MAX_CONSECUTIVE_SAME_DIRECTION）
  function isStreak(trials, direction, streakLength) {
    if (trials.length < streakLength) return false;
    for (var i = trials.length - streakLength; i < trials.length; i++) {
      if (trials[i].direction !== direction) return false;
    }
    return true;
  }

  // 假隨機出題：從歷史紀錄中排除「已經連續出現滿 MAX_CONSECUTIVE_SAME_DIRECTION 次」的方向，
  // 避免同一方向連續出現超過上限，其餘方向仍維持等機率隨機
  function pickNextDirection(trials) {
    var candidates = DIRECTIONS.filter(function (direction) {
      return !isStreak(trials, direction, MAX_CONSECUTIVE_SAME_DIRECTION);
    });
    // 保險：理論上不會全部方向都被排除，但若真的發生就退回完整方向集合
    if (candidates.length === 0) candidates = DIRECTIONS;
    return pickRandom(candidates);
  }

  // ==========================================
  // 遊戲狀態
  // ==========================================
  var state = {
    trialIndex: 0, // 下一個要顯示的提示索引 (0-based)
    trialActive: false,
    cueShownAt: 0,
    trialTimeoutId: null,
    log: {
      startedAt: null,
      trials: [], // { index, direction, clicked, clickedDirection, correct, reactionTimeMs, shownAt }
    },
  };

  // ==========================================
  // DOM 參照（於 DOMContentLoaded 內指派）
  // ==========================================
  var els = {};

  // ==========================================
  // 階段一：遊戲說明彈跳畫面
  // ==========================================
  function closeIntroModal() {
    els.introModal.hidden = true;
  }

  // ==========================================
  // 階段二：倒數彈跳畫面（3、2、1、遊戲開始！）
  // ==========================================
  function startCountdown() {
    els.countdownModal.hidden = false;
    els.countdownNumber.classList.remove("countdown-number--go");

    var steps = ["3", "2", "1"];
    var stepIndex = 0;

    function showNextStep() {
      if (stepIndex < steps.length) {
        els.countdownNumber.textContent = steps[stepIndex];
        els.countdownNumber.classList.remove("countdown-number");
        void els.countdownNumber.offsetWidth; // reflow，重新播放動畫
        els.countdownNumber.classList.add("countdown-number");
        stepIndex++;
        setTimeout(showNextStep, COUNTDOWN_STEP_MS);
      } else {
        els.countdownNumber.textContent = "遊戲開始！";
        els.countdownNumber.classList.add("countdown-number--go");
        setTimeout(function () {
          els.countdownModal.hidden = true;
          startGame();
        }, GO_TEXT_MS);
      }
    }

    showNextStep();
  }

  // ==========================================
  // 階段三：遊戲進行（30 次提示）
  // ==========================================
  function startGame() {
    state.trialIndex = 0;
    state.log.trials = [];
    state.log.startedAt = new Date().toISOString();
    els.gameScreen.hidden = false;
    showNextTrial();
  }

  // 讓對應方向的邊線亮條開始播放「閃 3 下→恆亮」的動畫，其餘三邊保持熄滅
  function setCueDirection(direction) {
    Object.keys(els.edgeCues).forEach(function (key) {
      els.edgeCues[key].classList.remove("is-active");
    });

    var activeCue = els.edgeCues[direction];
    void activeCue.offsetWidth; // reflow，確保動畫重新從頭播放
    activeCue.classList.add("is-active");
  }

  // 提前熄滅提示亮條（例如玩家已經點擊，不需要等滿 3 秒）
  function hideCue() {
    Object.keys(els.edgeCues).forEach(function (key) {
      els.edgeCues[key].classList.remove("is-active");
    });
  }

  function clearButtonFeedback() {
    els.directionBtns.forEach(function (btn) {
      btn.classList.remove("is-pressed");
    });
  }

  function showNextTrial() {
    if (state.trialIndex >= TOTAL_TRIALS) {
      endGame();
      return;
    }

    clearButtonFeedback();

    var direction = pickNextDirection(state.log.trials);
    setCueDirection(direction);

    state.trialActive = true;
    state.cueShownAt = performance.now();

    var trialRecord = {
      index: state.trialIndex + 1,
      direction: direction,
      clicked: false,
      clickedDirection: null,
      correct: false,
      reactionTimeMs: null,
      shownAt: new Date().toISOString(),
    };
    state.log.trials.push(trialRecord);

    state.trialTimeoutId = setTimeout(function () {
      handleTrialTimeout();
    }, CUE_DURATION_MS);
  }

  function handleDirectionBtnClick(event) {
    if (!state.trialActive) return;

    var btn = event.currentTarget;
    var clickedDirection = btn.dataset.direction;

    state.trialActive = false;
    clearTimeout(state.trialTimeoutId);

    var reactionTimeMs = Math.round(performance.now() - state.cueShownAt);
    var trialRecord = state.log.trials[state.log.trials.length - 1];
    trialRecord.clicked = true;
    trialRecord.clickedDirection = clickedDirection;
    trialRecord.reactionTimeMs = reactionTimeMs;
    trialRecord.correct = clickedDirection === trialRecord.direction;

    btn.classList.add("is-pressed");
    hideCue();

    setTimeout(advanceTrial, FEEDBACK_MS);
  }

  function handleTrialTimeout() {
    if (!state.trialActive) return; // 保險：避免與點擊事件重複觸發

    state.trialActive = false;
    // clicked / clickedDirection / correct 保持初始值，reactionTimeMs 保持 null
    hideCue();

    advanceTrial();
  }

  function advanceTrial() {
    state.trialIndex++;
    showNextTrial();
  }

  // ==========================================
  // 階段四：結束彈跳畫面
  // ==========================================
  function endGame() {
    els.gameScreen.hidden = true;

    var correctCount = 0; // 點對方向
    var wrongCount = 0; // 有點擊但方向錯誤
    var missCount = 0; // 逾時未點擊
    var reactionTimes = []; // 所有有點擊的反應時間

    state.log.trials.forEach(function (t) {
      if (!t.clicked) {
        missCount++;
      } else if (t.correct) {
        correctCount++;
      } else {
        wrongCount++;
      }
      if (t.clicked && typeof t.reactionTimeMs === "number") {
        reactionTimes.push(t.reactionTimeMs);
      }
    });

    var avgReactionTimeMs = null;
    if (reactionTimes.length > 0) {
      var sum = reactionTimes.reduce(function (a, b) {
        return a + b;
      }, 0);
      avgReactionTimeMs = Math.round(sum / reactionTimes.length);
    }
    state.log.avgReactionTimeMs = avgReactionTimeMs;

    els.endSummary.textContent =
      "答對：" +
      correctCount +
      "　答錯：" +
      wrongCount +
      "　未點擊：" +
      missCount +
      "\n平均反應時間：" +
      (avgReactionTimeMs !== null ? avgReactionTimeMs + " 毫秒" : "無點擊紀錄");

    els.endModal.hidden = false;

    // TODO: 將 state.log 串接至後端（例如 Supabase 的紀錄資料表）
    // submitResults(state.log);
    console.log("方向快手 - 本次紀錄", state.log);
  }

  // 預留：之後串接後端時可實作這個函式，將 state.log 送出
  function submitResults(log) {
    // 範例：
    // fetch("YOUR_SUPABASE_ENDPOINT", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(log),
    // });
  }

  // ==========================================
  // 初始化
  // ==========================================
  document.addEventListener("DOMContentLoaded", function () {
    els.introModal = document.getElementById("intro-modal");
    els.countdownModal = document.getElementById("countdown-modal");
    els.gameScreen = document.getElementById("game-screen");
    els.endModal = document.getElementById("end-modal");

    els.confirmBtn = document.getElementById("confirm-btn");
    els.countdownNumber = document.getElementById("countdown-number");

    els.edgeCues = {
      up: document.getElementById("edge-cue-up"),
      down: document.getElementById("edge-cue-down"),
      left: document.getElementById("edge-cue-left"),
      right: document.getElementById("edge-cue-right"),
    };
    els.directionBtns = Array.prototype.slice.call(
      document.querySelectorAll(".direction-btn"),
    );

    els.endSummary = document.getElementById("end-summary");
    els.backBtn = document.getElementById("back-btn");

    els.confirmBtn.addEventListener("click", function () {
      setTimeout(function () {
        closeIntroModal();
        startCountdown();
      }, NAV_DELAY_MS);
    });

    els.directionBtns.forEach(function (btn) {
      btn.addEventListener("click", handleDirectionBtnClick);
    });

    els.backBtn.addEventListener("click", function () {
      setTimeout(function () {
        window.location.href = "level_select.html";
      }, NAV_DELAY_MS);
    });
  });
})();
