(function (root) {
  'use strict';
  const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
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
  function generate(size, random = Math.random) {
    const maze = { size, cells: Array.from({ length: size * size }, () => [true, true, true, true]) };
    const visited = new Set([0]), stack = [0];
    while (stack.length) {
      const current = stack[stack.length - 1];
      const candidates = neighbors(maze, current).filter(n => !visited.has(n.index));
      if (!candidates.length) { stack.pop(); continue; }
      const next = candidates[Math.floor(random() * candidates.length)];
      maze.cells[current][next.dir] = false;
      maze.cells[next.index][(next.dir + 2) % 4] = false;
      visited.add(next.index); stack.push(next.index);
    }
    return maze;
  }
  function step(maze, index, dir) {
    if (dir < 0 || dir > 3 || maze.cells[index][dir]) return index;
    const [dx, dy] = vectors[dir];
    return index + dx + dy * maze.size;
  }
  const api = { generate, route, step, neighbors, vectors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Maze = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
