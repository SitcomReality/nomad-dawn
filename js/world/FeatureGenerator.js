export default class FeatureGenerator {
    constructor(world) {
        this.world = world;
        this.rng = world.rng;
        
        this.featureDefinitions = {
            'tree': {
                size: { min: 15, max: 25 },
                color: '#3d6b35',
                health: 100,
                collides: true
            },
            'bush': {
                size: { min: 8, max: 15 },
                color: '#4e8745',
                health: 50,
                collides: true
            },
            'rock': {
                size: { min: 10, max: 20 },
                color: '#999',
                health: 150,
                collides: true
            },
            'debris': {
                size: { min: 12, max: 18 },
                color: '#b7ae94',
                health: 80,
                collides: true
            },
            'cactus': {
                size: { min: 14, max: 22 },
                color: '#77a567',
                health: 70,
                collides: true
            },
            'ruin': {
                size: { min: 18, max: 30 },
                color: '#a09490',
                health: 200,
                collides: true
            }
        };
    }
    
    generateFeaturesForChunk(chunk) {
        if (!chunk.biome) return [];
        
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
            const featureDef = this.featureDefinitions[featureType];
            
            if (!featureDef) continue;
            
            // Create feature
            const sizeRange = featureDef.size;
            const size = sizeRange.min + this.rng() * (sizeRange.max - sizeRange.min);
            
            const feature = {
                id: `feature-${chunk.id}-${i}`,
                type: featureType,
                x: featureX,
                y: featureY,
                size: size,
                health: featureDef.health,
                collides: featureDef.collides,
                color: featureDef.color
            };
            
            // Add to chunk features
            chunk.features.push(feature);
        }
        
        return chunk.features;
    }
    
    getFeatureType(biome) {
        if (!biome.features || biome.features.length === 0) {
            return 'rock'; // Default fallback
        }
        
        // Pick random feature from biome's feature list
        return biome.features[Math.floor(this.rng() * biome.features.length)];
    }
}