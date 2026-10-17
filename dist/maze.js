(function (root) {
  'use strict';
  const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const levels = Object.freeze({
    easy: Object.freeze({ size: 8, min: 30, max: 50, turns: 12, decisions: 4, branching: .1 }),
    medium: Object.freeze({ size: 12, min: 64, max: 108, turns: 26, decisions: 9, branching: .06 }),
    hard: Object.freeze({ size: 16, min: 112, max: 176, turns: 46, decisions: 15, branching: .025 })
  });
  function neighbors(maze, index) {
    const x = index % maze.size, y = Math.floor(index / maze.size);
    return vectors.flatMap(([dx, dy], dir) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < maze.size && ny < maze.size
        ? [{ index: ny * maze.size + nx, dir }] : [];
    });
  }
  function route(maze, from, to = maze.cells.length - 1) {
    const queue = [from], previous = new Map([[from, null]]);
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (current === to) break;
      for (const next of neighbors(maze, current)) {
        if (!maze.cells[current][next.dir] && !previous.has(next.index)) {
          previous.set(next.index, current); queue.push(next.index);
        }
      }
    }
    if (!previous.has(to)) return [];
    const path = [];
    for (let at = to; at !== null; at = previous.get(at)) path.push(at);
    return path.reverse();
  }
  function generate(size, random = Math.random, branching = 0) {
    const maze = { size, cells: Array.from({ length: size * size }, () => [true, true, true, true]) };
    const visited = new Set([0]), stack = [0];
    while (stack.length) {
      // Occasionally grow an earlier branch to create meaningful choices instead of long corridors.
      const active = branching > 0 && random() < branching ? Math.floor(random() * stack.length) : stack.length - 1;
      const current = stack[active];
      const candidates = neighbors(maze, current).filter(n => !visited.has(n.index));
      if (!candidates.length) { stack.splice(active, 1); continue; }
      const next = candidates[Math.floor(random() * candidates.length)];
      maze.cells[current][next.dir] = false;
      maze.cells[next.index][(next.dir + 2) % 4] = false;
      visited.add(next.index); stack.push(next.index);
    }
    return maze;
  }
  function analyze(maze) {
    const path = route(maze, 0);
    let turns = 0, decisions = 0;
    for (let i = 1; i < path.length - 1; i++) {
      if (path[i] - path[i - 1] !== path[i + 1] - path[i]) turns++;
      if (maze.cells[path[i]].filter(wall => !wall).length > 2) decisions++;
    }
    return { length: path.length - 1, turns, decisions };
  }
  function generateChallenge(level, random = Math.random) {
    const config = levels[level];
    if (!config) throw new RangeError('Unknown maze level');
    let best, bestScore = -Infinity;
    for (let attempt = 0; attempt < 256; attempt++) {
      const maze = generate(config.size, random, config.branching), stats = analyze(maze);
      const distance = Math.max(0, config.min - stats.length, stats.length - config.max);
      const score = -distance * 100 + Math.min(stats.turns / config.turns, 1) + Math.min(stats.decisions / config.decisions, 1);
      if (score > bestScore) { best = maze; bestScore = score; }
      if (distance === 0 && stats.turns >= config.turns && stats.decisions >= config.decisions) return maze;
    }
    // Keep generation bounded on slower devices; every candidate is still a fully connected maze.
    return best;
  }
  function step(maze, index, dir) {
    if (dir < 0 || dir > 3 || maze.cells[index][dir]) return index;
    const [dx, dy] = vectors[dir];
    return index + dx + dy * maze.size;
  }
  const api = { levels, generate, generateChallenge, analyze, route, step, neighbors, vectors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Maze = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
