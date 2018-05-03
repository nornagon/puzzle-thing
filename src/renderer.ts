// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
import * as Simulator from "./simulator";
import {ipcRenderer} from "electron";
ipcRenderer.on('puzzle', (e: any, msg: string) => {
  const puzzle = JSON.parse(msg)
  console.log(puzzle)
  loadPuzzle(puzzle)
  draw()
  ipcRenderer.sendToHost('puzzle-loaded')
})

type Input = {
  label: string;
  position: { x: number; y: number; };
  signal: Array<number>;
}

type Output = {
  label: string;
  position: { x: number; y: number; };
  requiredSignal: Array<number | undefined>;
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
;(document.querySelector('#controls #play') as HTMLButtonElement).onclick = play
;(document.querySelector('#controls #back') as HTMLButtonElement).onclick = () => {
  window.close()
}

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
const outputs: Array<Output> = [];

let running = false;
let finished = false;
let initial = '';
let timeIndex = 0;
let correct = true;
let recordedOuts: { [label: string]: Array<number>; } = {}

let playingTimer: number = 0

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
  ctx.fillStyle = 'black'
  ctx.textBaseline = 'top'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.lineJoin = 'bevel'
  inputs.forEach(inp => {
    const {x, y} = inp.position
    const {px, py} = worldToScreen(x, y)
    ctx.strokeText(inp.label, px, py)
    ctx.fillText(inp.label, px, py)
  });
  outputs.forEach(out => {
    const {x, y} = out.position
    const {px, py} = worldToScreen(x, y)
    ctx.strokeText(out.label, px, py)
    ctx.fillText(out.label, px, py)
  })
  ctx.restore()

  ioCanvas.width = ioCanvas.getBoundingClientRect().width * devicePixelRatio
  ioCanvas.height = (18 * (inputs.length + outputs.length) + 2) * devicePixelRatio
  const ioCtx = ioCanvas.getContext('2d')
  ioCtx.scale(devicePixelRatio, devicePixelRatio)
  ioCtx.fillStyle = 'black';
  ioCtx.fillRect(0, 0, ioCtx.canvas.width, ioCtx.canvas.height)
  ioCtx.save()
  inputs.forEach(inp => {
    drawInput(inp, ioCtx)
    ioCtx.translate(0, 18)
  })
  outputs.forEach(out => {
    drawOutput(out, ioCtx)
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
  ctx.save()
  ctx.lineJoin = 'bevel'
  ctx.textBaseline = 'top'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
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

function drawOutput(output: Output, ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.lineJoin = 'bevel'
  ctx.textBaseline = 'top'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.strokeText(output.label, 4, 1)
  ctx.fillText(output.label, 4, 1)
  ctx.restore()

  const stepSize = 8

  const y = 8
  const pHeight = 8

  const recorded = recordedOuts[output.label] || []
  ctx.save()
  ctx.translate(16, 1)
  ctx.strokeStyle = 'gray'
  ctx.beginPath()
  ctx.moveTo(0, y + pHeight * -recorded[0])
  for (let t = 0; t < recorded.length; t++) {
    const v = recorded[t]
    ctx.lineTo(t * stepSize, y + pHeight * -v)
    ctx.lineTo((t + 1) * stepSize, y + pHeight * -v)
    const req = output.requiredSignal[t]
    if (req != undefined && Math.sign(req) !== Math.sign(v)) {
      ctx.fillStyle = 'red'
      ctx.fillRect(t * stepSize, y - pHeight, stepSize, pHeight * 2)
    }
  }
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.translate(16, 1)
  ctx.strokeStyle = 'white'
  ctx.beginPath()
  ctx.moveTo(0, y + pHeight * -output.requiredSignal[0])
  for (let t = 0; t < output.requiredSignal.length; t++) {
    const v = output.requiredSignal[t]
    if (v != undefined) {
      if (t > 0 && output.requiredSignal[t-1] == undefined)
        ctx.moveTo(t * stepSize, y + pHeight * -v)
      else
        ctx.lineTo(t * stepSize, y + pHeight * -v)
      ctx.lineTo((t + 1) * stepSize, y + pHeight * -v)
    }
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
  if (finished) {
    return;
  }
  sim.step()
  for (let i of inputs) {
    const s = i.signal[timeIndex];
    if (s > 0) {
      sim.set(i.position.x, i.position.y, 'positive')
    } else if (s < 0) {
      sim.set(i.position.x, i.position.y, 'negative')
    } else {
      sim.set(i.position.x, i.position.y, 'thinsolid')
    }
  }
  const pressure = sim.getPressure();
  for (let i of outputs) {
    const p = pressure[`${i.position.x},${i.position.y}`] || 0
    if (!(i.label in recordedOuts)) recordedOuts[i.label] = []
    recordedOuts[i.label].push(p)
    const s = i.requiredSignal[timeIndex];
    if (s !== undefined) {
      if (Math.sign(p) !== Math.sign(s)) {
        correct = false;
      }
    }
  }
  timeIndex += 1;
  const end = Math.max.apply(Math, inputs.map(i => i.signal.length).concat(outputs.map(o => o.requiredSignal.length)))
  draw()
  if (timeIndex === end) {
    finished = true;
    if (correct) {
      setTimeout(() => alert('you did it!'))
    } else {
      setTimeout(() => alert('try again'))
    }
  }
}

function play() {
  if (playingTimer) {
    clearInterval(playingTimer)
    playingTimer = 0
    return
  }
  playingTimer = window.setInterval(step, 250)
  step()
}

function reset() {
  if (!running)
    return;
  if (playingTimer) {
    clearInterval(playingTimer);
    playingTimer = 0;
  }
  finished = false;
  running = false;
  timeIndex = 0;
  correct = true;
  recordedOuts = {};
  sim.setGrid(JSON.parse(initial));
  draw();
}

type PuzzleLetterDef =
  "solid" | "open" | {in: string} | {out: string};
type PuzzleDef = {
  name: string;
  dimensions: [number, number];
  grid: [string];
  defns: [[string, PuzzleLetterDef]];
};

function loadPuzzle(puzzleDef: PuzzleDef) {
  const grid: {[k: string]: string} = {};
  forbidden.clear();
  inputs.length = 0;
  outputs.length = 0;
  const defnsByChar: { [c: string]: PuzzleLetterDef } = {}
  for (let [letter, def] of puzzleDef.defns) {
    defnsByChar[letter] = def;
  }
  for (let y in puzzleDef.grid) {
    const line = puzzleDef.grid[y];
    for (let x in (line as any)) {
      const c = line[Number(x)];
      if (c !== ' ') {
        const k = `${x},${y}`
        const def = defnsByChar[c];
        if (!def) debugger;
        if (typeof def === 'string') {
          grid[k] = def
        } else {
          if ('in' in def) {
            const signal = def.in.split('').map(x => x === '0' ? 0 : x === '+' ? 1 : x === '-' ? -1 : undefined)
            grid[k] = signal[0] < 0 ? 'negative' : signal[0] > 0 ? 'positive' : 'thinsolid';
            inputs.push({
              label: c,
              position: {x: Number(x), y: Number(y)},
              signal,
            })
          } else if ('out' in def) {
            const requiredSignal = def.out.split('').map(x => x === '0' ? 0 : x === '+' ? 1 : x === '-' ? -1 : undefined)
            grid[k] = 'thinsolid';
            outputs.push({
              label: c,
              position: {x: Number(x), y: Number(y)},
              requiredSignal,
            })
          }
        }
        forbidden.add(k);
      }
    }
  }
  bounds.width = puzzleDef.dimensions[0]
  bounds.height = puzzleDef.dimensions[1]
  sim.setGrid(grid);
}
