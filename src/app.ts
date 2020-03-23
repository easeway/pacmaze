import { Pose, Maze, Cell, Facing, Marker } from './maze';
import { RecursiveBacktracking } from './recursive_gen';
import { InputEventHandler, KeyEvent, GamepadStateEvent, GamepadState, GamepadButton, GamepadAxis, InputController } from './input';
import { Menu } from './menu';
import { Coder, MazeController } from './coder';

const ADD_ROW = [0, -1, 0, 1];
const ADD_COL = [-1, 0, 1, 0];
const FACING_ANGLES = [-180, -90, 0, 90];
const MARKER_CLASSES = ['', 'icon-foot', 'icon-cross'];

function updateMarkerClass(elem: HTMLElement, marker: Marker): void {
    MARKER_CLASSES.forEach((name, index) => {
        if (index == 0) return;
        if (index == marker) elem.classList.add(name);
        else elem.classList.remove(name);
    });
}

function gamepadStickDir(state: GamepadState, axis: number): Facing | null {
    let val = state.axes[axis];
    if (val == 1.0) return Facing.Right;
    if (val == -1.0) return Facing.Left;
    val = state.axes[axis+1];
    if (val == 1.0) return Facing.Down;
    if (val == -1.0) return Facing.Up;
    return null;
}

function gamepadSticksDir(state: GamepadState): Facing | null {
    let facing: Facing | null = null;
    [GamepadAxis.LStickH, GamepadAxis.PadH, GamepadAxis.RStickH].some((axis) => {
        facing = gamepadStickDir(state, axis);
        return facing != null;
    });
    return facing;
}

export class App implements InputEventHandler, MazeController {
    private elemMazeSider = document.getElementById('maze-sider');
    private elemCoderSider = document.getElementById('coder-sider');
    private elemRunningSider = document.getElementById('running-sider');
    private elemMazeGround = document.getElementById('maze-ground');
    private elemMaze = document.getElementById('maze');
    private elemMazeShade = document.getElementById('maze-shade');
    private elemWalker = document.getElementById('walker');
    private elemCells: HTMLElement[][] = [];
    private elemLightedCells: { [key: string]: HTMLElement } = {};

    private input = new InputController();

    private maze: Maze;
    private mazeShade: number;
    private forceMazeShadeOff = false;
    private mazeVisibleByKey = false;
    private walker: Pose;

    private coder = new Coder(this.input, this);
    private menu = new Menu(this.input, document.getElementById('maze-menu'));

    constructor() {
        this.init();
    }

    run() {
        this.input.addHandler(this);        
    }

    // MazeController implementation.

    runnerStarted(): void {
        this.render();
    }

    runnerStopped(): void {
        this.render();
    }

    currentPose(): Pose {
        return { ...this.walker };
    }

    markerInFront(): Marker | null {
        if (this.maze.facingWall(this.walker)) return null;
        let r = this.walker.row + ADD_ROW[this.walker.facing];
        let c = this.walker.col + ADD_COL[this.walker.facing];
        if (r < 0 || r >= this.maze.rows || c < 0 || c >= this.maze.cols) return null;
        return this.maze.markerOf({row: r, col: c});
    }

    arriveAtTarget(): boolean {
        return this.walker.row == this.maze.rows-1 && this.walker.col == this.maze.cols-1;
    }

    mark(marker: Marker): void {
        this.maze.mark(this.walker, marker);
        this.render();
    }

    moveForward(): void {
        let marker = this.markerInFront();
        if (marker == null) return;
        this.walker.row += ADD_ROW[this.walker.facing];
        this.walker.col += ADD_COL[this.walker.facing];
        if (marker == Marker.None) {
            this.maze.mark(this.walker, Marker.Visited);
        }
        this.render();
    }

    turn(dir: number): void {
        if (dir != -1 && dir != 1) return;
        this.walker.facing += dir;
        if (this.walker.facing < Facing.Left) this.walker.facing = Facing.Down;
        if (this.walker.facing > Facing.Down) this.walker.facing = Facing.Left;
        this.render();
    }

