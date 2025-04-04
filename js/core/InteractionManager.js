import ResourceCollectionManager from './ResourceCollectionManager.js';

export default class InteractionManager {
    constructor(game) {
        this.game = game;
        this.interactionCooldown = 500; // ms cooldown for 'E' key interactions
        this.lastInteractionTime = 0;
        this.resourceCheckRadius = 40; // Radius to check for resources when pressing 'E'
        
        // Create ResourceCollectionManager instance properly
        this.resourceManager = new ResourceCollectionManager(game);
    }

    handleInput(currentTime) {
        // Only handle 'E' key presses
        if (!this.game.input.isKeyDown('KeyE') || currentTime < this.lastInteractionTime + this.interactionCooldown) {
            return;
        }

        if (this.game.isGuestMode || !this.game.player) return;

        const player = this.game.player;
        const playerState = player.playerState;
        let interactionMade = false; // Flag for general interaction

        this.game.debug.log(`[InteractionManager] Handling 'E' press. State: ${playerState}`);

        try {
            switch (playerState) {
                case 'Overworld':
                    interactionMade = this.handleOverworldInteraction(player);
                    break;
                case 'Interior':
                    interactionMade = this.handleInteriorInteraction(player);
                    break;
                case 'Piloting':
                    interactionMade = this.handlePilotingInteraction(player);
                    break;
                case 'Building':
                    interactionMade = this.handleBuildingInteraction(player);
                    break;
            }
        } catch (error) {
            this.game.debug.error("Error during interaction handling:", error);
             // Attempt recovery if possible (e.g., reset state)
             if(player) {
                player.playerState = 'Overworld';
                 player.currentVehicleId = null;
                 player._stateChanged = true;
                 this.game.ui?.showNotification("Interaction Error - Resetting State", "error");
             }
        }

        if (interactionMade) {
            this.lastInteractionTime = currentTime;
            // Force immediate presence update if player state changed
            // Note: Player._stateChanged should be set by the handler functions
            if (player._stateChanged) {
                 this.game.network.updatePresence(player.getNetworkState());
                 player.clearStateChanged();
            }
        }
    }

    handleOverworldInteraction(player) {
        const interactionDistance = 50; // For vehicles
        let nearbyVehicle = null;
        let closestVehicleDistSq = interactionDistance * interactionDistance;

        // Check for nearby vehicles first
        for (const vehicle of this.game.entities.getByType('vehicle')) {
             if (!vehicle) continue;
            const dx = vehicle.x - player.x;
            const dy = vehicle.y - player.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestVehicleDistSq) {
                closestVehicleDistSq = distanceSq;
                nearbyVehicle = vehicle;
            }
        }

        if (nearbyVehicle) {
            this.game.debug.log(`[InteractionManager] Transitioning to Interior: Vehicle ${nearbyVehicle.id}`);
            player.playerState = 'Interior';
            player.currentVehicleId = nearbyVehicle.id;
            // Safely access grid properties with defaults
            const gridWidth = nearbyVehicle.gridWidth || 10;
            const gridHeight = nearbyVehicle.gridHeight || 10;
            player.gridX = nearbyVehicle.doorLocation?.x ?? Math.floor(gridWidth / 2);
            player.gridY = nearbyVehicle.doorLocation?.y ?? gridHeight - 1;
            player.speed = 0;
            player._stateChanged = true;
            return true; // Interaction occurred (entering vehicle)
        }

        // If no vehicle found, check for nearby resources using ResourceCollectionManager
        const nearbyResource = this.resourceManager.findNearestResource(player, this.resourceCheckRadius);

        if (nearbyResource) {
            this.game.debug.log(`[InteractionManager] Requesting collection of resource: ${nearbyResource.id}`);
            // Use the dedicated resource manager for collection logic
            return this.resourceManager.collectResource(player, nearbyResource);
        }

