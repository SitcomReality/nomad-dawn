/**
 * Represents a dynamic light source in the game world.
 */
export default class LightSource {
    /**
     * Creates a new LightSource instance.
     * @param {string} id - Unique identifier for the light source.
     * @param {Object} options - Configuration options.
     * @param {number} options.x - Initial X position.
     * @param {number} options.y - Initial Y position.
     * @param {Object} [options.color={r: 255, g: 255, b: 255}] - Light color.
     * @param {number} [options.intensity=1.0] - Light intensity (0.0 to 1.0).
     * @param {number} [options.range=300] - Effective range of the light in world units.
     * @param {string} [options.type='point'] - Type of light ('point', 'ambient' - future).
     * @param {string|null} [options.ownerId=null] - ID of the entity this light is attached to.
     */
    constructor(id, options = {}) {
        this.id = id;
        this.type = 'light_source'; // Consistent type property

        this.x = options.x ?? 0;
        this.y = options.y ?? 0;
        this.color = options.color ?? { r: 255, g: 255, b: 255 };
        this.intensity = Math.max(0, Math.min(1, options.intensity ?? 1.0));
        this.range = Math.max(0, options.range ?? 300);
        this.lightType = options.type ?? 'point'; // Use 'lightType' to avoid conflict with base 'type'
        this.ownerId = options.ownerId ?? null;

        // Potential future properties
        // this.direction = options.direction ?? null; // For spotlights
        // this.angle = options.angle ?? null; // Cone angle for spotlights
    }

    /**
     * Updates the light source state.
     * For now, mainly updates position if attached to an owner.
     * @param {number} deltaTime - Time since the last frame.
     * @param {Game} game - The main game instance.
     */
    update(deltaTime, game) {
        if (this.ownerId && game?.entities) {
            const owner = game.entities.get(this.ownerId);
            if (owner) {
                // Update position to match the owner
                // TODO: Add potential offset from owner's center if needed
                this.x = owner.x;
                this.y = owner.y;
            } else {
                // Owner entity disappeared, maybe remove this light?
                // console.warn(`Light source ${this.id} owner ${this.ownerId} not found.`);
                // Optionally: game.entities.remove(this.id);
            }
        }

        // Other update logic (e.g., flickering intensity) could go here
    }

    // Basic representation for potential debugging
    toString() {
        return `Light[${this.id}](${this.lightType} @ ${this.x.toFixed(0)},${this.y.toFixed(0)} | Range:${this.range} | Intensity:${this.intensity})`;
    }
}