    moveTo(pose: Pose): void {
        this.walker = { ...pose };
        this.render();
    }

    // Other methods.

    goHome(): void {
        this.maze.clearMarkers();
        for (let r = 0; r < this.maze.rows; r ++) {
            for (let c = 0; c < this.maze.cols; c ++) {
                this.elemCells[r][c].classList.remove(MARKER_CLASSES[Marker.Visited]);
                this.elemCells[r][c].classList.remove(MARKER_CLASSES[Marker.Blocked]);
            }
        }
        this.walker = { row: 0, col: 0, facing: Facing.Right };
        this.maze.mark(this.walker, Marker.Visited);
        this.render();
    }

    turnTo(facing: Facing): void {
        if (facing != this.walker.facing) {
            this.walker.facing = facing;
            this.render();
        }
    }

    turnToOrMove(facing: Facing): void {
        if (facing == this.walker.facing) {
            this.moveForward();
            return;
        }
        this.turnTo(facing);
    }

    private init(): void {
        let size = 0;
        this.elemMazeGround.classList.forEach((name) => {
            if (name.startsWith('maze-size-')) {
                size = parseInt(name.substr(10));
            }
        });
        if (size == 0) return;
        this.maze = new Maze(size, size);
        this.mazeShade = 1.0;
        this.walker = { row: 0, col: 0, facing: Facing.Right };
        this.maze.generate(RecursiveBacktracking);
        let mazeHTML = '';
        this.maze.walkCell((cell: Cell, r: number, c: number): boolean => {
            mazeHTML += `<div id="cell_${r}_${c}" `+
                            `class="maze-cell ${cell.wallNames.map((n) => 'cell-with-wall-'+n).join(' ')} ${MARKER_CLASSES[cell.marker]}" `+
                            `style="left:calc(var(--cell-width) * ${c});top:calc(var(--cell-height) * ${r});">`+
                            `<div class="cell-wall cell-wall-left"></div>`+
                            `<div class="cell-wall cell-wall-up"></div>`+
                            `<div class="cell-wall cell-wall-right"></div>`+
                            `<div class="cell-wall cell-wall-down"></div>`+
                        `</div>`;
            return true;
        });
        this.elemMaze.innerHTML = mazeHTML;
        this.elemCells = [];
        for (let r = 0; r < this.maze.rows; r ++) {
            let row = [];
            for (let c = 0; c < this.maze.cols; c ++) {
                row.push(document.getElementById(`cell_${r}_${c}`));
            }
            this.elemCells.push(row);
        }
        this.maze.mark(this.walker, Marker.Visited);
        this.elemLightedCells = {};
        this.render();        
    }

    private lightedCells(): { [key: string]: HTMLElement } {
        let cells: { [key: string]: HTMLElement } = {};
        let current = this.elemCells[this.walker.row][this.walker.col];
        cells[current.id] = current;
        if (this.maze.facingWall(this.walker)) {
            return cells;
        }
        let r = this.walker.row + ADD_ROW[this.walker.facing];
        let c = this.walker.col + ADD_COL[this.walker.facing];
        if (r < 0 || r >= this.maze.rows || c < 0 || c >= this.maze.cols) return cells;
        let cell = this.elemCells[r][c];
        cells[cell.id] = cell;
        return cells;
    }