        return false; // No interaction
    }

    handleInteriorInteraction(player) {
         const vehicle = this.game.entities.get(player.currentVehicleId);
         if (!vehicle) {
             this.game.debug.warn(`[InteractionManager] Player in Interior state but vehicle ${player.currentVehicleId} not found.`);
             player.playerState = 'Overworld';
             player.currentVehicleId = null;
             player._stateChanged = true;
             this.game.ui.showNotification("Error: Exited invalid vehicle", "error");
             return true; // State change is an interaction
         }

         // --- Check for Object Interaction FIRST ---
         const cellX = Math.floor(player.gridX);
         const cellY = Math.floor(player.gridY);
         const cellKey = `${cellX},${cellY}`;
         const objectId = vehicle.gridObjects?.[cellKey];
         const objectConfig = objectId ? this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectId) : null;

         if (objectConfig?.interactable) {
             this.game.debug.log(`[InteractionManager] Interacting with object '${objectConfig.name}' at (${cellX}, ${cellY})`);
             // Implement interaction logic based on object type
             switch (objectConfig.id) {
                 case 'storage_small':
                     this.game.ui.showNotification(`Accessed ${objectConfig.name}. (Storage UI not implemented)`, 'info');
                     break;
                 case 'console_basic':
                     this.game.ui.showNotification(`Used ${objectConfig.name}. (Functionality not implemented)`, 'info');
                     break;
                 case 'bed_simple':
                     this.game.ui.showNotification(`Rested on ${objectConfig.name}. (Healing/saving not implemented)`, 'info');
                     break;
                 default:
                     this.game.ui.showNotification(`Interacted with ${objectConfig.name}.`, 'info');
             }
             return true; // Object interaction occurred
         }

         // --- If NO object interaction, check for Door/Pilot Seat ---
          // Safely access grid properties with defaults
         const gridWidth = vehicle.gridWidth || 10;
         const gridHeight = vehicle.gridHeight || 10;
         const doorX = vehicle.doorLocation?.x ?? Math.floor(gridWidth / 2);
         const doorY = vehicle.doorLocation?.y ?? gridHeight - 1;
         const isNearDoor = Math.abs(player.gridX - doorX) < 0.6 && Math.abs(player.gridY - doorY) < 0.6;

         const pilotX = vehicle.pilotSeatLocation?.x ?? Math.floor(gridWidth / 2);
         const pilotY = vehicle.pilotSeatLocation?.y ?? 1;
         const isNearPilotSeat = Math.abs(player.gridX - pilotX) < 0.6 && Math.abs(player.gridY - pilotY) < 0.6;

         if (isNearDoor) {
             this.game.debug.log(`[InteractionManager] Transitioning to Overworld from vehicle ${vehicle.id}`);
             player.playerState = 'Overworld';
             const exitOffsetDistance = vehicle.size ? vehicle.size / 2 + player.size / 2 + 5 : 20;
             player.x = vehicle.x + Math.cos(vehicle.angle) * exitOffsetDistance;
             player.y = vehicle.y + Math.sin(vehicle.angle) * exitOffsetDistance;
             player.currentVehicleId = null;
             player._stateChanged = true;
             return true; // Exiting is an interaction
         } else if (isNearPilotSeat && vehicle.driver !== player.id) {
             this.game.debug.log(`[InteractionManager] Transitioning to Piloting vehicle ${vehicle.id}`);
             player.playerState = 'Piloting';
             vehicle.setDriver?.(player.id); // Use method if exists
             if (!vehicle.setDriver) vehicle.driver = player.id; // Fallback
              vehicle._stateChanged = true;
             this.game.network.updateRoomState({ vehicles: { [vehicle.id]: { driver: player.id } } });
             player._stateChanged = true;
             return true; // Piloting is an interaction
         }

        return false; // No door/seat interaction
    }

    handlePilotingInteraction(player) {
        const vehicle = this.game.entities.get(player.currentVehicleId);
         if (!vehicle) {
             this.game.debug.warn(`[InteractionManager] Player in Piloting state but vehicle ${player.currentVehicleId} not found.`);
             player.playerState = 'Overworld';
             player.currentVehicleId = null;
             player._stateChanged = true;
             this.game.ui.showNotification("Error: Exited invalid vehicle while piloting", "error");
             return true; // State change is an interaction
         }
         this.game.debug.log(`[InteractionManager] Transitioning from Piloting to Interior in vehicle ${vehicle.id}`);
         player.playerState = 'Interior';
         // Safely access grid properties with defaults
         const gridWidth = vehicle.gridWidth || 10;
         player.gridX = vehicle.pilotSeatLocation?.x ?? Math.floor(gridWidth / 2);
         player.gridY = vehicle.pilotSeatLocation?.y ?? 1;
         vehicle.removeDriver?.(); // Use method if exists
         if (!vehicle.removeDriver) vehicle.driver = null; // Fallback
         vehicle._stateChanged = true;
         this.game.network.updateRoomState({ vehicles: { [vehicle.id]: { driver: null } } });
         player._stateChanged = true;
        return true; // Exiting pilot seat is an interaction
    }

    handleBuildingInteraction(player) {
        // Currently, 'E' does nothing in building mode. Escape is handled by UIManager.
        this.game.debug.log("[InteractionManager] 'E' pressed while in Building mode. No action defined.");
        return false; // No interaction occurred
    }
}