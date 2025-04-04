/**
 * Manages the calculation and potentially rendering of shadows cast by light sources.
 */
export default class ShadowManager {
    constructor(game) {
        this.game = game;
        // --- MODIFIED: Store structured shadow data ---
        this.shadowData = []; // Stores { polygon, caster, light } objects
        // --- END MODIFIED ---
        // --- Caster Geometry Cache ---
        this.casterCache = new Map(); // Cache caster geometry to avoid recalculation
        this.cacheInvalidationFrame = 0; // Frame counter to manage cache invalidation
        this.cacheValidFrames = 5; // How many frames a cache entry is valid
        this.debug = false; // Set to true to render debug info for shadows
        this.maxShadowDistance = 1500;
    }

    /**
     * Calculates shadows for all relevant lights and casters in the current view.
     */
    calculateShadows() {
        // --- MODIFIED: Clear structured shadow data ---
        this.shadowData = [];
        // --- END MODIFIED ---
        if (!this.game.lightManager || !this.game.entities || !this.game.worldObjectManager) {
            return; // Required systems not available
        }

        // Increment cache frame counter
        this.cacheInvalidationFrame++;

        const camera = this.game.renderer?.camera;
        if (!camera) return;

        // --- INCREASED VIEW BOUNDS FOR SHADOWS ---
        // Calculate wider bounds than just the viewport to catch shadows cast from outside
        const viewPadding = this.maxShadowDistance * 0.5; // How far outside the view to check
        const viewWidthWorld = (this.game.renderer.canvas.width / camera.zoom);
        const viewHeightWorld = (this.game.renderer.canvas.height / camera.zoom);
        const extendedViewBounds = {
            minX: camera.x - viewWidthWorld / 2 - viewPadding,
            minY: camera.y - viewHeightWorld / 2 - viewPadding,
            maxX: camera.x + viewWidthWorld / 2 + viewPadding,
            maxY: camera.y + viewHeightWorld / 2 + viewPadding,
        };
        const extendedViewRadius = Math.max(extendedViewBounds.maxX - camera.x, extendedViewBounds.maxY - camera.y);

        // Get lights within the extended view radius + max light range
        const lights = this.game.entities.getLightsInRadius(camera.x, camera.y, extendedViewRadius + this.maxShadowDistance);

        // Get potential casters within the extended view bounds
        const potentialCasters = this.getPotentialCasters(extendedViewBounds);

        const pointLights = lights.filter(light => light.lightType === 'point' && light.intensity > 0.05 && light.range > 0);

        for (const light of pointLights) {
             // --- Culling: Skip light if it's too far away to affect the viewport ---
             const lightDistToViewCenterSq = (light.x - camera.x)**2 + (light.y - camera.y)**2;
             const maxRelevantLightDist = extendedViewRadius + light.range;
             if (lightDistToViewCenterSq > maxRelevantLightDist**2) {
                 continue; // Light too far away to cast shadows into the extended view
             }

            for (const caster of potentialCasters) {
                // --- Culling: Basic distance check between light and caster ---
                const dx = light.x - caster.x;
                const dy = light.y - caster.y;
                const lightCasterDistSq = dx * dx + dy * dy;
                // Skip if caster is beyond light range (plus a buffer?)
                const lightRangeSq = light.range * light.range;
                if (lightCasterDistSq > lightRangeSq * 1.1) { // Added 10% buffer
                    continue;
                }

                // --- Culling: Skip caster if it's too far from the view center to cast shadow into view ---
                 const casterDistToViewCenterSq = (caster.x - camera.x)**2 + (caster.y - camera.y)**2;
                 const maxRelevantCasterDist = extendedViewRadius + this.maxShadowDistance; // Max distance caster can be and still cast shadow into view
                 if (casterDistToViewCenterSq > maxRelevantCasterDist**2) {
                     continue;
                 }

                const casterGeometry = this.getCasterGeometry(caster);
                if (!casterGeometry || casterGeometry.length < 3) continue;

                const shadowPolygon = this.calculateShadowPolygonRaycast(light, casterGeometry);
                if (shadowPolygon) {
                    // --- MODIFIED: Store structured data ---
                    this.shadowData.push({ polygon: shadowPolygon, caster: caster, light: light });
                    // --- END MODIFIED ---
                }
            }
        }

        // Periodically clean up very old cache entries if needed
        // if (this.cacheInvalidationFrame % 100 === 0) { this.cleanupCache(); }
    }

