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
const ioCanvas: HTMLCanvasElement = document.querySelector('#io canvas')

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

const draw = () => {
  const worldToScreen = (tx: number, ty: number) => ({
    px: tx * size,
    py: ty * size
  });

  ctx.fillStyle = '#d6ae3e';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = colors.solid
  const origin = worldToScreen(0, 0)
  const boundEdge = worldToScreen(bounds.width, bounds.height)
  ctx.fillRect(origin.px, origin.py, boundEdge.px, boundEdge.py)

  const pressure = sim.getPressure();
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
  ctx.save()
  inputs.forEach(inp => {
    const {x, y} = inp.position
    const {px, py} = worldToScreen(x, y)
    ctx.fillStyle = 'black'
    ctx.textBaseline = 'top'
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.lineJoin = 'bevel'
    ctx.strokeText(inp.label, px, py)
    ctx.fillText(inp.label, px, py)
  });
  ctx.restore()

  ioCanvas.width = ioCanvas.getBoundingClientRect().width * devicePixelRatio
  ioCanvas.height = (18 * inputs.length + 2) * devicePixelRatio
  const ioCtx = ioCanvas.getContext('2d')
  ioCtx.scale(devicePixelRatio, devicePixelRatio)
  ioCtx.save()
  inputs.forEach(inp => {
    drawInput(inp, ioCtx)
    ioCtx.translate(0, 18)
  })
  ioCtx.restore()

  if (running) {
    ioCtx.save()
    ioCtx.translate(16, 0)
    ioCtx.strokeStyle = 'red'
    ioCtx.beginPath()
    ioCtx.moveTo(timeIndex * 8, 0)
    ioCtx.lineTo(timeIndex * 8, ioCtx.canvas.height - 1)
    ioCtx.stroke()
    ioCtx.restore()
  }
}

function drawInput(input: Input, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.strokeStyle = 'white'
  ctx.strokeText(input.label, 4, 1)
  ctx.fillText(input.label, 4, 1)
  ctx.restore()

  const stepSize = 8

  const y = 8
  const pHeight = -8

  ctx.save()
  ctx.translate(16, 1)
  ctx.strokeStyle = 'white'
  ctx.beginPath()
  ctx.moveTo(0, y + pHeight * input.signal[0])
  for (let t = 0; t < input.signal.length; t++) {
    const v = input.signal[t]
    ctx.lineTo(t * stepSize, y + pHeight * v)
    ctx.lineTo((t + 1) * stepSize, y + pHeight * v)
  }
  ctx.stroke()
  ctx.restore()
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
  letterDefs: { [k: string]: Input };
};

function loadPuzzle(puzzleDef: PuzzleDef) {
  const grid: {[k: string]: string} = {};
  forbidden.clear();
  inputs.length = 0;
  for (let k in puzzleDef.grid) {
    const v = puzzleDef.grid[k];
    const inp = puzzleDef.letterDefs[v];
    grid[k] = inp.signal[0] < 0 ? 'negative' : inp.signal[0] > 0 ? 'positive' : 'nothing';
    inputs.push(inp);
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
    '1,1': 'A',
    '1,4': 'B',
    //'4,1': 'n',
  },
  letterDefs: {
    'A': {
      position: {x: 1, y: 1},
      signal: [0,1,1,0,0,0,0,1,1,0,0,0,-1,0,0],
      label: 'A',
    },
    'B': {
      position: {x: 1, y: 4},
      signal: [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
      label: 'B',
    },
    //'n': 'negative',
  }
});

draw()
