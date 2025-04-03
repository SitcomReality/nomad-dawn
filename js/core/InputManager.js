export default class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Input states
        this.keys = {};
        this.mousePosition = { x: 0, y: 0 };
        this.mouseButtons = { left: false, middle: false, right: false };
        this.mouseWheel = 0;
        this.touches = [];
        
        // Initiate input listeners
        this.initKeyboardListeners();
        this.initMouseListeners();
        this.initTouchListeners();
    }
    
    initKeyboardListeners() {
        window.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
        });
        
        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Prevent default behavior for game control keys
        window.addEventListener('keydown', (event) => {
            // Prevent scrolling with arrow keys, space, etc.
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
                event.preventDefault();
            }
        }, { passive: false });
    }
    
    initMouseListeners() {
        this.canvas.addEventListener('mousemove', (event) => {
            // Get position relative to canvas
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition.x = event.clientX - rect.left;
            this.mousePosition.y = event.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mousedown', (event) => {
            switch (event.button) {
                case 0: this.mouseButtons.left = true; break;
                case 1: this.mouseButtons.middle = true; break;
                case 2: this.mouseButtons.right = true; break;
            }
        });
        
        this.canvas.addEventListener('mouseup', (event) => {
            switch (event.button) {
                case 0: this.mouseButtons.left = false; break;
                case 1: this.mouseButtons.middle = false; break;
                case 2: this.mouseButtons.right = false; break;
            }
        });
        
        this.canvas.addEventListener('wheel', (event) => {
            this.mouseWheel = Math.sign(event.deltaY);
            
            // Reset wheel value on next frame
            setTimeout(() => {
                this.mouseWheel = 0;
            }, 50);
            
            // Prevent page scrolling
            event.preventDefault();
        }, { passive: false });
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    
    initTouchListeners() {
        this.canvas.addEventListener('touchstart', (event) => {
            this.updateTouches(event.touches);
            event.preventDefault();
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (event) => {
            this.updateTouches(event.touches);
            event.preventDefault();
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (event) => {
            this.updateTouches(event.touches);
            event.preventDefault();
        }, { passive: false });
    }
    
    updateTouches(touchList) {
        const rect = this.canvas.getBoundingClientRect();
        this.touches = [];
        
        for (let i = 0; i < touchList.length; i++) {
            const touch = touchList[i];
            this.touches.push({
                id: touch.identifier,
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            });
        }
        
        // Update mouse position based on first touch
        if (this.touches.length > 0) {
            this.mousePosition.x = this.touches[0].x;
            this.mousePosition.y = this.touches[0].y;
            this.mouseButtons.left = true;
        } else {
            this.mouseButtons.left = false;
        }
    }
    
    // Check if a key is currently pressed
    isKeyDown(keyCode) {
        return !!this.keys[keyCode];
    }
    
    // Check if any of the provided keys are pressed
    isAnyKeyDown(keyCodes) {
        return keyCodes.some(code => this.isKeyDown(code));
    }
    
    // Get current mouse position
    getMousePosition() {
        return { ...this.mousePosition };
    }
    
    // Get normalized mouse position (0 to 1)
    getNormalizedMousePosition() {
        return {
            x: this.mousePosition.x / this.canvas.width,
            y: this.mousePosition.y / this.canvas.height
        };
    }
    
    // Check if a mouse button is pressed
    isMouseButtonDown(button) {
        return this.mouseButtons[button];
    }
    
    // Get movement direction based on WASD/arrow keys
    getMovementDirection() {
        const direction = { x: 0, y: 0 };
        
        // Horizontal movement
        if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) {
            direction.x = -1;
        } else if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) {
            direction.x = 1;
        }
        
        // Vertical movement
        if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) {
            direction.y = -1;
        } else if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) {
            direction.y = 1;
        }
        
        return direction;
    }
    
    // Update method to reset one-time inputs
    update() {
        // Reset mouse wheel value
        this.mouseWheel = 0;
    }
}