    // Helper to get potential casters within specified bounds
    getPotentialCasters(bounds) {
         // Get entities within the bounds
         const entities = this.game.entities.getAll()
             .filter(e => e && e.type !== 'light_source' && e.type !== 'effect' &&
                          e.x >= bounds.minX && e.x <= bounds.maxX &&
                          e.y >= bounds.minY && e.y <= bounds.maxY); // Filter entities by bounds

         // Get world objects within the bounds (already filtered by WorldObjectManager)
         const worldObjs = this.game.worldObjectManager.getVisibleObjects(
             bounds.minX, bounds.minY, bounds.maxX, bounds.maxY
         );

         // Combine and filter by shadow casting criteria
         return [...entities, ...worldObjs]
             .filter(caster => caster && this.shouldCastShadow(caster));
    }

    /**
     * Determines if an object/entity should cast a shadow.
     * @param {Object} obj - The game object or entity.
     * @returns {boolean} True if the object should cast shadows.
     */
    shouldCastShadow(obj) {
        // Players/Vehicles cast shadows only when in Overworld
        if (obj.type === 'player' || obj.type === 'vehicle') {
            if (obj.type === 'player' && obj.playerState !== 'Overworld') return false;
            return true;
        }
        // Features/Resources cast shadows if they collide and are large enough
        if ((obj.type === 'feature' || obj.type === 'resource') && obj.collides === true) {
             if (obj.size && obj.size < 15) return false; // Don't cast shadows for small pebbles etc.
            return true;
        }
        // Other types don't cast shadows by default
        return false;
    }

