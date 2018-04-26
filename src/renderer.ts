// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
import * as Simulator from "./simulator";

const sim = new Simulator({
  '1,2': 'positive',
  '1,3': 'nothing',
  '1,4': 'shuttle',
  '1,5': 'nothing',
})

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth * devicePixelRatio
canvas.height = window.innerHeight * devicePixelRatio
document.body.appendChild(canvas)
document.body.style.backgroundColor = 'black'
canvas.style.position = 'absolute'
canvas.style.left = canvas.style.top = '0'
canvas.style.width = canvas.style.height = '100%'
const ui = document.body.appendChild(document.createElement('div'))
ui.id = 'ui'
const stepbtn = ui.appendChild(document.createElement('button'))
stepbtn.textContent = 'step'
stepbtn.onclick = () => step()
ui.style.position = 'absolute'
ui.style.left = ui.style.top = ui.style.right = ui.style.bottom = '0'

const ctx = canvas.getContext('2d')
ctx.scale(devicePixelRatio, devicePixelRatio)
const size = 16;

const bounds = { width: 8, height: 8 };
const forbidden = new Set();

const draw = () => {
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
    ctx.fillStyle = colors[v];
    ctx.fillRect(px, py, size, size);
    const p = pressure[k]
    if (p !== 0) {
      ctx.fillStyle = p < 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,0,0.15)';
      ctx.fillRect(px, py, size, size)
    }
  }
}

function paint(e: MouseEvent) {
  const { offsetX: x, offsetY: y } = e;
  const tx = Math.floor(x / size);
  const ty = Math.floor(y / size);
  if (tx >= 0 && tx < bounds.width && ty >= 0 && ty < bounds.height && !forbidden.has(`${tx},${ty}`)) {
    sim.set(tx, ty, 'nothing');
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
  sim.step()
  draw()
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
