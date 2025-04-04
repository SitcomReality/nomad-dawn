import SeedableRNG from '../utils/SeedableRNG.js';

export default class ChunkManager {
    constructor(world) {
        this.world = world;
        this.chunks = {};
        this.activeChunkIds = new Set();
        this.chunkSize = world.chunkSize;
        this.maxLoadDistance = world.maxLoadDistance;
    }
    
    getChunkId(x, y) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        return `${chunkX},${chunkY}`;
    }
    
    getChunkCoordinates(x, y) {
        const chunkX = Math.floor(x / this.chunkSize) * this.chunkSize;
        const chunkY = Math.floor(y / this.chunkSize) * this.chunkSize;
        return { x: chunkX, y: chunkY };
    }
    
    getChunk(x, y) {
        const chunkId = this.getChunkId(x, y);
        return this.chunks[chunkId];
    }
    
    isChunkActive(chunkId) {
        return this.activeChunkIds.has(chunkId);
    }
    
    getActiveChunks() {
        return Array.from(this.activeChunkIds).map(id => this.chunks[id]).filter(Boolean);
    }
    
    async generateChunk(x, y) {
        const chunkId = this.getChunkId(x, y);

        // Skip if already generated
        if (this.chunks[chunkId]) return this.chunks[chunkId];

        // Calculate chunk center
        const chunkCenterX = Math.floor(x / this.chunkSize) * this.chunkSize + this.chunkSize / 2;
        const chunkCenterY = Math.floor(y / this.chunkSize) * this.chunkSize + this.chunkSize / 2;
        
        // Generate terrain height/moisture at chunk center for biome determination
        const height = this.world.getNoise(chunkCenterX * this.world.terrainScale, chunkCenterY * this.world.terrainScale, 0);
        const moisture = this.world.getNoise(chunkCenterX * this.world.terrainScale, chunkCenterY * this.world.terrainScale, 1000);

        // Determine biome based on height and moisture
        const biome = this.world.getBiome(height, moisture);

        // Create chunk object
        const chunk = {
            id: chunkId,
            x: chunkCenterX,
            y: chunkCenterY,
            size: this.chunkSize,
            biome: biome,
            features: [],
            resources: []
        };

        // Generate chunk features based on biome (passing world seed)
        this.world.featureGenerator.generateFeaturesForChunk(chunk, this.world.seed);

        // Generate chunk resources based on biome (passing world seed)
        this.world.resourceGenerator.generateResourcesForChunk(chunk, this.world.seed);

        // Store chunk in world
        this.chunks[chunkId] = chunk;

        return chunk;
    }
    
    async loadChunksAroundPosition(x, y) {
        const loadDistance = this.maxLoadDistance;
        const loadChunkRadius = Math.ceil(loadDistance / this.chunkSize);
        
        // Calculate which chunk the position is in
        const centerChunkX = Math.floor(x / this.chunkSize);
        const centerChunkY = Math.floor(y / this.chunkSize);
        
        // Create set of chunk IDs that should be active
        const shouldBeActive = new Set();
        const chunksToGenerate = [];
        
        // Generate or load chunks around position
        for (let cx = centerChunkX - loadChunkRadius; cx <= centerChunkX + loadChunkRadius; cx++) {
            for (let cy = centerChunkY - loadChunkRadius; cy <= centerChunkY + loadChunkRadius; cy++) {
                const chunkX = cx * this.chunkSize;
                const chunkY = cy * this.chunkSize;
                const chunkId = this.getChunkId(chunkX, chunkY);
                
                // Check if chunk is within load distance
                const chunkCenterX = chunkX + this.chunkSize / 2;
                const chunkCenterY = chunkY + this.chunkSize / 2;
                const dx = chunkCenterX - x;
                const dy = chunkCenterY - y;
                const distanceSquared = dx * dx + dy * dy;
                
                if (distanceSquared <= loadDistance * loadDistance) {
                    shouldBeActive.add(chunkId);
                    
                    // Generate chunk if it doesn't exist
                    if (!this.chunks[chunkId]) {
                        chunksToGenerate.push([chunkX, chunkY]);
                    }
                }
            }
        }
        
        // Generate all needed chunks
        await Promise.all(chunksToGenerate.map(coords => this.generateChunk(coords[0], coords[1])));
        
        // Determine which chunks to load and unload
        const toLoad = new Set();
        const toUnload = new Set();
        
        // Find chunks to load (in shouldBeActive but not in activeChunkIds)
        for (const chunkId of shouldBeActive) {
            if (!this.activeChunkIds.has(chunkId)) {
                toLoad.add(chunkId);
            }
        }
        
        // Find chunks to unload (in activeChunkIds but not in shouldBeActive)
        for (const chunkId of this.activeChunkIds) {
            if (!shouldBeActive.has(chunkId)) {
                toUnload.add(chunkId);
            }
        }
        
        // Perform load and unload operations
        for (const chunkId of toLoad) {
            this.activeChunkIds.add(chunkId);
        }
        
        for (const chunkId of toUnload) {
            this.activeChunkIds.delete(chunkId);
        }
        
        return {
            loaded: toLoad.size,
            unloaded: toUnload.size,
            active: this.activeChunkIds.size
        };
    }
    
    getVisibleChunks(cameraX, cameraY, viewWidth, viewHeight) {
        const result = [];
        
        // Calculate view bounds
        const halfWidth = viewWidth / 2;
        const halfHeight = viewHeight / 2;
        const left = cameraX - halfWidth;
        const right = cameraX + halfWidth;
        const top = cameraY - halfHeight;
        const bottom = cameraY + halfHeight;
        
        // Calculate chunk bounds
        const minChunkX = Math.floor(left / this.chunkSize);
        const maxChunkX = Math.ceil(right / this.chunkSize);
        const minChunkY = Math.floor(top / this.chunkSize);
        const maxChunkY = Math.ceil(bottom / this.chunkSize);
        
        // Collect visible chunks
        for (let cx = minChunkX; cx < maxChunkX; cx++) {
            for (let cy = minChunkY; cy < maxChunkY; cy++) {
                const chunkX = cx * this.chunkSize;
                const chunkY = cy * this.chunkSize;
                const chunkId = this.getChunkId(chunkX, chunkY);
                
                // Generate chunk if needed and visible
                if (!this.chunks[chunkId]) {
                    this.generateChunk(chunkX, chunkY);
                }
                
                if (this.chunks[chunkId]) {
                    result.push(this.chunks[chunkId]);
                }
            }
        }
        
        return result;
    }
    
    getChunksInRadius(x, y, radius) {
        const result = [];
        const radiusInChunks = Math.ceil(radius / this.chunkSize);
        
        // Calculate which chunk contains the center point
        const centerChunkX = Math.floor(x / this.chunkSize);
        const centerChunkY = Math.floor(y / this.chunkSize);
        
        // Collect chunks in radius
        for (let cx = centerChunkX - radiusInChunks; cx <= centerChunkX + radiusInChunks; cx++) {
            for (let cy = centerChunkY - radiusInChunks; cy <= centerChunkY + radiusInChunks; cy++) {
                const chunkX = cx * this.chunkSize;
                const chunkY = cy * this.chunkSize;
                const chunkId = this.getChunkId(chunkX, chunkY);
                
                // Calculate distance from center to chunk center
                const chunkCenterX = chunkX + this.chunkSize / 2;
                const chunkCenterY = chunkY + this.chunkSize / 2;
                const dx = chunkCenterX - x;
                const dy = chunkCenterY - y;
                const distanceSquared = dx * dx + dy * dy;
                
                // Add if within radius
                if (distanceSquared <= radius * radius) {
                    if (this.chunks[chunkId]) {
                        result.push(this.chunks[chunkId]);
                    }
                }
            }
        }
        
        return result;
    }
}