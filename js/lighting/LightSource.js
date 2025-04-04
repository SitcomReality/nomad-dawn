/**
 * Represents a dynamic light source in the game world.
 */
export default class LightSource {
    /**
     * Creates a new LightSource instance.
     * @param {string} id - Unique identifier for the light source.
     * @param {Object} options - Configuration options.
     * @param {number} options.x - Initial X position (overridden if ownerId is set).
     * @param {number} options.y - Initial Y position (overridden if ownerId is set).
     * @param {Object} [options.color={r: 255, g: 255, b: 255}] - Light color.
     * @param {number} [options.intensity=1.0] - Light intensity (0.0 to 1.0).
     * @param {number} [options.range=300] - Effective range of the light in world units.
     * @param {string} [options.type='point'] - Type of light ('point', 'ambient' - future).
     * @param {string|null} [options.ownerId=null] - ID of the entity this light is attached to.
     * @param {number} [options.offsetX=0] - Offset X from the owner's center, relative to owner's angle.
     * @param {number} [options.offsetY=0] - Offset Y from the owner's center, relative to owner's angle.
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
        this.offsetX = options.offsetX ?? 0; // Offset relative to owner's front/center
        this.offsetY = options.offsetY ?? 0; // Offset relative to owner's side/center

        // Potential future properties
        // this.direction = options.direction ?? null; // For spotlights
        // this.angle = options.angle ?? null; // Cone angle for spotlights
    }

    /**
     * Updates the light source state.
     * Updates position based on owner's position and angle if attached.
     * @param {number} deltaTime - Time since the last frame.
     * @param {Game} game - The main game instance.
     */
    update(deltaTime, game) {
        if (this.ownerId && game?.entities) {
            const owner = game.entities.get(this.ownerId);
            if (owner) {
                 // --- UPDATED: Calculate position with offset and owner angle ---
                 const ownerAngle = owner.angle ?? 0;
                 const cosAngle = Math.cos(ownerAngle);
                 const sinAngle = Math.sin(ownerAngle);

                 // Rotate the offset according to the owner's angle
                 const rotatedOffsetX = this.offsetX * cosAngle - this.offsetY * sinAngle;
                 const rotatedOffsetY = this.offsetX * sinAngle + this.offsetY * cosAngle;

                 // Set the light's position based on the owner's center and the rotated offset
                 this.x = owner.x + rotatedOffsetX;
                 this.y = owner.y + rotatedOffsetY;
                 // --- END UPDATED ---

            } else {
                // Owner entity disappeared, maybe remove this light?
                // Use EntityManager's remove method which also handles cleanup
                // game.entities.remove(this.id);
                // console.warn(`Light source ${this.id} owner ${this.ownerId} not found. Light may be orphaned.`);
                // For now, we'll let EntityManager's cleanup handle this when the owner is removed.
            }
        }

        // Other update logic (e.g., flickering intensity) could go here
    }

    // Basic representation for potential debugging
    toString() {
        return `Light[${this.id}](${this.lightType} @ ${this.x.toFixed(0)},${this.y.toFixed(0)} | Owner: ${this.ownerId} | Range:${this.range} | Intensity:${this.intensity})`;
    }
}