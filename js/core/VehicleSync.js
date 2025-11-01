/**
 * Synchronize vehicles from the network room state into the local game entities.
 * This function is designed to be robust against malformed input and will create,
 * update, or remove local Vehicle entities as needed to match the authoritative network state.
 *
 * @param {NetworkManager} networkManager - The network manager (provides .game reference).
 * @param {Object} networkVehicles - Object mapping vehicleId -> vehicleState (or null to remove).
 */
export function syncVehiclesFromNetwork(networkManager, networkVehicles) {
    const game = networkManager.game;
    const Vehicle = window.Vehicle;
    if (!Vehicle) {
        game.debug.error("[SyncVehicles] Vehicle class not found!");
        return;
    }

    if (!networkVehicles || typeof networkVehicles !== 'object') {
        game.debug.warn("[SyncVehicles] Received invalid networkVehicles data (not an object):", networkVehicles);
        return;
    }

    const presentVehicleIds = new Set(Object.keys(networkVehicles));
    const confirmedModifications = {};

    for (const vehicleId in networkVehicles) {
        const data = networkVehicles[vehicleId];
        let vehicle = game.entities.get(vehicleId);
        confirmedModifications[vehicleId] = [];

        // Deletion case
        if (data === null) {
            if (vehicle) {
                game.debug.log(`[SyncVehicles] Removing vehicle ${vehicleId} due to null in network state.`);
                game.entities.remove(vehicleId);
            }
            continue;
        }

        // Validate minimal structure
        if (!data || typeof data !== 'object' || !data.vehicleType || typeof data.x !== 'number' || typeof data.y !== 'number') {
            game.debug.warn(`[SyncVehicles] Incomplete vehicle data for ${vehicleId}, skipping.`, data);
            presentVehicleIds.delete(vehicleId);
            continue;
        }

        // Creation
        if (!vehicle) {
            const vehicleConfig = game.config.VEHICLE_TYPES.find(v => v.id === data.vehicleType);
            if (!vehicleConfig) {
                game.debug.warn(`[SyncVehicles] Unknown vehicle type: ${data.vehicleType} for ${vehicleId}`);
                continue;
            }
            try {
                vehicle = new Vehicle(vehicleId, vehicleConfig, data.owner ?? null);
            } catch (e) {
                game.debug.error(`[SyncVehicles] Error creating Vehicle ${vehicleId}:`, e);
                continue;
            }

            // Apply network-provided state with safe fallbacks
            vehicle.x = data.x;
            vehicle.y = data.y;
            vehicle.angle = typeof data.angle === 'number' ? data.angle : vehicle.angle;
            vehicle.health = typeof data.health === 'number' ? data.health : vehicle.health;
            vehicle.maxHealth = typeof data.maxHealth === 'number' ? data.maxHealth : vehicle.maxHealth;
            vehicle.driver = data.driver ?? null;
            vehicle.passengers = Array.isArray(data.passengers) ? data.passengers.slice() : [];

            vehicle.modules = Array.isArray(data.modules) ? data.modules.slice() : [];
            vehicle.gridWidth = typeof data.gridWidth === 'number' ? data.gridWidth : vehicle.gridWidth;
            vehicle.gridHeight = typeof data.gridHeight === 'number' ? data.gridHeight : vehicle.gridHeight;

            const newTiles = (data.gridTiles && typeof data.gridTiles === 'object') ? data.gridTiles : {};
            const newObjects = (data.gridObjects && typeof data.gridObjects === 'object') ? data.gridObjects : {};

            // Record keys as confirmed modifications for UI feedback
            Object.keys(newTiles).forEach(key => confirmedModifications[vehicleId].push(`${key}:gridTiles`));
            Object.keys(newObjects).forEach(key => confirmedModifications[vehicleId].push(`${key}:gridObjects`));

            vehicle.gridTiles = { ...newTiles };
            vehicle.gridObjects = { ...newObjects };

            vehicle.doorLocation = data.doorLocation ?? vehicle.doorLocation;
            vehicle.pilotSeatLocation = data.pilotSeatLocation ?? vehicle.pilotSeatLocation;

            if (typeof vehicle.recalculateStatsFromModules === 'function') {
                vehicle.recalculateStatsFromModules();
            }

            game.entities.add(vehicle);
        } else {
            // Update existing vehicle: apply diffs carefully to minimize churn
            const modulesChanged = JSON.stringify(vehicle.modules) !== JSON.stringify(data.modules ?? []);

            vehicle.x = typeof data.x === 'number' ? data.x : vehicle.x;
            vehicle.y = typeof data.y === 'number' ? data.y : vehicle.y;
            vehicle.angle = typeof data.angle === 'number' ? data.angle : vehicle.angle;
            vehicle.health = typeof data.health === 'number' ? data.health : vehicle.health;
            vehicle.maxHealth = typeof data.maxHealth === 'number' ? data.maxHealth : vehicle.maxHealth;
            vehicle.driver = data.driver ?? vehicle.driver;
            vehicle.passengers = Array.isArray(data.passengers) ? data.passengers.slice() : vehicle.passengers;
            vehicle.modules = Array.isArray(data.modules) ? data.modules.slice() : vehicle.modules;

            vehicle.gridWidth = typeof data.gridWidth === 'number' ? data.gridWidth : vehicle.gridWidth;
            vehicle.gridHeight = typeof data.gridHeight === 'number' ? data.gridHeight : vehicle.gridHeight;

            // Merge gridTiles: detect changes and record confirmed modifications
            const newTiles = (data.gridTiles && typeof data.gridTiles === 'object') ? data.gridTiles : {};
            const currentTiles = vehicle.gridTiles || {};
            Object.keys(newTiles).forEach(key => {
                if (currentTiles[key] !== newTiles[key]) {
                    currentTiles[key] = newTiles[key];
                    confirmedModifications[vehicleId].push(`${key}:gridTiles`);
                }
            });
            Object.keys(currentTiles).forEach(key => {
                if (!(key in newTiles)) {
                    delete currentTiles[key];
                    confirmedModifications[vehicleId].push(`${key}:gridTiles`);
                }
            });
            vehicle.gridTiles = currentTiles;

            // Merge gridObjects similarly
            const newObjects = (data.gridObjects && typeof data.gridObjects === 'object') ? data.gridObjects : {};
            const currentObjects = vehicle.gridObjects || {};
            Object.keys(newObjects).forEach(key => {
                if (currentObjects[key] !== newObjects[key]) {
                    currentObjects[key] = newObjects[key];
                    confirmedModifications[vehicleId].push(`${key}:gridObjects`);
                }
            });
            Object.keys(currentObjects).forEach(key => {
                if (!(key in newObjects)) {
                    delete currentObjects[key];
                    confirmedModifications[vehicleId].push(`${key}:gridObjects`);
                }
            });
            vehicle.gridObjects = currentObjects;

            vehicle.doorLocation = data.doorLocation ?? vehicle.doorLocation;
            vehicle.pilotSeatLocation = data.pilotSeatLocation ?? vehicle.pilotSeatLocation;

            // Recalculate stats if modules changed or maxHealth mismatch
            const vehicleConfig = game.config.VEHICLE_TYPES.find(v => v.id === data.vehicleType);
            const expectedMaxHealth = data.maxHealth ?? vehicleConfig?.health ?? vehicle.maxHealth;
            if (modulesChanged || vehicle.maxHealth !== expectedMaxHealth) {
                if (typeof vehicle.recalculateStatsFromModules === 'function') {
                    vehicle.recalculateStatsFromModules();
                } else {
                    game.debug.warn(`[SyncVehicles] Vehicle ${vehicleId} missing recalculateStatsFromModules.`);
                }
            }

            vehicle.health = Math.min(vehicle.health, vehicle.maxHealth);
        }
    }

    // Remove local vehicles not present in the authoritative network state
    const currentVehicles = game.entities.getByType('vehicle');
    for (const localVehicle of currentVehicles) {
        if (!localVehicle || !localVehicle.id) continue;
        if (!presentVehicleIds.has(localVehicle.id)) {
            game.debug.log(`[SyncVehicles] Removing local vehicle ${localVehicle.id} (no longer in network state)`);
            game.entities.remove(localVehicle.id);
        }
    }

    // Inform UI building manager about confirmed modifications for clearing pending overlays
    if (game.ui?.baseBuilding?.buildingManager?.confirmModifications) {
        for (const vehicleId in confirmedModifications) {
            if (confirmedModifications[vehicleId].length > 0) {
                try {
                    game.ui.baseBuilding.buildingManager.confirmModifications(vehicleId, confirmedModifications[vehicleId]);
                } catch (e) {
                    game.debug.error(`[SyncVehicles] Error confirming modifications for ${vehicleId}:`, e);
                }
            }
        }
    }
}