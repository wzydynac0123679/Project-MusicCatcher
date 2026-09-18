// 色字挑戰（關卡三）- Stroop test 遊戲流程與資料記錄邏輯
(function () {
  "use strict";

  // ==========================================
  // 常數設定
  // ==========================================
  // 六個顏色選項：id 對應按鍵的 data-color，name 為題目文字，bg/border 對應方塊與文字顏色
  var COLORS = [
    { id: "white", name: "白", bg: "#ffffff", border: "#7f7f7f" },
    { id: "blue", name: "藍", bg: "#5070ff", border: "#191d8f" },
    { id: "yellow", name: "黃", bg: "#fcff5c", border: "#9d8522" },
    { id: "red", name: "紅", bg: "#ff5757", border: "#982b2b" },
    { id: "purple", name: "紫", bg: "#9440dd", border: "#43106f" },
    { id: "black", name: "黑", bg: "#3d3d3d", border: "#000000" },
  ];

  var COLOR_BY_ID = {};
  COLORS.forEach(function (c) {
    COLOR_BY_ID[c.id] = c;
  });

  var TEST_MODES = ["color", "meaning"]; // color = 依文字顏色作答；meaning = 依文字意思作答

  var TEST_MODE_LABELS = {
    color: "文字顏色",
    meaning: "文字意思",
  };

  var TOTAL_TRIALS = 30;
  var FEEDBACK_MS = 250; // 按鍵按下後的短暫互動回饋時間
  var COUNTDOWN_STEP_MS = 1000;
  var GO_TEXT_MS = 800;
  var NAV_DELAY_MS = 150; // 與 scripts.js 的跳頁延遲一致，讓點擊音效播完

  // ==========================================
  // 小工具
  // ==========================================
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ==========================================
  // 遊戲狀態
  // ==========================================
  var state = {
    testMode: null, // 這次測試的答題要求："color" 或 "meaning"，一開始就決定，全程不變
    trialIndex: 0, // 下一個要顯示的題目索引 (0-based)
    trialActive: false,
    questionShownAt: 0,
    log: {
      startedAt: null,
      testMode: null,
      trials: [], // { index, word, displayColor, correctColor, clicked, clickedColor, correct, reactionTimeMs, shownAt }
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
  // 階段三：遊戲進行（30 題）
  // ==========================================
  function startGame() {
    state.trialIndex = 0;
    state.log.trials = [];
    state.log.startedAt = new Date().toISOString();
    els.gameScreen.hidden = false;
    showNextTrial();
  }

  function clearButtonFeedback() {
    els.colorBtns.forEach(function (btn) {
      btn.classList.remove("is-pressed");
    });
  }

  // 依測驗要求（color / meaning）算出這一題正確答案的顏色 id
  function getCorrectColorId(wordColor, displayColor) {
    return state.testMode === "color" ? displayColor.id : wordColor.id;
  }

  function renderQuestion(wordColor, displayColor) {
    els.question.textContent = wordColor.name;
    els.question.style.color = displayColor.bg;
    els.question.style.webkitTextStrokeColor = displayColor.border;
  }

  function showNextTrial() {
    if (state.trialIndex >= TOTAL_TRIALS) {
      endGame();
      return;
    }

    clearButtonFeedback();

    var wordColor = pickRandom(COLORS); // 字義（題目文字本身代表的顏色）
    var displayColor = pickRandom(COLORS); // 字的顯示顏色（獨立隨機，可能與字義相同或不同）
    var correctColorId = getCorrectColorId(wordColor, displayColor);

    renderQuestion(wordColor, displayColor);

    state.trialActive = true;
    state.questionShownAt = performance.now();

    state.log.trials.push({
      index: state.trialIndex + 1,
      word: wordColor.id,
      displayColor: displayColor.id,
      correctColor: correctColorId,
      clicked: false,
      clickedColor: null,
      correct: false,
      reactionTimeMs: null,
      shownAt: new Date().toISOString(),
    });
  }

  function handleColorBtnClick(event) {
    if (!state.trialActive) return;

    var btn = event.currentTarget;
    var clickedColorId = btn.dataset.color;

    state.trialActive = false;

    var reactionTimeMs = Math.round(performance.now() - state.questionShownAt);
    var trialRecord = state.log.trials[state.log.trials.length - 1];
    trialRecord.clicked = true;
    trialRecord.clickedColor = clickedColorId;
    trialRecord.reactionTimeMs = reactionTimeMs;
    trialRecord.correct = clickedColorId === trialRecord.correctColor;

    btn.classList.add("is-pressed");

    setTimeout(advanceTrial, FEEDBACK_MS);
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

    var correctCount = 0;
    var wrongCount = 0;
    var reactionTimes = [];

    state.log.trials.forEach(function (t) {
      if (t.correct) {
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
      "本次作答依據：" +
      TEST_MODE_LABELS[state.testMode] +
      "\n答對：" +
      correctCount +
      "　答錯：" +
      wrongCount +
      "\n平均反應時間：" +
      (avgReactionTimeMs !== null ? avgReactionTimeMs + " 毫秒" : "無點擊紀錄");

    els.endModal.hidden = false;

    // TODO: 將 state.log 串接至後端（例如 Supabase 的紀錄資料表）
    // submitResults(state.log);
    console.log("色字挑戰 - 本次紀錄", state.log);
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
    // 這次測試的答題要求：一開始隨機決定一次，全程不變
    state.testMode = pickRandom(TEST_MODES);
    state.log.testMode = state.testMode;

    els.introModal = document.getElementById("intro-modal");
    els.introInstruction = document.getElementById("intro-instruction");
    els.countdownModal = document.getElementById("countdown-modal");
    els.gameScreen = document.getElementById("game-screen");
    els.endModal = document.getElementById("end-modal");

    els.confirmBtn = document.getElementById("confirm-btn");
    els.countdownNumber = document.getElementById("countdown-number");

    els.question = document.getElementById("stroop-question");
    els.colorBtns = Array.prototype.slice.call(
      document.querySelectorAll(".color-btn"),
    );

    els.endSummary = document.getElementById("end-summary");
    els.backBtn = document.getElementById("back-btn");

    els.introInstruction.textContent =
      "接下來請依照文字的「" + TEST_MODE_LABELS[state.testMode] + "」作答";

    els.confirmBtn.addEventListener("click", function () {
      setTimeout(function () {
        closeIntroModal();
        startCountdown();
      }, NAV_DELAY_MS);
    });

    els.colorBtns.forEach(function (btn) {
      btn.addEventListener("click", handleColorBtnClick);
    });

    els.backBtn.addEventListener("click", function () {
      setTimeout(function () {
        window.location.href = "level_select.html";
      }, NAV_DELAY_MS);
    });
  });
})();