    /**
     * Gets a simplified geometric representation (vertices) of a caster, using caching.
     * @param {Object} caster - The object or entity casting the shadow.
     * @returns {Array<{x: number, y: number}>|null} Array of vertices or null.
     */
    getCasterGeometry(caster) {
        // Cache Check
        const cacheEntry = this.casterCache.get(caster.id);
        if (cacheEntry && cacheEntry.validUntilFrame >= this.cacheInvalidationFrame) {
             if (Math.abs(caster.x - cacheEntry.x) < 0.1 && Math.abs(caster.y - cacheEntry.y) < 0.1) {
                 return cacheEntry.geometry;
             }
        }

        // If cache miss or invalid, calculate geometry
        const size = caster.size || 20;
        const halfSize = size / 2;
        // --- Simplification: Use Axis-Aligned Bounding Box (AABB) for now ---
        // Rotation could be added here later if needed
        const geometry = [
            { x: caster.x - halfSize, y: caster.y - halfSize }, // Top-left
            { x: caster.x + halfSize, y: caster.y - halfSize }, // Top-right
            { x: caster.x + halfSize, y: caster.y + halfSize }, // Bottom-right
            { x: caster.x - halfSize, y: caster.y + halfSize }, // Bottom-left
        ];

        // Update Cache
        this.casterCache.set(caster.id, {
             geometry: geometry,
             validUntilFrame: this.cacheInvalidationFrame + this.cacheValidFrames,
             x: caster.x,
             y: caster.y
        });

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
        if (!casterVertices || casterVertices.length < 3) return null;

        const lightPos = { x: light.x, y: light.y };
        const maxDist = this.maxShadowDistance; // Use configured max shadow distance
        const silhouetteEdges = []; // Stores { v1: vertex, v2: vertex }

        // 1. Find silhouette edges (edges facing the light)
        for (let i = 0; i < casterVertices.length; i++) {
            const v1 = casterVertices[i];
            const v2 = casterVertices[(i + 1) % casterVertices.length]; // Next vertex, wraps around

            const edgeVecX = v2.x - v1.x;
            const edgeVecY = v2.y - v1.y;
            const midX = (v1.x + v2.x) / 2;
            const midY = (v1.y + v2.y) / 2;
            const normalX = edgeVecY;
            const normalY = -edgeVecX;
            const lightToMidX = midX - lightPos.x;
            const lightToMidY = midY - lightPos.y;
            const dotProduct = normalX * lightToMidX + normalY * lightToMidY;
            const epsilon = 1e-6;
            if (dotProduct > epsilon) {
                silhouetteEdges.push({ v1: v1, v2: v2, index: i });
            }
        }

        if (silhouetteEdges.length === 0 || silhouetteEdges.length === casterVertices.length) {
            return null; // Light inside or exactly behind caster
        }

        // 2. Identify the start and end vertices of the silhouette chain
        // This part assumes the silhouette forms a contiguous chain, which is true for convex casters
        let silhouetteStartVertex = null;
        let silhouetteEndVertex = null;
        // Find an edge whose previous edge is NOT in the silhouette list - its v1 is the start
         for (const edge of silhouetteEdges) {
             const prevEdgeIndex = (edge.index - 1 + casterVertices.length) % casterVertices.length;
             if (!silhouetteEdges.some(e => e.index === prevEdgeIndex)) {
                  silhouetteStartVertex = edge.v1;
                  break;
             }
         }
         // Find an edge whose next edge is NOT in the silhouette list - its v2 is the end
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
             // Check for zero vector (light is exactly at the vertex)
             if (dx === 0 && dy === 0) {
                 // Handle this case: maybe return the vertex itself or offset slightly?
                 // Returning vertex itself might cause issues. Let's offset slightly.
                 const smallOffset = 0.01;
                 return { x: vertex.x + smallOffset, y: vertex.y + smallOffset };
             }
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Ensure scale is finite even if dist is very small
             const scale = dist < 1e-6 ? maxDist / 1e-6 : maxDist / dist;
            return {
                x: lightPos.x + dx * scale,
                y: lightPos.y + dy * scale
            };
        };

        const projectedStart = projectRay(silhouetteStartVertex);
        const projectedEnd = projectRay(silhouetteEndVertex);

        // 4. Construct the final shadow polygon vertices in order
        const finalPolygon = [
            { x: silhouetteStartVertex.x, y: silhouetteStartVertex.y },
            { x: projectedStart.x, y: projectedStart.y },
            { x: projectedEnd.x, y: projectedEnd.y },
            { x: silhouetteEndVertex.x, y: silhouetteEndVertex.y }
        ];

        return finalPolygon;
    }

    /**
     * Returns the calculated shadow data for the current frame.
     * @returns {Array<{polygon: Array<{x: number, y: number}>, caster: Object, light: LightSource}>} An array of shadow data objects.
     */
    getShadowData() {
        // --- MODIFIED: Return structured shadow data ---
        return this.shadowData;
        // --- END MODIFIED ---
    }

     // Optional cache cleanup
     cleanupCache() {
         const currentFrame = this.cacheInvalidationFrame;
         const entriesToDelete = [];
         for (const [id, entry] of this.casterCache.entries()) {
             if (entry.validUntilFrame < currentFrame - (this.cacheValidFrames * 5)) {
                 entriesToDelete.push(id);
             }
         }
         entriesToDelete.forEach(id => this.casterCache.delete(id));
          if (entriesToDelete.length > 0 && this.debug) {
              console.log(`Cleaned up ${entriesToDelete.length} old shadow caster cache entries.`);
          }
     }
}