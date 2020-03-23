import { InputController, InputEventHandler, KeyEvent, GamepadStateEvent, GamepadButton, GamepadAxis } from './input';

export interface MenuCallback {
    (data?: string): void;
}

export class Menu implements InputEventHandler {
    private callback: MenuCallback;
    private items: HTMLElement[];
    private selectedIndex: number;

    constructor(private inputController: InputController, private elem: HTMLElement) {
    }

    show(callback: MenuCallback): void {
        if (this.callback != null) throw new Error('menu already shown');
        this.initMenu();
        this.callback = callback;        
        this.elem.classList.remove('hidden');
        this.inputController.addHandler(this);
    }

    handleKeyEvent(event: KeyEvent): boolean {
        if (event.up) return false;
        switch (event.code) {
        case 'Escape': this.complete(false); return true;
        case 'ArrowUp': this.moveSelection(-1); return true;
        case 'ArrowDown': this.moveSelection(1); return true;
        case 'Enter': this.complete(true); return true;
        }
        return false;
    }

    handleGamepadStateEvent(event: GamepadStateEvent): void {
        if (event.diff.buttons[GamepadButton.B] || event.diff.buttons[GamepadButton.Back]) {
            this.complete(false);
            return;
        }
        if (event.diff.buttons[GamepadButton.A]) {
            this.complete(true);
            return;
        }
        let upDown = event.diff.axes[GamepadAxis.LStickV];
        if (upDown == null) upDown = event.diff.axes[GamepadAxis.PadV];
        if (upDown == null) upDown = event.diff.axes[GamepadAxis.RStickV];
        if (upDown == -1.0) {
            this.moveSelection(-1);
            return;
        }
        if (upDown == 1.0) {
            this.moveSelection(1);
            return;
        }
    }

    private initMenu(): void {
        let nodes = this.elem.querySelectorAll(".menu-item");
        this.items = [];
        this.selectedIndex = -1;
        nodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                let elem = node as HTMLElement;
                if (elem.classList.contains('selected')) {
                    if (this.selectedIndex < 0) {
                        this.selectedIndex = this.items.length;
                    } else {
                        elem.classList.remove('selected');
                    }
                }
                this.items.push(elem);
            }
        });
        if (this.selectedIndex < 0 && this.items.length > 0) {
            this.selectedIndex = 0;
            this.items[0].classList.add('selected');
        }
    }

    private moveSelection(delta: number): void {
        // If menu is empty, do nothing.
        if (this.selectedIndex < 0) return;

        let index = this.selectedIndex + delta;
        if (index < 0) index = 0;
        if (index >= this.items.length) index = this.items.length - 1;
        if (index != this.selectedIndex) {
            this.items[this.selectedIndex].classList.remove('selected');
            this.items[index].classList.add('selected');
            this.selectedIndex = index;
        }
    }

    private complete(accepted: boolean): void {
        let data: string | null = null;
        if (accepted && this.selectedIndex >= 0) {
            data = this.items[this.selectedIndex].dataset.id;
        }
        let callback = this.callback;
        this.inputController.removeHandler(this);
        this.elem.classList.add('hidden');
        this.callback = null;
        this.items = null;
        this.selectedIndex = -1;
        callback(data);
    }
}