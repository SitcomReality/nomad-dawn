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
        this.networkUpdateDelay = 50; // ms

        // --- NEW: Track pending modifications ---
        // Maps vehicleId -> Set of "cellKey:gridType" strings (e.g., "5,5:gridObjects")
        this.pendingModifications = {};
        // --- END NEW ---
    }

    setActiveVehicle(vehicle) {
        // --- REMOVED: VehicleBuildingManager.setActiveVehicle console log ---
        // Flush any pending updates for the previous vehicle immediately
        if (this.networkUpdateTimeout) {
            clearTimeout(this.networkUpdateTimeout);
            this.sendNetworkUpdates();
        }
        this.networkUpdateQueue = {}; // Clear queue for new vehicle
        // Clear pending modifications for the *previous* vehicle if it exists
        if (this.activeVehicle && this.pendingModifications[this.activeVehicle.id]) {
            delete this.pendingModifications[this.activeVehicle.id];
        }

        this.activeVehicle = vehicle;

        // Reset selection/tool when vehicle changes
        this.selectedTool = 'select';
        this.selectedObjectType = null; // Reset selected object type too
    }

    // --- REMOVED: VehicleBuildingManager.setSelectedTool console log ---
    setSelectedTool(tool) {
        if (this.selectedTool !== tool) {
            this.selectedTool = tool;
             // If switching away from place_object, clear the selected object type? Optional.
             if (tool !== 'place_object') {
                 this.selectedObjectType = null;
             }
            // UI Update is handled by BaseBuildingUI.setActiveTool
        }
    }

    // --- REMOVED: VehicleBuildingManager.setSelectedTileType console log ---
    setSelectedTileType(tileType) {
        this.selectedTileType = tileType;
        // UI update handled by BaseBuildingUI / BuildingToolPanel
    }

    // --- REMOVED: VehicleBuildingManager.setSelectedObjectType console log ---
     setSelectedObjectType(objectTypeId) {
        if (this.selectedObjectType !== objectTypeId) {
             this.selectedObjectType = objectTypeId;
             // Do NOT automatically switch tool
             // this.selectedTool = 'place_object';
             // UI update handled by BaseBuildingUI
        }
    }

    // --- REMOVED: VehicleBuildingManager.handleGridClick console log ---
    handleGridClick(gridX, gridY) {
        if (!this.activeVehicle || gridX < 0 || gridY < 0 || !this.game.player) {
             this.game.debug.warn(`[BuildingManager] Grid click ignored: No active vehicle, invalid coords (${gridX}, ${gridY}), or no player.`);
             return;
        }

        const cellKey = `${gridX},${gridY}`;
        const pendingKey = `${cellKey}:${this.selectedTool === 'place_tile' ? 'gridTiles' : 'gridObjects'}`; // Key for pending check

        // --- NEW: Check if cell modification is already pending ---
        if (this.isModificationPending(this.activeVehicle.id, cellKey)) {
            this.game.debug.log(`[BuildingManager] Modification for cell ${cellKey} is already pending.`);
            this.uiManager?.showNotification(`Modification pending...`, 'info', 1500);
            return;
        }
        // --- END NEW ---


        switch (this.selectedTool) {
            case 'select':
                // ... existing select logic ...
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
                const isPending = this.isModificationPending(this.activeVehicle.id, cellKey);
                this.uiManager?.showNotification(`Cell (${gridX},${gridY}): Tile=${tileName}, Object=${objectName}${isPending ? ' (Pending)' : ''}`, 'info', 2000);
                break;

            case 'place_tile':
                // ... existing place_tile logic ...
                if (!this.selectedTileType) {
                    this.game.debug.warn(`[BuildingManager] Place tile tool used, but no tile type selected.`);
                    this.uiManager?.showNotification(`Select a tile type to place first!`, 'warn');
                    return;
                }
                if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                    const existingObjId = this.activeVehicle.gridObjects[cellKey];
                    const existingObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === existingObjId);
                    const existingObjName = existingObjConfig?.name || existingObjId;
                    this.uiManager?.showNotification(`Cannot place tile: Cell occupied by ${existingObjName}.`, 'error');
                    return;
                }
                if (this.activeVehicle.gridTiles && this.activeVehicle.gridTiles[cellKey] === this.selectedTileType) {
                    // --- REMOVED: VehicleBuildingManager.handleGridClick skip console log ---
                    return;
                }

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
                        // --- REMOVED: VehicleBuildingManager.handleGridClick missing resources console log ---
                        this.uiManager?.showNotification(`Cannot afford ${tileConfig.name}. Need: ${missingResources.join(', ')}`, 'error');
                        return;
                    }
                }
                if (tileConfig.cost) {
                    for (const [resource, amount] of Object.entries(tileConfig.cost)) {
                        this.game.player.addResource(resource, -amount); // Subtract cost
                    }
                    this.game.player._stateChanged = true; // Mark state change
                    if (this.uiManager.baseBuilding.isVisible && this.uiManager.baseBuilding.toolPanel) {
                        this.uiManager.baseBuilding.toolPanel.update(); // Update tool panel affordability display
                    }
                }
                this.queueNetworkUpdate('gridTiles', cellKey, this.selectedTileType);
                // --- REMOVED: VehicleBuildingManager.handleGridClick queue console log ---
                break;

            case 'place_object':
                // ... existing place_object logic ...
                if (!this.selectedObjectType) {
                    this.game.debug.warn(`[BuildingManager] Place object tool used, but no object type selected.`);
                    this.uiManager?.showNotification(`Select an object type to place first!`, 'warn');
                    return;
                }
                if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                    const existingObjId = this.activeVehicle.gridObjects[cellKey];
                    const existingObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === existingObjId);
                    const existingObjName = existingObjConfig?.name || existingObjId;
                    this.uiManager?.showNotification(`Cannot place object: Cell already occupied by ${existingObjName}.`, 'error');
                    // --- REMOVED: VehicleBuildingManager.handleGridClick occupied console log ---
                    return;
                }
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
                         // --- REMOVED: VehicleBuildingManager.handleGridClick missing resources console log ---
                        this.uiManager?.showNotification(`Cannot afford ${objectConfig.name}. Need: ${missingResources.join(', ')}`, 'error');
                        return;
                    }
                }

                if (objectConfig.cost) {
                    for (const [resource, amount] of Object.entries(objectConfig.cost)) {
                        this.game.player.addResource(resource, -amount); // Subtract cost
                    }
                    this.game.player._stateChanged = true; // Mark state change
                    // --- REMOVED: Direct presence update ---
                    if (this.uiManager.baseBuilding.isVisible) {
                        // --- CHANGED: Update tool panel instead of old button state logic ---
                        this.uiManager.baseBuilding.toolPanel?.update();
                    }
                }
                this.queueNetworkUpdate('gridObjects', cellKey, this.selectedObjectType);
                break;

            case 'remove':
                // ... existing remove logic ...
                let removedItemType = null;
                let refundCost = null;
                let updateType = null; // 'gridObjects' or 'gridTiles'
                let itemKey = null; // Key to add to pending modifications

                if (this.activeVehicle.gridObjects && this.activeVehicle.gridObjects[cellKey]) {
                    removedItemType = this.activeVehicle.gridObjects[cellKey];
                    const removedObjConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === removedItemType);
                    refundCost = removedObjConfig?.cost;
                    updateType = 'gridObjects';
                    itemKey = `${cellKey}:gridObjects`;
                }
                else if (this.activeVehicle.gridTiles && this.activeVehicle.gridTiles[cellKey]) {
                    removedItemType = this.activeVehicle.gridTiles[cellKey];
                    const removedTileConfig = this.game.config.INTERIOR_TILE_TYPES.find(t => t.id === removedItemType);
                    refundCost = removedTileConfig?.cost;
                    updateType = 'gridTiles';
                    itemKey = `${cellKey}:gridTiles`;
                }

                if (updateType) {
                    // --- NEW: Check if removal is pending ---
                     if (this.isModificationPending(this.activeVehicle.id, cellKey, updateType)) {
                        this.game.debug.log(`[BuildingManager] Removal for ${cellKey} (${updateType}) is already pending.`);
                        this.uiManager?.showNotification(`Removal pending...`, 'info', 1500);
                        return;
                     }
                     // --- END NEW ---

                    this.queueNetworkUpdate(updateType, cellKey, null); // Use null to signify removal

                    if (removedItemType && refundCost) {
                        const refundFactor = 0.75;
                        let refundedResources = [];
                        for (const [resource, amount] of Object.entries(refundCost)) {
                            const amountToRefund = Math.floor(amount * refundFactor);
                            if (amountToRefund > 0) {
                                this.game.player.addResource(resource, amountToRefund);
                                refundedResources.push(`${amountToRefund} ${this.getResourceName(resource)}`);
                            }
                        }
                        if (refundedResources.length > 0) {
                            this.game.player._stateChanged = true;
                            this.uiManager?.showNotification(`Refunded: ${refundedResources.join(', ')}`, 'info');
                            if (this.uiManager.baseBuilding.isVisible && this.uiManager.baseBuilding.toolPanel) {
                                this.uiManager.baseBuilding.toolPanel.update();
                            }
                        }
                    }
                     // --- REMOVED: VehicleBuildingManager.handleGridClick remove queue console log ---
                } else {
                    // --- REMOVED: VehicleBuildingManager.handleGridClick remove empty console log ---
                }
                break;

            default:
                this.game.debug.warn(`[BuildingManager] Unknown tool used: ${this.selectedTool}`);
        }
    }

    // ... existing queueNetworkUpdate ...
    queueNetworkUpdate(gridType, cellKey, value) {
        if (!this.activeVehicle || !this.activeVehicle.id) return;

        if (!this.networkUpdateQueue[this.activeVehicle.id]) {
            this.networkUpdateQueue[this.activeVehicle.id] = {};
        }
        if (!this.networkUpdateQueue[this.activeVehicle.id][gridType]) {
            this.networkUpdateQueue[this.activeVehicle.id][gridType] = {};
        }
        this.networkUpdateQueue[this.activeVehicle.id][gridType][cellKey] = value;

        if (this.networkUpdateTimeout) {
            clearTimeout(this.networkUpdateTimeout);
        }
        this.networkUpdateTimeout = setTimeout(() => {
            this.sendNetworkUpdates();
        }, this.networkUpdateDelay);
    }

    sendNetworkUpdates() {
        const updatesToSend = {};
        let hasUpdates = false;
        const sentPendingKeys = new Set(); // Track keys added to pending in this batch

        for (const vehicleId in this.networkUpdateQueue) {
            if (!this.networkUpdateQueue[vehicleId]) continue;
            if (!this.pendingModifications[vehicleId]) {
                 this.pendingModifications[vehicleId] = new Set();
            }

            const vehicleUpdates = {};
            let vehicleHasUpdates = false;

            // Tiles
            const tilesData = this.networkUpdateQueue[vehicleId].gridTiles;
            if (tilesData && Object.keys(tilesData).length > 0) {
                vehicleUpdates.gridTiles = { ...tilesData };
                vehicleHasUpdates = true;
                // --- NEW: Add tile keys to pending list ---
                Object.keys(tilesData).forEach(cellKey => {
                     const pendingKey = `${cellKey}:gridTiles`;
                     this.pendingModifications[vehicleId].add(pendingKey);
                     sentPendingKeys.add(`${vehicleId}:${pendingKey}`);
                });
                 // --- END NEW ---
            }

            // Objects
            const objectsData = this.networkUpdateQueue[vehicleId].gridObjects;
            if (objectsData && Object.keys(objectsData).length > 0) {
                vehicleUpdates.gridObjects = { ...objectsData };
                vehicleHasUpdates = true;
                 // --- NEW: Add object keys to pending list ---
                Object.keys(objectsData).forEach(cellKey => {
                     const pendingKey = `${cellKey}:gridObjects`;
                     this.pendingModifications[vehicleId].add(pendingKey);
                     sentPendingKeys.add(`${vehicleId}:${pendingKey}`);
                });
                // --- END NEW ---
            }

            if (vehicleHasUpdates) {
                updatesToSend[vehicleId] = vehicleUpdates;
                hasUpdates = true;
            }
        }

        this.networkUpdateQueue = {};
        this.networkUpdateTimeout = null;

        if (!hasUpdates) {
            return;
        }

        // --- REMOVED: VehicleBuildingManager.sendNetworkUpdates debug log ---
        this.game.network.updateRoomState({
            vehicles: updatesToSend
        });
        // Trigger immediate UI update to show pending state
        if (this.uiManager?.baseBuilding?.isVisible) {
             this.uiManager.baseBuilding.update();
        }
    }

    // --- NEW: Method to confirm modifications received from network ---
    confirmModifications(vehicleId, confirmedKeys) {
        // confirmedKeys is an array of "cellKey:gridType" strings
        if (!this.pendingModifications[vehicleId] || !confirmedKeys || confirmedKeys.length === 0) {
            return;
        }
        let changesMade = false;
        confirmedKeys.forEach(key => {
            if (this.pendingModifications[vehicleId].delete(key)) {
                 changesMade = true;
            }
        });

        // Clean up vehicle entry if set is empty
        if (this.pendingModifications[vehicleId].size === 0) {
             delete this.pendingModifications[vehicleId];
        }
        // Trigger UI update if changes were made and UI is visible
        if (changesMade && this.uiManager?.baseBuilding?.isVisible && this.activeVehicle?.id === vehicleId) {
             this.uiManager.baseBuilding.update(); // Re-render to remove pending overlay
        }
    }

    // --- NEW: Helper to check pending status ---
    isModificationPending(vehicleId, cellKey, gridType = null) {
         if (!this.pendingModifications[vehicleId]) {
             return false;
         }
         if (gridType) {
             return this.pendingModifications[vehicleId].has(`${cellKey}:${gridType}`);
         } else {
             // Check both types if gridType is not specified
             return this.pendingModifications[vehicleId].has(`${cellKey}:gridTiles`) ||
                    this.pendingModifications[vehicleId].has(`${cellKey}:gridObjects`);
         }
    }
    // --- END NEW ---


    getResourceName(resourceId) {
        const resConfig = this.game.config.RESOURCE_TYPES.find(r => r.id === resourceId);
        return resConfig?.name || resourceId;
    }

    update(deltaTime) {
        // No per-frame logic needed currently
    }
}