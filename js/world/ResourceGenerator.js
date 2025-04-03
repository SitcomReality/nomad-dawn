import { Config } from '../config/GameConfig.js';

export default class ResourceGenerator {
    constructor(world) {
        this.world = world;
        this.rng = world.rng;
        // Simplify definitions, rely on GameConfig for sprite/color/name
        this.resourceDefinitions = {
            'metal': { baseAmount: 50, size: 15, density: 1.0 },
            'energy': { baseAmount: 40, size: 12, density: 0.8 },
            'food': { baseAmount: 60, size: 14, density: 1.2 },
            'uranium': { baseAmount: 20, size: 10, density: 0.2, isRare: true, clusterSize: 3 },
            'silicon': { baseAmount: 25, size: 12, density: 0.3, isRare: true, clusterSize: 4 },
            'crystal': { baseAmount: 15, size: 16, density: 0.15, isRare: true, clusterSize: 5 },
            'medicine': { baseAmount: 30, size: 11, density: 0.25, isRare: true, clusterSize: 3 },
            'exotic_wood': { baseAmount: 35, size: 18, density: 0.2, isRare: true, clusterSize: 4 }
        };
    }

    generateResourcesForChunk(chunk) {
        this.generateCommonResources(chunk);
        this.generateRareResources(chunk);
        return chunk.resources;
    }

    generateCommonResources(chunk) {
        if (!chunk.biome || !chunk.biome.resources) return;

        chunk.biome.resources.forEach(resourceType => {
            const resourceDef = this.resourceDefinitions[resourceType];
            const resourceConfig = Config.RESOURCE_TYPES.find(r => r.id === resourceType); // Get full config
            if (!resourceDef || !resourceConfig) return;

            const baseCount = Math.ceil(this.world.resourceDensity * chunk.size / 100); // Scale count with density and chunk size
            const resourceCount = Math.floor(baseCount * resourceDef.density * (0.7 + this.rng() * 0.6));


            for (let i = 0; i < resourceCount; i++) {
                const offsetX = (this.rng() - 0.5) * chunk.size;
                const offsetY = (this.rng() - 0.5) * chunk.size;
                const resourceX = chunk.x + offsetX;
                const resourceY = chunk.y + offsetY;

                const resource = {
                    id: `resource-${chunk.id}-${resourceType}-${i}`,
                    type: 'resource', // Type used for rendering/collision checks
                    resourceType: resourceType, // Specific type ID
                    name: resourceConfig.name,
                    x: resourceX,
                    y: resourceY,
                    size: resourceDef.size + this.rng() * 5 - 2.5,
                    amount: Math.max(1, resourceDef.baseAmount + Math.floor(this.rng() * 30 - 15)), // Ensure at least 1 amount
                    color: resourceConfig.color, // Get color from config
                    collides: true,
                    spriteCellId: Config.RESOURCE_SPRITES[resourceType] // Get sprite mapping from config
                };

                chunk.resources.push(resource);
            }
        });
    }

    generateRareResources(chunk) {
        // Lower probability for rare resource cluster spawn
        if (!chunk.biome || !chunk.biome.rareResources || this.rng() > 0.1) return;

        const biomeRareResources = chunk.biome.rareResources;
        if (biomeRareResources.length === 0) return;

        const rareType = biomeRareResources[Math.floor(this.rng() * biomeRareResources.length)];
        const resourceDef = this.resourceDefinitions[rareType];
        const resourceConfig = Config.RESOURCE_TYPES.find(r => r.id === rareType); // Get full config

        if (!resourceDef || !resourceConfig || !resourceDef.isRare) return;

        const clusterSize = resourceDef.clusterSize || 3;
        const clusterRadius = chunk.size * 0.3;

        const clusterCenterOffsetX = (this.rng() - 0.5) * (chunk.size - clusterRadius * 2);
        const clusterCenterOffsetY = (this.rng() - 0.5) * (chunk.size - clusterRadius * 2);
        const clusterCenterX = chunk.x + clusterCenterOffsetX;
        const clusterCenterY = chunk.y + clusterCenterOffsetY;

        for (let i = 0; i < clusterSize; i++) {
            const angle = this.rng() * Math.PI * 2;
            const distance = this.rng() * clusterRadius;
            const resourceX = clusterCenterX + Math.cos(angle) * distance;
            const resourceY = clusterCenterY + Math.sin(angle) * distance;

            const resource = {
                id: `resource-${chunk.id}-${rareType}-${i}`,
                type: 'resource',
                resourceType: rareType,
                name: resourceConfig.name,
                x: resourceX,
                y: resourceY,
                size: resourceDef.size + this.rng() * 4 - 2,
                amount: Math.max(1, resourceDef.baseAmount + Math.floor(this.rng() * 10)), // Ensure at least 1
                color: resourceConfig.color, // Get color from config
                collides: true,
                rare: true,
                spriteCellId: Config.RESOURCE_SPRITES[rareType] // Get sprite mapping from config
            };

            chunk.resources.push(resource);
        }
    }
}