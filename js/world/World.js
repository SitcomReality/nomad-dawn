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
        this.noise = options.noise || {
            simplex2: (x, y) => {
                // Simple fallback if noise library not available
                const value = Math.sin(x * 0.1) * Math.cos(y * 0.1);
                return value * 0.5;
            }
        };

        // Debug flag
        this.debug = options.debug || false;

        // Initialize managers
        this.chunkManager = new ChunkManager(this);
        this.resourceGenerator = new ResourceGenerator(this);
        this.featureGenerator = new FeatureGenerator(this);

        // Resource deposits - maintained for network sync
        this.resources = {}; 
        this.resourceOverrides = {}; 

    }

    async initialize() {
        // Generate initial world state (spawn area)
        await this.generateSpawnArea();

        return true;
    }

    async generateSpawnArea() {
        // Generate chunks around (0,0) for initial spawn area
        const spawnRadius = 1000;

        // Use chunk manager to load chunks around spawn point
        await this.chunkManager.loadChunksAroundPosition(0, 0);

        return true;
    }

    getNoise(x, y, seed = 0) {
        // Use noise function to generate terrain values
        return this.noise.simplex2(x + seed, y + seed) * 0.5 + 0.5;
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
        if (roomState.resources !== undefined) { 
             // Update the overrides based on the network state.
             // Null values indicate collected resources.
             this.resourceOverrides = roomState.resources || {};
             this.game?.debug?.log(`[World] Synced resource overrides. Count: ${Object.keys(this.resourceOverrides).length}`);
        }

        if (roomState.worldObjects) {
            this.updateWorldObjectsFromNetwork(roomState.worldObjects);
        }

        // Sync time of day
        if (roomState.timeOfDay !== undefined && typeof this.game?.setTimeOfDay === 'function') { 
            this.game.setTimeOfDay(roomState.timeOfDay);
        }
    }

    /**
     * Checks if a resource is marked as collected (null) in the overrides.
     * @param {string} resourceId
     * @returns {boolean} True if the resource is collected, false otherwise.
     */
    isResourceCollected(resourceId) {
        // A resource is considered collected if its entry in overrides is exactly null.
        // If the ID doesn't exist in overrides, it's not collected (or hasn't been interacted with).
        return this.resourceOverrides.hasOwnProperty(resourceId) && this.resourceOverrides[resourceId] === null;
    }

    findResourceById(resourceId) {
        // Iterate through all *loaded* chunks to find the resource by ID
        for (const chunkId in this.chunkManager.chunks) {
            // Only check active/loaded chunks
            if (!this.chunkManager.isChunkActive(chunkId)) continue;

            const chunk = this.chunkManager.chunks[chunkId];
            if (chunk && chunk.resources) {
                const found = chunk.resources.find(r => r.id === resourceId);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    addResourceToChunk(resource) {
        const chunkCoordinates = this.chunkManager.getChunkCoordinates(resource.x, resource.y);
        const chunkId = this.chunkManager.getChunkId(resource.x, resource.y);

        // Ensure the target chunk exists before adding
        if (!this.chunkManager.chunks[chunkId]) {
            // Generate the chunk if it doesn't exist when a resource needs to be added
            console.warn(`Target chunk ${chunkId} for resource ${resource.id} not generated yet.`);
            this.chunkManager.generateChunk(chunkCoordinates.x, chunkCoordinates.y).then(chunk => {
                if (chunk && chunk.resources && !chunk.resources.some(r => r.id === resource.id)) {
                    chunk.resources.push(resource);
                }
            }).catch(err => {
                console.error(`Error generating chunk ${chunkId} for resource ${resource.id}:`, err);
            });
            return;
        }

        const chunk = this.chunkManager.chunks[chunkId];
        if (chunk && chunk.resources && !chunk.resources.some(r => r.id === resource.id)) {
            chunk.resources.push(resource);
        } else if (chunk && chunk.resources && chunk.resources.some(r => r.id === resource.id)) {
            // Already exists, nothing to do
        } else if (!chunk) {
            console.warn(`Attempted to add resource ${resource.id} to non-existent chunk ${chunkId} after check.`);
        }
    }

    updateResourceChunkLocation(resource) {
        const currentChunkId = this.chunkManager.getChunkId(resource.x, resource.y);
        let foundInCorrectChunk = false;

        // Check if it's in the correct chunk's list
        if (this.chunkManager.chunks[currentChunkId] && this.chunkManager.chunks[currentChunkId].resources) {
            if (this.chunkManager.chunks[currentChunkId].resources.some(r => r.id === resource.id)) {
                foundInCorrectChunk = true;
            }
        }

        // If not in the correct chunk, remove from any incorrect chunk and add to the correct one
        if (!foundInCorrectChunk) {
            // Remove from any chunk it might be incorrectly listed in
            for (const chunkId in this.chunkManager.chunks) {
                if (this.chunkManager.chunks[chunkId].resources) {
                    const initialLength = this.chunkManager.chunks[chunkId].resources.length;
                    this.chunkManager.chunks[chunkId].resources = this.chunkManager.chunks[chunkId].resources.filter(r => r.id !== resource.id);
                }
            }
            // Add to the correct chunk
            this.addResourceToChunk(resource);
        }
    }

    updateWorldObjectsFromNetwork(worldObjects) {
        // Update world objects like buildings, etc.
        for (const [id, data] of Object.entries(worldObjects)) {
            // Handle object updates similar to resources
        }
    }
}