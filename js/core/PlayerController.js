/**
 * Handles player input processing, state transitions, and interactions with the game world.
 */
export default class PlayerController {
    constructor(game) {
        this.game = game;
        this.input = game.input; // Shortcut to input manager
        this.entities = game.entities; // Shortcut to entity manager
        this.network = game.network; // Shortcut to network manager
        this.debug = game.debug; // Shortcut to debug utils

        this.interactionCooldown = 200; // Milliseconds between interaction checks
        this.lastInteractionTime = 0;
        this.gridMoveCooldown = 150; // Milliseconds between grid movements
        this.lastGridMoveTime = 0;
        this.buildToggleCooldown = 300; // Milliseconds between build mode toggles
        this.lastBuildToggleTime = 0;
    }

    update(deltaTime) {
        const player = this.game.player;
        if (!player || this.game.isGuestMode) return;

        const now = performance.now();

        // --- Check for Interaction Input (E key) ---
        if (this.input.isKeyDown('KeyE') && now - this.lastInteractionTime > this.interactionCooldown) {
            this.handleInteractionKeyPress();
            this.lastInteractionTime = now;
        }

        // --- Check for Build Mode Input (B key) ---
        if (this.input.isKeyDown('KeyB') && now - this.lastBuildToggleTime > this.buildToggleCooldown) {
            this.handleBuildKeyPress();
            this.lastBuildToggleTime = now;
        }

        // --- Handle Movement Updates Based on State ---
        this.handleMovementUpdate(deltaTime, player);
    }

    // --- NEW: Method to handle 'B' key press for building ---
    handleBuildKeyPress() {
        const player = this.game.player;
        if (!player) return;

        if (player.playerState === 'Overworld') {
            // Check for nearby owned vehicle
            const nearbyOwnedVehicle = this.findPlayerNearbyOwnedVehicle();

            if (nearbyOwnedVehicle) {
                // --- Transition to Building state ---
                player.playerState = 'Building';
                player.currentVehicleId = nearbyOwnedVehicle.id; // Store ID of vehicle being modified
                player._stateChanged = true; // Sync state change
                this.debug.log(`Player ${player.id} entering Building mode for vehicle ${nearbyOwnedVehicle.id}`);

                // Show the Base Building UI, passing the vehicle context
                this.game.ui.baseBuilding.show(nearbyOwnedVehicle);
            } else {
                this.game.ui.showNotification("No owned vehicle nearby to modify.", "warn");
            }
        } else if (player.playerState === 'Building') {
            // --- Exit Building state ---
            this.exitBuildingMode();
        }
        // If in Interior or Piloting state, 'B' might do something else later, or nothing.
    }

    // --- NEW: Helper method to exit building mode ---
    exitBuildingMode() {
         const player = this.game.player;
         if (!player || player.playerState !== 'Building') return;

         player.playerState = 'Overworld';
         // Keep currentVehicleId? Maybe not necessary after exiting building? Clear it.
         // player.currentVehicleId = null; // Let's clear it for now
         player._stateChanged = true; // Sync state change
         this.debug.log(`Player ${player.id} exiting Building mode.`);

         // Hide the Base Building UI
         this.game.ui.baseBuilding.hide();
    }

    handleMovementUpdate(deltaTime, player) {
        switch (player.playerState) {
            case 'Overworld':
                // Update player world movement
                player.update(deltaTime, this.input); // Player update handles this
                break;

            case 'Interior':
                // Handle grid-based movement using input
                this.handleInteriorGridMovement(deltaTime, player);
                break;

            case 'Piloting':
                // Update vehicle movement based on input
                const vehicle = player.currentVehicleId ? this.entities.get(player.currentVehicleId) : null;
                if (vehicle && vehicle.update) {
                    vehicle.update(deltaTime, this.input);
                    // Sync vehicle state if it changed
                    if (vehicle.hasStateChanged && vehicle.hasStateChanged()) {
                        // Only send minimal state frequently during piloting
                        const minimalState = vehicle.getMinimalNetworkState ? vehicle.getMinimalNetworkState() : { x: vehicle.x, y: vehicle.y, angle: vehicle.angle, speed: vehicle.speed, health: vehicle.health, driver: vehicle.driver };
                        this.network.updateRoomState({
                            vehicles: {
                                [vehicle.id]: minimalState
                            }
                        });
                        if (vehicle.clearStateChanged) vehicle.clearStateChanged();
                    }
                }
                break;

            case 'Building':
                // Player is stationary while in building mode (using the UI)
                // Stop any existing overworld movement if they just entered build mode
                player.speed = 0;
                break;
        }
    }

