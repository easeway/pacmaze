export enum GamepadButton {
    A = 0,
    B = 1,
    X = 3,
    Y = 4,
    LB = 6,
    RB = 7,
    LT = 8,
    RT = 9,
    Back = 10,
    Start = 11,
    Mid = 12,
    LStick = 13,
    RStick = 14,
}

export enum GamepadAxis {
    LStickH = 0,
    LStickV = 1,
    RStickH = 2,
    RStickV = 3,
    RT = 4,
    LT = 5,
    PadH = 6,
    PadV = 7,
}

// For key simulation.
const DIFF_REFIRE_DELAY = 150;

export class GamepadState {
    axes: number[] = [];
    buttons: boolean[] = [];
    axesRefired: boolean[] = [];

    constructor(gp?: Gamepad) {
        if (gp) {
            this.axes = gp.axes.map((val) => val);
            this.buttons = gp.buttons.map((btn) => btn.pressed);
        }
    }

    get empty(): boolean {
        return this.axes.length == 0 && this.buttons.length == 0;
    }
}

export class InputEvent {
    private callNext = false;

    constructor() {

    }

    next(): void {
        this.callNext = true;
    }

    // Internal use only.

    prepareForNext(): boolean {
        let enabled = this.callNext;
        this.callNext = false;
        return enabled;
    }
}

export class KeyEvent extends InputEvent {
    constructor(readonly code: string, readonly up: boolean) {
        super();
    }
}

export class GamepadStateEvent extends InputEvent {
    constructor(readonly state: GamepadState, readonly diff: GamepadState, readonly index: number) {
        super();
    }
}

export interface InputEventHandler {
    handleKeyEvent(event: KeyEvent): boolean;
    handleGamepadStateEvent(event: GamepadStateEvent): void;
}

class GamepadController {
    private lastState: GamepadState;
    private axesLastDiffTime: number[] = [];

    constructor(private gamepad: Gamepad) {
        this.lastState = new GamepadState(this.gamepad);
    }

    get index(): number {
        return this.gamepad.index;
    }

    get state(): GamepadState {
        return this.lastState;
    }

    refresh(gamepad: Gamepad): void {
        this.gamepad = gamepad;
    }

    poll(): GamepadState {
        let newState = new GamepadState(this.gamepad);
        let diff = new GamepadState();
        let now = Date.now();
        for (let i in newState.axes) {
            if (newState.axes[i] != this.lastState.axes[i]) {
                diff.axes[i] = newState.axes[i];
            } else if (newState.axes[i] != 0 && this.axesLastDiffTime[i] != null && now - this.axesLastDiffTime[i] > DIFF_REFIRE_DELAY) {
                diff.axes[i] = newState.axes[i];
                diff.axesRefired[i] = true;
            }
            if (i in diff.axes) {
                this.axesLastDiffTime[i] = now;
            }
        }
        for (let i in newState.buttons) {
            if (newState.buttons[i] != this.lastState.buttons[i]) {
                diff.buttons[i] = newState.buttons[i];
            }
        }
        this.lastState = newState;
        return diff;
    }
}

class ChainedEventHandler implements InputEventHandler {
    constructor(private handlers: InputEventHandler[]) {
    }

    handleKeyEvent(event: KeyEvent): boolean {
        let result = false;
        for (let i in this.handlers) {
            result = this.handlers[i].handleKeyEvent(event);
            if (!event.prepareForNext()) break;
        }
        return result;
    }

    handleGamepadStateEvent(event: GamepadStateEvent): void {
        for (let i in this.handlers) {
            this.handlers[i].handleGamepadStateEvent(event);
            if (!event.prepareForNext()) break;
        }
    }
}

export class InputController {
    private eventHandlers: InputEventHandler[] = [];

    private gamepads: GamepadController[] = [];
    private animationFrame?: number;

    constructor() {
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            this.handleKeyEvent(event, false);
        });
        window.addEventListener('keyup', (event: KeyboardEvent) => {
            this.handleKeyEvent(event, true);
        });
        window.addEventListener('gamepadconnected', (event: GamepadEvent) => {
            this.addGamepad(event.gamepad);
        });
        window.addEventListener('gamepaddisconnected', (event: GamepadEvent) => {
            this.removeGamepad(event.gamepad.index);
        });
    }

    addHandler(handler: InputEventHandler): void {
        this.eventHandlers.unshift(handler);
    }

    removeHandler(handler: InputEventHandler): void {
        let index = this.eventHandlers.findIndex((h) => h == handler);
        if (index >= 0) this.eventHandlers.splice(index, 1);
    }

    private handleKeyEvent(event: KeyboardEvent, up: boolean): void {
        if (new ChainedEventHandler(this.eventHandlers).handleKeyEvent(new KeyEvent(event.code, up))) {
            event.preventDefault();
        }
    }

    private animationLoop(): void {
        this.animationFrame = null;
        this.scanGamepads();
        let handler = new ChainedEventHandler(this.eventHandlers)
        this.gamepads.forEach((ctl) => {
            let diff = ctl.poll();
            if (handler != null) {
                handler.handleGamepadStateEvent(new GamepadStateEvent(ctl.state, diff, ctl.index));
            }
        });
        if (this.gamepads.length > 0) {
            this.animationFrame = requestAnimationFrame(() => this.animationLoop());
        }
    }

    private scanGamepads(): void {
        let gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i ++) {
            let gamepad = gamepads[i];
            if (gamepad) {
                let controller = this.gamepads[gamepad.index];
                if (controller == null) {
                    this.addGamepad(gamepad);
                } else {
                    controller.refresh(gamepad);
                }
            }
            if (gamepad == null && this.gamepads[i] != null) {
                this.removeGamepad(i);
            }
        }
    }

    private addGamepad(gamepad: Gamepad): void {
        this.gamepads[gamepad.index] = new GamepadController(gamepad)
        if (this.animationFrame == null) {
            this.animationFrame = requestAnimationFrame(() => this.animationLoop());
        }
    }

    private removeGamepad(index: number): void {
        delete this.gamepads[index];
        if (this.gamepads.length == 0 && this.animationFrame != null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
}
