// 樂動捕手 - 互動與音效控制邏輯
(function () {
  "use strict";

  // ---------- 音效資源預載 ----------
  // 預載 mouse_move.wav 音效檔，提升懸停時的反應速度
  var hoverAudio = new Audio("assets/wav/mouse_move.wav");
  hoverAudio.volume = 0.5; // 可依需求調整音量 (0.0 ~ 1.0)

  function playHoverSound() {
    // 重設播放進度並播放，確保快速連續觸發時也能及時發聲
    hoverAudio.currentTime = 0;
    hoverAudio.play().catch(function (error) {
      // 捕捉瀏覽器自動播放限制 (Autoplay Policy) 的異常
      console.warn("Hover audio play prevented:", error);
    });
  }

  // ---------- Web Audio API 點擊音效合成器 ----------
  var audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // 按鈕點擊：金屬/機械打擊聲 (Pop / Mechanical Snap)
  function playClickSound() {
    var ctx = getAudioContext();
    if (!ctx) return;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  // 自動替全頁面的按鈕元素綁定音效 Event Listener
  function bindButtonAudioEvents() {
    var buttons = document.querySelectorAll(
      "button, .ribbon-btn, .enter-btn, .tri-btn",
    );
    buttons.forEach(function (btn) {
      /*
      btn.addEventListener("mouseenter", function () {
        playHoverSound();
      });
      */

      btn.addEventListener("click", function () {
        playClickSound();
      });
    });
  }

  // ---------- DOM 載入後初始化 ----------
  document.addEventListener("DOMContentLoaded", function () {
    bindButtonAudioEvents();

    var state = {
      gender: "女",
      age: 70,
    };

    var genderOptions = ["女", "男"];

    // ---------- 性別選擇器 ----------
    var genderCard = document.querySelector('[data-selector="gender"]');
    if (genderCard) {
      var genderValueEl = genderCard.querySelector("[data-value]");

      genderCard.addEventListener("click", function (event) {
        var btn = event.target.closest(".tri-btn");
        if (!btn) return;

        var currentIndex = genderOptions.indexOf(state.gender);
        var direction = btn.dataset.action === "next" ? 1 : -1;
        var nextIndex =
          (currentIndex + direction + genderOptions.length) %
          genderOptions.length;

        state.gender = genderOptions[nextIndex];
        genderValueEl.textContent = state.gender;
      });
    }

    // ---------- 年齡選擇器 ----------
    var ageCard = document.querySelector('[data-selector="age"]');
    if (ageCard) {
      var ageValueEl = ageCard.querySelector("[data-value]");
      var min = parseInt(ageCard.dataset.min, 10) || 1;
      var max = parseInt(ageCard.dataset.max, 10) || 120;

      ageCard.addEventListener("click", function (event) {
        var btn = event.target.closest(".tri-btn");
        if (!btn) return;

        var direction = btn.dataset.action === "next" ? 1 : -1;
        var next = state.age + direction;

        if (next < min) next = min;
        if (next > max) next = max;

        state.age = next;
        ageValueEl.textContent = state.age;
      });
    }

    // ---------- 進入遊戲 ----------
    var enterBtn = document.getElementById("enterGameBtn");
    if (enterBtn) {
      enterBtn.addEventListener("click", function () {
        // 延遲 150ms 讓點擊音效播放完成再跳頁
        setTimeout(function () {
          window.location.href = "level_select.html";
        }, 150);
      });
    }

    // ---------- 關卡頁按鈕點擊跳轉修飾 ----------
    var ribbonBtns = document.querySelectorAll(".ribbon-btn");
    ribbonBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var targetUrl = btn.getAttribute("data-href");
        if (targetUrl) {
          e.preventDefault();
          setTimeout(function () {
            window.location.href = targetUrl;
          }, 150);
        }
      });
    });
  });
})();
