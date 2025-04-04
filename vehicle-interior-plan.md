// Vehicle.js
class Vehicle {
    constructor() {
        this.gridWidth = 10;
        this.gridHeight = 10;
        this.gridTiles = {};
        this.gridObjects = {};
        this.doorLocation = { x: 0, y: 0 };
        this.pilotSeatLocation = { x: 0, y: 0 };
    }

    getFullNetworkState() {
        return {
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            gridTiles: this.gridTiles,
            gridObjects: this.gridObjects,
            doorLocation: this.doorLocation,
            pilotSeatLocation: this.pilotSeatLocation,
        };
    }

    update() {
        if (this.driver && game.player.playerState === 'Piloting') {
            // Movement logic
        }
    }
}

// Player.js
class Player {
    constructor() {
        this.playerState = 'Overworld';
        this.currentVehicleId = null;
        this.gridX = 0;
        this.gridY = 0;
    }

    update() {
        if (this.playerState === 'Piloting' || this.playerState === 'Interior') return;

        // Overworld movement logic
    }

    getNetworkState() {
        return {
            playerState: this.playerState,
            currentVehicleId: this.currentVehicleId,
            gridX: this.gridX,
            gridY: this.gridY,
        };
    }

    hasStateChanged() {
        // Check if player state or position has changed
    }
}

// PlayerController.js
class PlayerController {
    handleInteractionKeyPress() {
        if (input.isKeyPressed('E')) {
            if (player.playerState === 'Overworld' && player.isNearVehicle()) {
                player.playerState = 'Interior';
                player.currentVehicleId = vehicle.id;
                player.gridX = vehicle.doorLocation.x;
                player.gridY = vehicle.doorLocation.y;
                console.log("Transitioning to Interior");
            } else if (player.playerState === 'Interior') {
                if (player.gridX === vehicle.doorLocation.x && player.gridY === vehicle.doorLocation.y) {
                    player.playerState = 'Overworld';
                    player.currentVehicleId = null;
                    console.log("Transitioning to Overworld");
                } else if (player.gridX === vehicle.pilotSeatLocation.x && player.gridY === vehicle.pilotSeatLocation.y) {
                    player.playerState = 'Piloting';
                    vehicle.setDriver(player.id);
                    console.log("Transitioning to Piloting");
                }
            } else if (player.playerState === 'Piloting') {
                player.playerState = 'Interior';
                player.gridX = vehicle.pilotSeatLocation.x;
                player.gridY = vehicle.pilotSeatLocation.y;
                vehicle.removeDriver();
                console.log("Transitioning back to Interior");
            } else if (player.playerState === 'Overworld' && input.isKeyPressed('B')) {
                // Transition to Building state
                player.playerState = 'Building';
            }
        }
    }

    handleInteriorGridMovement(deltaTime, player) {
        // Implement grid-based movement using WASD input
        // Check for collisions with vehicle walls/objects (based on gridTiles/gridObjects)
        // Update player.gridX, player.gridY and set player._stateChanged = true
    }
}

// NetworkManager.js
class NetworkManager {
    constructor() {
        // ...
    }

    syncVehiclesFromNetwork() {
        // Ensure gridTiles and gridObjects updates are merged correctly
    }

    updateRoomState() {
        // Ensure grid properties are included in the payload
    }
}

// Renderer.js
class Renderer {
    constructor() {
        // ...
        this.interiorRenderer = new InteriorRenderer(this, game);
    }

    render() {
        // ...
        if (game.player.playerState === 'Interior') {
            this.interiorRenderer.render(currentVehicle, game.player);
            // Skip rendering world and entities
        }
    }
}

// InteriorRenderer.js
class InteriorRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
    }

    render(vehicle, player) {
        // Clear background
        // Draw grid lines
        // Draw tiles (Floor, Wall, Door, PilotSeat) with basic colors/shapes
        // Draw placed objects (basic shapes for now)
        // Draw the player character at player.gridX, player.gridY
    }
}

// VehicleBuildingRenderer.js
class VehicleBuildingRenderer {
    constructor() {
        // ...
    }

    renderGrid(vehicle) {
        // Generate HTML/SVG/Canvas elements to represent the vehicle.gridTiles and vehicle.gridObjects
        // Add click listeners to grid cells/elements, calling back to VehicleBuildingManager
    }

    show() {
        // ...
    }

    hide() {
        // ...
    }

    update() {
        // ...
    }
}

// VehicleBuildingManager.js
class VehicleBuildingManager {
    constructor() {
        // ...
    }

    handleGridClick() {
        // Determine clicked gridX, gridY
        // Based on selectedTool, prepare the grid update data (modify gridTiles)
        // Send roomState update via NetworkManager
    }

    renderGrid() {
        // Call renderer.renderGrid(activeVehicle)
    }
}