    handleInteriorGridMovement(deltaTime, player) {
        const now = performance.now();
        if (now - this.lastGridMoveTime < this.gridMoveCooldown) {
            return; // Wait for cooldown
        }

        const direction = this.input.getMovementDirection();
        if (direction.x === 0 && direction.y === 0) {
            return; // No movement input
        }

        const vehicle = player.currentVehicleId ? this.entities.get(player.currentVehicleId) : null;
        if (!vehicle || !vehicle.gridTiles) {
            this.debug.warn(`Cannot perform grid movement: Vehicle ${player.currentVehicleId} or its gridTiles not found.`);
            return;
        }

        // Determine primary movement direction (prioritize one axis if diagonal)
        let moveX = 0;
        let moveY = 0;
        if (Math.abs(direction.x) > Math.abs(direction.y)) {
             moveX = Math.sign(direction.x);
        } else if (Math.abs(direction.y) > Math.abs(direction.x)) {
             moveY = Math.sign(direction.y);
        } else if (direction.x !== 0) { // Diagonal, pick one (e.g., horizontal)
             moveX = Math.sign(direction.x);
        } else if (direction.y !== 0) {
             moveY = Math.sign(direction.y);
        }


        const targetGridX = player.gridX + moveX;
        const targetGridY = player.gridY + moveY;

        // Check bounds
        if (targetGridX < 0 || targetGridX >= vehicle.gridWidth ||
            targetGridY < 0 || targetGridY >= vehicle.gridHeight) {
            return; // Out of bounds
        }

        // Check if target tile is walkable (e.g., not 'Wall')
        // Assume 'Floor', 'Door', 'PilotSeat' are walkable, others are not unless specified.
        const targetTileKey = `${targetGridX},${targetGridY}`;
        const targetTileType = vehicle.gridTiles[targetTileKey] || 'Empty'; // Default to Empty if not defined

        // Define non-walkable tile types
        const nonWalkableTiles = ['Wall', 'Empty']; // Add other blocking types as needed

        if (nonWalkableTiles.includes(targetTileType)) {
            return; // Cannot move into this tile type
        }

        // TODO: Check collision with gridObjects later if needed

        // Move player
        player.gridX = targetGridX;
        player.gridY = targetGridY;
        player._stateChanged = true; // Mark state changed for network sync
        this.lastGridMoveTime = now; // Reset cooldown timer
    }

    handleInteractionKeyPress() {
        const player = this.game.player;
        if (!player) return;

        const currentVehicle = player.currentVehicleId ? this.entities.get(player.currentVehicleId) : null;

        switch (player.playerState) {
            case 'Overworld':
                const nearbyVehicle = this.findPlayerNearbyVehicle();
                if (nearbyVehicle) {
                    // --- Transition to Interior state ---
                    player.playerState = 'Interior';
                    player.currentVehicleId = nearbyVehicle.id;
                    // Use nullish coalescing for safety
                    player.gridX = nearbyVehicle.doorLocation?.x ?? 0;
                    player.gridY = nearbyVehicle.doorLocation?.y ?? 0;
                    player._stateChanged = true;
                    this.debug.log(`Player ${player.id} entering vehicle ${nearbyVehicle.id}`);

                    // Hide UI panels if open
                    if (this.game.ui.inventory.isVisible) this.game.ui.inventory.hide();
                    if (this.game.ui.baseBuilding.isVisible) this.game.ui.baseBuilding.hide();
                }
                break;

            case 'Interior':
                 if (currentVehicle) {
                    // Check grid properties exist before accessing
                    const doorX = currentVehicle.doorLocation?.x;
                    const doorY = currentVehicle.doorLocation?.y;
                    const pilotX = currentVehicle.pilotSeatLocation?.x;
                    const pilotY = currentVehicle.pilotSeatLocation?.y;

                    const isAtDoor = (doorX !== undefined && doorY !== undefined) &&
                                     player.gridX === doorX && player.gridY === doorY;
                    const isAtPilotSeat = (pilotX !== undefined && pilotY !== undefined) &&
                                          player.gridX === pilotX && player.gridY === pilotY;

                    if (isAtDoor) {
                        // --- Transition to Overworld state ---
                        player.playerState = 'Overworld';
                        // Place player slightly outside vehicle (behind the door relative to vehicle angle)
                        const exitOffset = (currentVehicle.size || 30) / 2 + 15; // Increased offset
                        const exitAngle = (currentVehicle.angle ?? 0) + Math.PI; // Opposite vehicle direction
                        player.x = currentVehicle.x + Math.cos(exitAngle) * exitOffset;
                        player.y = currentVehicle.y + Math.sin(exitAngle) * exitOffset;
                        player.angle = exitAngle; // Face away from vehicle
                        player.currentVehicleId = null;
                        player._stateChanged = true;
                        this.debug.log(`Player ${player.id} exiting vehicle ${currentVehicle.id}`);
                    } else if (isAtPilotSeat) {
                        // --- Transition to Piloting state ---
                        player.playerState = 'Piloting';
                        if (currentVehicle.setDriver) currentVehicle.setDriver(player.id);
                        // Send network update for driver change
                        this.network.updateRoomState({
                            vehicles: {
                                [currentVehicle.id]: { driver: player.id }
                            }
                        });
                        player._stateChanged = true; // Send player state change too
                        this.debug.log(`Player ${player.id} starts piloting vehicle ${currentVehicle.id}`);
                    } else {
                        // Handle interaction with grid objects later
                        this.debug.log(`Player pressed E at (${player.gridX}, ${player.gridY}) - no interaction defined.`);
                    }
                } else {
                    this.debug.warn(`Player in Interior state but currentVehicleId ${player.currentVehicleId} not found.`);
                    // Force back to overworld as a safety measure?
                    player.playerState = 'Overworld';
                    player.currentVehicleId = null;
                    player._stateChanged = true;
                }
                break;

            case 'Piloting':
                 if (currentVehicle) {
                     // --- Transition back to Interior state ---
                     player.playerState = 'Interior';
                     // Place player back at pilot seat
                     player.gridX = currentVehicle.pilotSeatLocation?.x ?? 0;
                     player.gridY = currentVehicle.pilotSeatLocation?.y ?? 0;
                     if (currentVehicle.removeDriver) currentVehicle.removeDriver();
                     // Send network update for driver change
                     this.network.updateRoomState({
                         vehicles: {
                             [currentVehicle.id]: { driver: null }
                         }
                     });
                     player._stateChanged = true; // Send player state change
                     this.debug.log(`Player ${player.id} stops piloting vehicle ${currentVehicle.id}`);
                 } else {
                     this.debug.warn(`Player in Piloting state but currentVehicleId ${player.currentVehicleId} not found.`);
                     // Force back to overworld
                     player.playerState = 'Overworld';
                     player.currentVehicleId = null;
                     player._stateChanged = true;
                 }
                 break;
             case 'Building':
                 // 'E' currently does nothing in building mode
                 // Could potentially be used for selecting/confirming later
                 break;
        }
    }

