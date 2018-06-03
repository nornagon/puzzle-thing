const puzzleList = document.querySelector('#puzzle-list')
const fs = require('fs')
const puzzleText = fs.readFileSync('puzzles.txt', 'utf8')

import * as P from 'parsimmon';

function line<T>(p: P.Parser<T>) {
  return p.skip(P.regexp(/\s*(\n|$)/m))
}
function brack<T>(p: P.Parser<T>) {
  return P.string("[").then(p).skip(P.string("]"))
}

let PuzzleParser = P.createLanguage({
  puzzles: r => r.puzzle.many(),
  puzzle: r => r.whitespace.then(P.seq(
    r.name,
    r.dimensions,
    r.grid,
    r.defns,
  )).map(([name, dimensions, grid, defns]) => ({
    name,
    dimensions,
    grid,
    defns,
  })),
  whitespace: () => P.regexp(/\s*/),
  name: () => line(brack(P.regexp(/[^\]]+/))),
  integer: () => P.regexp(/[0-9]+/).map(Number),
  dimensions: r => line(P.seq(r.integer.skip(P.string("x")), r.integer)),
  grid: () =>
    line(P.regexp(/.+\|/).map(s => s.slice(0, -1))).many()
      .skip(line(P.regexp(/-+\+/))),
  signal: () => brack(P.regexp(/[- 0+]+/)),
  in: r => P.string("in").skip(r.whitespace).then(r.signal).map(s => ({in: s})),
  out: r => P.string("out").skip(r.whitespace).then(r.signal).map(s => ({out: s})),
  defn: r => P.seq(
    P.regexp(/[^|]/).skip(P.string(':')).skip(r.whitespace),
    P.alt(
      r.in,
      r.out,
      P.alt(
        ...["solid", "open"].map(P.string)
      )
    )
  ),
  defns: r => line(r.defn).many(),
})

const puzzles = PuzzleParser.puzzles.tryParse(puzzleText)

puzzleList.innerHTML = `<ul>${puzzles.map((p: any, i: number) => `<li data-id=${i}>${p.name}</li>`).join('')}</ul>`
;(puzzleList.children[0] as HTMLElement).addEventListener('click', (e: MouseEvent) => {
  const puzzleId = Number((e.target as HTMLElement).dataset.id)
  const puzzleFrame = document.createElement('iframe')
  puzzleFrame.src = 'index.html'
  puzzleFrame.style.opacity = '0.0001'
  puzzleFrame.addEventListener('load', () => {
    puzzleFrame.contentWindow.close = () => {
      puzzleFrame.remove()
      document.body.classList.remove('puzzling')
    }
    puzzleFrame.contentWindow.loadPuzzle(puzzles[puzzleId])
    puzzleFrame.style.opacity = null
  })
  document.body.appendChild(puzzleFrame)
  document.body.classList.add('puzzling')
})
