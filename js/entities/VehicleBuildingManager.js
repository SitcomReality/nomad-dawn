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
        this.selectedObjectType = null; // Default object type to place - Now starts null

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
        this.selectedObjectType = null; // Reset selected object type too
        // TODO: Update UI to reflect the current tool/selection for the new vehicle
        // This is handled by BaseBuildingUI.setActiveTool called from BaseBuildingUI.show()
    }

    setSelectedTool(tool) {
        if (this.selectedTool !== tool) {
            this.selectedTool = tool;
            this.game.debug.log(`[BuildingManager] Selected tool: ${tool}`);
             // If switching away from place_object, clear the selected object type? Optional.
             if (tool !== 'place_object') {
                 this.selectedObjectType = null;
             }
            // UI Update is handled by BaseBuildingUI.setActiveTool
        }
    }

    setSelectedTileType(tileType) {
        this.selectedTileType = tileType;
        // Do NOT automatically switch tool anymore - BaseBuildingUI handles tool setting
        // this.selectedTool = 'place_tile';
        this.game.debug.log(`[BuildingManager] Selected tile type: ${tileType}`);
        // UI update handled by BaseBuildingUI
    }

     setSelectedObjectType(objectTypeId) {
        if (this.selectedObjectType !== objectTypeId) {
             this.selectedObjectType = objectTypeId;
             // Do NOT automatically switch tool
             // this.selectedTool = 'place_object';
             this.game.debug.log(`[BuildingManager] Selected object type: ${objectTypeId}`);
             // UI update handled by BaseBuildingUI
        }
    }

    handleGridClick(gridX, gridY) {
        if (!this.activeVehicle || gridX < 0 || gridY < 0 || !this.game.player) {
             this.game.debug.warn(`[BuildingManager] Grid click ignored: No active vehicle, invalid coords (${gridX}, ${gridY}), or no player.`);
             return;
        }

        this.game.debug.log(`[BuildingManager] Grid clicked at (${gridX}, ${gridY}) with tool: ${this.selectedTool}, object: ${this.selectedObjectType}`);
        const cellKey = `${gridX},${gridY}`;

        switch (this.selectedTool) {
            case 'select':
                // TODO: Display info about the selected cell (tile, object) in the UI
                const tile = this.activeVehicle.gridTiles?.[cellKey];
                const object = this.activeVehicle.gridObjects?.[cellKey];
                console.log(`Selected cell ${cellKey}. Tile: ${tile}, Object: ${object}`);
                this.uiManager?.showNotification(`Cell (${gridX},${gridY}): Tile=${tile || 'None'}, Object=${object || 'None'}`, 'info', 2000);
                break;

            case 'place_tile':
                // Check resource cost for tile (if implemented)
                this.queueNetworkUpdate('gridTiles', cellKey, this.selectedTileType);
                break;

            case 'place_object':
                 if (!this.selectedObjectType) {
                     this.game.debug.warn(`[BuildingManager] Place object tool used, but no object type selected.`);
                     this.uiManager?.showNotification(`Select an object type to place first!`, 'warn');
                     return;
                 }
                // Check for collisions or existing objects? Server might handle this better.
                 // Check resource cost
                 const objectConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === this.selectedObjectType);
                 if (!objectConfig) {
                     this.game.debug.error(`[BuildingManager] Config not found for selected object type: ${this.selectedObjectType}`);
                     return;
                 }

                 if (objectConfig.cost) {
                     let canAfford = true;
                     let missingResources = [];
                     for (const [resource, amount] of Object.entries(objectConfig.cost)) {
                         if ((this.game.player.resources[resource] || 0) < amount) {
                             canAfford = false;
                             missingResources.push(`${amount} ${resource}`);
                         }
                     }
                     if (!canAfford) {
                         this.game.debug.log(`[BuildingManager] Cannot afford ${objectConfig.name}. Missing: ${missingResources.join(', ')}`);
                         this.uiManager?.showNotification(`Cannot afford ${objectConfig.name}. Need: ${missingResources.join(', ')}`, 'error');
                         return;
                     }
                 }

                 // Deduct resources locally (optimistic update) - network is source of truth eventually
                 if (objectConfig.cost) {
                    for (const [resource, amount] of Object.entries(objectConfig.cost)) {
                        this.game.player.addResource(resource, -amount); // Subtract cost
                    }
                    // Trigger presence update for resources
                     this.game.player._stateChanged = true;
                     this.game.network.updatePresence({ resources: this.game.player.resources });
                 }


                 this.queueNetworkUpdate('gridObjects', cellKey, this.selectedObjectType);
                break;

            case 'remove':
                 // Add cost refund logic here? (Optional)
                 let removedItemType = null;
                 let refundCost = null;

                 // Remove object first
                 if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                     removedItemType = this.activeVehicle.gridObjects[cellKey];
                     const removedObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === removedItemType);
                     refundCost = removedObjConfig?.cost; // Get cost for potential refund
                     this.queueNetworkUpdate('gridObjects', cellKey, null); // Use null to signify removal
                 }
                 // Then remove tile if no object was present
                 else if (this.activeVehicle.gridTiles && this.activeVehicle.gridTiles[cellKey]) {
                      removedItemType = this.activeVehicle.gridTiles[cellKey];
                      // Add tile cost/refund logic if tiles have costs
                      this.queueNetworkUpdate('gridTiles', cellKey, null); // Use null to signify removal
                 }

                 // Refund resources if an item was removed and had a cost
                 if (removedItemType && refundCost) {
                      const refundFactor = 0.75; // Refund 75%?
                      let refundedResources = [];
                      for (const [resource, amount] of Object.entries(refundCost)) {
                           const amountToRefund = Math.floor(amount * refundFactor);
                           if (amountToRefund > 0) {
                               this.game.player.addResource(resource, amountToRefund);
                               refundedResources.push(`${amountToRefund} ${resource}`);
                           }
                      }
                      if (refundedResources.length > 0) {
                           // Trigger presence update for resources
                           this.game.player._stateChanged = true;
                           this.game.network.updatePresence({ resources: this.game.player.resources });
                           this.uiManager?.showNotification(`Refunded: ${refundedResources.join(', ')}`, 'info');
                      }
                 }
                break;

            default:
                this.game.debug.warn(`[BuildingManager] Unknown tool used: ${this.selectedTool}`);
        }
    }

    // Queue updates to be sent in batches
    queueNetworkUpdate(gridType, cellKey, value) {
         if (!this.activeVehicle || !this.activeVehicle.id) return;

        if (!this.networkUpdateQueue[this.activeVehicle.id]) {
            this.networkUpdateQueue[this.activeVehicle.id] = {};
        }
        if (!this.networkUpdateQueue[this.activeVehicle.id][gridType]) {
             this.networkUpdateQueue[this.activeVehicle.id][gridType] = {};
        }
        this.networkUpdateQueue[this.activeVehicle.id][gridType][cellKey] = value;

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
        const updatesToSend = {};
        let hasUpdates = false;

        // Iterate through queued updates for all vehicles (though usually just one)
        for (const vehicleId in this.networkUpdateQueue) {
             if (!this.networkUpdateQueue[vehicleId]) continue;

             const vehicleUpdates = {};
             if (this.networkUpdateQueue[vehicleId].gridTiles && Object.keys(this.networkUpdateQueue[vehicleId].gridTiles).length > 0) {
                 vehicleUpdates.gridTiles = this.networkUpdateQueue[vehicleId].gridTiles;
                 hasUpdates = true;
             }
             if (this.networkUpdateQueue[vehicleId].gridObjects && Object.keys(this.networkUpdateQueue[vehicleId].gridObjects).length > 0) {
                 vehicleUpdates.gridObjects = this.networkUpdateQueue[vehicleId].gridObjects;
                 hasUpdates = true;
             }

             if (Object.keys(vehicleUpdates).length > 0) {
                 updatesToSend[vehicleId] = vehicleUpdates;
             }
        }


         if (!hasUpdates) {
             this.networkUpdateQueue = {}; // Clear queue even if nothing sent
             this.networkUpdateTimeout = null;
             return;
         }

         this.game.debug.log(`[BuildingManager] Sending network update for vehicles:`, JSON.parse(JSON.stringify(updatesToSend)));

        this.game.network.updateRoomState({
            vehicles: updatesToSend
        });

        // Clear the queue and timeout
        this.networkUpdateQueue = {};
        this.networkUpdateTimeout = null;

        // Trigger a UI refresh in BaseBuildingUI to show potential local changes faster
        // BaseBuildingUI.update() handles rendering the grid, which reads directly from entity data updated by network sync.
        // For optimistic updates (making it appear instantly), we would need to modify the local vehicle entity here.
        // Let's rely on network sync for now.
    }

    // Called when the building UI is active
    update(deltaTime) {
        // Currently no per-frame logic needed, updates are event-driven (clicks)
    }
}