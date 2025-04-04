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

        // --- Vehicle Interior State ---
        this.playerState = 'Overworld'; // 'Overworld' | 'Interior' | 'Piloting' | 'Building'
        this.currentVehicleId = null; // ID of vehicle the player is interacting with/inside
        this.gridX = 0; // Player's position on vehicle grid when in 'Interior' state
        this.gridY = 0; // Player's position on vehicle grid when in 'Interior' state
        // --- End Vehicle Interior State ---

        // Vehicle / base properties
        this.vehicleId = null; // Legacy? Keep for now, maybe reconcile with currentVehicleId
        this.insideVehicle = false; // Legacy? Keep for now, maybe reconcile with playerState

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

        // Collection cooldown to prevent spamming requests
        this.lastCollectionTime = 0;
        this.collectionCooldown = 500; // milliseconds
    }

    update(deltaTime, input) {
        if (!input && this.playerState !== 'Piloting') return; // Need input unless piloting

        // Store previous state to detect changes
        const prevState = {
             x: this.x, y: this.y, angle: this.angle, health: this.health,
             resources: { ...this.resources }, vehicleId: this.vehicleId,
             playerState: this.playerState, currentVehicleId: this.currentVehicleId,
             gridX: this.gridX, gridY: this.gridY
        };

        // --- Movement based on Player State ---
        if (this.playerState === 'Overworld') {
            this.updateOverworldMovement(deltaTime, input);
        } else if (this.playerState === 'Interior') {
            this.updateInteriorMovement(deltaTime, input);
        } else if (this.playerState === 'Piloting') {
            // No direct player movement, vehicle moves instead (handled in Game.js)
            this.speed = 0;
        } else if (this.playerState === 'Building') {
             // Potentially different controls or just no movement
             this.speed = 0;
        }
        // --- End Movement Update ---


        // Check for state changes compared to previous state *within this frame*
        if (
            this.x !== prevState.x ||
            this.y !== prevState.y ||
            this.angle !== prevState.angle ||
            this.health !== prevState.health || // Check other relevant properties
            this.vehicleId !== prevState.vehicleId || // Legacy check
            this.playerState !== prevState.playerState ||
            this.currentVehicleId !== prevState.currentVehicleId ||
            this.gridX !== prevState.gridX ||
            this.gridY !== prevState.gridY ||
            JSON.stringify(this.resources) !== JSON.stringify(prevState.resources) // Simple resource check
        ) {
            this._stateChanged = true;
        }
    }

    updateOverworldMovement(deltaTime, input) {
        // Apply movement based on directional input
        const direction = input.getMovementDirection();

        if (direction.x !== 0 || direction.y !== 0) {
            // Calculate target angle based on direction
            const targetAngle = Math.atan2(direction.y, direction.x);

            // Smoothly rotate towards target angle
            const angleDiff = this.normalizeAngle(targetAngle - this.angle);
            this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotationSpeed * deltaTime);

            // Accelerate
            this.speed = Math.min(this.speed + this.acceleration * deltaTime, this.maxSpeed);
        } else {
            // Decelerate when no input
            this.speed = Math.max(0, this.speed - this.deceleration * deltaTime);
        }

        // Apply movement
        if (this.speed > 0) {
            this.x += Math.cos(this.angle) * this.speed * deltaTime;
            this.y += Math.sin(this.angle) * this.speed * deltaTime;
        }
    }

    updateInteriorMovement(deltaTime, input) {
        // Placeholder for grid-based movement (Step 5)
        // For now, just prevent overworld movement
        this.speed = 0;

        // Simple example: Immediate movement on key press (replace with proper logic later)
        const direction = input.getMovementDirection();
        let moved = false;
        if (direction.x !== 0 || direction.y !== 0) {
            let nextGridX = this.gridX;
            let nextGridY = this.gridY;

            if (direction.x < 0) nextGridX -= 1;
            if (direction.x > 0) nextGridX += 1;
            if (direction.y < 0) nextGridY -= 1; // Note: Canvas Y is down, grid Y might be up
            if (direction.y > 0) nextGridY += 1;

            // TODO: Check grid boundaries and obstacles (Step 5)
            const vehicle = this.game.entities.get(this.currentVehicleId);
            if (vehicle &&
                nextGridX >= 0 && nextGridX < vehicle.gridWidth &&
                nextGridY >= 0 && nextGridY < vehicle.gridHeight /* && isPassable(nextGridX, nextGridY, vehicle) */ )
            {
                this.gridX = nextGridX;
                this.gridY = nextGridY;
                moved = true;
            }

            // Consume input to prevent repeated movement from holding key
            if (moved) {
                 if (direction.x < 0) input.keys['KeyA'] = input.keys['ArrowLeft'] = false;
                 if (direction.x > 0) input.keys['KeyD'] = input.keys['ArrowRight'] = false;
                 if (direction.y < 0) input.keys['KeyW'] = input.keys['ArrowUp'] = false;
                 if (direction.y > 0) input.keys['KeyS'] = input.keys['ArrowDown'] = false;
                 this._stateChanged = true; // Mark state changed due to grid movement
                 this.game.debug.log(`Player moved to grid (${this.gridX}, ${this.gridY})`);
            }
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
        // Collision handling should likely be disabled or different in Interior/Piloting states
        if (this.playerState !== 'Overworld') return;

        if (!other) return;

        switch(other.type) {
            case 'resource':
                // Check cooldown before attempting collection
                 const now = performance.now();
                 if (now - this.lastCollectionTime > this.collectionCooldown) {
                    this.requestCollectResource(other);
                    this.lastCollectionTime = now; // Update last collection time
                 }
                break;
            case 'vehicle':
                // Interaction is now handled by PlayerActionHandler ('E' key)
                // We might add passive effects on collision later (e.g., bump damage)
                break;
            // Add cases for other collidable types (e.g., projectiles, hazards)
            default:
                // Handle generic collision if needed
                break;
        }
    }

    // Request collection of a resource node via network
    requestCollectResource(resource) {
        // Double check resource validity and if it's already marked locally (though network is source of truth)
        if (!resource || !resource.id || !resource.resourceType || resource.amount <= 0) {
             // console.warn(`Attempted to collect invalid resource:`, resource); // Debug
             return;
        }

        // 1. Optimistically add the resource locally for immediate feedback
        //    This will be overwritten/confirmed by the presence update anyway.
        //    No, let's rely on the network confirmation to avoid potential desync if collection fails server-side (if that logic existed)
        // this.addResource(resource.resourceType, resource.amount); // Removed optimistic update

        // 2. Send request to update the *shared* room state, removing the resource
        //    This is the crucial step for synchronization.
        this.game.network.updateRoomState({
            resources: {
                [resource.id]: null // Use null to signify deletion in room state
            }
        });

        // 3. Send a *request* to update *this player's* presence, reflecting the added resource count
        //    The server/host would ideally validate this and then broadcast the updated presence.
        //    For pure client-side authority (like current Websim setup), we directly update our own presence.
        //    Create a temporary new resources object reflecting the change.
        const newResources = { ...this.resources };
        newResources[resource.resourceType] = (newResources[resource.resourceType] || 0) + resource.amount;
        this.game.network.updatePresence({
            resources: newResources // Send the potential new resources object
        });
        // NOTE: We don't call addResource locally here anymore. The change will come back via presence update.
        // this._stateChanged = true; // Flagging state changed here might cause duplicate updates if presence echo is fast.

        // 4. Trigger a local visual effect for immediate feedback
        if (this.game.renderer) {
             // Use resource color for the effect
            this.game.renderer.createEffect('collect', resource.x, resource.y, { color: resource.color || '#ffff00' });
        }

        // Optional: Send a broadcast event for sound effects on all clients
        // this.game.network.send({
        //     type: 'play_sound',
        //     soundId: 'collect_resource',
        //     x: resource.x,
        //     y: resource.y,
        //     volume: 0.8
        // });

        // Local logging
        this.game.debug.log(`Player ${this.id} requested collection of ${resource.amount} ${resource.resourceType} from ${resource.id}`);
    }

    // --- State Transition Methods (Step 2 Implementation) ---
    enterVehicle(vehicle) {
        // Can only enter from Overworld state
        if (!vehicle || this.playerState !== 'Overworld') return false;

        this.playerState = 'Interior';
        this.currentVehicleId = vehicle.id;
        // Set grid position to vehicle's door location
        this.gridX = vehicle.doorLocation?.x ?? 0;
        this.gridY = vehicle.doorLocation?.y ?? 0;

        this.vehicleId = vehicle.id; // Keep legacy field synced for now
        this.insideVehicle = true; // Keep legacy field synced

        this._stateChanged = true; // Mark state changed for network sync
        this.game.debug.log(`Player ${this.id} transitioned to Interior state in vehicle ${vehicle.id}. Grid Pos: (${this.gridX}, ${this.gridY})`);
        return true;
    }

    exitVehicle() {
        // Can only exit from Interior state
        if (this.playerState !== 'Interior' || !this.currentVehicleId) return false;

        const vehicle = this.game.entities.get(this.currentVehicleId);
        if (!vehicle) {
             this.game.debug.warn(`Player ${this.id} trying to exit vehicle, but vehicle ${this.currentVehicleId} not found.`);
             // Force state back to Overworld anyway?
             this.playerState = 'Overworld';
             this.currentVehicleId = null;
             this.vehicleId = null; // Legacy
             this.insideVehicle = false; // Legacy
             this._stateChanged = true;
             return false;
        }

        // Ensure player is at the door location to exit
        if (this.gridX !== vehicle.doorLocation?.x || this.gridY !== vehicle.doorLocation?.y) {
            this.game.ui.showNotification("Must be at the door to exit.", "warn");
            this.game.debug.log(`Player ${this.id} failed exit: Not at door (Player: ${this.gridX},${this.gridY} | Door: ${vehicle.doorLocation?.x},${vehicle.doorLocation?.y})`);
            return false;
        }

        // Position player slightly outside the vehicle, based on vehicle angle
        const exitOffset = (vehicle.size || 30) / 2 + this.size / 2 + 5; // Place just outside radius sum
        const exitAngle = vehicle.angle !== undefined ? vehicle.angle : 0;
        this.x = vehicle.x + Math.cos(exitAngle) * exitOffset;
        this.y = vehicle.y + Math.sin(exitAngle) * exitOffset;
        this.angle = exitAngle; // Align player angle with vehicle exit angle

        // Change state back to Overworld
        this.playerState = 'Overworld';
        this.currentVehicleId = null;
        this.vehicleId = null; // Keep legacy field synced
        this.insideVehicle = false; // Keep legacy field synced

        this._stateChanged = true; // Mark state changed for network sync
        this.game.debug.log(`Player ${this.id} transitioned to Overworld state from vehicle ${vehicle.id}. World Pos: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
        return true;
    }

     startPilotingVehicle() {
         // Can only pilot from Interior state
         if (this.playerState !== 'Interior' || !this.currentVehicleId) return false;
         const vehicle = this.game.entities.get(this.currentVehicleId);
         if (!vehicle) {
             this.game.debug.warn(`Player ${this.id} trying to pilot, but vehicle ${this.currentVehicleId} not found.`);
             return false;
         }

         // Check if player is at the pilot seat location
         if (this.gridX !== vehicle.pilotSeatLocation?.x || this.gridY !== vehicle.pilotSeatLocation?.y) {
             this.game.ui.showNotification("Must be at the pilot seat.", "warn");
             this.game.debug.log(`Player ${this.id} failed pilot: Not at seat (Player: ${this.gridX},${this.gridY} | Seat: ${vehicle.pilotSeatLocation?.x},${vehicle.pilotSeatLocation?.y})`);
             return false;
         }

         // Check if someone else is already driving
         if (vehicle.driver && vehicle.driver !== this.id) {
            this.game.ui.showNotification("Pilot seat is occupied.", "warn");
             this.game.debug.log(`Player ${this.id} failed pilot: Seat occupied by ${vehicle.driver}`);
            return false;
         }

         this.playerState = 'Piloting';
         vehicle.setDriver(this.id); // Vehicle registers the driver (sets _stateChanged on vehicle)

         // Send room state update for vehicle driver change *immediately*
         this.game.network.updateRoomState({
             vehicles: {
                 [vehicle.id]: {
                     driver: this.id
                 }
             }
         });
         // Also ensure vehicle's local state reflects the change immediately
         if(vehicle.clearStateChanged) vehicle.clearStateChanged();

         this._stateChanged = true; // Mark player state changed for network sync
         this.game.debug.log(`Player ${this.id} transitioned to Piloting state in vehicle ${vehicle.id}.`);
         return true;
     }

     stopPilotingVehicle() {
         // Can only stop piloting from Piloting state
         if (this.playerState !== 'Piloting' || !this.currentVehicleId) return false;
         const vehicle = this.game.entities.get(this.currentVehicleId);
         // Should always find vehicle if piloting, but check anyway
         if (!vehicle) {
              this.game.debug.warn(`Player ${this.id} trying to stop piloting, but vehicle ${this.currentVehicleId} not found (this shouldn't happen).`);
              // Force back to interior?
              this.playerState = 'Interior';
              // Guess position near pilot seat
              this.gridX = vehicle?.pilotSeatLocation?.x ?? 0;
              this.gridY = vehicle?.pilotSeatLocation?.y ?? 0;
              this._stateChanged = true;
              return false;
         }

         this.playerState = 'Interior';
         this.gridX = vehicle.pilotSeatLocation?.x ?? 0; // Position player back at the seat
         this.gridY = vehicle.pilotSeatLocation?.y ?? 0;
         vehicle.removeDriver(); // Vehicle removes driver (sets _stateChanged on vehicle)

         // Send room state update for vehicle driver change *immediately*
         this.game.network.updateRoomState({
             vehicles: {
                 [vehicle.id]: {
                     driver: null
                 }
             }
         });
         // Also ensure vehicle's local state reflects the change immediately
         if(vehicle.clearStateChanged) vehicle.clearStateChanged();


         this._stateChanged = true; // Mark player state changed for network sync
         this.game.debug.log(`Player ${this.id} transitioned back to Interior state from piloting vehicle ${vehicle.id}.`);
         return true;
     }
    // --- End State Transition Methods ---


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
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            resources: { ...this.resources },
            vehicleId: this.vehicleId, // Keep sending legacy field for now
            equipment: { ...this.equipment },
            // --- New State Properties ---
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

        // Fallback: If flag wasn't set, do a quick check just in case
        // (This might not be strictly necessary if _stateChanged is managed perfectly)
        const currentState = this.getNetworkState();
        const lastState = this._lastNetworkState;

        // Don't bother checking position/angle if not in overworld
        let positionChanged = false;
        let angleChanged = false;
        if (currentState.playerState === 'Overworld') {
            const positionThresholdSq = 1*1; // Use squared distance
            const dx = currentState.x - lastState.x;
            const dy = currentState.y - lastState.y;
            positionChanged = (dx * dx + dy * dy) > positionThresholdSq;

            const angleThreshold = 0.1; // Radians
            angleChanged = Math.abs(this.normalizeAngle(currentState.angle - lastState.angle)) > angleThreshold;
        }

        const healthChanged = currentState.health !== lastState.health;
        const vehicleChanged = currentState.vehicleId !== lastState.vehicleId; // Legacy

        // More efficient resource check if resources change frequently
        const resourcesChanged = JSON.stringify(currentState.resources) !== JSON.stringify(lastState.resources);

        const equipmentChanged = JSON.stringify(currentState.equipment) !== JSON.stringify(lastState.equipment);

        // Add checks for new state properties
        const playerStateChanged = currentState.playerState !== lastState.playerState;
        const currentVehicleIdChanged = currentState.currentVehicleId !== lastState.currentVehicleId;
        const gridPositionChanged = currentState.gridX !== lastState.gridX || currentState.gridY !== lastState.gridY;

        return positionChanged || angleChanged || healthChanged || vehicleChanged || resourcesChanged || equipmentChanged ||
               playerStateChanged || currentVehicleIdChanged || gridPositionChanged;
    }

    // Stores the current state as the last sent state and resets the change flag
    clearStateChanged() {
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}