    // --- MOVED from BaseBuildingUI.js ---
    // Helper to find nearby vehicle (any vehicle)
    findPlayerNearbyVehicle() {
        const player = this.game.player;
        if (!player) return null;

        const vehicles = this.entities.getByType('vehicle');
        const interactionDistance = 100; // Interaction range
        let closestVehicle = null;
        let closestDistanceSq = interactionDistance * interactionDistance;

        for (const vehicle of vehicles) {
            // Ensure vehicle has basic grid properties before allowing entry
            // Check gridTiles existence, doorLocation object existence, pilotSeatLocation object existence
            if (!vehicle || typeof vehicle.gridTiles !== 'object' || typeof vehicle.doorLocation !== 'object' || typeof vehicle.pilotSeatLocation !== 'object') {
                 continue;
            }
            const dx = vehicle.x - player.x;
            const dy = vehicle.y - player.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestVehicle = vehicle;
            }
        }
        return closestVehicle;
    }

    // --- NEW: Helper to find nearby vehicle *owned* by the player ---
    findPlayerNearbyOwnedVehicle() {
        const player = this.game.player;
        if (!player) return null;

        const vehicles = this.entities.getByType('vehicle');
        const interactionDistance = 150; // Slightly larger range for building
        let closestOwnedVehicle = null;
        let closestDistanceSq = interactionDistance * interactionDistance;

        this.debug.log(`Finding nearby OWNED vehicles. Total vehicles: ${vehicles.length}`);

        for (const vehicle of vehicles) {
             // Check ownership
             if (vehicle.owner !== player.id) {
                 this.debug.log(`  Skipping vehicle ${vehicle.id}: Not owned by ${player.id} (Owner: ${vehicle.owner})`);
                 continue;
             }

            const dx = vehicle.x - player.x;
            const dy = vehicle.y - player.y;
            const distanceSq = dx * dx + dy * dy;

            this.debug.log(`  Checking owned vehicle ${vehicle.id} at (${vehicle.x.toFixed(0)}, ${vehicle.y.toFixed(0)}), distance: ${Math.sqrt(distanceSq).toFixed(1)}`);

            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestOwnedVehicle = vehicle;
            }
        }

        if (closestOwnedVehicle) {
            this.debug.log(`Closest owned vehicle found: ${closestOwnedVehicle.id} at distance ${Math.sqrt(closestDistanceSq).toFixed(1)}`);
        } else {
            this.debug.log(`No owned vehicle found within interaction distance (${interactionDistance}).`);
        }

        return closestOwnedVehicle;
    }
}