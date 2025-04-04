// New file: js/lighting/ShadowManager.js
/**
 * Manages the calculation and potentially rendering of shadows cast by light sources.
 */
export default class ShadowManager {
    constructor(game) {
        this.game = game;
        this.shadowPolygons = []; // Stores calculated shadow polygons for the current frame
        this.casterCache = new Map(); // Cache caster geometry to avoid recalculation
        this.debug = false; // Set to true to render debug info for shadows
    }

    /**
     * Calculates shadows for all relevant lights and casters in the current view.
     */
    calculateShadows() {
        this.shadowPolygons = [];
        if (!this.game.lightManager || !this.game.entities || !this.game.worldObjectManager) {
            return; // Required systems not available
        }

        // Determine viewport bounds in world coordinates for optimization
        const camera = this.game.renderer?.camera;
        if (!camera) return;
        const viewWidthWorld = (this.game.renderer.canvas.width / camera.zoom) * 1.5; // Extend bounds slightly
        const viewHeightWorld = (this.game.renderer.canvas.height / camera.zoom) * 1.5;
        const viewBounds = {
            minX: camera.x - viewWidthWorld / 2,
            minY: camera.y - viewHeightWorld / 2,
            maxX: camera.x + viewWidthWorld / 2,
            maxY: camera.y + viewHeightWorld / 2,
        };

        // Get lights within or near the viewport
        // Increase check radius slightly beyond light range to catch shadows cast into view
        const lights = this.game.entities.getLightsInRadius(camera.x, camera.y, Math.max(viewWidthWorld, viewHeightWorld) / 2 + 500);

        // Get potential shadow casters within the viewport
        const potentialCasters = [
            ...this.game.entities.getAll().filter(e => e && e.type !== 'light_source' && e.type !== 'effect'), // Filter entities
            ...this.game.worldObjectManager.getVisibleObjects(viewBounds.minX, viewBounds.minY, viewBounds.maxX, viewBounds.maxY) // Get world objects
        ].filter(caster => caster && this.shouldCastShadow(caster)); // Filter only those that should cast shadows

        // Filter lights to only include point lights for now
        const pointLights = lights.filter(light => light.lightType === 'point' && light.intensity > 0.05 && light.range > 0);

        for (const light of pointLights) {
            // Optimization: Skip lights completely outside the view + their range
            const lightDistSq = (light.x - camera.x)**2 + (light.y - camera.y)**2;
            const maxViewDist = Math.max(viewWidthWorld, viewHeightWorld) / 2;
            if (lightDistSq > (maxViewDist + light.range)**2) {
                continue;
            }

            for (const caster of potentialCasters) {
                // Basic distance check between light and caster
                const dx = light.x - caster.x;
                const dy = light.y - caster.y;
                const distSq = dx * dx + dy * dy;

                // Skip if caster is too far from the light to cast a meaningful shadow within the light's range
                if (distSq > (light.range * 1.5) * (light.range * 1.5)) { // Use 1.5x range buffer
                    continue;
                }

                // Get caster geometry (simplified for now)
                const casterGeometry = this.getCasterGeometry(caster);
                if (!casterGeometry) continue;

                // Calculate the shadow polygon for this light/caster pair
                const shadowPolygon = this.calculatePolygonForCaster(light, casterGeometry);
                if (shadowPolygon) {
                    this.shadowPolygons.push(shadowPolygon);
                }
            }
        }
    }

    /**
     * Determines if an object/entity should cast a shadow.
     * @param {Object} obj - The game object or entity.
     * @returns {boolean} True if the object should cast shadows.
     */
    shouldCastShadow(obj) {
        // Define criteria for shadow casters
        // For now, simple checks: players, vehicles, and world objects marked as collidable
        if (obj.type === 'player' || obj.type === 'vehicle') {
            return true;
        }
        if ((obj.type === 'feature' || obj.type === 'resource') && obj.collides === true) {
            return true;
        }
        return false; // Default to not casting shadows
    }

    /**
     * Gets a simplified geometric representation (vertices) of a caster.
     * @param {Object} caster - The object or entity casting the shadow.
     * @returns {Array<{x: number, y: number}>|null} Array of vertices or null.
     */
    getCasterGeometry(caster) {
        // TODO: Cache geometry based on caster.id if static?
        // For now, approximate as a rectangle based on size.
        const size = caster.size || 20;
        const halfSize = size / 2;
        // Define vertices relative to caster's center (x, y)
        // Note: For simplicity, assumes axis-aligned bounding box. Rotation ignored for now.
        return [
            { x: caster.x - halfSize, y: caster.y - halfSize }, // Top-left
            { x: caster.x + halfSize, y: caster.y - halfSize }, // Top-right
            { x: caster.x + halfSize, y: caster.y + halfSize }, // Bottom-right
            { x: caster.x - halfSize, y: caster.y + halfSize }, // Bottom-left
        ];
    }

    /**
     * Calculates the shadow polygon cast by a specific object from a light source.
     * Placeholder implementation - needs actual geometry/raycasting logic.
     * @param {LightSource} light - The light source.
     * @param {Array<{x: number, y: number}>} casterVertices - Vertices of the caster polygon.
     * @returns {Array<{x: number, y: number}>|null} The vertices of the shadow polygon or null.
     */
    calculatePolygonForCaster(light, casterVertices) {
        // --- Placeholder Implementation ---
        // This needs to be replaced with actual shadow calculation logic (e.g., 2D raycasting)
        // For now, just return a slightly offset version of the caster geometry for testing rendering
        const shadowLength = light.range * 0.5; // Arbitrary shadow length for testing
        const dx = casterVertices[0].x - light.x; // Use first vertex for direction approximation
        const dy = casterVertices[0].y - light.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        const offsetX = nx * shadowLength * 0.1; // Small offset for testing
        const offsetY = ny * shadowLength * 0.1;

        const shadowPolygon = casterVertices.map(v => ({
            x: v.x + offsetX,
            y: v.y + offsetY
        }));

        // Simple extension (VERY basic placeholder) - extend corners away from light
        // This is NOT geometrically correct shadow casting.
        const extendedPolygon = [];
        casterVertices.forEach(vertex => {
            const vecX = vertex.x - light.x;
            const vecY = vertex.y - light.y;
            const len = Math.sqrt(vecX * vecX + vecY * vecY) || 1;
             // Project vertex far away
            extendedPolygon.push({
                x: light.x + (vecX / len) * light.range * 2, // Project far
                y: light.y + (vecY / len) * light.range * 2
            });
        });
         // Combine original vertices and extended points (needs proper ordering/clipping later)
         // This placeholder will likely render incorrectly, just to test polygon drawing.
        return [...casterVertices, ...extendedPolygon.reverse()]; // Placeholder order
        // return null; // Return null until calculation is implemented
    }

    /**
     * Returns the calculated shadow polygons for the current frame.
     * @returns {Array<Array<{x: number, y: number}>>} An array of shadow polygons.
     */
    getShadowPolygons() {
        return this.shadowPolygons;
    }
}