    private render(): void {
        if (this.coder.running) {
            this.elemMazeSider.classList.add('hidden');
            this.elemCoderSider.classList.add('hidden');
            this.elemRunningSider.classList.remove('hidden');
        } else if (this.coder.visible) {
            this.elemMazeSider.classList.add('hidden');
            this.elemCoderSider.classList.remove('hidden');
            this.elemRunningSider.classList.add('hidden');
        } else {
            this.elemMazeSider.classList.remove('hidden');
            this.elemCoderSider.classList.add('hidden');
            this.elemRunningSider.classList.add('hidden');
        }
        let cells = this.lightedCells();
        for (let id in this.elemLightedCells) {
            if (!(id in cells)) {
                this.elemLightedCells[id].classList.remove('maze-cell-lighted');
            }
        }
        for (let id in cells) {
            if (!(id in this.elemLightedCells)) {
                cells[id].classList.add('maze-cell-lighted');
            }
        }
        this.elemLightedCells = cells;
        updateMarkerClass(this.elemCells[this.walker.row][this.walker.col], this.maze.markerOf(this.walker));
        this.elemMazeShade.style.opacity = `${(this.forceMazeShadeOff || this.mazeVisibleByKey) ? 0 : this.mazeShade}`;
        this.elemWalker.style.top = `calc(var(--cell-height) * ${this.walker.row})`;
        this.elemWalker.style.left = `calc(var(--cell-width) * ${this.walker.col})`;
        this.elemWalker.style.transform = `rotate(${FACING_ANGLES[this.walker.facing]}deg)`;
    }

    private setMazeVisibility(visibility: number): void {
        this.mazeShade = 1 - visibility;
        this.render();
    }

    private showCoder(): void {
        if (this.coder.visible) this.coder.hide();
        else this.coder.show();
        this.render();
    }

    private runCode(): void {
        if (this.coder.visible) this.coder.hide();
        this.coder.run();
        this.render();
    }

    private newMazeMenu(): void {
        this.menu.show((id) => {
            if (id == null) return;
            let classesToRemove: string[] = [];
            this.elemMazeGround.classList.forEach((name) => {
                if (name.startsWith('maze-size-')) {
                    classesToRemove.push(name);
                }
            });
            classesToRemove.forEach((name) => this.elemMazeGround.classList.remove(name));
            this.elemMazeGround.classList.add(id);
            this.init();
        });
    }

    // Implement InputEventHandler.

    handleKeyEvent(event: KeyEvent): boolean {
        if (event.up) {
            switch (event.code) {
            case 'KeyL':
                this.mazeVisibleByKey = false;
                this.render();
                return true;
            }
            return false;
        }
        switch (event.code) {
        case 'ArrowUp': this.turnToOrMove(Facing.Up); return true;
        case 'ArrowDown': this.turnToOrMove(Facing.Down); return true;
        case 'ArrowLeft': this.turnToOrMove(Facing.Left); return true;
        case 'ArrowRight': this.turnToOrMove(Facing.Right); return true;
        case 'Enter':
        case 'Space': this.moveForward(); return true;
        case 'KeyV': this.mark(Marker.Visited); return true;
        case 'KeyB': this.mark(Marker.Blocked); return true;
        case 'KeyX': this.mark(Marker.None); return true;
        case 'KeyL':
            this.mazeVisibleByKey = true;
            this.render();
            return true;
        case 'KeyH': this.goHome(); return true;
        case 'KeyC': this.showCoder(); return true;
        case 'KeyR': this.runCode(); return true;
        case 'KeyN': this.newMazeMenu(); return true;
        default:
            console.log("Unknown key: " + event.code);
            return false;
        }
    }

    handleGamepadStateEvent(event: GamepadStateEvent): void {
        if (event.diff.buttons[GamepadButton.Start]) {
            this.newMazeMenu();
            return;
        }

        if (event.diff.axes[GamepadAxis.LT] != null) {
            this.setMazeVisibility((event.diff.axes[GamepadAxis.LT] + 1)/2);
        }

        if (event.diff.buttons[GamepadButton.Back]) {
            this.goHome();
            return;
        }

        let markerV = event.diff.buttons[GamepadButton.A];
        let markerB = event.diff.buttons[GamepadButton.B];
        let markerC = event.diff.buttons[GamepadButton.X];
        if (markerV && !markerB) this.mark(Marker.Visited);
        if (markerB && !markerV) this.mark(Marker.Blocked);
        if (markerC) this.mark(Marker.None);
    
        if (event.diff.buttons[GamepadButton.RT]) {
            this.moveForward();
            return;
        }

        let facing = gamepadSticksDir(event.diff);
        if (facing != null) {
            this.turnToOrMove(facing);
            return;
        }
    }
}
