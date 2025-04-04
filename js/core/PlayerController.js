/**
 * Handles player input processing, state transitions, and interactions related
 * to movement and vehicle entry/exit.
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

        // --- Handle Movement Updates Based on State ---
        this.handleMovementUpdate(deltaTime, player);
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
                // Building mode usually doesn't involve direct player/vehicle movement via WASD
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

        // Debug log
        // this.debug.log(`Player moved to grid (${player.gridX}, ${player.gridY})`);
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
                 // 'E' might close the building UI or finalize placement later
                 break;
        }
    }

    // Helper to find nearby vehicle
    findPlayerNearbyVehicle() {
        const player = this.game.player;
        if (!player) return null;

        const vehicles = this.entities.getByType('vehicle');
        const interactionDistance = 100; // Interaction range
        let closestVehicle = null;
        let closestDistanceSq = interactionDistance * interactionDistance;

        for (const vehicle of vehicles) {
            // Ensure vehicle has grid properties before allowing entry
            if (!vehicle.gridTiles || !vehicle.doorLocation || !vehicle.pilotSeatLocation) {
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
}