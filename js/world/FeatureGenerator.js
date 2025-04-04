import SeedableRNG from '../utils/SeedableRNG.js'; // Import the RNG

export default class FeatureGenerator {
    constructor(world) {
        this.world = world;

        this.featureDefinitions = {
            'tree': {
                size: { min: 15, max: 25 },
                spriteCellId: 'tree_pine', // Link to sprite cell
                health: 100,
                collides: true
            },
            'bush': {
                size: { min: 8, max: 15 },
                spriteCellId: 'shrub_round',
                health: 50,
                collides: true
            },
            'rock': {
                size: { min: 10, max: 20 },
                spriteCellId: 'rock_medium',
                health: 150,
                collides: true
            },
            'debris': {
                size: { min: 12, max: 18 },
                spriteCellId: 'tire',
                health: 80,
                collides: true
            },
            'cactus': {
                size: { min: 14, max: 22 },
                spriteCellId: 'cactus_tall',
                health: 70,
                collides: true
            },
            'ruin': { // Using boulder sprite as placeholder
                size: { min: 18, max: 30 },
                spriteCellId: 'boulder_large',
                health: 200,
                collides: true
            },
            // Add other potential features like pebbles if needed by biomes
            'pebbles': {
                size: { min: 5, max: 10 },
                spriteCellId: 'pebbles_small',
                health: 20, // Less health
                collides: false // Pebbles might not block movement
            },
             'boulder': { // Explicit boulder type if needed distinct from ruin/rock
                 size: { min: 25, max: 40 },
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
    generateFeaturesForChunk(chunk, worldSeed) { // Accept worldSeed
        if (!chunk.biome) return [];

        // --- NEW: Create chunk-specific RNG ---
        const chunkBaseX = Math.floor(chunk.x / this.world.chunkSize);
        const chunkBaseY = Math.floor(chunk.y / this.world.chunkSize);
        const chunkSeed = SeedableRNG.combineSeeds(worldSeed, chunkBaseX, chunkBaseY, 1); // Added 1 for feature type seed offset
        const rng = new SeedableRNG(chunkSeed);
        // --- END NEW ---

        // Determine feature count based on biome and chunk RNG
        const baseFeatureCount = 5; // Example base count
        const featureDensity = chunk.biome.featureDensity || 1;
        // Use chunk RNG for count variation
        const featureCount = Math.floor(baseFeatureCount * featureDensity * (0.5 + rng.next()));

        // Ensure chunk.features is initialized
        chunk.features = chunk.features || [];

        // Generate features
        for (let i = 0; i < featureCount; i++) {
            // Use chunk RNG for position
            const offsetX = (rng.next() - 0.5) * chunk.size;
            const offsetY = (rng.next() - 0.5) * chunk.size;
            const featureX = chunk.x + offsetX;
            const featureY = chunk.y + offsetY;

            // Determine feature type based on biome (using chunk RNG)
            const featureType = this.getFeatureType(chunk.biome, rng); // Pass RNG
            const featureDef = this.featureDefinitions[featureType];

            if (!featureDef) continue;

            // Create feature (using chunk RNG for size variation)
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
                color: featureDef.color, // Keep color as fallback/tint?
                spriteCellId: featureDef.spriteCellId, // Pass sprite info
                name: featureType.charAt(0).toUpperCase() + featureType.slice(1) // Add a name
            };

            // Add to chunk features
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
    getFeatureType(biome, rng) { // Accept RNG
        if (!biome.features || biome.features.length === 0) {
            return 'rock'; // Default fallback
        }

        // Pick random feature from biome's feature list using the provided RNG
        return biome.features[rng.nextInt(0, biome.features.length)];
    }
}