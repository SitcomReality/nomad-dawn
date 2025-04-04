/**
 * Manages the calculation and potentially rendering of shadows cast by light sources.
 */
export default class ShadowManager {
    constructor(game) {
        this.game = game;
        this.shadowPolygons = []; // Stores calculated shadow polygons for the current frame
        // --- NEW: Caster Geometry Cache ---
        this.casterCache = new Map(); // Cache caster geometry to avoid recalculation
        this.cacheInvalidationFrame = 0; // Frame counter to manage cache invalidation
        this.cacheValidFrames = 5; // How many frames a cache entry is valid
        // --- END NEW ---
        this.debug = false; // Set to true to render debug info for shadows
        this.maxShadowDistance = 1500;
    }

    /**
     * Calculates shadows for all relevant lights and casters in the current view.
     */
    calculateShadows() {
        this.shadowPolygons = [];
        if (!this.game.lightManager || !this.game.entities || !this.game.worldObjectManager) {
            return; // Required systems not available
        }

        // --- NEW: Increment cache frame counter ---
        this.cacheInvalidationFrame++;
        // --- END NEW ---

        const camera = this.game.renderer?.camera;
        if (!camera) return;
        const viewWidthWorld = (this.game.renderer.canvas.width / camera.zoom) * 1.5;
        const viewHeightWorld = (this.game.renderer.canvas.height / camera.zoom) * 1.5;
        const viewBounds = {
            minX: camera.x - viewWidthWorld / 2,
            minY: camera.y - viewHeightWorld / 2,
            maxX: camera.x + viewWidthWorld / 2,
            maxY: camera.y + viewHeightWorld / 2,
        };

        const lights = this.game.entities.getLightsInRadius(camera.x, camera.y, Math.max(viewWidthWorld, viewHeightWorld) / 2 + 500);

        // --- Optimization: Get potential casters ONCE ---
        const potentialCasters = this.getPotentialCasters(viewBounds);
        // --- END Optimization ---

        const pointLights = lights.filter(light => light.lightType === 'point' && light.intensity > 0.05 && light.range > 0);

        for (const light of pointLights) {
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
                if (distSq > (light.range * 1.5) * (light.range * 1.5)) {
                    continue;
                }

                // --- UPDATED: Use getCasterGeometry with caching ---
                const casterGeometry = this.getCasterGeometry(caster);
                // --- END UPDATED ---

                if (!casterGeometry || casterGeometry.length < 3) continue;

                const shadowPolygon = this.calculateShadowPolygonRaycast(light, casterGeometry);
                if (shadowPolygon) {
                    this.shadowPolygons.push(shadowPolygon);
                }
            }
        }

