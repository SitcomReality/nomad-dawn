// New file: js/entities/VehicleBuildingManager.js

/**
 * Manages the logic for modifying the vehicle interior grid.
 * Handles tool selection, grid clicks, and network updates for building actions.
 */
export default class VehicleBuildingManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager; // Reference to UIManager to interact with building UI
        this.activeVehicle = null;
        this.selectedTool = 'select'; // 'select', 'place_tile', 'place_object', 'remove'
        this.selectedTileType = 'floor_metal'; // Default tile type to place
        this.selectedObjectType = 'wall_metal'; // Default object type to place

        // Debounce network updates for rapid actions (like dragging to place multiple tiles)
        this.networkUpdateQueue = {};
        this.networkUpdateTimeout = null;
        this.networkUpdateDelay = 100; // ms
    }

    setActiveVehicle(vehicle) {
        this.activeVehicle = vehicle;
        this.game.debug.log(`[BuildingManager] Set active vehicle: ${vehicle?.id}`);
        // Reset selection/tool when vehicle changes
        this.selectedTool = 'select';
        // TODO: Update UI to reflect the current tool/selection for the new vehicle
    }

    setSelectedTool(tool) {
        this.selectedTool = tool;
        this.game.debug.log(`[BuildingManager] Selected tool: ${tool}`);
        // TODO: Update UI to highlight the selected tool button
    }

    setSelectedTileType(tileType) {
        this.selectedTileType = tileType;
        this.selectedTool = 'place_tile'; // Switch tool automatically
        this.game.debug.log(`[BuildingManager] Selected tile type: ${tileType}, Tool: ${this.selectedTool}`);
        // TODO: Update UI
    }

     setSelectedObjectType(objectType) {
        this.selectedObjectType = objectType;
        this.selectedTool = 'place_object'; // Switch tool automatically
        this.game.debug.log(`[BuildingManager] Selected object type: ${objectType}, Tool: ${this.selectedTool}`);
        // TODO: Update UI
    }

    handleGridClick(gridX, gridY) {
        if (!this.activeVehicle || gridX < 0 || gridY < 0) {
             this.game.debug.warn(`[BuildingManager] Grid click ignored: No active vehicle or invalid coords (${gridX}, ${gridY})`);
             return;
        }

        this.game.debug.log(`[BuildingManager] Grid clicked at (${gridX}, ${gridY}) with tool: ${this.selectedTool}`);
        const cellKey = `${gridX},${gridY}`;

        switch (this.selectedTool) {
            case 'select':
                // TODO: Display info about the selected cell (tile, object) in the UI
                console.log(`Selected cell ${cellKey}. Tile: ${this.activeVehicle.gridTiles?.[cellKey]}, Object: ${this.activeVehicle.gridObjects?.[cellKey]}`);
                break;

            case 'place_tile':
                this.queueNetworkUpdate('gridTiles', cellKey, this.selectedTileType);
                break;

            case 'place_object':
                // Check for collisions or existing objects?
                // For now, just place it.
                 this.queueNetworkUpdate('gridObjects', cellKey, this.selectedObjectType);
                break;

            case 'remove':
                 // Remove object first, then tile if no object was present
                 if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                     this.queueNetworkUpdate('gridObjects', cellKey, null); // Use null to signify removal
                 } else if (this.activeVehicle.gridTiles && this.activeVehicle.gridTiles[cellKey]) {
                      this.queueNetworkUpdate('gridTiles', cellKey, null); // Use null to signify removal
                 }
                break;

            default:
                this.game.debug.warn(`[BuildingManager] Unknown tool used: ${this.selectedTool}`);
        }
    }

    // Queue updates to be sent in batches
    queueNetworkUpdate(gridType, cellKey, value) {
         if (!this.activeVehicle || !this.activeVehicle.id) return;

        if (!this.networkUpdateQueue[gridType]) {
            this.networkUpdateQueue[gridType] = {};
        }
        this.networkUpdateQueue[gridType][cellKey] = value;

        // Clear existing timeout and set a new one
        if (this.networkUpdateTimeout) {
            clearTimeout(this.networkUpdateTimeout);
        }
        this.networkUpdateTimeout = setTimeout(() => {
            this.sendNetworkUpdates();
        }, this.networkUpdateDelay);
    }

    // Send the queued updates
    sendNetworkUpdates() {
         if (!this.activeVehicle || !this.activeVehicle.id || Object.keys(this.networkUpdateQueue).length === 0) {
             this.networkUpdateQueue = {}; // Clear queue even if nothing sent
             return;
         }

         const updatePayload = {};
         if (this.networkUpdateQueue.gridTiles) {
             updatePayload.gridTiles = this.networkUpdateQueue.gridTiles;
         }
         if (this.networkUpdateQueue.gridObjects) {
             updatePayload.gridObjects = this.networkUpdateQueue.gridObjects;
         }

         this.game.debug.log(`[BuildingManager] Sending network update for vehicle ${this.activeVehicle.id}:`, JSON.parse(JSON.stringify(updatePayload)));

        this.game.network.updateRoomState({
            vehicles: {
                [this.activeVehicle.id]: updatePayload
            }
        });

        // Clear the queue and timeout
        this.networkUpdateQueue = {};
        this.networkUpdateTimeout = null;

        // Optional: Immediately update local vehicle state for responsiveness?
        // Be careful as this might diverge slightly from network state until confirmation.
        // if (updatePayload.gridTiles) {
        //     this.activeVehicle.gridTiles = { ...this.activeVehicle.gridTiles, ...updatePayload.gridTiles };
        // }
        // if (updatePayload.gridObjects) {
        //     this.activeVehicle.gridObjects = { ...this.activeVehicle.gridObjects, ...updatePayload.gridObjects };
        // }
        // Need to handle null values for deletion correctly if updating locally.

        // Trigger a UI refresh in BaseBuildingUI to show potential local changes faster
        this.uiManager?.baseBuilding?.update();
    }

    // Called when the building UI is active
    update(deltaTime) {
        // Currently no per-frame logic needed, updates are event-driven (clicks)
    }
}
