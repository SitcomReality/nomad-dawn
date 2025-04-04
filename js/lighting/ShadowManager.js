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
                const shadowPolygon = this.calculateShadowPolygonRaycast(light, casterGeometry);
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
     * Calculates the shadow polygon using 2D Raycasting, finding silhouette edges.
     * Currently assumes casterVertices represent a convex polygon (like a rectangle).
     * @param {LightSource} light - The light source.
     * @param {Array<{x: number, y: number}>} casterVertices - Vertices of the caster polygon (ordered, e.g., clockwise).
     * @returns {Array<{x: number, y: number}>|null} The vertices of the shadow polygon or null.
     */
    calculateShadowPolygonRaycast(light, casterVertices) {
        if (!casterVertices || casterVertices.length < 3) return null;

        const lightPos = { x: light.x, y: light.y };
        const maxDist = this.maxShadowDistance;
        const silhouetteEdges = []; // Stores { v1: vertex, v2: vertex }

        // 1. Find silhouette edges (edges facing the light)
        for (let i = 0; i < casterVertices.length; i++) {
            const v1 = casterVertices[i];
            const v2 = casterVertices[(i + 1) % casterVertices.length]; // Next vertex, wraps around

            // Calculate edge vector and midpoint
            const edgeVecX = v2.x - v1.x;
            const edgeVecY = v2.y - v1.y;
            const midX = (v1.x + v2.x) / 2;
            const midY = (v1.y + v2.y) / 2;

            // Calculate edge normal (pointing outwards for clockwise vertices)
            const normalX = edgeVecY;
            const normalY = -edgeVecX;

            // Calculate vector from light to edge midpoint
            const lightToMidX = midX - lightPos.x;
            const lightToMidY = midY - lightPos.y;

            // Calculate dot product of normal and light vector
            const dotProduct = normalX * lightToMidX + normalY * lightToMidY;

            // If dot product > 0, the edge is facing the light (part of the silhouette)
            if (dotProduct > 0) {
                silhouetteEdges.push({ v1: v1, v2: v2, index: i });
            }
        }

        // Handle cases where no edges face the light (light inside caster? should not happen with check)
        // or all edges face the light (should also not happen for convex)
        if (silhouetteEdges.length === 0 || silhouetteEdges.length === casterVertices.length) {
             // This might happen if the light is very close or inside the caster bounds
             // For simplicity, return null, though a more robust solution might be needed
            return null;
        }

        // 2. Identify the start and end vertices of the silhouette chain
        // Find the edge where the next edge in the original polygon is *not* a silhouette edge.
        // Find the edge where the previous edge in the original polygon is *not* a silhouette edge.
        // This logic assumes a single contiguous silhouette chain, valid for convex polygons.

        let silhouetteStartVertex = null;
        let silhouetteEndVertex = null;

        // Find the start vertex (v1 of the first edge whose *previous* edge is not silhouette)
        for (const edge of silhouetteEdges) {
             const prevEdgeIndex = (edge.index - 1 + casterVertices.length) % casterVertices.length;
             if (!silhouetteEdges.some(e => e.index === prevEdgeIndex)) {
                  silhouetteStartVertex = edge.v1;
                  break;
             }
        }
         // Find the end vertex (v2 of the last edge whose *next* edge is not silhouette)
         for (const edge of silhouetteEdges) {
             const nextEdgeIndex = (edge.index + 1) % casterVertices.length;
              if (!silhouetteEdges.some(e => e.index === nextEdgeIndex)) {
                  silhouetteEndVertex = edge.v2;
                  break;
              }
         }


        if (!silhouetteStartVertex || !silhouetteEndVertex) {
            // Fallback or error handling if silhouette ends cannot be determined
            // This might indicate issues with vertex order or the light position.
             if (this.debug) console.warn("Could not determine silhouette start/end vertices.", silhouetteEdges);
             return null;
        }


        // 3. Project rays from the light through the silhouette start and end vertices
        const projectRay = (vertex) => {
            const dx = vertex.x - lightPos.x;
            const dy = vertex.y - lightPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            // Project slightly further than maxDist to ensure clipping works
            const scale = (maxDist + 1) / dist;
            return {
                x: lightPos.x + dx * scale,
                y: lightPos.y + dy * scale
            };
        };

        const projectedStart = projectRay(silhouetteStartVertex);
        const projectedEnd = projectRay(silhouetteEndVertex);

        // 4. Construct the final shadow polygon vertices in order
        // Order: silhouette start -> projected start -> projected end -> silhouette end
        const finalPolygon = [
            { x: silhouetteStartVertex.x, y: silhouetteStartVertex.y },
            { x: projectedStart.x, y: projectedStart.y },
            { x: projectedEnd.x, y: projectedEnd.y },
            { x: silhouetteEndVertex.x, y: silhouetteEndVertex.y }
        ];

        // TODO: Clipping against light range could be added here if needed.
        // For now, we rely on the maxShadowDistance projection.

        return finalPolygon;
    }

    /**
     * Returns the calculated shadow polygons for the current frame.
     * @returns {Array<Array<{x: number, y: number}>>} An array of shadow polygons.
     */
    getShadowPolygons() {
        return this.shadowPolygons;
    }
}