export default class World {
    constructor(options) {
        this.seed = options.seed || Math.floor(Math.random() * 999999);
        this.size = options.size || 10000;
        this.chunkSize = options.chunkSize || 500;
        
        // Active chunks storage
        this.chunks = {};
        this.activeChunkIds = new Set();
        
        // Resource deposits
        this.resources = {};
        
        // World generation parameters
        this.terrainScale = options.terrainScale || 0.005;
        this.resourceDensity = options.resourceDensity || 0.01;
        this.maxLoadDistance = options.maxLoadDistance || 2000;
        
        // Debug flag
        this.debug = options.debug || false;
        
        // Setup noise generator (implemented in perlin import)
        this.noise = options.noise || {
            simplex2: (x, y) => {
                // Simple fallback if noise library not available
                const value = Math.sin(x * 0.1) * Math.cos(y * 0.1);
                return value * 0.5;
            }
        };
    }
    
    async initialize() {
        // Initialize world generation
        this.rng = this.createRNG(this.seed);
        
        // Generate initial world state (spawn area)
        await this.generateSpawnArea();
        
        return true;
    }
    
    createRNG(seed) {
        // Simple deterministic RNG
        let s = seed;
        return function() {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }
    
    async generateSpawnArea() {
        // Generate chunks around (0,0) for initial spawn area
        const spawnRadius = 1000;
        const spawnChunkRadius = Math.ceil(spawnRadius / this.chunkSize);
        
        const generatePromises = [];
        
        for (let cx = -spawnChunkRadius; cx <= spawnChunkRadius; cx++) {
            for (let cy = -spawnChunkRadius; cy <= spawnChunkRadius; cy++) {
                const chunkX = cx * this.chunkSize;
                const chunkY = cy * this.chunkSize;
                const chunkId = this.getChunkId(chunkX, chunkY);
                
                // Skip if already generated
                if (this.chunks[chunkId]) continue;
                
                generatePromises.push(this.generateChunk(chunkX, chunkY));
            }
        }
        
        await Promise.all(generatePromises);
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
    
    async generateChunk(x, y) {
        const chunkId = this.getChunkId(x, y);
        
        // Skip if already generated
        if (this.chunks[chunkId]) return this.chunks[chunkId];
        
        // Calculate chunk center
        const chunkCenterX = Math.floor(x / this.chunkSize) * this.chunkSize + this.chunkSize / 2;
        const chunkCenterY = Math.floor(y / this.chunkSize) * this.chunkSize + this.chunkSize / 2;
        
        // Generate terrain height/moisture at chunk center for biome determination
        const height = this.getNoise(chunkCenterX * this.terrainScale, chunkCenterY * this.terrainScale, 0);
        const moisture = this.getNoise(chunkCenterX * this.terrainScale, chunkCenterY * this.terrainScale, 1000);
        
        // Determine biome based on height and moisture
        const biome = this.getBiome(height, moisture);
        
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
        
        // Generate chunk features based on biome
        this.generateChunkFeatures(chunk);
        
        // Store chunk in world
        this.chunks[chunkId] = chunk;
        
        return chunk;
    }
    
    generateChunkFeatures(chunk) {
        // Determine feature count based on biome
        const baseFeatureCount = 5;
        const featureDensity = chunk.biome.featureDensity || 1;
        const featureCount = Math.floor(baseFeatureCount * featureDensity * (0.5 + this.rng()));
        
        // Generate features
        for (let i = 0; i < featureCount; i++) {
            // Random position within chunk
            const offsetX = (this.rng() - 0.5) * chunk.size;
            const offsetY = (this.rng() - 0.5) * chunk.size;
            const featureX = chunk.x + offsetX;
            const featureY = chunk.y + offsetY;
            
            // Determine feature type based on biome
            const featureType = this.getFeatureType(chunk.biome);
            
            // Create feature
            const feature = {
                id: `feature-${chunk.id}-${i}`,
                type: featureType,
                x: featureX,
                y: featureY,
                size: 10 + this.rng() * 20,
                health: 100,
                collides: true
            };
            
            // Add to chunk features
            chunk.features.push(feature);
        }
        
        // Generate resources
        const resourceCount = Math.floor(this.resourceDensity * chunk.size * (0.5 + this.rng()));
        
        for (let i = 0; i < resourceCount; i++) {
            // Random position within chunk
            const offsetX = (this.rng() - 0.5) * chunk.size;
            const offsetY = (this.rng() - 0.5) * chunk.size;
            const resourceX = chunk.x + offsetX;
            const resourceY = chunk.y + offsetY;
            
            // Determine resource type based on biome
            const resourceType = this.getResourceType(chunk.biome);
            
            // Create resource node
            const resource = {
                id: `resource-${chunk.id}-${i}`,
                type: 'resource',
                resourceType: resourceType,
                x: resourceX,
                y: resourceY,
                size: 15 + this.rng() * 10,
                amount: 50 + Math.floor(this.rng() * 50),
                color: this.getResourceColor(resourceType),
                collides: true
            };
            
            // Add to chunk resources
            chunk.resources.push(resource);
        }
    }
    
    getNoise(x, y, seed = 0) {
        // Use noise function to generate terrain values
        return this.noise.simplex2(x + seed, y + seed) * 0.5 + 0.5;
    }
    
    getBiome(height, moisture) {
        // Determine biome based on height and moisture
        if (height < 0.3) {
            return {
                name: 'Wasteland',
                color: '#a89078',
                featureDensity: 0.5,
                resources: ['metal', 'energy']
            };
        } else if (height < 0.6) {
            if (moisture < 0.4) {
                return {
                    name: 'Desert',
                    color: '#d6c88e',
                    featureDensity: 0.3,
                    resources: ['energy']
                };
            } else {
                return {
                    name: 'Grassland',
                    color: '#7d9951',
                    featureDensity: 1.2,
                    resources: ['food', 'metal']
                };
            }
        } else {
            if (moisture < 0.5) {
                return {
                    name: 'Hills',
                    color: '#8cad81',
                    featureDensity: 0.8,
                    resources: ['metal', 'food']
                };
            } else {
                return {
                    name: 'Forest',
                    color: '#4b7339',
                    featureDensity: 1.5,
                    resources: ['food', 'energy']
                };
            }
        }
    }
    
    getFeatureType(biome) {
        // Determine feature type based on biome
        const features = {
            'Desert': ['rock', 'cactus', 'debris'],
            'Wasteland': ['debris', 'rock', 'ruin'],
            'Grassland': ['tree', 'rock', 'bush'],
            'Hills': ['rock', 'tree', 'bush'],
            'Forest': ['tree', 'tree', 'bush', 'rock']
        };
        
        // Get feature list for this biome, or default
        const biomeFeatures = features[biome.name] || ['rock'];
        
        // Pick random feature from biome's feature list
        return biomeFeatures[Math.floor(this.rng() * biomeFeatures.length)];
    }
    
    getResourceType(biome) {
        // Get available resource types for this biome
        const biomeResources = biome.resources || ['metal'];
        
        // Pick random resource type from biome's resource list
        return biomeResources[Math.floor(this.rng() * biomeResources.length)];
    }
    
    getResourceColor(resourceType) {
        // Define colors for different resource types
        const colors = {
            'metal': '#a0a0a0',
            'energy': '#f0e050',
            'food': '#50c020'
        };
        
        return colors[resourceType] || '#ff00ff';
    }
    
    update(deltaTime, playerX, playerY) {
        // Load and unload chunks based on player position
        this.updateActiveChunks(playerX, playerY);
    }
    
    updateActiveChunks(playerX, playerY) {
        // Determine which chunks should be active based on player position
        const loadDistance = this.maxLoadDistance;
        const loadChunkRadius = Math.ceil(loadDistance / this.chunkSize);
        
        // Calculate which chunk the player is in
        const playerChunkX = Math.floor(playerX / this.chunkSize);
        const playerChunkY = Math.floor(playerY / this.chunkSize);
        
        // Create set of chunk IDs that should be active
        const shouldBeActive = new Set();
        
        // Generate or load chunks around player
        for (let cx = playerChunkX - loadChunkRadius; cx <= playerChunkX + loadChunkRadius; cx++) {
            for (let cy = playerChunkY - loadChunkRadius; cy <= playerChunkY + loadChunkRadius; cy++) {
                const chunkX = cx * this.chunkSize;
                const chunkY = cy * this.chunkSize;
                const chunkId = this.getChunkId(chunkX, chunkY);
                
                // Check if chunk is within load distance
                const chunkCenterX = chunkX + this.chunkSize / 2;
                const chunkCenterY = chunkY + this.chunkSize / 2;
                const dx = chunkCenterX - playerX;
                const dy = chunkCenterY - playerY;
                const distanceSquared = dx * dx + dy * dy;
                
                if (distanceSquared <= loadDistance * loadDistance) {
                    shouldBeActive.add(chunkId);
                    
                    // Generate chunk if it doesn't exist
                    if (!this.chunks[chunkId]) {
                        this.generateChunk(chunkX, chunkY);
                    }
                }
            }
        }
        
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
    
    getRandomSpawnPoint() {
        // Find a safe place to spawn a player
        // For simplicity, just use the center for now
        return { x: 0, y: 0 };
    }
    
    syncFromNetworkState(roomState) {
        // Update world state from network
        if (roomState.resources) {
            this.updateResourcesFromNetwork(roomState.resources);
        }
        
        if (roomState.worldObjects) {
            this.updateWorldObjectsFromNetwork(roomState.worldObjects);
        }
    }
    
    updateResourcesFromNetwork(networkResources) {
        // Update resource locations and amounts
        for (const [id, data] of Object.entries(networkResources)) {
            if (data === null) {
                // Resource was deleted
                delete this.resources[id];
                continue;
            }
            
            // Update or create resource
            if (!this.resources[id]) {
                this.resources[id] = {
                    id,
                    type: 'resource',
                    ...data
                };
            } else {
                // Update existing resource
                Object.assign(this.resources[id], data);
            }
            
            // Make sure the resource is in the right chunk
            const chunkId = this.getChunkId(this.resources[id].x, this.resources[id].y);
            if (!this.chunks[chunkId]) {
                // Generate the chunk if needed
                this.generateChunk(
                    Math.floor(this.resources[id].x / this.chunkSize) * this.chunkSize,
                    Math.floor(this.resources[id].y / this.chunkSize) * this.chunkSize
                );
            }
            
            // Add resource to chunk if not already there
            const chunk = this.chunks[chunkId];
            if (chunk) {
                const resourceInChunk = chunk.resources.find(r => r.id === id);
                if (!resourceInChunk) {
                    chunk.resources.push(this.resources[id]);
                }
            }
        }
    }
    
    updateWorldObjectsFromNetwork(worldObjects) {
        // Update world objects like buildings, etc.
        for (const [id, data] of Object.entries(worldObjects)) {
            // Handle object updates similar to resources
            // Implementation depends on the specifics of your world objects
        }
    }
}

