const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Maze = require('../dist/maze.js');
const source = fs.readFileSync(require.resolve('../dist/app.js'), 'utf8');

function loadGame(saved) {
  const nodes = new Map();
  class Node {
    constructor() { this.style = {}; this.dataset = {}; this.attrs = {}; this.classList = { toggle() {}, add() {}, remove() {} }; }
    setAttribute(key, value) { this.attrs[key] = String(value); if (key === 'id') nodes.set('#' + value, this); }
    append() {} replaceChildren() {} addEventListener() {} close() {} focus() {}
  }
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, new Node()); return nodes.get(selector); };
  let stored = JSON.stringify(saved), writes = 0;
  vm.runInNewContext(source, {
    Maze,
    document: { querySelector: get, querySelectorAll: () => [], createElementNS: () => new Node(), addEventListener() {} },
    window: { addEventListener() {} }, navigator: {}, location: { protocol: 'file:' },
    localStorage: { getItem: () => stored, setItem: (key, value) => { stored = value; writes++; } },
    setTimeout: () => 1, clearTimeout() {}
  });
  return { saved: JSON.parse(stored), writes, label: get('#maze-board').attrs['aria-label'], wins: get('#wins').textContent };
}

test('upgrading an old map retains wins, selected level, sound, and round number', () => {
  const result = loadGame({ level: 'hard', maze: Maze.generate(11), position: 0, steps: 0, history: [0], round: 7, wins: 5, completed: false, sound: true });
  assert.equal(result.saved.rulesVersion, 2);
  assert.equal(result.saved.maze.size, 16);
  assert.equal(result.saved.wins, 5); assert.equal(result.saved.sound, true);
  assert.equal(result.saved.level, 'hard'); assert.equal(result.saved.round, 8);
  assert.equal(result.saved.position, 0); assert.equal(result.saved.steps, 0);
});

test('refreshing a current map keeps the exact map and player position', () => {
  const maze = Maze.generateChallenge('medium'), position = Maze.route(maze, 0)[1];
  const saved = { rulesVersion: 2, level: 'medium', maze, position, steps: 1, round: 8, wins: 5, completed: false, sound: false };
  const result = loadGame(saved);
  assert.equal(result.writes, 0); assert.deepEqual(result.saved, saved);
  assert.match(result.label, /已走 1 步/); assert.equal(result.wins, 5);
});

test('corrupt metadata recovers to a playable map with valid defaults', () => {
  const result = loadGame({ level: 'unknown', wins: -10, sound: 'true', round: -1 });
  assert.equal(result.saved.maze.size, 8); assert.equal(result.saved.wins, 0);
  assert.equal(result.saved.sound, false); assert.equal(result.saved.round, 1);
});
