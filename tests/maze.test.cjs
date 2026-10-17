const test = require('node:test');
const assert = require('node:assert/strict');
const Maze = require('../dist/maze.js');

function seeded(seed) {
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}

function inspect(maze) {
  const n = maze.size, graph = maze.cells.map(() => []);
  let edges = 0;
  maze.cells.forEach((walls, i) => {
    const x = i % n, y = Math.floor(i / n);
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + [0, 1, 0, -1][dir], ny = y + [-1, 0, 1, 0][dir];
      if (nx < 0 || nx >= n || ny < 0 || ny >= n) assert.equal(walls[dir], true, 'outer wall is closed');
      if (walls[dir]) { assert.equal(Maze.step(maze, i, dir), i); continue; }
      const next = ny * n + nx;
      assert.equal(maze.cells[next][(dir + 2) % 4], false, 'wall agrees in both directions');
      assert.equal(Maze.step(maze, i, dir), next);
      graph[i].push(next); edges++;
    }
  });
  const queue = [0], parent = new Map([[0, null]]);
  for (let head = 0; head < queue.length; head++) for (const next of graph[queue[head]]) {
    if (!parent.has(next)) { parent.set(next, queue[head]); queue.push(next); }
  }
  assert.equal(parent.size, n * n, 'every cell is reachable');
  assert.equal(edges / 2, n * n - 1, 'one unambiguous solution between cells');
  const path = [];
  for (let i = n * n - 1; i !== null; i = parent.get(i)) path.push(i);
  path.reverse();
  let turns = 0, decisions = 0;
  for (let i = 1; i < path.length - 1; i++) {
    if (path[i] - path[i - 1] !== path[i + 1] - path[i]) turns++;
    if (graph[path[i]].length >= 3) decisions++;
  }
  return { length: path.length - 1, turns, decisions, graph };
}

for (const [level, config] of Object.entries(Maze.levels)) {
  test(`${level}: 100 mazes are solvable and meet route, turn, and fork targets`, () => {
    for (let seed = 1; seed <= 100; seed++) {
      const maze = Maze.generateChallenge(level, seeded(seed * 7919));
      assert.equal(maze.size, config.size);
      const result = inspect(maze);
      assert.ok(result.length >= config.min && result.length <= config.max, `${level}, seed ${seed}, length ${result.length}`);
      assert.ok(result.turns >= config.turns, `${level}, seed ${seed}, turns ${result.turns}`);
      assert.ok(result.decisions >= config.decisions, `${level}, seed ${seed}, forks ${result.decisions}`);
      const from = Math.floor(maze.cells.length / 2), hint = Maze.route(maze, from);
      assert.equal(hint[0], from); assert.equal(hint.at(-1), maze.cells.length - 1);
      hint.slice(1).forEach((next, index) => assert.ok(result.graph[hint[index]].includes(next), 'hint never crosses a wall'));
    }
  });
}

test('generation remains bounded with a degenerate random source', () => {
  for (const level of Object.keys(Maze.levels)) inspect(Maze.generateChallenge(level, () => .5));
});
