/**
 * Manages the calculation and potentially rendering of shadows cast by light sources.
 */
export default class ShadowManager {
    constructor(game) {
        this.game = game;
        this.shadowPolygons = []; // Stores calculated shadow polygons for the current frame
        this.casterCache = new Map(); // Cache caster geometry to avoid recalculation
        this.debug = false; // Set to true to render debug info for shadows
        // Define a maximum distance for shadow rays to prevent infinite polygons
        this.maxShadowDistance = 1500; // Can be adjusted, perhaps based on light range later
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
                if (!casterGeometry || casterGeometry.length < 3) continue;

                // Calculate the shadow polygon for this light/caster pair
                // --- UPDATED: Call the implemented raycasting function ---
                const shadowPolygon = this.calculateShadowPolygonRaycast(light, casterGeometry);
                // --- END UPDATED ---
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
             // Exclude very small objects?
             if (obj.size && obj.size < 15) return false;
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
     * Calculates the shadow polygon using 2D Raycasting.
     * @param {LightSource} light - The light source.
     * @param {Array<{x: number, y: number}>} casterVertices - Vertices of the caster polygon (ordered clockwise or counter-clockwise).
     * @returns {Array<{x: number, y: number}>|null} The vertices of the shadow polygon or null.
     */
    calculateShadowPolygonRaycast(light, casterVertices) {
        if (!casterVertices || casterVertices.length < 3) return null;

        const lightPos = { x: light.x, y: light.y };
        const maxDist = this.maxShadowDistance; // Use the defined max distance
        const shadowPoints = [];

        // 1. Cast rays from the light through each vertex of the caster
        for (let i = 0; i < casterVertices.length; i++) {
            const vertex = casterVertices[i];
            const dx = vertex.x - lightPos.x;
            const dy = vertex.y - lightPos.y;

            // Project the ray to the maximum shadow distance
            const rayEndX = lightPos.x + dx * (maxDist / (Math.sqrt(dx * dx + dy * dy) || 1));
            const rayEndY = lightPos.y + dy * (maxDist / (Math.sqrt(dx * dx + dy * dy) || 1));

            shadowPoints.push({ x: rayEndX, y: rayEndY, angle: Math.atan2(dy, dx) });

            // Add rotated points slightly around each vertex ray to handle edges
            // This helps close gaps when vertices are collinear from the light's perspective
            const angle = Math.atan2(dy, dx);
            const smallAngleOffset = 0.0001; // Tiny angle offset

            // Point slightly counter-clockwise
            const dxCCW = Math.cos(angle - smallAngleOffset);
            const dyCCW = Math.sin(angle - smallAngleOffset);
            shadowPoints.push({
                x: lightPos.x + dxCCW * maxDist,
                y: lightPos.y + dyCCW * maxDist,
                angle: angle - smallAngleOffset
            });

            // Point slightly clockwise
            const dxCW = Math.cos(angle + smallAngleOffset);
            const dyCW = Math.sin(angle + smallAngleOffset);
            shadowPoints.push({
                x: lightPos.x + dxCW * maxDist,
                y: lightPos.y + dyCW * maxDist,
                angle: angle + smallAngleOffset
            });
        }

        // 2. Sort the projected points by angle around the light source
        shadowPoints.sort((a, b) => a.angle - b.angle);

        // 3. Construct the final shadow polygon
        // The final polygon consists of a subset of the caster's vertices (the "outer edge")
        // and the projected points corresponding to those vertices.
        // This requires finding the silhouette edges, which is complex.
        // --- Simplified Approach (Approximation): ---
        // For now, use all sorted projected points. This creates a large polygon encompassing
        // the shadow area but isn't perfectly accurate at the caster boundary.
        // A more robust method involves segment intersection tests or finding silhouette edges.
        const finalPolygon = [];
        for(const p of shadowPoints) {
             finalPolygon.push({x: p.x, y: p.y});
        }


        // This simplified approach generates a large covering polygon.
        // More advanced steps (clipping, silhouette finding) are needed for accuracy.
        return finalPolygon.length >= 3 ? finalPolygon : null;
    }

    /**
     * Returns the calculated shadow polygons for the current frame.
     * @returns {Array<Array<{x: number, y: number}>>} An array of shadow polygons.
     */
    getShadowPolygons() {
        return this.shadowPolygons;
    }
}