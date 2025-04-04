/**
 * Simple seedable pseudo-random number generator (PRNG) using Mulberry32 algorithm.
 * Ensures deterministic results based on an initial seed.
 */
export default class SeedableRNG {
    /**
     * Creates a new instance of the RNG.
     * @param {number} seed - The initial seed value (integer).
     */
    constructor(seed) {
        // Ensure seed is an integer
        this.seed = Math.floor(seed);
        // Initialize the state
        this.a = this.seed | 0; // Ensure 'a' is a 32-bit integer
    }

    /**
     * Generates the next pseudo-random number between 0 (inclusive) and 1 (exclusive).
     * @returns {number} A pseudo-random float.
     */
    next() {
        // Mulberry32 algorithm
        this.a |= 0; // Ensure 'a' stays a 32-bit integer
        this.a = this.a + 0x6D2B79F5 | 0;
        let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // Convert to float [0, 1)
    }

    /**
     * Generates the next pseudo-random integer between min (inclusive) and max (exclusive).
     * @param {number} min - The minimum integer value (inclusive).
     * @param {number} max - The maximum integer value (exclusive).
     * @returns {number} A pseudo-random integer.
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }

    /**
     * Generates a pseudo-random boolean value (true/false).
     * @param {number} probability - The probability of returning true (0 to 1). Default is 0.5.
     * @returns {boolean} A pseudo-random boolean.
     */
    nextBool(probability = 0.5) {
        return this.next() < probability;
    }

    /**
     * Static utility function to combine multiple seeds into a single hash.
     * Useful for generating deterministic seeds for specific coordinates or elements.
     * Uses a simple hashing approach.
     * @param {...number} seeds - Integers to combine.
     * @returns {number} A combined seed hash (32-bit integer).
     */
    static combineSeeds(...seeds) {
        let hash = 0;
        for (let i = 0; i < seeds.length; i++) {
             let seed = seeds[i] | 0; // Ensure integer
             hash = ((hash << 5) - hash) + seed;
             hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
}