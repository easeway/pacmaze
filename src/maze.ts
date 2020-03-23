export interface Pos {
    row: number;
    col: number;
}

export enum Facing {
    Left,
    Up,
    Right,
    Down,
}

export const FacingNames = ['left', 'up', 'right', 'down'];

export function facingOpposite(f: Facing): Facing {
    return (f + 2) % 4;
}

export interface Pose extends Pos {
    facing: Facing;
}

export enum Marker {
    None,
    Visited,
    Blocked,
}

export class Cell {

    walls: number = 0x0f;
    marker: Marker = Marker.None;

    constructor() {
    }

    hasWall(facing: Facing): boolean {
        return (this.walls & 1 << facing) != 0;
    }

    removeWall(facing: Facing) {
        this.walls &= ~(1 << facing);
    }

    get wallNames(): string[] {
        return [0, 1, 2, 3].filter((f) => this.hasWall(f)).map((f) => FacingNames[f])
    }
}

export interface CellWalker {
    (cell: Cell, row: number, col: number): boolean;
}

export interface Generator {
    (cells: Cell[][]): void;    
}

export class Maze {
    cells: Cell[][] = [];

    constructor(public readonly rows: number, public readonly cols: number) {
        this.reset();
    }

    reset(): void {
        this.cells = [];
        for (let r = 0; r < this.rows; r ++) {
            let row = [];
            for (let c = 0; c < this.cols; c ++) {
                row.push(new Cell());
            }
            this.cells.push(row);
        }
        this.cells[0][0].removeWall(Facing.Left);
        this.cells[this.rows-1][this.cols-1].removeWall(Facing.Right);
    }

    generate(g: Generator): void {
        g(this.cells);
    }

    walkCell(w: CellWalker): boolean {
        for (let r = 0; r < this.cells.length; r ++) {
            for (let c = 0; c < this.cells[r].length; c ++) {
                if (!w(this.cells[r][c], r, c)) {
                    return false;
                }
            }
        }
        return true;
    }

    facingWall(pose: Pose): boolean {
        return this.cells[pose.row][pose.col].hasWall(pose.facing);
    }

    markerOf(pos: Pos): Marker {
        return this.cells[pos.row][pos.col].marker;
    }

    mark(pos: Pos, marker: Marker): void {
        this.cells[pos.row][pos.col].marker = marker;
    }

    toggleMark(pos: Pos, marker: Marker): void {
        let current = this.cells[pos.row][pos.col].marker;
        this.cells[pos.row][pos.col].marker = current == marker ? Marker.None : marker;
    }

    clearMarkers(): void {
        this.walkCell((cell, row, col) => { 
            cell.marker = Marker.None;
            return true;
        });
    }
}
