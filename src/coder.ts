import * as Blockly from 'blockly';
import { Pose, Marker } from './maze';
import { InputEventHandler, KeyEvent, GamepadStateEvent, InputController } from './input';

Blockly.Blocks['counter'] = {
    init: function() {
        this.jsonInit({
            message0: 'counter',
            output: null,
            colour: 65,
        });
    },
};

Blockly.Blocks['inspect'] = {
    init: function() {
        this.jsonInit({
            message0: "%1 is in the front",
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'thing',
                    options: [
                        ["road", ""],
                        ["wall", "WALL"],
                        ["visited", "VISITED"],
                        ["blocked", "BLOCKED"],
                    ],
                },
            ],
            output: null,
            colour: 20,
        });
    },
};

Blockly.Blocks['inc_counter'] = {
    init: function() {
        this.jsonInit({
            message0: 'increase counter',
            previousStatement: null,
            nextStatement: null,
            colour: 210,
        });
    },
};

Blockly.Blocks['mark'] = {
    init: function() {
        this.jsonInit({
            message0: 'mark %1',
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'marker',
                    options: [
                        ["blocked", "BLOCKED"],
                        ["visited", "VISITED"],
                        ["nothing", ""],
                    ],
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: 290,
        });
    },
};

Blockly.Blocks['move_forward'] = {
    init: function() {
        this.jsonInit({
            message0: 'move forward',
            previousStatement: null,
            colour: 120,
        });
    },
};

Blockly.Blocks['turn'] = {
    init: function() {
        this.jsonInit({
            message0: 'turn %1',
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'direction',
                    options: [
                        ["left", "LEFT"],
                        ["right", "RIGHT"],
                    ],
                },
            ],
            previousStatement: null,
            colour: 160,
        });
    },
};

Blockly.Blocks['step_back'] = {
    init: function() {
        this.jsonInit({
            message0: 'step_back',
            previousStatement: null,
            colour: 330,
        });
    },
};

var JavaScript = (Blockly as any).JavaScript;

JavaScript['counter'] = function(block: Blockly.Block): string[] {
    return [`this.counter`, JavaScript.ORDER_MEMBER];
};

JavaScript['inspect'] = function(block: Blockly.Block): string[] {
    return [`this.frontMarker == '${block.getFieldValue('thing')}'`, JavaScript.ORDER_EQUALITY];
};

JavaScript['inc_counter'] = function(block: Blockly.Block): string {
    return `this.increaseCounter();\n`;
};

JavaScript['mark'] = function(block: Blockly.Block): string {
    return `this.mark('${block.getFieldValue('marker')}');\n`;
};

JavaScript['move_forward'] = function(block: Blockly.Block): string {
    return `this.moveForward();\nreturn;\n`;
};

JavaScript['turn'] = function(block: Blockly.Block): string {
    return `this.turn('${block.getFieldValue('direction')}');\nreturn;\n`;
};

JavaScript['step_back'] = function(block: Blockly.Block): string {
    return `this.stepBack();\nreturn;\n`;
};

export class Coder implements InputEventHandler {
    private elemCoder = document.getElementById('coder');
    private elemBlockly = document.getElementById('blockly');
    private workspace: Blockly.WorkspaceSvg;
    private runner: Runner;

    constructor(private inputController: InputController, private mazeController: MazeController) {
        this.workspace = Blockly.inject(this.elemBlockly, {
            toolbox: document.getElementById('toolbox'),
            zoom: {
                controls: true,
                wheel: true,
                startScale: 1.2,
                maxScale: 4.0,
                minScale: 0.5,
                scaleSpeed: 1.2,
            },
        });
        window.addEventListener('resize', () => this.resizeWorkspace());
    }

    get visible(): boolean {
        return !this.elemCoder.classList.contains('hidden');
    }

    get running(): boolean {
        return this.runner != null;
    }

    show(): void {
        if (!this.visible) {
            this.elemCoder.classList.remove('hidden');
            this.inputController.addHandler(this);
            this.resizeWorkspace();
        }
    }

    hide(): void {
        if (this.visible) {
            this.inputController.removeHandler(this);            
            this.elemCoder.classList.add('hidden');
        }
    }

