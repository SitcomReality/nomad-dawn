// New file: js/core/PlayerActionHandler.js

export default class PlayerActionHandler {
    constructor(game) {
        this.game = game;
        // Cooldown to prevent spamming 'E' key interactions
        this.interactionCooldown = 200; // ms
        this.lastInteractionTime = 0;
    }

    handleInput(deltaTime) {
        if (!this.game.player || this.game.isGuestMode || !this.game.input) return;

        const player = this.game.player;
        const input = this.game.input;
        const now = performance.now();

        // Check for 'E' key press and cooldown
        if (input.isKeyDown('KeyE') && (now - this.lastInteractionTime > this.interactionCooldown)) {
            this.lastInteractionTime = now; // Reset cooldown timer

            if (player.playerState === 'Overworld') {
                this.tryEnterVehicle(player);
            } else if (player.playerState === 'Interior') {
                this.tryInteriorAction(player);
            } else if (player.playerState === 'Piloting') {
                this.tryStopPiloting(player);
            }
        }
        // Add other action key handling here (e.g., interacting with objects inside vehicle)
    }

    tryEnterVehicle(player) {
        const nearbyVehicle = this.game.findClosestVehicle(player.x, player.y, this.game.interactionDistance);
        if (nearbyVehicle) {
            this.game.debug.log(`[ActionHandler] Player ${player.id} attempting to enter vehicle ${nearbyVehicle.id}`);
            if (player.enterVehicle(nearbyVehicle)) {
                this.game.debug.log(`[ActionHandler] Player entered vehicle successfully.`);
                // Player state change triggers network update via player.hasStateChanged() check in Game.js
            } else {
                 this.game.debug.log(`[ActionHandler] Player failed to enter vehicle.`);
            }
        } else {
            // Optionally show a notification if 'E' is pressed with no vehicle nearby
            // this.game.ui.showNotification("No vehicle nearby to enter.", "info");
        }
    }

    tryInteriorAction(player) {
        const currentVehicle = this.game.entities.get(player.currentVehicleId);
        if (!currentVehicle) {
            this.game.debug.warn(`[ActionHandler] Player ${player.id} in Interior state but vehicle ${player.currentVehicleId} not found.`);
            // Force player back to overworld?
            player.playerState = 'Overworld';
            player.currentVehicleId = null;
            player._stateChanged = true;
            return;
        }

        // Check if at door
        if (player.gridX === currentVehicle.doorLocation?.x && player.gridY === currentVehicle.doorLocation?.y) {
            this.game.debug.log(`[ActionHandler] Player ${player.id} attempting to exit vehicle ${currentVehicle.id}`);
            if (player.exitVehicle()) {
                 this.game.debug.log(`[ActionHandler] Player exited vehicle successfully.`);
            } else {
                 this.game.debug.log(`[ActionHandler] Player failed to exit vehicle.`);
            }
        }
        // Check if at pilot seat
        else if (player.gridX === currentVehicle.pilotSeatLocation?.x && player.gridY === currentVehicle.pilotSeatLocation?.y) {
            this.game.debug.log(`[ActionHandler] Player ${player.id} attempting to start piloting ${currentVehicle.id}`);
             if (player.startPilotingVehicle()) {
                 this.game.debug.log(`[ActionHandler] Player started piloting successfully.`);
             } else {
                 this.game.debug.log(`[ActionHandler] Player failed to start piloting.`);
             }
        }
        // TODO: Add checks for other interactive grid objects here
        // else if (isAtGridObject(player.gridX, player.gridY, currentVehicle.gridObjects)) {
        //    handleGridObjectInteraction();
        // }
    }

    tryStopPiloting(player) {
         this.game.debug.log(`[ActionHandler] Player ${player.id} attempting to stop piloting.`);
         if (player.stopPilotingVehicle()) {
              this.game.debug.log(`[ActionHandler] Player stopped piloting successfully.`);
         } else {
              this.game.debug.log(`[ActionHandler] Player failed to stop piloting.`);
         }
    }
}
