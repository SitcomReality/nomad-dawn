// New file: js/world/WorldObjectManager.js
/**
 * Manages the state and visibility of world objects (features, resources)
 * based on generation and network overrides.
 */
export default class WorldObjectManager {
    constructor(game) {
        this.game = game;
        // Stores all generated objects, keyed by object ID
        this.allObjects = {};
        // Stores which chunk each object belongs to, keyed by object ID
        this.objectChunkMap = {};
        // Stores the current resource overrides from the network
        this.resourceOverrides = {};
        // Spatial grid for faster querying (optional optimization)
        // this.spatialGrid = new SpatialGrid(gridCellSize);

        // --- Performance Tracking ---
        this.lastVisibleCheckTime = 0;
        this.lastVisibleCheckCount = 0;
        this.lastVisibleReturnCount = 0;
    }

    /**
     * Registers a generated world object (feature or resource).
     * @param {Object} obj - The object data (must have id, x, y).
     * @param {string} chunkId - The ID of the chunk the object belongs to.
     */
    registerObject(obj, chunkId) {
        if (!obj || !obj.id) return;
        if (this.allObjects[obj.id]) {
             if (this.game?.debug?.isEnabled()) {
                 // This can happen legitimately if chunks reload, make it debug level
                 this.game.debug.log(`[WorldObjectManager] Object ${obj.id} already registered. Overwriting.`);
             }
        }
        this.allObjects[obj.id] = obj;
        this.objectChunkMap[obj.id] = chunkId;
        // Optional: Add to spatial grid
        // this.spatialGrid.add(obj);
    }

    /**
     * Updates the internal state of resource overrides.
     * @param {Object} overrides - The resource override data from roomState.resources.
     */
    updateResourceOverrides(overrides) {
        this.resourceOverrides = overrides || {};
        // TODO: Potential optimization: Check if overrides actually changed before assigning.
    }

    /**
     * Checks if a resource object is currently active (not collected).
     * @param {Object} obj - The resource object.
     * @returns {boolean} True if the resource is active, false otherwise.
     */
    isResourceActive(obj) {
        if (!obj || obj.type !== 'resource' || !obj.id) {
            return true; // Non-resources or invalid objects are considered "active" (i.e., not filterable this way)
        }
        // Check the overrides: null means collected/inactive
        // A resource is inactive *only* if its ID exists as a key in overrides and the value is null.
        return !(this.resourceOverrides.hasOwnProperty(obj.id) && this.resourceOverrides[obj.id] === null);
    }

    /**
     * Retrieves all visible and active world objects within the given bounds.
     * @param {number} minX - Left boundary.
     * @param {number} minY - Top boundary.
     * @param {number} maxX - Right boundary.
     * @param {number} maxY - Bottom boundary.
     * @returns {Array<Object>} An array of visible and active world objects.
     */
    getVisibleObjects(minX, minY, maxX, maxY) {
        const startTime = performance.now();
        const visible = [];
        let checkCount = 0;

        // TODO: Optimize this with a spatial grid if performance becomes an issue.
        // For now, iterate through all registered objects. This is a likely bottleneck.
        for (const id in this.allObjects) {
            checkCount++;
            const obj = this.allObjects[id];
            // Basic boundary check first
            if (obj && obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY) {
                // Check if the object is active (resources might be collected)
                if (this.isResourceActive(obj)) {
                    visible.push(obj);
                }
            }
        }

        // Sort by Y for rendering order (can be expensive)
        visible.sort((a, b) => a.y - b.y);

        const endTime = performance.now();
        this.lastVisibleCheckTime = endTime - startTime;
        this.lastVisibleCheckCount = checkCount;
        this.lastVisibleReturnCount = visible.length;

        // Log performance if debug enabled and it took significant time
        if (this.game?.debug?.isEnabled() && this.lastVisibleCheckTime > 5) {
            this.game.debug.log(`[WorldObjectManager] getVisibleObjects took ${this.lastVisibleCheckTime.toFixed(2)}ms. Checked: ${checkCount}, Returned: ${visible.length}. Total Objects: ${Object.keys(this.allObjects).length}`);
        }

        return visible;
    }

    /**
     * Removes all objects associated with a specific chunk ID.
     * Called when a chunk is unloaded to manage memory.
     * @param {string} chunkId - The ID of the chunk to clear objects for.
     */
    removeObjectsForChunk(chunkId) {
        let removedCount = 0;
        const objectsToRemove = [];
        // First, identify objects to remove without modifying the iterated object
        for (const objectId in this.objectChunkMap) {
            if (this.objectChunkMap[objectId] === chunkId) {
                 objectsToRemove.push(objectId);
            }
        }

        // Then, remove them
        for (const objectId of objectsToRemove) {
             delete this.allObjects[objectId];
             delete this.objectChunkMap[objectId];
             // Optional: Remove from spatial grid
             // this.spatialGrid.remove(objectId);
             removedCount++;
        }

        if (removedCount > 0 && this.game?.debug?.isEnabled()) {
            this.game.debug.log(`[WorldObjectManager] Removed ${removedCount} objects for unloaded chunk ${chunkId}. Total objects now: ${Object.keys(this.allObjects).length}`);
        }
    }

    /**
     * Finds a resource object by its ID, considering overrides.
     * @param {string} resourceId - The ID of the resource.
     * @returns {Object|null} The resource object or null if not found or inactive.
     */
    findResourceById(resourceId) {
        const obj = this.allObjects[resourceId];
        if (!obj || obj.type !== 'resource') {
            return null; // Not found or not a resource
        }

        if (!this.isResourceActive(obj)) {
            return null; // Found but inactive/collected
        }

        // Apply overrides if they exist (e.g., modified amount) - Currently not used, but placeholder
        const overrideData = this.resourceOverrides[resourceId];
        if (overrideData && typeof overrideData === 'object') {
            // Return a copy with overrides applied
            return { ...obj, ...overrideData };
        }

        // Return the original object if no specific overrides (other than null) exist
        return obj;
    }

    // Helper to get current stats for debug overlay
    getPerformanceStats() {
        return {
             totalObjects: Object.keys(this.allObjects).length,
             lastCheckMs: this.lastVisibleCheckTime.toFixed(2),
             lastCheckCount: this.lastVisibleCheckCount,
             lastReturnCount: this.lastVisibleReturnCount
        };
    }
}