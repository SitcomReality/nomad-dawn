// New file: js/core/CollisionManager.js
export default class CollisionManager {
    constructor(game) {
        this.game = game;
    }

    // Moved from Game.js
    checkCollisions() {
        // More optimized collision checks needed for many entities.
        // Consider spatial partitioning (e.g., Quadtree or Grid) later.

        // Only get entities that can collide (player, vehicles) for the outer loop
        // Ensure entities and world exist before proceeding
        if (!this.game.entities || !this.game.world) return;

        const colliders = this.game.entities.getAll().filter(e => 
             e && 
             e.collidesWith && typeof e.collidesWith === 'function' && // Check if method exists
             e.onCollision && typeof e.onCollision === 'function' && // Check if method exists
             (e.type === 'player' || e.type === 'vehicle') &&
             e.playerState !== 'Interior' // --- NEW: Don't check collisions for entities inside ---
        );

        if (colliders.length === 0) return;

        // Get all potentially collidable objects (other players, vehicles, world objects) once
        const potentialTargets = this.game.entities.getAll().filter(e => e && e.playerState !== 'Interior'); // Filter out null/undefined and interior entities
        let worldObjects = [];

        // Check if world and player/collider exist to define search area
        const searchCenter = this.game.player || colliders[0]; // Use player or first collider as center
        if (searchCenter) {
            const checkRadius = (searchCenter.radius || searchCenter.size / 2 || 20) + 100; // Use radius + buffer
             // --- Use WorldObjectManager for potentially faster lookups ---
             const bounds = {
                 minX: searchCenter.x - checkRadius,
                 minY: searchCenter.y - checkRadius,
                 maxX: searchCenter.x + checkRadius,
                 maxY: searchCenter.y + checkRadius
             };
             if (this.game.worldObjectManager) {
                worldObjects = this.game.worldObjectManager.getVisibleObjects(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                                    .filter(obj => obj && obj.collides === true); // Only get collidable objects
             } else {
                // Fallback to chunk iteration if manager not available
                 const nearbyChunks = this.game.world.getChunksInRadius(searchCenter.x, searchCenter.y, checkRadius);
                 nearbyChunks.forEach(chunk => {
                     if (chunk && chunk.features) worldObjects = worldObjects.concat(chunk.features.filter(f => f && f.collides));
                     if (chunk && chunk.resources) worldObjects = worldObjects.concat(chunk.resources.filter(r => r && r.collides));
                 });
             }
        }

        const allTargets = [...potentialTargets, ...worldObjects];

        for (let i = 0; i < colliders.length; i++) {
            const entityA = colliders[i];
            if (!entityA) continue; // Safety check

            // Check against other entities and world objects
            for (let j = 0; j < allTargets.length; j++) {
                 const entityB = allTargets[j];

                 // Skip self-collision and check if B is valid and collidable
                 if (!entityB || entityA === entityB) continue;

                 // Skip if B doesn't have collision properties (rough check)
                  // Use optional chaining for safety
                 if (entityB?.collides === false) continue;

                 // --- Refined Collision Logic ---
                 if (this.broadPhaseCheck(entityA, entityB)) {
                     // More precise check (use entity method if available, otherwise simple circle)
                     let collision = false;
                     if (typeof entityA.collidesWith === 'function') {
                          // Check if B is a world object or another entity
                          const isWorldObjectB = !entityB.collidesWith; // Assuming world objects lack this method
                          collision = entityA.collidesWith(entityB, isWorldObjectB); // Pass flag if needed
                          // If collidesWith doesn't exist on A, this won't run (as per filter above)
                     }
                     // Fallback removed as colliders filter ensures collidesWith exists

                     if (collision) {
                          // --- Call onCollision ---
                         if (typeof entityA.onCollision === 'function') {
                             entityA.onCollision(entityB); // A reacts to B
                         }
                         // If B is also an entity with an onCollision method, let it react in its own loop iteration
                         // This prevents double collision handling in one frame check.
                         // if (entityB.onCollision && typeof entityB.onCollision === 'function') {
                         //     entityB.onCollision(entityA); // B reacts to A
                         // }
                     }
                 }
            }
        }
    }

    // Moved from Game.js
     // Simple broad-phase check (Axis-Aligned Bounding Box)
     broadPhaseCheck(entityA, entityB) {
         const radiusA = (entityA.radius || entityA.size / 2 || 0);
         const radiusB = (entityB.radius || entityB.size / 2 || 0);
         if (radiusA === 0 || radiusB === 0) return false; // Cannot check if radius is zero
         const dx = Math.abs(entityA.x - entityB.x);
         const dy = Math.abs(entityA.y - entityB.y);
         // Add a small buffer maybe?
         const buffer = 1;
         return dx < radiusA + radiusB + buffer && dy < radiusA + radiusB + buffer;
     }

    // Moved from Game.js - No longer needed here as collidesWith handles it
     // Simple circle collision check (used for entity vs world object)
     // simpleCircleCollision(entity, obj) { ... } // REMOVED
}
