// New file: js/core/PlayerController.js

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
    }

    update(deltaTime) {
        const player = this.game.player;
        if (!player || this.game.isGuestMode) return;

        // --- Check for Interaction Input (E key) ---
        const now = performance.now();
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
                // TODO: Implement grid-based movement using input
                // Example: Check WASD -> calculate target grid cell -> move player gridX/gridY
                // Make sure to update player._stateChanged = true; when grid position changes
                this.handleInteriorGridMovement(deltaTime, player);
                break;

            case 'Piloting':
                // Update vehicle movement based on input
                const vehicle = player.currentVehicleId ? this.entities.get(player.currentVehicleId) : null;
                if (vehicle && vehicle.update) {
                    vehicle.update(deltaTime, this.input);
                    // Sync vehicle state if it changed
                    if (vehicle.hasStateChanged && vehicle.hasStateChanged()) {
                        this.network.updateRoomState({
                            vehicles: {
                                [vehicle.id]: vehicle.getFullNetworkState() // Send full state when driven
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
        // Placeholder for grid movement logic
        // If player moves (changes gridX/gridY), set player._stateChanged = true;
        // This needs collision checking against vehicle walls/objects eventually.
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
                    const isAtDoor = player.gridX === currentVehicle.doorLocation?.x &&
                                     player.gridY === currentVehicle.doorLocation?.y;
                    const isAtPilotSeat = player.gridX === currentVehicle.pilotSeatLocation?.x &&
                                          player.gridY === currentVehicle.pilotSeatLocation?.y;

                    if (isAtDoor) {
                        // --- Transition to Overworld state ---
                        player.playerState = 'Overworld';
                        // Place player slightly outside vehicle (behind the door relative to vehicle angle)
                        const exitOffset = (currentVehicle.size || 30) / 2 + 15; // Increased offset
                        const exitAngle = currentVehicle.angle + Math.PI; // Opposite vehicle direction
                        player.x = currentVehicle.x + Math.cos(exitAngle) * exitOffset;
                        player.y = currentVehicle.y + Math.sin(exitAngle) * exitOffset;
                        player.angle = exitAngle; // Face away from vehicle
                        player.currentVehicleId = null;
                        player._stateChanged = true;
                        this.debug.log(`Player ${player.id} exiting vehicle ${currentVehicle.id}`);
                    } else if (isAtPilotSeat) {
                        // --- Transition to Piloting state ---
                        player.playerState = 'Piloting';
                        currentVehicle.setDriver(player.id);
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
                     currentVehicle.removeDriver();
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