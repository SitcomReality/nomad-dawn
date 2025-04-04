/**
 * Handles movement logic for both players and vehicles
 * This extracts logic from Player.js and Vehicle.js to reduce file size
 * and standardize the control scheme
 */
export default class MovementController {
    constructor() {
        // No state needed in constructor - all methods are stateless helpers
    }

    /**
     * Processes input for tank-style controls (rotation + forward/backward)
     * @param {Object} entity - The entity to move (player or vehicle)
     * @param {Object} input - InputManager instance
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateTankControls(entity, input, deltaTime) {
        if (!input) return;

        // Store previous state to detect changes
        const prevState = {
            x: entity.x, 
            y: entity.y, 
            angle: entity.angle, 
            speed: entity.speed
        };
        
        let stateDidChange = false;

        // Handle rotation (A/D or Left/Right keys)
        if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) {
            // Rotate counter-clockwise
            entity.angle -= entity.rotationSpeed * deltaTime;
            stateDidChange = true;
        }
        else if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) {
            // Rotate clockwise
            entity.angle += entity.rotationSpeed * deltaTime;
            stateDidChange = true;
        }

        // Normalize angle after rotation
        if (typeof entity.normalizeAngle === 'function') {
            entity.angle = entity.normalizeAngle(entity.angle);
        }

        // Handle forward/backward (W/S or Up/Down keys)
        if (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) {
            // Accelerate forward
            entity.speed = Math.min(entity.speed + entity.acceleration * deltaTime, entity.maxSpeed);
            stateDidChange = true;
        }
        else if (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) {
            // Accelerate backward (reverse)
            entity.speed = Math.max(entity.speed - entity.acceleration * deltaTime, -entity.maxSpeed * 0.5);
            stateDidChange = true;
        }
        else {
            // Decelerate when no input
            const decelAmount = entity.deceleration * deltaTime;
            if (Math.abs(entity.speed) <= decelAmount) {
                entity.speed = 0;
            } else {
                entity.speed -= Math.sign(entity.speed) * decelAmount;
            }
            if (entity.speed !== prevState.speed) {
                stateDidChange = true;
            }
        }

        // Apply movement if there's any speed
        if (entity.speed !== 0) {
            entity.x += Math.cos(entity.angle) * entity.speed * deltaTime;
            entity.y += Math.sin(entity.angle) * entity.speed * deltaTime;
            stateDidChange = true;
        }

        // Check for state changes
        if (
            entity.x !== prevState.x ||
            entity.y !== prevState.y ||
            entity.angle !== prevState.angle ||
            entity.speed !== prevState.speed
        ) {
            if (entity._stateChanged !== undefined) {
                entity._stateChanged = true;
            }
        }

        return stateDidChange;
    }
}