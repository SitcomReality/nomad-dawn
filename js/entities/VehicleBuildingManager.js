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

        // Debounce network updates for rapid actions
        this.networkUpdateQueue = {};
        this.networkUpdateTimeout = null;
        // REDUCED delay to send smaller, more frequent updates, mitigating large message size risk.
        this.networkUpdateDelay = 50; // ms
    }

    setActiveVehicle(vehicle) {
        this.activeVehicle = vehicle;
        this.game.debug.log(`[BuildingManager] Set active vehicle: ${vehicle?.id}`);
        // Reset selection/tool when vehicle changes
        this.selectedTool = 'select';
        this.selectedObjectType = null; // Reset selected object type too
        // UI Update is handled by BaseBuildingUI.setActiveTool called from BaseBuildingUI.show()
         // Flush any pending updates for the previous vehicle immediately
         if (this.networkUpdateTimeout) {
             clearTimeout(this.networkUpdateTimeout);
             this.sendNetworkUpdates();
         }
         this.networkUpdateQueue = {}; // Clear queue for new vehicle
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
        this.game.debug.log(`[BuildingManager] Selected tile type: ${tileType}`);
        // UI update handled by BaseBuildingUI / BuildingToolPanel
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
         // Prevent building if player is not the owner? (Optional rule)
         // if (this.activeVehicle.owner && this.activeVehicle.owner !== this.game.player.id) {
         //     this.uiManager?.showNotification("You don't own this vehicle.", "warn");
         //     return;
         // }

        this.game.debug.log(`[BuildingManager] Grid clicked at (${gridX}, ${gridY}) with tool: ${this.selectedTool}, object: ${this.selectedObjectType}`);
        const cellKey = `${gridX},${gridY}`;

        switch (this.selectedTool) {
            case 'select':
                // Display info about the selected cell (tile, object) in the UI
                const tile = this.activeVehicle.gridTiles?.[cellKey];
                const object = this.activeVehicle.gridObjects?.[cellKey];
                let tileName = 'None';
                if (tile) {
                    const tileConfig = this.game.config.INTERIOR_TILE_TYPES.find(t => t.id === tile);
                    tileName = tileConfig?.name || tile;
                }
                let objectName = 'None';
                if (object) {
                    const objConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === object);
                    objectName = objConfig?.name || object;
                }
                console.log(`Selected cell ${cellKey}. Tile: ${tileName}, Object: ${objectName}`);
                this.uiManager?.showNotification(`Cell (${gridX},${gridY}): Tile=${tileName}, Object=${objectName}`, 'info', 2000);
                break;

            case 'place_tile':
                if (!this.selectedTileType) {
                    this.game.debug.warn(`[BuildingManager] Place tile tool used, but no tile type selected.`);
                    this.uiManager?.showNotification(`Select a tile type to place first!`, 'warn');
                    return;
                }

                // Check if cell is occupied by an object (cannot place tile under object)
                if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                    const existingObjId = this.activeVehicle.gridObjects[cellKey];
                    const existingObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === existingObjId);
                    const existingObjName = existingObjConfig?.name || existingObjId;
                    this.uiManager?.showNotification(`Cannot place tile: Cell occupied by ${existingObjName}.`, 'error');
                    return;
                }
                // Check if the same tile type is already there
                if (this.activeVehicle.gridTiles && this.activeVehicle.gridTiles[cellKey] === this.selectedTileType) {
                    this.game.debug.log(`[BuildingManager] Tile placement skipped: Cell (${gridX},${gridY}) already has tile type ${this.selectedTileType}.`);
                    // Optionally show a subtle notification?
                    // this.uiManager?.showNotification(`Cell already has this tile.`, 'info', 1000);
                    return;
                }

                // Check resource cost
                const tileConfig = this.game.config.INTERIOR_TILE_TYPES.find(t => t.id === this.selectedTileType);
                if (!tileConfig) {
                    this.game.debug.error(`[BuildingManager] Config not found for selected tile type: ${this.selectedTileType}`);
                    return;
                }

                if (tileConfig.cost) {
                    let canAfford = true;
                    let missingResources = [];
                    for (const [resource, amount] of Object.entries(tileConfig.cost)) {
                        if ((this.game.player.resources[resource] || 0) < amount) {
                            canAfford = false;
                            missingResources.push(`${amount} ${this.getResourceName(resource)}`);
                        }
                    }
                    if (!canAfford) {
                        this.game.debug.log(`[BuildingManager] Cannot afford ${tileConfig.name}. Missing: ${missingResources.join(', ')}`);
                        this.uiManager?.showNotification(`Cannot afford ${tileConfig.name}. Need: ${missingResources.join(', ')}`, 'error');
                        return;
                    }
                }

                // Deduct resources locally (optimistic update)
                if (tileConfig.cost) {
                    for (const [resource, amount] of Object.entries(tileConfig.cost)) {
                        this.game.player.addResource(resource, -amount); // Subtract cost
                    }
                    this.game.player._stateChanged = true; // Mark state change
                    // Refresh UI resource display
                    if (this.uiManager.baseBuilding.isVisible && this.uiManager.baseBuilding.toolPanel) {
                        this.uiManager.baseBuilding.toolPanel.update(); // Update tool panel affordability display
                    }
                }

                // Queue the network update
                this.queueNetworkUpdate('gridTiles', cellKey, this.selectedTileType);
                this.game.debug.log(`[BuildingManager] Queued placement of tile ${this.selectedTileType} at (${gridX}, ${gridY})`);
                break;

            case 'place_object':
                if (!this.selectedObjectType) {
                    this.game.debug.warn(`[BuildingManager] Place object tool used, but no object type selected.`);
                    this.uiManager?.showNotification(`Select an object type to place first!`, 'warn');
                    return;
                }
                // --- Server-Side Authority Simulation ---
                // Check if cell is already occupied by an object
                if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                    const existingObjId = this.activeVehicle.gridObjects[cellKey];
                    const existingObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === existingObjId);
                    const existingObjName = existingObjConfig?.name || existingObjId;
                    this.uiManager?.showNotification(`Cannot place object: Cell already occupied by ${existingObjName}.`, 'error');
                    this.game.debug.log(`[BuildingManager] Placement failed at (${gridX},${gridY}). Cell occupied by ${existingObjId}.`);
                    return;
                }
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
                            missingResources.push(`${amount} ${this.getResourceName(resource)}`);
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
                    this.game.player._stateChanged = true; // Mark state change
                    // No need to explicitly send presence here, game loop will handle it
                    // this.game.network.updatePresence({ resources: this.game.player.resources });
                    // Refresh UI resource display (HUD updates automatically, Building UI needs manual trigger)
                    if (this.uiManager.baseBuilding.isVisible) {
                        this.uiManager.baseBuilding.updateObjectButtonStates(); // Update craftability status
                    }
                }

                // Queue the network update
                this.queueNetworkUpdate('gridObjects', cellKey, this.selectedObjectType);
                // Optionally, provide immediate visual feedback locally (will be confirmed/overwritten by network)
                // this.activeVehicle.gridObjects[cellKey] = this.selectedObjectType; // Optimistic local update
                // this.uiManager.baseBuilding.buildingRenderer?.render(); // Re-render grid
                break;

            case 'remove':
                let removedItemType = null;
                let refundCost = null;
                let updateType = null; // 'gridObjects' or 'gridTiles'

                // Check if removing an object
                if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                    removedItemType = this.activeVehicle.gridObjects[cellKey];
                    const removedObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === removedItemType);
                    refundCost = removedObjConfig?.cost; // Get cost for potential refund
                    updateType = 'gridObjects';
                }
                // Check if removing a tile (only if no object was present)
                else if (this.activeVehicle.gridTiles && this.activeVehicle.gridTiles[cellKey]) {
                    removedItemType = this.activeVehicle.gridTiles[cellKey];
                    const removedTileConfig = this.game.config.INTERIOR_TILE_TYPES.find(t => t.id === removedItemType);
                    refundCost = removedTileConfig?.cost; // Get cost for potential refund
                    updateType = 'gridTiles';
                }

                // If an item was found to remove
                if (updateType) {
                    // Queue the removal update
                    this.queueNetworkUpdate(updateType, cellKey, null); // Use null to signify removal

                    // Optional: Optimistic local update
                    // if (updateType === 'gridObjects') delete this.activeVehicle.gridObjects[cellKey];
                    // else if (updateType === 'gridTiles') delete this.activeVehicle.gridTiles[cellKey];
                    // this.uiManager.baseBuilding.buildingRenderer?.render(); // Re-render grid

                    // Refund resources if applicable
                    if (removedItemType && refundCost) {
                        const refundFactor = 0.75; // Refund 75%? Configurable?
                        let refundedResources = [];
                        for (const [resource, amount] of Object.entries(refundCost)) {
                            const amountToRefund = Math.floor(amount * refundFactor);
                            if (amountToRefund > 0) {
                                this.game.player.addResource(resource, amountToRefund);
                                refundedResources.push(`${amountToRefund} ${this.getResourceName(resource)}`);
                            }
                        }
                        if (refundedResources.length > 0) {
                            // Trigger presence update for resources (done automatically by game loop now)
                            this.game.player._stateChanged = true; // Mark state changed
                            // No explicit presence update needed here
                            this.uiManager?.showNotification(`Refunded: ${refundedResources.join(', ')}`, 'info');
                            // Refresh UI cost display
                            if (this.uiManager.baseBuilding.isVisible && this.uiManager.baseBuilding.toolPanel) {
                                this.uiManager.baseBuilding.toolPanel.update(); // Update tool panel affordability display
                            }
                        }
                    }
                    this.game.debug.log(`[BuildingManager] Queued removal of ${removedItemType} at (${gridX}, ${gridY})`);
                } else {
                    this.game.debug.log(`[BuildingManager] Remove tool clicked on empty cell (${gridX}, ${gridY}).`);
                }
                break;

            default:
                this.game.debug.warn(`[BuildingManager] Unknown tool used: ${this.selectedTool}`);
        }
    }

    // Queue updates to be sent in batches
    queueNetworkUpdate(gridType, cellKey, value) {
        if (!this.activeVehicle || !this.activeVehicle.id) return;

        // Initialize queues if they don't exist
        if (!this.networkUpdateQueue[this.activeVehicle.id]) {
            this.networkUpdateQueue[this.activeVehicle.id] = {};
        }
        if (!this.networkUpdateQueue[this.activeVehicle.id][gridType]) {
            this.networkUpdateQueue[this.activeVehicle.id][gridType] = {};
        }

        // Add the specific cell update to the queue for this vehicle and grid type
        this.networkUpdateQueue[this.activeVehicle.id][gridType][cellKey] = value;

        // Clear any existing timeout to reset the delay timer
        if (this.networkUpdateTimeout) {
            clearTimeout(this.networkUpdateTimeout);
        }
        // Set a new timeout to send the accumulated updates
        this.networkUpdateTimeout = setTimeout(() => {
            this.sendNetworkUpdates();
        }, this.networkUpdateDelay);
    }

    // Send the queued updates
    sendNetworkUpdates() {
        // Construct the update payload based on the current queue
        const updatesToSend = {};
        let hasUpdates = false;

        // Iterate through queued updates for all vehicles (usually just one active)
        for (const vehicleId in this.networkUpdateQueue) {
            if (!this.networkUpdateQueue[vehicleId]) continue;

            // Prepare the update structure for this specific vehicle
            const vehicleUpdates = {};
            let vehicleHasUpdates = false;

            // Check and add gridTiles updates
            const tilesData = this.networkUpdateQueue[vehicleId].gridTiles;
            if (tilesData && Object.keys(tilesData).length > 0) {
                vehicleUpdates.gridTiles = { ...tilesData }; // Copy data
                vehicleHasUpdates = true;
            }

            // Check and add gridObjects updates
            const objectsData = this.networkUpdateQueue[vehicleId].gridObjects;
            if (objectsData && Object.keys(objectsData).length > 0) {
                vehicleUpdates.gridObjects = { ...objectsData }; // Copy data
                vehicleHasUpdates = true;
            }

            // If this vehicle had updates, add it to the main payload
            if (vehicleHasUpdates) {
                updatesToSend[vehicleId] = vehicleUpdates;
                hasUpdates = true;
            }
        }

        // Clear the queue and timeout regardless of whether updates were sent
        this.networkUpdateQueue = {};
        this.networkUpdateTimeout = null;

        // Only send if there are actual updates to transmit
        if (!hasUpdates) {
            // this.game.debug.log(`[BuildingManager] SendNetworkUpdates called, but queue was empty.`);
            return;
        }

        // DEBUG: Log the exact structure being sent
        this.game.debug.log(`[BuildingManager] Sending network update for vehicles:`, JSON.parse(JSON.stringify({ vehicles: updatesToSend })));

        // Send the update via the network manager
        this.game.network.updateRoomState({
            vehicles: updatesToSend // Send the structured update
        });

        // UI refresh is handled by the network sync -> entity update -> render loop
    }

    getResourceName(resourceId) {
        const resConfig = this.game.config.RESOURCE_TYPES.find(r => r.id === resourceId);
        return resConfig?.name || resourceId;
    }

    // Called when the building UI is active
    update(deltaTime) {
        // Currently no per-frame logic needed, updates are event-driven (clicks)
        // Could potentially handle things like drag-to-build here later.
    }
}