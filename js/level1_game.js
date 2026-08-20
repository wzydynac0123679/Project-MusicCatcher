// 形狀獵人（關卡一）- 遊戲流程與資料記錄邏輯
(function () {
  "use strict";

  // ==========================================
  // 常數設定
  // ==========================================
  var SHAPES = ["triangle", "trapezoid", "square", "circle", "star"];

  var SHAPE_NAMES = {
    triangle: "三角形",
    trapezoid: "等腰梯形",
    square: "正方形",
    circle: "圓形",
    star: "五角星型",
  };

  var COLORS = [
    { name: "green", fill: "#59ea67", stroke: "#2e9429" },
    { name: "blue", fill: "#5070ff", stroke: "#191d8f" },
    { name: "red", fill: "#ff5757", stroke: "#982b2b" },
    { name: "purple", fill: "#9440dd", stroke: "#43106f" },
    { name: "yellow", fill: "#fcff5c", stroke: "#9d8522" },
  ];

  var OUTLINE_STROKE = "#7f7f7f"; // 目標圖形：未填色，邊線灰色

  var TOTAL_TRIALS = 30;

  // 目標圖形在 30 張卡片中出現的次數上下限。
  // 注意：要讓「相鄰卡片不可重複同一圖形」一定能排出來，
  // TARGET_MAX_COUNT 不應超過 Math.ceil(TOTAL_TRIALS / 2)（此處為 15）。
  var TARGET_MIN_COUNT = 6; // 最少次數（30 張的 40%）
  var TARGET_MAX_COUNT = 15; // 最多次數（30 張的 50%）

  var CARD_DURATION_MS = 3000; // 每張卡片顯示 3 秒
  var COUNTDOWN_STEP_MS = 1000;
  var GO_TEXT_MS = 800;
  var NAV_DELAY_MS = 150; // 與 scripts.js 的跳頁延遲一致，讓點擊音效播完

  // ==========================================
  // 小工具
  // ==========================================
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 回傳 [min, max] 區間內（含頭尾）的隨機整數
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 產生五角星的頂點座標字串（置中於 100,100，外徑 90，內徑 36）
  function buildStarPoints() {
    var cx = 100,
      cy = 100,
      outerR = 90,
      innerR = 36,
      points = [];
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? outerR : innerR;
      // 從正上方開始，每 36 度一個頂點
      var angle = (Math.PI / 5) * i - Math.PI / 2;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      points.push(x.toFixed(1) + "," + y.toFixed(1));
    }
    return points.join(" ");
  }

  // 依圖形類型回傳「圖形骨架」的 SVG 標籤字串（fill/stroke 由呼叫端指定）
  function buildShapeMarkup(shapeType, fill, stroke, strokeWidth) {
    var attrs =
      'fill="' +
      fill +
      '" stroke="' +
      stroke +
      '" stroke-width="' +
      strokeWidth +
      '" stroke-linejoin="round"';

    switch (shapeType) {
      case "triangle":
        return '<polygon points="100,20 15,180 185,180" ' + attrs + " />";
      case "trapezoid":
        return '<polygon points="65,35 135,35 180,165 20,165" ' + attrs + " />";
      case "square":
        return (
          '<rect x="30" y="30" width="140" height="140" rx="10" ' +
          attrs +
          " />"
        );
      case "circle":
        return (
          '<circle cx="100" cy="100" r="82" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '" stroke-width="' +
          strokeWidth +
          '" />'
        );
      case "star":
        return '<polygon points="' + buildStarPoints() + '" ' + attrs + " />";
      default:
        return "";
    }
  }

  // 遊戲卡片用：依圖形類型與顏色，回傳填色 SVG 字串
  function renderShapeSVG(shapeType, color) {
    var markup = buildShapeMarkup(shapeType, color.fill, color.stroke, 6);
    return (
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      markup +
      "</svg>"
    );
  }

  // 目標圖形用：未填色，邊線固定為灰色 #7f7f7f
  function renderShapeOutlineSVG(shapeType) {
    var markup = buildShapeMarkup(shapeType, "none", OUTLINE_STROKE, 8);
    return (
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      markup +
      "</svg>"
    );
  }

  // ---------- 卡片圖形序列產生（含次數上下限 + 不可連續重複同一圖形） ----------

  // 依「各圖形要出現的次數」，排出一個序列，且相鄰兩張卡片的圖形不可相同。
  // 作法：每一步都從「次數尚未用完、且不等於上一張圖形」的候選中，
  // 挑剩餘次數最多的那個（次數相同則隨機挑），這是排列組合中
  // 避免相鄰重複的標準貪婪解法（只要沒有任何圖形次數超過 ceil(n/2) 就必定可排出）。
  function arrangeNoAdjacentDuplicates(counts) {
    var sequence = [];
    var lastShape = null;

    while (sequence.length < TOTAL_TRIALS) {
      var candidates = Object.keys(counts).filter(function (s) {
        return counts[s] > 0 && s !== lastShape;
      });

      // 理論上在次數設定合理（不超過上限）時不會發生，這裡僅作保險 fallback
      if (candidates.length === 0) {
        candidates = Object.keys(counts).filter(function (s) {
          return counts[s] > 0;
        });
      }

      var maxCount = Math.max.apply(
        null,
        candidates.map(function (s) {
          return counts[s];
        }),
      );
      var topCandidates = candidates.filter(function (s) {
        return counts[s] === maxCount;
      });
      var chosen = pickRandom(topCandidates);

      counts[chosen]--;
      sequence.push(chosen);
      lastShape = chosen;
    }

    return sequence;
  }

  // 產生本局 30 張卡片的圖形序列：
  // 1. 目標圖形出現次數隨機落在 [TARGET_MIN_COUNT, TARGET_MAX_COUNT] 之間
  // 2. 其餘卡片隨機分配給另外 4 種圖形
  // 3. 排列時確保相鄰兩張卡片的圖形不相同
  function buildTrialShapeSequence(targetShape) {
    var targetCount = randomInt(TARGET_MIN_COUNT, TARGET_MAX_COUNT);
    var otherShapes = SHAPES.filter(function (s) {
      return s !== targetShape;
    });

    var counts = {};
    counts[targetShape] = targetCount;
    otherShapes.forEach(function (s) {
      counts[s] = 0;
    });

    var remaining = TOTAL_TRIALS - targetCount;
    for (var i = 0; i < remaining; i++) {
      counts[pickRandom(otherShapes)]++;
    }

    return arrangeNoAdjacentDuplicates(counts);
  }

  // 依卡片圖形序列，為每張卡片挑選顏色。
  // 圖形本身已保證不會連續重複，因此「圖形」與「圖形+顏色」組合
  // 自然都不會連續出現 2 次以上；這裡的顏色仍是每張獨立隨機挑選。
  function buildTrialColorSequence(shapeSequence) {
    return shapeSequence.map(function () {
      return pickRandom(COLORS);
    });
  }

  // ==========================================
  // 遊戲狀態
  // ==========================================
  var state = {
    target: null, // { shape }
    trialShapeSequence: [], // 本局 30 張卡片的圖形順序
    trialColorSequence: [], // 本局 30 張卡片對應的顏色
    trialIndex: 0, // 下一個要顯示的卡片索引 (0-based)
    trialActive: false,
    cardShownAt: 0,
    trialTimeoutId: null,
    log: {
      targetShape: null,
      startedAt: null,
      trials: [], // { index, shape, color, isTarget, clicked, reactionTimeMs, shownAt }
    },
  };

  // ==========================================
  // DOM 參照（於 DOMContentLoaded 內指派）
  // ==========================================
  var els = {};

  // ==========================================
  // 階段一：目標圖形彈跳畫面
  // ==========================================
  function initTargetModal() {
    var shape = pickRandom(SHAPES);
    state.target = { shape: shape };
    state.log.targetShape = shape;

    state.trialShapeSequence = buildTrialShapeSequence(shape);
    state.trialColorSequence = buildTrialColorSequence(
      state.trialShapeSequence,
    );

    els.targetCardContent.innerHTML = renderShapeOutlineSVG(shape);
    els.targetModal.hidden = false;
  }

  function closeTargetModal() {
    els.targetModal.hidden = true;
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
        // 重新觸發動畫
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
  // 階段三：遊戲進行（30 張卡片）
  // ==========================================
  function startGame() {
    state.trialIndex = 0;
    state.log.trials = [];
    state.log.startedAt = new Date().toISOString();
    els.gameScreen.hidden = false;
    showNextTrial();
  }

  function showNextTrial() {
    if (state.trialIndex >= TOTAL_TRIALS) {
      endGame();
      return;
    }

    var shape = state.trialShapeSequence[state.trialIndex];
    var color = state.trialColorSequence[state.trialIndex];
    var isTarget = shape === state.target.shape;

    els.trialCardContent.innerHTML = renderShapeSVG(shape, color);
    els.trialCardContent.classList.remove("is-entering");
    void els.trialCardContent.offsetWidth; // reflow，重新播放進場動畫
    els.trialCardContent.classList.add("is-entering");

    state.trialActive = true;
    state.cardShownAt = performance.now();

    // 先把這張卡片的紀錄放進 log，點擊/逾時再回填 clicked / reactionTimeMs
    var trialRecord = {
      index: state.trialIndex + 1,
      shape: shape,
      color: color.name,
      isTarget: isTarget,
      clicked: false,
      reactionTimeMs: null,
      shownAt: new Date().toISOString(),
    };
    state.log.trials.push(trialRecord);

    state.trialTimeoutId = setTimeout(function () {
      handleTrialTimeout();
    }, CARD_DURATION_MS);
  }

  function handleTrialCardClick() {
    if (!state.trialActive) return;

    state.trialActive = false;
    clearTimeout(state.trialTimeoutId);

    var reactionTimeMs = Math.round(performance.now() - state.cardShownAt);
    var trialRecord = state.log.trials[state.log.trials.length - 1];
    trialRecord.clicked = true;
    trialRecord.reactionTimeMs = reactionTimeMs;

    advanceTrial();
  }

  function handleTrialTimeout() {
    if (!state.trialActive) return; // 保險：避免與點擊事件重複觸發

    state.trialActive = false;
    // clicked 保持 false，reactionTimeMs 保持 null
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

    var hits = 0; // 目標圖形且有點擊
    var misses = 0; // 目標圖形但沒點擊
    var falseAlarms = 0; // 非目標圖形卻點擊
    var reactionTimes = []; // 所有有點擊卡片的反應時間

    state.log.trials.forEach(function (t) {
      if (t.isTarget && t.clicked) hits++;
      if (t.isTarget && !t.clicked) misses++;
      if (!t.isTarget && t.clicked) falseAlarms++;
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
      "目標圖形：" +
      SHAPE_NAMES[state.log.targetShape] +
      "\n正確點擊：" +
      hits +
      "　漏按：" +
      misses +
      "　誤按：" +
      falseAlarms +
      "\n平均反應時間：" +
      (avgReactionTimeMs !== null ? avgReactionTimeMs + " 毫秒" : "無點擊紀錄");

    els.endModal.hidden = false;

    // TODO: 將 state.log 串接至後端（例如 Supabase 的紀錄資料表）
    // submitResults(state.log);
    console.log("形狀獵人 - 本次紀錄", state.log);
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
    els.targetModal = document.getElementById("target-modal");
    els.countdownModal = document.getElementById("countdown-modal");
    els.gameScreen = document.getElementById("game-screen");
    els.endModal = document.getElementById("end-modal");

    els.targetCardContent = document.getElementById("target-card-content");
    els.confirmBtn = document.getElementById("confirm-btn");

    els.countdownNumber = document.getElementById("countdown-number");

    els.trialCard = document.getElementById("trial-card");
    els.trialCardContent = document.getElementById("trial-card-content");

    els.endSummary = document.getElementById("end-summary");
    els.backBtn = document.getElementById("back-btn");

    initTargetModal();

    els.confirmBtn.addEventListener("click", function () {
      setTimeout(function () {
        closeTargetModal();
        startCountdown();
      }, NAV_DELAY_MS);
    });

    els.trialCard.addEventListener("click", handleTrialCardClick);

    els.backBtn.addEventListener("click", function () {
      setTimeout(function () {
        window.location.href = "level_select.html";
      }, NAV_DELAY_MS);
    });
  });
})();
