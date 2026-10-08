/* 旋转地球去下班 — page, results and challenge sharing. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const GAME_SECONDS = 30;
  const MAX_SCORE = 1000000;
  const STORAGE_KEY = 'planet-offwork:v1';
  let uiState = 'intro';
  let mode = 'random';
  let sound = false;
  let best = { score: 0, time: 0 };
  let currentSeed = randomSeed();
  let result = null;
  let toastTimer;
  let helpReturn = 'intro';
  let challenge = null;

  function randomSeed() {
    if (window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint32Array(1);
      window.crypto.getRandomValues(bytes);
      return bytes[0] || 1;
    }
    return (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
  }

  function dailySeed() {
    const key = 'planet-offwork:' + new Date().toISOString().slice(0, 10);
    let hash = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    }
    return (hash >>> 0) || 1;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizedScore(value) {
    return Math.max(0, Math.min(MAX_SCORE, Math.floor(finite(value))));
  }

  function normalizedTime(value) {
    return Math.max(0, Math.min(GAME_SECONDS, finite(value)));
  }

  function show(id, visible) {
    const element = $(id);
    if (element) element.hidden = !visible;
  }

  function text(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }

  function setState(next) {
    uiState = next;
    const shell = $('gameShell');
    if (shell) shell.dataset.state = next;
    document.body.classList.toggle('is-playing', next === 'playing');
    show('intro', next === 'intro');
    show('result', next === 'result');
    show('paused', next === 'paused');
    show('help', next === 'help');
    const pauseButton = $('pauseBtn');
    if (pauseButton) pauseButton.disabled = next !== 'playing';
    for (const id of ['leftBtn', 'rightBtn']) {
      if ($(id)) $(id).disabled = next !== 'playing';
    }
  }

  function toast(message, duration = 2800) {
    clearTimeout(toastTimer);
    text('toast', message);
    const element = $('toast');
    if (element) {
      element.hidden = false;
      element.classList.add('visible');
      toastTimer = setTimeout(() => {
        element.classList.remove('visible');
        element.hidden = true;
      }, duration);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ best, sound }));
    } catch (_) {
      // Private browsing and full storage must not interrupt a round.
    }
  }

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && saved.best) {
        best = {
          score: normalizedScore(saved.best.score),
          time: normalizedTime(saved.best.time)
        };
      }
      sound = Boolean(saved && saved.sound === true);
    } catch (_) {
      sound = false;
    }
  }

  function readChallenge() {
    const params = new URLSearchParams(location.search);
    const seed = params.get('seed');
    const beat = params.get('beat');
    if (!seed || !/^\d{1,10}$/.test(seed)) return;
    const numberSeed = Number(seed);
    if (!Number.isSafeInteger(numberSeed) || numberSeed < 1 || numberSeed > 4294967295) return;
    currentSeed = numberSeed;
    if (beat === null || !/^\d{1,7}$/.test(beat)) return;
    const numberBeat = Number(beat);
    if (numberBeat < 0 || numberBeat > MAX_SCORE) return;
    challenge = { seed: numberSeed, score: numberBeat };
    mode = 'challenge';
  }

  function updateMode() {
    text('modeLabel', mode === 'daily' ? '今日同一路线' : mode === 'challenge' ? '朋友的下班挑战' : '地球打工人');
    show('challengeBanner', mode === 'challenge' && Boolean(challenge));
    if (challenge && mode === 'challenge') {
      text('challengeText', `朋友转着地球拿下 ${challenge.score} 分。轮到你准点下班。`);
      text('startBtn', '接招，超越 TA');
    } else {
      text('startBtn', '出发 · 转着地球去下班');
    }
  }

  function applySound() {
    const button = $('soundBtn');
    if (button) {
      button.setAttribute('aria-pressed', String(sound));
      button.setAttribute('aria-label', sound ? '关闭音效' : '打开音效');
      button.title = sound ? '音效已开' : '音效已关';
      button.dataset.sound = sound ? 'on' : 'off';
      const label = button.querySelector('[data-sound-label]');
      if (label) label.textContent = sound ? '音效开' : '音效关';
      else button.textContent = sound ? '♪ 音效开' : '♪ 音效关';
    }
    if (window.PlanetGame) window.PlanetGame.setSound(sound);
  }

  function resetHud() {
    text('scoreValue', '0');
    text('timeValue', '30.0');
    text('coinValue', '0');
  }

  function startRound(kind = 'retry') {
    if (!window.PlanetGame || typeof window.PlanetGame.start !== 'function') {
      toast('地球正在转起来，马上就好。');
      return;
    }
    if (kind === 'daily') {
      mode = 'daily';
      currentSeed = dailySeed();
    } else if (kind === 'new') {
      mode = 'random';
      currentSeed = randomSeed();
    }
    result = null;
    show('shareFallback', false);
    resetHud();
    updateMode();
    setState('playing');
    applySound();
    window.PlanetGame.start(currentSeed);
  }

  function pauseRound() {
    if (uiState !== 'playing') return;
    setState('paused');
    window.PlanetGame?.pause();
  }

  function resumeRound() {
    if (uiState !== 'paused') return;
    setState('playing');
    window.PlanetGame?.resume();
  }

  function openHelp() {
    if (uiState === 'help') return;
    helpReturn = uiState;
    setState('help');
    if (helpReturn === 'playing') window.PlanetGame?.pause();
  }

  function closeHelp() {
    setState(helpReturn);
    if (helpReturn === 'playing') window.PlanetGame?.resume();
  }

  function goHome() {
    window.PlanetGame?.pause();
    setState('intro');
    updateMode();
  }

  function handleTick(event) {
    const data = event.detail || {};
    text('scoreValue', normalizedScore(data.score));
    text('timeValue', Math.max(0, GAME_SECONDS - normalizedTime(data.time)).toFixed(1));
    text('coinValue', Math.max(0, Math.floor(finite(data.coins))));
  }

  function handleEnd(event) {
    const data = event.detail || {};
    result = {
      score: normalizedScore(data.score),
      time: normalizedTime(data.time),
      reason: data.reason === 'win' ? 'win' : 'fall',
      coins: Math.max(0, Math.floor(finite(data.coins))),
      combo: Math.max(0, Math.floor(finite(data.combo)))
    };
    const newBest = result.score > best.score || (result.score === best.score && result.time > best.time);
    if (newBest) {
      best = { score: result.score, time: result.time };
      persist();
    }
    text('bestValue', best.score);
    show('bestBadge', newBest);
    text('bestBadge', '刷新个人纪录');
    text('resultScore', result.score);
    text('resultStats', `坚持 ${result.time.toFixed(1)} 秒 · 收集 ${result.coins} 枚金币 · 连击 ${result.combo}`);
    let eyebrow = '今日下班路，需要一点操作';
    let title;
    let quip;
    if (result.reason === 'win') {
      title = '今天准点下班。';
      quip = '地球都被你转明白了。把同一条下班路发给朋友，看看谁赚得更多。';
    } else if (result.time < 10) {
      title = '地球没下班，你先下去了。';
      quip = '人会自己跳，你负责转地球。把实心地面转到脚下，再试一次！';
    } else if (result.time < 20) {
      title = '班没少上，路没站稳。';
      quip = '红色缺口不能踩。左右转动地球，给下一跳找一块落脚地。';
    } else {
      title = '差一点，打卡成功。';
      quip = `已经坚持 ${result.time.toFixed(1)} 秒。再稳住几跳，下班就在前面。`;
    }
    if (mode === 'challenge' && challenge) {
      const won = result.score > challenge.score;
      const tied = result.score === challenge.score;
      eyebrow = won ? `接招成功 · 超过朋友的 ${challenge.score} 分` : tied ? '分数打平 · 同班同命？' : `朋友 ${challenge.score} 分 · 你 ${result.score} 分`;
      if (won) quip = '你更会转，也更会赚。把同一路线发回去，轮到朋友追你了。';
      else if (tied) quip = '同一条下班路，居然赚得一样多。再转一次，分个高下。';
      else quip = `朋友留下 ${challenge.score} 分。再来同一条路线，多捡几枚金币就有机会。`;
    }
    text('resultEyebrow', eyebrow);
    text('resultTitle', title);
    text('resultQuip', quip);
    setState('result');
    exposeUrl();
  }

  function challengeUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('seed', String(currentSeed));
    url.searchParams.set('beat', String(result ? result.score : best.score));
    return url.href;
  }

  function shareText() {
    const score = result ? result.score : best.score;
    return `我转着地球赶下班，拿下 ${score} 分！\n《旋转地球去下班》人自己跳，你负责转动整个星球。\n同一条下班路，你能超过我吗？点开就能玩。`;
  }

  function exposeUrl(focus = false) {
    show('shareFallback', true);
    const input = $('shareUrl');
    if (!input) return;
    input.value = challengeUrl();
    if (focus) {
      input.focus({ preventScroll: true });
      input.select();
      input.setSelectionRange(0, input.value.length);
    }
  }

  async function copyChallenge() {
    exposeUrl();
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(challengeUrl());
      toast('挑战链接已复制，发给朋友赶下班！');
    } catch (_) {
      exposeUrl(true);
      toast('链接已选中，长按复制，发给朋友接招。', 4000);
    }
  }

  async function shareChallenge() {
    const url = challengeUrl();
    exposeUrl();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '旋转地球去下班 · 来接招', text: shareText(), url });
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    await copyChallenge();
  }

  function listen(id, action) {
    $(id)?.addEventListener('click', action);
  }

  function init() {
    readSaved();
    readChallenge();
    text('bestValue', best.score);
    resetHud();
    updateMode();
    setState('intro');
    applySound();
    listen('startBtn', () => startRound());
    listen('dailyBtn', () => startRound('daily'));
    listen('retryBtn', () => startRound());
    listen('newBtn', () => startRound('new'));
    listen('pauseBtn', pauseRound);
    listen('resumeBtn', resumeRound);
    listen('helpBtn', openHelp);
    listen('closeHelpBtn', closeHelp);
    listen('homeBtn', goHome);
    listen('shareBtn', shareChallenge);
    listen('copyBtn', copyChallenge);
    listen('selectUrlBtn', () => {
      const input = $('shareUrl');
      if (input) {
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
        toast('链接已选中，长按选择复制。');
      }
    });
    listen('soundBtn', () => {
      sound = !sound;
      applySound();
      persist();
      toast(sound ? '音效已开启' : '音效已关闭');
    });
    window.addEventListener('planet:tick', handleTick);
    window.addEventListener('planet:end', handleEnd);
    window.addEventListener('planet:pause', () => {
      if (uiState === 'playing') setState('paused');
    });
    window.addEventListener('keydown', (event) => {
      if (event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (event.key === 'Escape') {
        if (uiState === 'help') closeHelp();
        else if (uiState === 'playing') pauseRound();
        else if (uiState === 'paused') resumeRound();
      } else if (event.key === 'Enter' && uiState === 'intro' && tag !== 'BUTTON') {
        event.preventDefault();
        startRound();
      } else if (event.key.toLowerCase() === 'r' && (uiState === 'result' || uiState === 'paused')) {
        event.preventDefault();
        startRound();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && uiState === 'playing') pauseRound();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
