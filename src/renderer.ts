// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
import * as Simulator from "./simulator";

type Input = {
  label: string;
  position: { x: number; y: number; };
  signal: Array<number>;
}

const sim = new Simulator({
  '1,2': 'positive',
  '1,3': 'nothing',
  '1,4': 'shuttle',
  '1,5': 'nothing',
})

const canvas: HTMLCanvasElement = document.querySelector('#board canvas')
const {width, height} = canvas.getBoundingClientRect()
canvas.width = width * devicePixelRatio
canvas.height = height * devicePixelRatio

;(document.querySelector('#controls #step') as HTMLButtonElement).onclick = step
;(document.querySelector('#controls #stop') as HTMLButtonElement).onclick = reset

let brush = 'nothing'

Array.prototype.forEach.call(document.querySelectorAll('#palette button'), (e: HTMLButtonElement) => {
  e.onclick = () => {
    brush = e.dataset.paint;
  }
});

const ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio)
const size = 16;

const bounds = { width: 8, height: 8 };
const forbidden = new Set();

const inputs: Array<Input> = [];

let running = false;
let initial = '';
let timeIndex = 0;

const draw = () => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const colors: { [t: string]: string } = {
    bridge: '#2E96D6',
    negative: '#D65729',
    nothing: '#FFFFFF',
    positive: '#5CCC5C',
    shuttle: '#9328BD',
    solid: '#09191B',
    thinshuttle: '#D887F8',
    thinsolid: '#B5B5B5',
    buttonup: '#CC7B00'
  };
  const pressure = sim.getPressure();
  const worldToScreen = (tx: number, ty: number) => ({
    px: tx * size,
    py: ty * size
  });
  for (let k in sim.grid) {
    const { x: tx, y: ty } = Simulator.parseXY(k);
    const {px, py} = worldToScreen(tx, ty);
    const v = sim.grid[k];
    if (v !== 'solid') {
      ctx.fillStyle = colors[v];
      ctx.fillRect(px, py, size, size);
    }
    const p = pressure[k] || 0
    if (p !== 0) {
      ctx.fillStyle = p < 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,0,0.15)';
      ctx.fillRect(px, py, size, size)
    }
  }
}

function paint(e: MouseEvent) {
  if (running) return;
  const { offsetX: x, offsetY: y } = e;
  const tx = Math.floor(x / size);
  const ty = Math.floor(y / size);
  if (tx >= 0 && tx < bounds.width && ty >= 0 && ty < bounds.height && !forbidden.has(`${tx},${ty}`)) {
    sim.set(tx, ty, brush);
  }
  draw();
}
canvas.onmousedown = paint
canvas.onmousemove = (e) => {
  if (e.buttons == 1) {
    paint(e)
  }
}

function step() {
  if (!running) {
    running = true;
    initial = JSON.stringify(sim.grid);
  }
  sim.step()
  for (let i of inputs) {
    const s = i.signal[timeIndex];
    if (s > 0) {
      sim.set(i.position.x, i.position.y, 'positive')
    } else if (s < 0) {
      sim.set(i.position.x, i.position.y, 'negative')
    } else {
      sim.set(i.position.x, i.position.y, 'nothing')
    }
  }
  timeIndex += 1;
  draw()
}

function reset() {
  if (!running)
    return;
  running = false;
  timeIndex = 0;
  sim.setGrid(JSON.parse(initial));
  draw();
}

type PuzzleDef = {
  name: string;
  width: number;
  height: number;
  grid: { [k: string]: string };
  letterDefs: { [k: string]: string };
};

function loadPuzzle(puzzleDef: PuzzleDef) {
  const grid: {[k: string]: string} = {};
  forbidden.clear();
  for (let k in puzzleDef.grid) {
    const v = puzzleDef.grid[k];
    grid[k] = puzzleDef.letterDefs[v];
    forbidden.add(k);
  }
  bounds.width = puzzleDef.width
  bounds.height = puzzleDef.height
  sim.setGrid(grid);
}

loadPuzzle({
  name: 'and',
  width: 6,
  height: 6,
  grid: {
    '1,1': 'p',
    '1,4': 'p',
    '4,1': 'n',
  },
  letterDefs: {
    'p': 'positive',
    'n': 'negative',
  }
});

draw()
