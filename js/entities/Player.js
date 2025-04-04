import MovementController from '../core/MovementController.js';

export default class Player {
    constructor(id, game) {
        this.id = id;
        this.game = game;

        // Basic properties
        this.type = 'player';
        this.name = 'Player'; // Will be updated with network username
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = 200;
        this.acceleration = 200;
        this.deceleration = 300;
        this.rotationSpeed = 3; // radians per second
        this.size = 20;

        // Game stats
        this.health = 100;
        this.maxHealth = 100;
        this.resources = {
            metal: 0,
            energy: 0,
            food: 0
        };

        // Vehicle / base properties
        this.vehicleId = null; // Kept for driving state
        this.insideVehicle = false; // Kept for driving state

        // --- NEW: Vehicle Interior State ---
        this.playerState = 'Overworld'; // 'Overworld' | 'Building' | 'Interior' | 'Piloting'
        this.currentVehicleId = null; // ID of the vehicle the player is interacting with/inside
        this.gridX = 0; // Player's grid X position when in 'Interior' state
        this.gridY = 0; // Player's grid Y position when in 'Interior' state
        this.interiorMoveSpeed = 5; // Grid units per second
        // --- END NEW ---

        // Equipment
        this.equipment = {
            weapon: null,
            armor: null,
            tool: null
        };

        // Collision properties
        this.radius = this.size / 2;
        this.mass = 10;

        // Network state tracking
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;

        // Collection cooldown to prevent spamming requests (Now used by InteractionManager)
        // this.lastCollectionTime = 0; // REMOVED
        // this.collectionCooldown = 500; // REMOVED
        
        // Add movement controller
        this.movementController = new MovementController();
    }

    update(deltaTime, input) {
        if (!input) return;

        // Store previous state to detect changes
        const prevState = {
            x: this.x, y: this.y, angle: this.angle, speed: this.speed, health: this.health,
            resources: { ...this.resources }, vehicleId: this.vehicleId,
            playerState: this.playerState, currentVehicleId: this.currentVehicleId,
            gridX: this.gridX, gridY: this.gridY
        };
        let stateDidChange = false; // Track changes within this update

        // --- Update logic based on playerState ---
        if (this.playerState === 'Overworld') {
             // Use tank-style controls from MovementController
             this.movementController.updateTankControls(this, input, deltaTime);
        } else if (this.playerState === 'Interior') {
            // Movement within the vehicle grid
             const direction = input.getMovementDirection();
             const vehicle = this.game.entities.get(this.currentVehicleId);
             let canMoveX = true;
             let canMoveY = true;

             if (vehicle && (direction.x !== 0 || direction.y !== 0)) {
                 const moveAmount = this.interiorMoveSpeed * deltaTime;
                 const nextGridX = this.gridX + direction.x * moveAmount;
                 const nextGridY = this.gridY + direction.y * moveAmount;

                 // --- Simple Grid Collision Check ---
                 if (direction.x !== 0) {
                     // Check cell player is trying to move INTO horizontally
                     const targetCellX = Math.floor(nextGridX);
                     const currentCellY = Math.floor(this.gridY);
                     const cellKeyX = `${targetCellX},${currentCellY}`;
                     const objectInCellX = vehicle.gridObjects?.[cellKeyX];
                     // Check if the object type blocks movement (e.g., walls)
                     if (objectInCellX === 'wall_metal') { // TODO: Use config or helper func
                         canMoveX = false;
                         // Optional: Snap player back to edge of current cell if moving towards wall
                         // this.gridX = Math.round(this.gridX);
                     }
                 }

                 if (direction.y !== 0) {
                     // Check cell player is trying to move INTO vertically
                     const targetCellY = Math.floor(nextGridY);
                     const currentCellX = Math.floor(this.gridX);
                     const cellKeyY = `${currentCellX},${targetCellY}`;
                     const objectInCellY = vehicle.gridObjects?.[cellKeyY];
                     // Check if the object type blocks movement
                      if (objectInCellY === 'wall_metal') { // TODO: Use config or helper func
                         canMoveY = false;
                          // Optional: Snap player back to edge of current cell
                          // this.gridY = Math.round(this.gridY);
                      }
                 }

                 // Apply movement only if allowed
                 if (canMoveX) {
                    this.gridX = nextGridX;
                 }
                 if (canMoveY) {
                    this.gridY = nextGridY;
                 }

                 // --- Grid Boundary Check ---
                 // Clamp position after applying movement
                  this.gridX = Math.max(0, Math.min(vehicle.gridWidth ? vehicle.gridWidth - 0.01 : 9.99, this.gridX));
                  this.gridY = Math.max(0, Math.min(vehicle.gridHeight ? vehicle.gridHeight - 0.01 : 9.99, this.gridY));
             }
        } else if (this.playerState === 'Piloting' || this.playerState === 'Building') {
             // No direct player movement input handled here
             this.speed = 0; // Ensure player speed is zero
        }

        // Check for state changes compared to previous state *within this frame*
        if (
            this.x !== prevState.x ||
            this.y !== prevState.y ||
            this.angle !== prevState.angle ||
            this.speed !== prevState.speed ||
            this.health !== prevState.health ||
            this.vehicleId !== prevState.vehicleId ||
            this.playerState !== prevState.playerState ||
            this.currentVehicleId !== prevState.currentVehicleId ||
            Math.abs(this.gridX - prevState.gridX) > 0.001 || // Use tolerance for float comparison
            Math.abs(this.gridY - prevState.gridY) > 0.001 ||
            JSON.stringify(this.resources) !== JSON.stringify(prevState.resources)
        ) {
            stateDidChange = true;
        }

        // If internal logic didn't set _stateChanged, set it based on comparison
        if (stateDidChange) {
             this._stateChanged = true;
        }
    }

