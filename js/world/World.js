import ChunkManager from './ChunkManager.js';
import ResourceGenerator from './ResourceGenerator.js';
import FeatureGenerator from './FeatureGenerator.js';
import { BiomeTypes } from './Biome.js';

export default class World {
    constructor(options) {
        this.seed = options.seed ?? Math.floor(Math.random() * 999999);
        this.size = options.size || 10000;
        this.chunkSize = options.chunkSize || 500;

        // World generation parameters
        this.terrainScale = options.terrainScale || 0.005;
        this.resourceDensity = options.resourceDensity || 0.01;
        this.maxLoadDistance = options.maxLoadDistance || 2000;

        // Setup noise generator (passed from Game)
        this.noiseFunction = options.noiseFunction || ((x, y) => {
            // Simple fallback if noise library not available
            console.warn("Noise function not provided to World, using fallback.");
            const value = Math.sin(x * 0.1) * Math.cos(y * 0.1);
            return value * 0.5;
        });

        // Debug flag
        this.debug = options.debug || false;

        // --- NEW: WorldObjectManager reference ---
        this.worldObjectManager = options.worldObjectManager;
        if (!this.worldObjectManager) {
             console.error("WorldObjectManager not provided to World constructor!");
             // Optionally create a fallback, though Game should provide it
             // this.worldObjectManager = new WorldObjectManager(window.game);
        }
        // --- END NEW ---

        // Initialize managers
        this.chunkManager = new ChunkManager(this);
        this.resourceGenerator = new ResourceGenerator(this);
        this.featureGenerator = new FeatureGenerator(this);
    }

    async initialize() {
        // Generate initial world state (spawn area)
        await this.generateSpawnArea();
        return true;
    }

    async generateSpawnArea() {
        // Generate chunks around (0,0) for initial spawn area
        // Use chunk manager to load chunks around spawn point
        await this.chunkManager.loadChunksAroundPosition(0, 0);
        return true;
    }

    getNoise(x, y, seedOffset = 0) {
        // Use the injected noise function. Add seedOffset for variety if needed.
        // noisejs simplex2 returns values between -1 and 1. Normalize to 0-1.
        const noiseVal = this.noiseFunction(x + seedOffset, y + seedOffset);
        return (noiseVal + 1) / 2;
    }

    getBiome(height, moisture) {
        // Determine biome based on height and moisture
        if (height < 0.3) {
            return BiomeTypes.WASTELAND;
        } else if (height < 0.6) {
            if (moisture < 0.4) {
                return BiomeTypes.DESERT;
            } else {
                return BiomeTypes.GRASSLAND;
            }
        } else {
            if (moisture < 0.5) {
                return BiomeTypes.HILLS;
            } else {
                return BiomeTypes.FOREST;
            }
        }
    }

    update(deltaTime, playerX, playerY) {
        // Load and unload chunks based on player position
        this.chunkManager.loadChunksAroundPosition(playerX, playerY);
    }

    getVisibleChunks(cameraX, cameraY, viewWidth, viewHeight) {
        return this.chunkManager.getVisibleChunks(cameraX, cameraY, viewWidth, viewHeight);
    }

    getChunksInRadius(x, y, radius) {
        return this.chunkManager.getChunksInRadius(x, y, radius);
    }

    getRandomSpawnPoint() {
        // Find a safe place to spawn a player
        // For simplicity, just use the center for now
        return { x: 0, y: 0 };
    }

    syncFromNetworkState(roomState) {
        // Update world state from network
        if (roomState.resources !== undefined) { // Check specifically for resources key
             // --- NEW: Update WorldObjectManager with overrides ---
             if (this.worldObjectManager) {
                 this.worldObjectManager.updateResourceOverrides(roomState.resources);
             }
             // --- END NEW ---
        }

        if (roomState.worldObjects) {
            this.updateWorldObjectsFromNetwork(roomState.worldObjects);
        }

        // Sync time of day
        if (roomState.timeOfDay !== undefined && typeof window.game?.setTimeOfDay === 'function') {
            window.game.setTimeOfDay(roomState.timeOfDay);
        }
    }

    /**
     * Checks if a resource is considered active using the WorldObjectManager.
     * @param {string} resourceId - The ID of the resource to check.
     * @returns {boolean} True if the resource is active, false otherwise.
     */
    isResourceActive(resourceId) {
        // --- NEW: Delegate to WorldObjectManager ---
         if (!this.worldObjectManager) return false; // Cannot determine if manager missing
         const resource = this.worldObjectManager.findResourceById(resourceId);
         return !!resource; // Active if the manager returns an object for it
        // --- END NEW ---
    }

    /**
     * Finds a resource by ID using the WorldObjectManager.
     * @param {string} resourceId - The ID of the resource to find.
     * @returns {Object|null} The resource object or null if not found/inactive.
     */
    findResourceById(resourceId) {
         // --- NEW: Delegate to WorldObjectManager ---
         if (!this.worldObjectManager) return null;
         return this.worldObjectManager.findResourceById(resourceId);
         // --- END NEW ---
    }

    updateWorldObjectsFromNetwork(worldObjects) {
        // Update world objects like buildings, etc.
        // Currently unused, but kept for potential future features
        for (const [id, data] of Object.entries(worldObjects)) {
            // Handle object updates similar to resources
        }
    }
}