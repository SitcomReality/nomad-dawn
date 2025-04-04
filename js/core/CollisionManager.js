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

        const colliders = this.game.entities.getAll().filter(e => e && e.collidesWith && e.onCollision && (e.type === 'player' || e.type === 'vehicle'));

        if (colliders.length === 0) return;

        // Get all potentially collidable objects (other players, vehicles, world objects) once
        const potentialTargets = this.game.entities.getAll().filter(e => e); // Filter out null/undefined
        let worldObjects = [];
        
        // Check if world and player/collider exist to define search area
        const searchCenter = this.game.player || colliders[0]; // Use player or first collider as center
        if (searchCenter) {
            const checkRadius = (searchCenter.radius || searchCenter.size / 2 || 20) + 100; // Use radius + buffer
             const nearbyChunks = this.game.world.getChunksInRadius(searchCenter.x, searchCenter.y, checkRadius);
             nearbyChunks.forEach(chunk => {
                 if (chunk && chunk.features) worldObjects = worldObjects.concat(chunk.features.filter(f => f && f.collides));
                 if (chunk && chunk.resources) worldObjects = worldObjects.concat(chunk.resources.filter(r => r && r.collides));
             });
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
                 if (entityB.collides === false || (entityB.type !== 'player' && entityB.type !== 'vehicle' && !entityB.collides)) continue;

                 if (this.broadPhaseCheck(entityA, entityB)) {
                     // More precise check (use simple for world objects, entity method otherwise)
                     let collision = false;
                      if (entityB.collidesWith) { // B is an entity with a method
                          collision = entityA.collidesWith(entityB);
                      } else if (entityB.collides) { // B is likely a world object
                          collision = this.simpleCircleCollision(entityA, entityB);
                      }

                     if (collision) {
                         if (entityA.onCollision) entityA.onCollision(entityB); // A reacts to B
                         if (entityB.onCollision) { // If B is an entity, it reacts too
                             entityB.onCollision(entityA);
                         }
                         // Debug log for collision event
                         // this.game.debug.log(`Collision detected: ${entityA.type} (${entityA.id}) <-> ${entityB.type} (${entityB.id || 'world_obj'})`);
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

    // Moved from Game.js
     // Simple circle collision check (used for entity vs world object)
     simpleCircleCollision(entity, obj) {
         const radiusA = (entity.radius || entity.size / 2 || 0);
         const radiusB = (obj.radius || obj.size / 2 || 0); // Assume size property for world objects
         if (radiusA === 0 || radiusB === 0) return false; // Cannot check if radius is missing

         const dx = entity.x - obj.x;
         const dy = entity.y - obj.y;
         const distanceSq = dx * dx + dy * dy;
         const radiiSumSq = (radiusA + radiusB) * (radiusA + radiusB);
         return distanceSq < radiiSumSq;
     }
}