    normalizeAngle(angle) {
        // Normalize angle to be between -PI and PI
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this._stateChanged = true;

        // Trigger damage effect
        // this.game.renderer.createEffect('damage', this.x, this.y);

        return this.health;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this._stateChanged = true;
        return this.health;
    }

    // Adds resource locally and flags state change
    addResource(type, amount) {
        if (this.resources[type] !== undefined) {
            this.resources[type] += amount;
            this._stateChanged = true; // Mark state as changed when resources are added
            // console.log(`Player ${this.id} added ${amount} ${type}. New total: ${this.resources[type]}`); // Debug log
            return true;
        }
        console.warn(`Player ${this.id} attempted to add unknown resource type: ${type}`);
        return false;
    }

    equipItem(item) {
        if (!item || !item.type || !item.slot) return false;

        // Store previous item if any
        const previousItem = this.equipment[item.slot];

        // Equip new item
        this.equipment[item.slot] = item;

        // Apply equipment effects (e.g., armor increases max health)
        if (item.effect) {
            for (const [stat, value] of Object.entries(item.effect)) {
                if (stat === 'maxHealth') {
                    this.maxHealth += value;
                }
                // Add other stat effects as needed
            }
        }

        this._stateChanged = true;
        return true;
    }

    unequipItem(slot) {
        if (!slot || !this.equipment[slot]) return false;

        const item = this.equipment[slot];

        // Remove equipment effects
        if (item.effect) {
            for (const [stat, value] of Object.entries(item.effect)) {
                if (stat === 'maxHealth') {
                    this.maxHealth -= value;
                    this.health = Math.min(this.health, this.maxHealth); // Cap health
                }
                // Remove other stat effects as needed
            }
        }

        // Clear equipment slot
        this.equipment[slot] = null;

        this._stateChanged = true;
        return true;
    }

