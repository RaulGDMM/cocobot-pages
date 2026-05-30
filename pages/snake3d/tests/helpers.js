// ─── Test Helpers ───
// In Jest, `snake = [...]` creates a local variable that shadows the global.
// These helpers mutate the actual global arrays that the source functions reference.

function setSnake(segments) {
  snake.length = 0;
  segments.forEach(s => snake.push(s));
}

function setApples(items) {
  apples.length = 0;
  items.forEach(a => apples.push(a));
}

function setObstacles(items) {
  obstacles.length = 0;
  items.forEach(o => obstacles.push(o));
}

module.exports = { setSnake, setApples, setObstacles };
