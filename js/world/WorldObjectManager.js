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
    }

    /**
     * Registers a generated world object (feature or resource).
     * @param {Object} obj - The object data (must have id, x, y).
     * @param {string} chunkId - The ID of the chunk the object belongs to.
     */
    registerObject(obj, chunkId) {
        if (!obj || !obj.id) return;
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
    }

    /**
     * Checks if a resource object is currently active (not collected).
     * @param {Object} obj - The resource object.
     * @returns {boolean} True if the resource is active, false otherwise.
     */
    isResourceActive(obj) {
        if (obj.type !== 'resource') {
            return true; // Features are always active unless explicitly removed
        }
        // Check the overrides: null means collected/inactive
        return !(this.resourceOverrides[obj.id] === null);
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
        const visible = [];
        // TODO: Optimize this with a spatial grid if performance becomes an issue.
        // For now, iterate through all registered objects.
        for (const id in this.allObjects) {
            const obj = this.allObjects[id];
            if (obj && obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY) {
                if (this.isResourceActive(obj)) {
                    visible.push(obj);
                }
            }
        }
        // Sort by Y for rendering order
        visible.sort((a, b) => a.y - b.y);
        return visible;
    }

    /**
     * Removes all objects associated with a specific chunk ID.
     * Called when a chunk is unloaded to manage memory.
     * @param {string} chunkId - The ID of the chunk to clear objects for.
     */
    removeObjectsForChunk(chunkId) {
        let removedCount = 0;
        for (const objectId in this.objectChunkMap) {
            if (this.objectChunkMap[objectId] === chunkId) {
                delete this.allObjects[objectId];
                delete this.objectChunkMap[objectId];
                // Optional: Remove from spatial grid
                // this.spatialGrid.remove(objectId);
                removedCount++;
            }
        }
        if (removedCount > 0 && this.game?.debug?.isEnabled()) {
            this.game.debug.log(`[WorldObjectManager] Removed ${removedCount} objects for unloaded chunk ${chunkId}`);
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

        // Apply overrides if they exist (e.g., modified amount)
        const overrideData = this.resourceOverrides[resourceId];
        if (overrideData && typeof overrideData === 'object') {
            // Return a copy with overrides applied
            return { ...obj, ...overrideData };
        }

        // Return the original object if no specific overrides (other than null) exist
        return obj;
    }
}