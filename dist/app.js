'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const levels = { easy: { size: 6, min: 12, max: 24 }, medium: { size: 8, min: 24, max: 52 }, hard: { size: 11, min: 42, max: 100 } };
  const storageKey = 'bunny-maze-v1';
  const NS = 'http://www.w3.org/2000/svg';
  const board = $('#maze-board'), svg = $('#maze-svg'), success = $('#success-dialog');
  let level = 'easy', maze, position = 0, steps = 0, history = [0], round = 1, wins = 0, completed = false;
  let sound = false, audio, toastTimer, hintTimer, pointer, hintCells = [], token;
  const inset = 32, available = 536;
  function readSaved() { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ level, maze, position, steps, history, round, wins, completed, sound })); } catch { /* Play remains available when storage is disabled. */ }
  }
  function element(tag, attrs = {}, parent = svg) {
    const item = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => item.setAttribute(key, value));
    parent.append(item); return item;
  }
  function cellCenter(index) { const unit = available / maze.size; return [inset + (index % maze.size + .5) * unit, inset + (Math.floor(index / maze.size) + .5) * unit]; }
  function notify(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2700);
  }
  function tone(frequency, duration = .09, delay = 0, volume = .035) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + delay;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .01); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration + .02);
    } catch { /* Sound is an optional enhancement. */ }
  }
  function updateControls() {
    $$('.difficulty').forEach(button => { const active = button.dataset.level === level; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    $('#steps').textContent = `已走 ${steps} 步`;
    $('#round').textContent = `NO. ${String(round).padStart(2, '0')}`;
    $('#wins').textContent = wins;
    $('#sound').setAttribute('aria-pressed', String(sound));
    $('#sound').setAttribute('aria-label', sound ? '关闭声音' : '开启声音'); $('#sound').title = sound ? '关闭声音' : '开启声音';
    $('#sound use').setAttribute('href', sound ? '#i-sound' : '#i-muted');
    $('#adventure-status').textContent = completed ? '探险成功啦' : '探险进行中';
    const x = position % maze.size + 1, y = Math.floor(position / maze.size) + 1;
    board.setAttribute('aria-label', `迷宫，${maze.size} 行 ${maze.size} 列。小兔在第 ${y} 行第 ${x} 列。已走 ${steps} 步。目标在右下角。滑动、点按相邻格子或使用键盘移动。`);
  }
  function draw() {
    svg.replaceChildren();
    const unit = available / maze.size, n = maze.size;
    // A quiet dotted ground keeps the corridors legible without becoming a visual grid.
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const [cx, cy] = cellCenter(y * n + x); element('circle', { cx, cy, r: 1.6, fill: '#dce3cc' });
    }
    const [sx, sy] = cellCenter(0), [gx, gy] = cellCenter(n * n - 1);
    element('rect', { x: sx - unit * .37, y: sy - unit * .37, width: unit * .74, height: unit * .74, rx: unit * .22, fill: '#e6ecd6' });
    element('rect', { x: gx - unit * .39, y: gy - unit * .39, width: unit * .78, height: unit * .78, rx: unit * .24, fill: '#f8e6c6' });
    element('polyline', { id: 'trail', class: 'trail' });
    element('g', { id: 'breadcrumbs' });
    element('polyline', { id: 'hint-path', class: 'hint-path' });
    const goal = element('g', { class: 'goal-token' });
    element('use', { href: '#carrot', x: gx - unit * .26, y: gy - unit * .34, width: unit * .52, height: unit * .62 }, goal);
    const wallSegments = [];
    maze.cells.forEach((cell, index) => {
      const x = index % n, y = Math.floor(index / n), left = inset + x * unit, top = inset + y * unit;
      if (y > 0 && cell[0]) wallSegments.push(`M${left} ${top}h${unit}`);
      if (x > 0 && cell[3]) wallSegments.push(`M${left} ${top}v${unit}`);
    });
    element('path', { class: 'maze-wall', d: wallSegments.join(' '), style: `stroke-width:${n > 8 ? 6 : 7}px` });
    element('rect', { class: 'maze-boundary', x: inset, y: inset, width: available, height: available, rx: 8 });
    token = element('g', { class: 'player-token', id: 'player' });
    element('ellipse', { cx: 0, cy: unit * .24, rx: unit * .28, ry: unit * .085, fill: '#85976c', opacity: '.16' }, token);
    element('use', { href: '#bunny', x: -unit * .35, y: -unit * .44, width: unit * .7, height: unit * .78 }, token);
    updatePlayer();
  }
  function updatePlayer() {
    const [x, y] = cellCenter(position); token.style.transform = `translate(${x}px, ${y}px)`;
    $('#trail').setAttribute('points', history.map(i => cellCenter(i).join(',')).join(' '));
    const dots = $('#breadcrumbs'); dots.replaceChildren();
    history.slice(0, -1).forEach(index => { const [cx, cy] = cellCenter(index); element('circle', { cx, cy, r: Math.max(2, available / maze.size * .035), class: 'trail-dot' }, dots); });
    $('#hint-path').setAttribute('points', hintCells.map(i => cellCenter(i).join(',')).join(' '));
    updateControls();
  }
  function clearHint() { clearTimeout(hintTimer); hintCells = []; $('#hint-path')?.setAttribute('points', ''); }
  function newMaze(nextLevel = level) {
    pointer = null; clearHint(); success.close(); level = nextLevel;
    const config = levels[level];
    for (let attempt = 0; attempt < 60; attempt++) {
      maze = Maze.generate(config.size); const length = Maze.route(maze, 0).length - 1;
      if (length >= config.min && length <= config.max) break;
    }
    position = 0; steps = 0; history = [0]; completed = false; draw(); save();
    $('#encouragement-title').textContent = '每一步，都很棒！';
    $('#encouragement-text').textContent = '走错也没关系，换个方向试试看。';
  }
  function restart() {
    pointer = null; clearHint(); success.close(); position = 0; steps = 0; history = [0]; completed = false; draw(); save();
    notify('小兔回到起点啦，再试一次吧！');
  }
  function move(dir) {
    if (completed || success.open || document.hidden) return;
    const next = Maze.step(maze, position, dir);
    if (next === position) {
      token.classList.remove('bump'); void token.getBoundingClientRect(); token.classList.add('bump');
      return;
    }
    clearHint(); position = next; steps++;
    const previous = history.indexOf(next);
    if (previous >= 0) history = history.slice(0, previous + 1); else history.push(next);
    updatePlayer(); tone(430 + (steps % 5) * 40, .055, 0, .018);
    if (position === maze.cells.length - 1) complete();
    else if (steps === 8) { $('#encouragement-title').textContent = '小兔喜欢和你一起探险！'; $('#encouragement-text').textContent = '观察前面的路，慢慢走就好。'; }
    save();
  }
  function complete() {
    completed = true; wins++; pointer = null; clearHint(); updateControls();
    $('#success-stat').textContent = `${{ easy: '轻松', medium: '进阶', hard: '挑战' }[level]}探险完成 · 一共走了 ${steps} 步`;
    $('#encouragement-title').textContent = '找到啦！你真棒！'; $('#encouragement-text').textContent = '下一片森林，藏着什么小惊喜呢？';
    const confetti = $('.confetti'); confetti.replaceChildren();
    for (let i = 0; i < 28; i++) { const dot = document.createElement('i'); dot.style.setProperty('--left', `${Math.random() * 100}%`); dot.style.setProperty('--delay', `${Math.random() * .6}s`); dot.style.setProperty('--color', ['#e2ae6b', '#9cb785', '#efbfaa', '#d6c982'][i % 4]); confetti.append(dot); }
    success.showModal(); tone(523.25, .18); tone(659.25, .18, .14); tone(783.99, .2, .28); tone(1046.5, .3, .45);
  }
  board.addEventListener('contextmenu', event => event.preventDefault());
  board.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || completed) return;
    event.preventDefault(); board.focus({ preventScroll: true }); board.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  });
  board.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId || completed) return;
    const rect = board.getBoundingClientRect(), threshold = Math.max(15, rect.width * available / 600 / maze.size * .67);
    let dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    // Consume motion in cell-sized steps, even if a fast swipe arrives in a single event.
    for (let iteration = 0; iteration < maze.size && Math.max(Math.abs(dx), Math.abs(dy)) >= threshold; iteration++) {
      pointer.moved = true;
      if (Math.abs(dx) > Math.abs(dy)) { move(dx > 0 ? 1 : 3); if (!pointer) break; pointer.x += Math.sign(dx) * threshold; pointer.y = event.clientY; }
      else { move(dy > 0 ? 2 : 0); if (!pointer) break; pointer.y += Math.sign(dy) * threshold; pointer.x = event.clientX; }
      dx = event.clientX - pointer.x; dy = event.clientY - pointer.y;
    }
  });
  board.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX, dy = event.clientY - pointer.startY;
    if (!pointer.moved && Math.max(Math.abs(dx), Math.abs(dy)) > 12) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    else if (!pointer.moved) {
      const rect = board.getBoundingClientRect(), unit = available / maze.size;
      const x = Math.floor(((event.clientX - rect.left) / rect.width * 600 - inset) / unit);
      const y = Math.floor(((event.clientY - rect.top) / rect.height * 600 - inset) / unit);
      const px = position % maze.size, py = Math.floor(position / maze.size);
      if (x >= 0 && x < maze.size && y >= 0 && y < maze.size && Math.abs(x - px) + Math.abs(y - py) === 1) move(x > px ? 1 : x < px ? 3 : y > py ? 2 : 0);
    }
    pointer = null;
  });
  ['pointercancel', 'lostpointercapture'].forEach(type => board.addEventListener(type, () => { pointer = null; }));
  const keyDirections = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
  document.addEventListener('keydown', event => {
    if (success.open || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (Object.hasOwn(keyDirections, event.key)) { event.preventDefault(); move(keyDirections[event.key]); }
  });
  window.addEventListener('blur', () => { pointer = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pointer = null; });
  $$('.difficulty').forEach(button => button.addEventListener('click', () => { if (button.dataset.level === level) return; round++; newMaze(button.dataset.level); tone(620, .1); notify(`换到${{ easy: '轻松', medium: '进阶', hard: '挑战' }[level]}迷宫啦，出发！`); }));
  $('#new-maze').addEventListener('click', () => { round++; newMaze(); notify('一张新的迷宫，等你来探索！'); });
  $('#restart').addEventListener('click', restart);
  $('#hint').addEventListener('click', () => {
    if (completed) { notify('胡萝卜已经找到啦，换一张继续探险吧！'); return; }
    clearHint(); hintCells = Maze.route(maze, position).slice(0, 3); updatePlayer(); tone(660, .12);
    notify('跟着金色小路走两步，再自己试试吧！'); hintTimer = setTimeout(clearHint, 5000);
  });
  $('#sound').addEventListener('click', () => { sound = !sound; updateControls(); save(); tone(660, .1); notify(sound ? '森林的声音打开啦' : '已开启安静探险'); });
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify('可以通过浏览器菜单进入全屏');
    } catch { notify('可以通过浏览器菜单进入全屏'); }
  });
  document.addEventListener('fullscreenchange', () => { const label = document.fullscreenElement ? '退出全屏' : '进入全屏'; $('#fullscreen').setAttribute('aria-label', label); $('#fullscreen').title = label; });
  $('#close-success').addEventListener('click', () => success.close());
  $('#next-adventure').addEventListener('click', () => { round++; newMaze(); });
  $('#replay-maze').addEventListener('click', restart);
  success.addEventListener('close', () => board.focus({ preventScroll: true }));
  $('.brand').addEventListener('click', event => { event.preventDefault(); board.focus({ preventScroll: true }); });
  function validSaved(data) {
    if (!data || !Object.hasOwn(levels, data.level) || !data.maze || data.maze.size !== levels[data.level].size) return false;
    const n = data.maze.size, cells = data.maze.cells;
    if (!Array.isArray(cells) || cells.length !== n * n || !cells.every(cell => Array.isArray(cell) && cell.length === 4 && cell.every(wall => typeof wall === 'boolean'))) return false;
    if (!Number.isInteger(data.position) || data.position < 0 || data.position >= cells.length || !Number.isSafeInteger(data.steps) || data.steps < 0) return false;
    if (!Number.isSafeInteger(data.round) || data.round < 1 || !Number.isSafeInteger(data.wins) || data.wins < 0 || typeof data.completed !== 'boolean' || typeof data.sound !== 'boolean') return false;
    for (let i = 0; i < cells.length; i++) {
      if ((i < n && !cells[i][0]) || (i % n === n - 1 && !cells[i][1]) || (i >= cells.length - n && !cells[i][2]) || (i % n === 0 && !cells[i][3])) return false;
      for (const next of Maze.neighbors(data.maze, i)) if (cells[i][next.dir] !== cells[next.index][(next.dir + 2) % 4]) return false;
    }
    if ((data.position === cells.length - 1) !== data.completed || !Maze.route(data.maze, 0, data.position).length || !Maze.route(data.maze, 0).length) return false;
    return true;
  }
  const saved = readSaved();
  if (validSaved(saved)) {
    ({ level, maze, position, steps, round, wins, completed, sound } = saved);
    history = Maze.route(maze, 0, position); draw();
    if (completed) { $('#encouragement-title').textContent = '找到啦！你真棒！'; $('#encouragement-text').textContent = '换一张迷宫，继续新的探险吧。'; }
  } else newMaze();
  // Offline support is optional; direct file opening still works without it.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
