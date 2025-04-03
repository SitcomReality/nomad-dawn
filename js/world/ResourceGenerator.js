export default class ResourceGenerator {
    constructor(world) {
        this.world = world;
        this.rng = world.rng;
        this.resourceDefinitions = {
            'metal': {
                name: 'Metal',
                color: '#a0a0a0',
                baseAmount: 50,
                size: 15,
                density: 1.0,
                spriteCellId: 'metal'
            },
            'energy': {
                name: 'Energy Crystals',
                color: '#f0e050',
                baseAmount: 40,
                size: 12,
                density: 0.8,
                spriteCellId: 'energy'
            },
            'food': {
                name: 'Food Source',
                color: '#50c020',
                baseAmount: 60,
                size: 14,
                density: 1.2,
                spriteCellId: 'food'
            },
            'uranium': {
                name: 'Uranium',
                color: '#2ea83b',
                baseAmount: 20,
                size: 10,
                density: 0.2,
                isRare: true,
                clusterSize: 3,
                spriteCellId: 'uranium'
            },
            'silicon': {
                name: 'Pure Silicon',
                color: '#b9d0d7',
                baseAmount: 25,
                size: 12,
                density: 0.3,
                isRare: true,
                clusterSize: 4,
                spriteCellId: 'silicon'
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

    generateResourcesForChunk(chunk) {
        this.generateCommonResources(chunk);
        this.generateRareResources(chunk);
        return chunk.resources;
    }

    generateCommonResources(chunk) {
        if (!chunk.biome || !chunk.biome.resources) return;

        chunk.biome.resources.forEach(resourceType => {
            const resourceDef = this.resourceDefinitions[resourceType];
            if (!resourceDef) return;

            const baseCount = Math.ceil(this.world.resourceDensity * chunk.size / 100);
            const resourceCount = Math.floor(baseCount * resourceDef.density * (0.7 + this.rng() * 0.6));

            for (let i = 0; i < resourceCount; i++) {
                const offsetX = (this.rng() - 0.5) * chunk.size;
                const offsetY = (this.rng() - 0.5) * chunk.size;
                const resourceX = chunk.x + offsetX;
                const resourceY = chunk.y + offsetY;

                const resource = {
                    id: `resource-${chunk.id}-${resourceType}-${i}`,
                    type: 'resource',
                    resourceType: resourceType,
                    name: resourceDef.name,
                    x: resourceX,
                    y: resourceY,
                    size: resourceDef.size + this.rng() * 5 - 2.5,
                    amount: resourceDef.baseAmount + Math.floor(this.rng() * 30 - 15),
                    color: resourceDef.color,
                    collides: true,
                    spriteCellId: resourceDef.spriteCellId 
                };

                chunk.resources.push(resource);
            }
        });
    }

    generateRareResources(chunk) {
        if (!chunk.biome || !chunk.biome.rareResources) return;

        if (this.rng() > 0.08) return;

        const biomeRareResources = chunk.biome.rareResources;
        const rareType = biomeRareResources[Math.floor(this.rng() * biomeRareResources.length)];
        const resourceDef = this.resourceDefinitions[rareType];

        if (!resourceDef || !resourceDef.isRare) return;

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
                name: resourceDef.name,
                x: resourceX,
                y: resourceY,
                size: resourceDef.size + this.rng() * 4 - 2,
                amount: resourceDef.baseAmount + Math.floor(this.rng() * 10),
                color: resourceDef.color,
                collides: true,
                rare: true,
                spriteCellId: resourceDef.spriteCellId 
            };

            chunk.resources.push(resource);
        }
    }
}