    collidesWith(other) {
        // Basic circle collision detection
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.radius + other.radius);
    }

    // Handle collision based on the other entity's type
    onCollision(other) {
        if (!other) return;

        switch(other.type) {
            case 'resource':
                 // --- REMOVED: Resource collection logic moved to InteractionManager ---
                // // Check cooldown before attempting collection
                //  const now = performance.now();
                //  if (now - this.lastCollectionTime > this.collectionCooldown) {
                //     this.requestCollectResource(other);
                //     this.lastCollectionTime = now; // Update last collection time
                //  }
                break;
            case 'vehicle':
                // Example: Enter vehicle on key press (implementation depends on input access)
                // This logic will move/change with the new interior system.
                // if (!this.insideVehicle && this.game.input.isKeyDown('KeyE')) {
                //     this.enterVehicle(other);
                // }
                break;
            // Add cases for other collidable types (e.g., projectiles, hazards)
            default:
                // Handle generic collision if needed
                break;
        }
    }

    // Deprecate old enter/exit vehicle logic
    enterVehicle(vehicle) {
        console.warn("Player.enterVehicle is deprecated. Use state transitions.");
        // Implement state transition logic here or rely on Game class handler
        return false; // Indicate failure or handle transition
    }

    exitVehicle() {
        console.warn("Player.exitVehicle is deprecated. Use state transitions.");
        // Implement state transition logic here or rely on Game class handler
        return false; // Indicate failure or handle transition
    }

    render(ctx, x, y, size) {
        // Custom rendering for player
        // Adjust color based on health
        const healthPercent = this.health / this.maxHealth;
        const g = Math.floor(255 * healthPercent);
        ctx.fillStyle = `rgb(100, ${g}, 255)`;

        // Draw player body
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw direction indicator
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size / 2, y);
        ctx.stroke();
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this._stateChanged = true;
        return this;
    }

    getNetworkState() {
        // Return the data needed for network presence updates
        return {
            // Basic movement/state (only relevant for Overworld)
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed, // Send speed even if 0
            // Common state
            health: this.health,
            // Inventory/status
            resources: { ...this.resources },
            equipment: { ...this.equipment },
            // Vehicle interaction / Interior State
            playerState: this.playerState,
            currentVehicleId: this.currentVehicleId,
            gridX: this.gridX,
            gridY: this.gridY,
        };
    }

    // Checks if the current state is significantly different from the last sent state
    hasStateChanged() {
        // Always return true if the internal flag is set
        if (this._stateChanged) return true;

        // Fallback: If flag wasn't set, do a comparison just in case
        const currentState = this.getNetworkState();
        const lastState = this._lastNetworkState || {}; // Ensure lastState is an object

        // Only check position/angle/speed if in Overworld
        let movementChanged = false;
        if (currentState.playerState === 'Overworld' && lastState.playerState === 'Overworld') {
            const positionThresholdSq = 0.5*0.5; // Reduced threshold for faster updates
            const dx = currentState.x - (lastState.x || 0);
            const dy = currentState.y - (lastState.y || 0);
            const positionChanged = (dx * dx + dy * dy) > positionThresholdSq;

            const angleThreshold = 0.05; // Radians
            const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - (lastState.angle || 0))) > angleThreshold;

            const speedThreshold = 1;
            const speedChanged = Math.abs(currentState.speed - (lastState.speed || 0)) > speedThreshold;
            movementChanged = positionChanged || angleChanged || speedChanged;
        }

        const healthChanged = currentState.health !== lastState.health;

        // Check interior state changes (including grid position)
         // Use a tolerance for grid position changes
         const gridPosThreshold = 0.1;
        const interiorStateChanged = currentState.playerState !== lastState.playerState ||
                                     currentState.currentVehicleId !== lastState.currentVehicleId ||
                                     Math.abs(currentState.gridX - (lastState.gridX ?? 0)) > gridPosThreshold ||
                                     Math.abs(currentState.gridY - (lastState.gridY ?? 0)) > gridPosThreshold;

        // More efficient resource check if resources change frequently
        const resourcesChanged = JSON.stringify(currentState.resources) !== JSON.stringify(lastState.resources || {});

        const equipmentChanged = JSON.stringify(currentState.equipment) !== JSON.stringify(lastState.equipment || {});

        return movementChanged || healthChanged || resourcesChanged || equipmentChanged || interiorStateChanged;
    }

    clearStateChanged() {
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}