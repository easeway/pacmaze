import { Facing, Cell, facingOpposite } from './maze';

const ADD_ROW = [0, -1, 0, 1];
const ADD_COL = [-1, 0, 1, 0];

function recursiveGenerate(cells: Cell[][], state: number[][], r: number, c: number): void {
    let [rows, cols] = [cells.length, cells[0].length];
    let facings = [Facing.Left, Facing.Up, Facing.Right, Facing.Down];
    for (let i = 0; i < 4; i ++) {
        let n = Math.floor(Math.random() * 4);
        if (n != i) {
            [facings[n], facings[i]] = [facings[i], facings[n]];
        }
    }
    for (let i = 0; i < 4; i ++) {
        state[r][c] = i;
        if (!cells[r][c].hasWall(facings[i])) continue;
        let [r1, c1] = [r + ADD_ROW[facings[i]], c + ADD_COL[facings[i]]];
        if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols || state[r1][c1] != -1) {
            continue;
        }
        let neighborWall = facingOpposite(facings[i]);
        //console.log(`CELL[${r},${c}] ${facings[i]} -> [${r1},${c1}] ${neighborWall}`);
        cells[r][c].removeWall(facings[i]);
        cells[r1][c1].removeWall(neighborWall);
        recursiveGenerate(cells, state, r1, c1);
    }
}

export function RecursiveBacktracking(cells: Cell[][]): void {
    let state: number[][] = [];
    for (let r = 0; r < cells.length; r ++) {
        let row = [];
        for (let c = 0; c < cells[r].length; c ++) {
            row.push(-1);
        }
        state.push(row);
    }
    recursiveGenerate(cells, state, 0, 0);
}
