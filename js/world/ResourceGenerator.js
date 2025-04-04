import SeedableRNG from '../utils/SeedableRNG.js';

export default class ResourceGenerator {
    constructor(world) {
        this.world = world;

        this.resourceDefinitions = {
            'metal': {
                name: 'Metal',
                color: '#a0a0a0',
                baseAmount: 50,
                size: 15,
                density: 1.0,
                spriteCellId: 'metal_lump'
            },
            'energy': {
                name: 'Energy Crystals',
                color: '#f0e050',
                baseAmount: 40,
                size: 12,
                density: 0.8,
                spriteCellId: 'battery_car'
            },
            'food': {
                name: 'Food Source',
                color: '#50c020',
                baseAmount: 60,
                size: 14,
                density: 1.2,
                spriteCellId: 'food_fruit'
            },
            'uranium': {
                name: 'Uranium',
                color: '#2ea83b',
                baseAmount: 20,
                size: 10,
                density: 0.2,
                isRare: true,
                clusterSize: 3,
                spriteCellId: 'barrel_toxic'
            },
            'silicon': {
                name: 'Pure Silicon',
                color: '#b9d0d7',
                baseAmount: 25,
                size: 12,
                density: 0.3,
                isRare: true,
                clusterSize: 4,
                spriteCellId: 'metal_ingots'
            },
            'crystal': {
                name: 'Crystal Formation',
                color: '#9966cc',
                baseAmount: 15,
                size: 16,
                density: 0.15,
                isRare: true,
                clusterSize: 5,
                spriteCellId: 'crystal'
            },
            'medicine': {
                name: 'Medicinal Plants',
                color: '#d14a87',
                baseAmount: 30,
                size: 11,
                density: 0.25,
                isRare: true,
                clusterSize: 3,
                spriteCellId: 'medicine'
            },
            'exotic_wood': {
                name: 'Exotic Wood',
                color: '#8b4513',
                baseAmount: 35,
                size: 18,
                density: 0.2,
                isRare: true,
                clusterSize: 4,
                spriteCellId: 'exotic_wood'
            }
        };
    }

    /**
     * Generates resources for a chunk using deterministic RNG.
     * @param {Object} chunk - The chunk object.
     * @param {number} worldSeed - The world's base seed.
     * @returns {Array<Object>} The generated resources array for the chunk.
     */
    generateResourcesForChunk(chunk, worldSeed) {
        // --- NEW: Create chunk-specific RNG ---
        const chunkBaseX = Math.floor(chunk.x / this.world.chunkSize);
        const chunkBaseY = Math.floor(chunk.y / this.world.chunkSize);
        // Use different offset for resource RNG vs feature RNG
        const commonSeed = SeedableRNG.combineSeeds(worldSeed, chunkBaseX, chunkBaseY, 2);
        const rareSeed = SeedableRNG.combineSeeds(worldSeed, chunkBaseX, chunkBaseY, 3);
        const commonRng = new SeedableRNG(commonSeed);
        const rareRng = new SeedableRNG(rareSeed);
        // --- END NEW ---

        // Ensure chunk.resources is initialized
        chunk.resources = chunk.resources || [];

        this.generateCommonResources(chunk, commonRng); 
        this.generateRareResources(chunk, rareRng);     

        return chunk.resources;
    }

    /**
     * Generates common resources for the chunk using the provided RNG.
     * @param {Object} chunk - The chunk object.
     * @param {SeedableRNG} rng - The seeded RNG instance to use.
     */
    generateCommonResources(chunk, rng) { 
        if (!chunk.biome || !chunk.biome.resources) return;

        chunk.biome.resources.forEach(resourceType => {
            const resourceDef = this.resourceDefinitions[resourceType];
            if (!resourceDef) return;

            // Use RNG for density calculation
            const baseCount = Math.ceil(this.world.resourceDensity * chunk.size / 100);
            const resourceCount = Math.floor(baseCount * resourceDef.density * (0.7 + rng.next() * 0.6));

            for (let i = 0; i < resourceCount; i++) {
                // Use RNG for position and variation
                const offsetX = (rng.next() - 0.5) * chunk.size;
                const offsetY = (rng.next() - 0.5) * chunk.size;
                const resourceX = chunk.x + offsetX;
                const resourceY = chunk.y + offsetY;

                const resource = {
                    id: `resource-${chunk.id}-${resourceType}-${i}`,
                    type: 'resource',
                    resourceType: resourceType,
                    name: resourceDef.name,
                    x: resourceX,
                    y: resourceY,
                    size: resourceDef.size + rng.next() * 5 - 2.5, 
                    amount: resourceDef.baseAmount + Math.floor(rng.next() * 30 - 15), 
                    color: resourceDef.color,
                    collides: true,
                    spriteCellId: resourceDef.spriteCellId
                };

                chunk.resources.push(resource);
            }
        });
    }

    /**
     * Generates rare resources for the chunk using the provided RNG.
     * @param {Object} chunk - The chunk object.
     * @param {SeedableRNG} rng - The seeded RNG instance to use.
     */
    generateRareResources(chunk, rng) { 
        if (!chunk.biome || !chunk.biome.rareResources) return;

        // Use RNG to decide if rare resources spawn
        if (rng.next() > 0.08) return; 

        const biomeRareResources = chunk.biome.rareResources;
        // Use RNG to pick which rare resource
        const rareType = biomeRareResources[rng.nextInt(0, biomeRareResources.length)];
        const resourceDef = this.resourceDefinitions[rareType];

        if (!resourceDef || !resourceDef.isRare) return;

        const clusterSize = resourceDef.clusterSize || 3;
        const clusterRadius = chunk.size * 0.3;

        // Use RNG for cluster center position
        const clusterCenterOffsetX = (rng.next() - 0.5) * (chunk.size - clusterRadius * 2);
        const clusterCenterOffsetY = (rng.next() - 0.5) * (chunk.size - clusterRadius * 2);
        const clusterCenterX = chunk.x + clusterCenterOffsetX;
        const clusterCenterY = chunk.y + clusterCenterOffsetY;

        for (let i = 0; i < clusterSize; i++) {
            // Use RNG for position within cluster
            const angle = rng.next() * Math.PI * 2;
            const distance = rng.next() * clusterRadius;
            const resourceX = clusterCenterX + Math.cos(angle) * distance;
            const resourceY = clusterCenterY + Math.sin(angle) * distance;

            const resource = {
                id: `resource-${chunk.id}-${rareType}-${i}`,
                type: 'resource',
                resourceType: rareType,
                name: resourceDef.name,
                x: resourceX,
                y: resourceY,
                size: resourceDef.size + rng.next() * 4 - 2, 
                amount: resourceDef.baseAmount + Math.floor(rng.next() * 10), 
                color: resourceDef.color,
                collides: true,
                rare: true,
                spriteCellId: resourceDef.spriteCellId
            };

            chunk.resources.push(resource);
        }
    }
}