    run(): void {
        if (this.runner != null) {
            this.runner.terminate();
        }
        this.runner = new Runner(this.generate(), this, this.mazeController, this.inputController);
        this.mazeController.runnerStarted();
    }

    runnerComplete(runner: Runner): void {
        if (runner == this.runner) {
            this.runner = null;
            this.mazeController.runnerStopped();
        }
    }

    handleKeyEvent(event: KeyEvent): boolean {
        if (event.up) return false;
        switch (event.code) {
        case 'KeyC': event.next(); return false;
        case 'KeyR': event.next(); return false;
        }
        return false;
    }

    handleGamepadStateEvent(event: GamepadStateEvent): void {
    }

    private generate(): () => void {
        let code = JavaScript.workspaceToCode(this.workspace);
        console.log(code);
        return eval(`(function() {\n${code}\n})`);

    }

    private resizeWorkspace(): void {
        Blockly.svgResize(this.workspace);
    }
}

export interface MazeController {
    runnerStarted(): void;
    runnerStopped(): void;
    currentPose(): Pose;
    markerInFront(): Marker | null;
    arriveAtTarget(): boolean;
    mark(marker: Marker): void;
    moveForward(): void;
    turn(dir: number): void;
    moveTo(pose: Pose): void;

}

class State {
    private stack: { pose: Pose, counter: number }[] = [];
    private currentCounter: number = 0;

    constructor(private controller: MazeController) {
    }

    get counter(): number {
        return this.currentCounter;
    }

    get frontMarker(): string {
        let marker = this.controller.markerInFront();
        if (marker == null) return 'WALL';
        switch (marker) {
        case Marker.Visited: return 'VISITED';
        case Marker.Blocked: return 'BLOCKED';
        default: return '';
        }
    }

    increaseCounter(): void {
        this.currentCounter ++;
    }

    mark(marker: string): void {
        switch (marker) {
        case 'VISITED': this.controller.mark(Marker.Visited); break;
        case 'BLOCKED': this.controller.mark(Marker.Blocked); break;
        case '': this.controller.mark(Marker.None); break;
        }
    }

    moveForward(): void {
        this.stack.push({pose: this.controller.currentPose(), counter: this.currentCounter});
        this.currentCounter = 0;
        this.controller.moveForward();
    }

    turn(direction: string): void {
        switch (direction) {
        case 'LEFT': this.controller.turn(-1); break;
        case 'RIGHT': this.controller.turn(1); break;
        }
    }

    stepBack(): void {
        if (this.stack.length == 0) return;
        let state = this.stack.pop();
        this.currentCounter = state.counter;
        this.controller.moveTo(state.pose);
    }
}

export class Runner implements InputEventHandler {
    private state: State;
    private interval: number = 100;
    private timer?: number;

    constructor(private stepFn: () => void, private coder: Coder,
                private controller: MazeController, private inputController: InputController) {
        this.state = new State(this.controller);
        this.inputController.addHandler(this);
        this.next();
    }

    terminate(): void {
        this.done();
    }

    private next(): void {
        if (this.controller.arriveAtTarget()) {
            this.done();
            return;
        }
        this.stopTimer();
        this.timer = window.setTimeout(() => { this.runStep(); }, this.interval);
    }

    private done() {
        this.stopTimer();
        this.inputController.removeHandler(this);
        this.coder.runnerComplete(this);
    }

    private pause() {
        this.stopTimer();
    }

    private resume() {
        this.stopTimer();
        this.next();
    }

    private stopTimer() {
        if (this.timer != null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private runStep() {
        if (!this.controller.arriveAtTarget()) {
            this.stepFn.call(this.state);
        }
        this.next();
    }

    handleKeyEvent(event: KeyEvent): boolean {
        if (event.code == 'KeyL' || event.code == 'KeyC') {
            event.next();
            return false;
        }
        if (event.up) return false;
        switch (event.code) {
        case 'Escape': this.done(); return true;
        case 'KeyP': this.pause(); return true;
        case 'KeyR': this.resume(); return true;
        case 'Equal': 
            this.interval -= 100;
            if (this.interval < 100) this.interval = 100;
            return true;
        case 'Minus':
            this.interval += 100;
            if (this.interval > 1000) this.interval = 1000;
            return true;
        }
        return false;
    }

    handleGamepadStateEvent(event: GamepadStateEvent): void {
    }
}
