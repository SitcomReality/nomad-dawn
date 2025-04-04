import SeedableRNG from '../utils/SeedableRNG.js'; // Import the RNG

export default class FeatureGenerator {
    constructor(world) {
        this.world = world;

        this.featureDefinitions = {
            'tree': {
                size: { min: 30, max: 50 }, 
                spriteCellId: 'tree_pine', 
                health: 100,
                collides: true
            },
            'bush': {
                size: { min: 16, max: 30 }, 
                spriteCellId: 'shrub_round',
                health: 50,
                collides: true
            },
            'rock': {
                size: { min: 20, max: 40 }, 
                spriteCellId: 'rock_medium',
                health: 150,
                collides: true
            },
            'debris': {
                size: { min: 24, max: 36 }, 
                spriteCellId: 'tire',
                health: 80,
                collides: true
            },
            'cactus': {
                size: { min: 28, max: 44 }, 
                spriteCellId: 'cactus_tall',
                health: 70,
                collides: true
            },
            'ruin': { 
                size: { min: 36, max: 60 }, 
                spriteCellId: 'boulder_large',
                health: 200,
                collides: true
            },
            'pebbles': {
                size: { min: 10, max: 20 }, 
                spriteCellId: 'pebbles_small',
                health: 20, 
                collides: false 
            },
             'boulder': { 
                 size: { min: 50, max: 80 }, 
                 spriteCellId: 'boulder_large',
                 health: 300,
                 collides: true
             }
        };
    }

    /**
     * Generates features for a given chunk using a deterministic RNG based on chunk coordinates and world seed.
     * @param {Object} chunk - The chunk object.
     * @param {number} worldSeed - The world's base seed.
     */
    generateFeaturesForChunk(chunk, worldSeed) { 
        if (!chunk.biome) return [];

        const chunkBaseX = Math.floor(chunk.x / this.world.chunkSize);
        const chunkBaseY = Math.floor(chunk.y / this.world.chunkSize);
        const chunkSeed = SeedableRNG.combineSeeds(worldSeed, chunkBaseX, chunkBaseY, 1); 
        const rng = new SeedableRNG(chunkSeed);

        const baseFeatureCount = 5; 
        const featureDensity = chunk.biome.featureDensity || 1;
        const featureCount = Math.floor(baseFeatureCount * featureDensity * (0.5 + rng.next()));

        chunk.features = chunk.features || [];

        for (let i = 0; i < featureCount; i++) {
            const offsetX = (rng.next() - 0.5) * chunk.size;
            const offsetY = (rng.next() - 0.5) * chunk.size;
            const featureX = chunk.x + offsetX;
            const featureY = chunk.y + offsetY;

            const featureType = this.getFeatureType(chunk.biome, rng); 
            const featureDef = this.featureDefinitions[featureType];

            if (!featureDef) continue;

            const sizeRange = featureDef.size;
            const size = sizeRange.min + rng.next() * (sizeRange.max - sizeRange.min);

            const feature = {
                id: `feature-${chunk.id}-${i}`,
                type: featureType,
                x: featureX,
                y: featureY,
                size: size,
                health: featureDef.health,
                collides: featureDef.collides,
                color: featureDef.color, 
                spriteCellId: featureDef.spriteCellId, 
                name: featureType.charAt(0).toUpperCase() + featureType.slice(1) 
            };

            chunk.features.push(feature);
        }

        return chunk.features;
    }

    /**
     * Gets a feature type suitable for the biome using the provided RNG.
     * @param {Object} biome - The biome object.
     * @param {SeedableRNG} rng - The seeded RNG instance to use.
     * @returns {string} The selected feature type ID.
     */
    getFeatureType(biome, rng) { 
        if (!biome.features || biome.features.length === 0) {
            return 'rock'; 
        }

        return biome.features[rng.nextInt(0, biome.features.length)];
    }
}