        // --- NEW: Optional cache cleanup ---
        // Periodically clean up very old cache entries if needed
        // if (this.cacheInvalidationFrame % 100 === 0) { this.cleanupCache(); }
        // --- END NEW ---
    }

    // --- NEW: Helper to get potential casters ---
    getPotentialCasters(viewBounds) {
         // Get potential shadow casters within the viewport
         const entities = this.game.entities.getAll()
             .filter(e => e && e.type !== 'light_source' && e.type !== 'effect'); // Filter entities
         const worldObjs = this.game.worldObjectManager.getVisibleObjects(
             viewBounds.minX, viewBounds.minY, viewBounds.maxX, viewBounds.maxY
         );

         return [...entities, ...worldObjs]
             .filter(caster => caster && this.shouldCastShadow(caster)); // Filter only those that should cast shadows
    }
    // --- END NEW ---

    /**
     * Determines if an object/entity should cast a shadow.
     * @param {Object} obj - The game object or entity.
     * @returns {boolean} True if the object should cast shadows.
     */
    shouldCastShadow(obj) {
        // ... existing shouldCastShadow logic ...
        if (obj.type === 'player' || obj.type === 'vehicle') {
            // Add check for player state (don't cast shadows when inside?)
            if (obj.type === 'player' && obj.playerState !== 'Overworld') return false;
            return true;
        }
        if ((obj.type === 'feature' || obj.type === 'resource') && obj.collides === true) {
             if (obj.size && obj.size < 15) return false;
            return true;
        }
        return false;
    }

    /**
     * Gets a simplified geometric representation (vertices) of a caster, using caching.
     * @param {Object} caster - The object or entity casting the shadow.
     * @returns {Array<{x: number, y: number}>|null} Array of vertices or null.
     */
    getCasterGeometry(caster) {
        // --- NEW: Cache Check ---
        const cacheEntry = this.casterCache.get(caster.id);
        // Check if cache exists and is still valid (based on frame counter)
        if (cacheEntry && cacheEntry.validUntilFrame >= this.cacheInvalidationFrame) {
             // Return cached geometry if position hasn't changed significantly (simple check)
             // More robust check might involve comparing caster.x/y with cacheEntry.x/y
             if (Math.abs(caster.x - cacheEntry.x) < 0.1 && Math.abs(caster.y - cacheEntry.y) < 0.1) {
                 return cacheEntry.geometry;
             }
        }
        // --- END NEW ---

        // If cache miss or invalid, calculate geometry
        const size = caster.size || 20;
        const halfSize = size / 2;
        const geometry = [
            { x: caster.x - halfSize, y: caster.y - halfSize }, // Top-left
            { x: caster.x + halfSize, y: caster.y - halfSize }, // Top-right
            { x: caster.x + halfSize, y: caster.y + halfSize }, // Bottom-right
            { x: caster.x - halfSize, y: caster.y + halfSize }, // Bottom-left
        ];

        // --- NEW: Update Cache ---
        this.casterCache.set(caster.id, {
             geometry: geometry,
             validUntilFrame: this.cacheInvalidationFrame + this.cacheValidFrames,
             x: caster.x, // Store position for change detection
             y: caster.y
        });
        // --- END NEW ---

        return geometry;
    }

    /**
     * Calculates the shadow polygon using 2D Raycasting, finding silhouette edges.
     * Currently assumes casterVertices represent a convex polygon (like a rectangle).
     * @param {LightSource} light - The light source.
     * @param {Array<{x: number, y: number}>} casterVertices - Vertices of the caster polygon (ordered, e.g., clockwise).
     * @returns {Array<{x: number, y: number}>|null} The vertices of the shadow polygon or null.
     */
    calculateShadowPolygonRaycast(light, casterVertices) {
        // ... existing calculateShadowPolygonRaycast logic ...
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
            // Add a small epsilon to handle light exactly on an edge extension?
            const epsilon = 1e-6;
            if (dotProduct > epsilon) {
                silhouetteEdges.push({ v1: v1, v2: v2, index: i });
            }
        }

        // Handle cases where no edges face the light (light inside caster? should not happen with check)
        // or all edges face the light (should also not happen for convex)
        if (silhouetteEdges.length === 0 || silhouetteEdges.length === casterVertices.length) {
            return null;
        }

        // 2. Identify the start and end vertices of the silhouette chain
        let silhouetteStartVertex = null;
        let silhouetteEndVertex = null;
        for (const edge of silhouetteEdges) {
             const prevEdgeIndex = (edge.index - 1 + casterVertices.length) % casterVertices.length;
             if (!silhouetteEdges.some(e => e.index === prevEdgeIndex)) {
                  silhouetteStartVertex = edge.v1;
                  break;
             }
        }
         for (const edge of silhouetteEdges) {
             const nextEdgeIndex = (edge.index + 1) % casterVertices.length;
              if (!silhouetteEdges.some(e => e.index === nextEdgeIndex)) {
                  silhouetteEndVertex = edge.v2;
                  break;
              }
         }

        if (!silhouetteStartVertex || !silhouetteEndVertex) {
             if (this.debug) console.warn("Could not determine silhouette start/end vertices.", silhouetteEdges);
             return null;
        }


        // 3. Project rays from the light through the silhouette start and end vertices
        const projectRay = (vertex) => {
            const dx = vertex.x - lightPos.x;
            const dy = vertex.y - lightPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
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

        return finalPolygon;
    }

    /**
     * Returns the calculated shadow polygons for the current frame.
     * @returns {Array<Array<{x: number, y: number}>>} An array of shadow polygons.
     */
    getShadowPolygons() {
        return this.shadowPolygons;
    }

     // --- NEW: Optional cache cleanup ---
     cleanupCache() {
         const currentFrame = this.cacheInvalidationFrame;
         const entriesToDelete = [];
         for (const [id, entry] of this.casterCache.entries()) {
             // Delete if significantly older than valid frames (e.g., > 5x validity period)
             if (entry.validUntilFrame < currentFrame - (this.cacheValidFrames * 5)) {
                 entriesToDelete.push(id);
             }
         }
         entriesToDelete.forEach(id => this.casterCache.delete(id));
          if (entriesToDelete.length > 0 && this.debug) {
              console.log(`Cleaned up ${entriesToDelete.length} old shadow caster cache entries.`);
          }
     }
     // --- END NEW ---
}