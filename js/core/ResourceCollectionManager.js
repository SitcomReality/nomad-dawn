/**
 * Manages resource collection logic, extracted from InteractionManager
 * to reduce file size and maintain separation of concerns.
 */
export default class ResourceCollectionManager {
    constructor(game) {
        this.game = game;
    }

    /**
     * Handles the logic for collecting a resource. Updates player inventory,
     * sends network updates for room state (resource removal) and player presence (inventory).
     * @param {Player} player - The player entity collecting the resource.
     * @param {Object} resource - The resource entity being collected.
     */
    collectResource(player, resource) {
        // Double check resource validity
        if (!resource || !resource.id || !resource.resourceType || resource.amount <= 0) {
            this.game.debug.warn(`[ResourceCollectionManager] Attempted to collect invalid resource:`, resource);
            return;
        }
        
        // Double check it's actually active according to world state
        if (!this.game.world.isResourceActive(resource.id)) {
            this.game.debug.log(`[ResourceCollectionManager] Attempted to collect already collected resource: ${resource.id}`);
            return;
        }

        // 1. Add the resource locally
        player.addResource(resource.resourceType, resource.amount);

        // 2. Mark resource as collected in the world object manager
        if (this.game.worldObjectManager) {
            this.game.worldObjectManager.updateResourceOverrides({ [resource.id]: null });
        }

        // 3. Trigger a local visual effect for immediate feedback
        if (this.game.renderer) {
            this.game.renderer.createEffect('collect', resource.x, resource.y, { 
                color: resource.color || '#ffff00' 
            });
        }

        // 4. Show notification
        const resourceConfig = this.game.config?.RESOURCE_TYPES.find(r => r.id === resource.resourceType);
        const resourceName = resourceConfig?.name || resource.resourceType;
        this.game.ui.showNotification(`Collected ${resource.amount} ${resourceName}`, 'success');

        // 5. Local logging
        this.game.debug.log(`Player ${player.id} collected ${resource.amount} ${resource.resourceType} from ${resource.id}`);

        return true;
    }

    /**
     * Finds the closest collectable resource to the player within a given radius
     * @param {Player} player - The player entity 
     * @param {number} radius - Search radius
     * @returns {Object|null} - The closest resource object or null if none found
     */
    findNearestResource(player, radius) {
        if (!player || !this.game.world) return null;
        
        let nearbyResource = null;
        let closestResourceDistSq = radius * radius;

        // Try using WorldObjectManager first for efficiency
        if (this.game.worldObjectManager) {
            const bounds = {
                minX: player.x - radius,
                minY: player.y - radius,
                maxX: player.x + radius,
                maxY: player.y + radius
            };
            
            const visibleObjects = this.game.worldObjectManager.getVisibleObjects(
                bounds.minX, bounds.minY, bounds.maxX, bounds.maxY
            );
            
            for (const obj of visibleObjects) {
                if (obj && obj.type === 'resource') {
                    const dx = obj.x - player.x;
                    const dy = obj.y - player.y;
                    const distanceSq = dx * dx + dy * dy;
                    if (distanceSq < closestResourceDistSq) {
                        closestResourceDistSq = distanceSq;
                        nearbyResource = obj;
                    }
                }
            }
        } else {
            // Fallback to chunk iteration if manager not available
            const chunks = this.game.world.getChunksInRadius(player.x, player.y, radius * 1.5) || [];
            for (const chunk of chunks) {
                if (chunk && chunk.resources) {
                    for (const resource of chunk.resources) {
                        if (resource && this.game.world.isResourceActive(resource.id)) {
                            const dx = resource.x - player.x;
                            const dy = resource.y - player.y;
                            const distanceSq = dx * dx + dy * dy;
                            if (distanceSq < closestResourceDistSq) {
                                closestResourceDistSq = distanceSq;
                                nearbyResource = resource;
                            }
                        }
                    }
                }
            }
        }

        return nearbyResource;
    }
}