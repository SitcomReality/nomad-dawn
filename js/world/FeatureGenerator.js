import { Config } from '../config/GameConfig.js';

export default class FeatureGenerator {
    constructor(world) {
        this.world = world;
        this.rng = world.rng;
        
        // Simplified feature definitions, relying on GameConfig for sprite info
        this.featureDefinitions = {
            'tree': {
                size: { min: 15, max: 25 },
                health: 100,
                collides: true
            },
            'bush': {
                size: { min: 8, max: 15 },
                health: 50,
                collides: true
            },
            'rock': {
                size: { min: 10, max: 20 },
                health: 150,
                collides: true
            },
            'debris': {
                size: { min: 12, max: 18 },
                health: 80,
                collides: true
            },
            'cactus': {
                size: { min: 14, max: 22 },
                health: 70,
                collides: true
            },
            'ruin': { 
                size: { min: 18, max: 30 },
                health: 200,
                collides: true
            },
            'pebbles': {
                size: { min: 5, max: 10 },
                health: 20,
                collides: false 
            },
             'boulder': {
                 size: { min: 25, max: 40 },
                 health: 300,
                 collides: true
             }
        };
    }
    
    generateFeaturesForChunk(chunk) {
        if (!chunk.biome) return [];
        
        // Determine feature count based on biome
        const baseFeatureCount = 5; // Lower base count, density handles more
        const featureDensity = chunk.biome.featureDensity || 1;
        const featureCount = Math.floor(baseFeatureCount * featureDensity * (0.8 + this.rng() * 0.4) * (chunk.size / 500)); // Scale with chunk size, adjust randomness

        
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
            
            // Get sprite mapping from Config
            const spriteCellId = Config.FEATURE_SPRITES[featureType];
            if (!spriteCellId) {
                console.warn(`No sprite mapping found for feature type: ${featureType}`);
                // Optionally skip this feature or use a fallback sprite
                // continue; 
            }
            
            // Create feature
            const sizeRange = featureDef.size;
            const size = sizeRange.min + this.rng() * (sizeRange.max - sizeRange.min);
            
            const feature = {
                id: `feature-${chunk.id}-${featureType}-${i}`, // Make ID slightly more descriptive
                type: 'feature', // Generic type for world features
                featureType: featureType, // Specific type
                x: featureX,
                y: featureY,
                size: size,
                health: featureDef.health,
                collides: featureDef.collides,
                spriteCellId: spriteCellId, // Pass sprite info
                name: featureType.charAt(0).toUpperCase() + featureType.slice(1) // Add a name
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
        const type = biome.features[Math.floor(this.rng() * biome.features.length)];

        // Randomly select tree type if 'tree' is chosen
        if (type === 'tree') {
             // Example: return this.rng() > 0.5 ? 'tree_pine' : 'tree_round'; 
             // For now, FeatureGenerator returns 'tree', Config.FEATURE_SPRITES maps 'tree' to one sprite.
             // Or FeatureGenerator could return 'tree_pine'/'tree_round' directly based on biome or randomness.
             // Let's stick to the simple mapping for now.
             return 'tree';
        }
        return type;

    }
}