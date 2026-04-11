export default class EntityManager {
    constructor(game) {
        this.game = game;
        this.entities = {};
        this.playerEntities = {};
        this.lightSources = {};
    }

    add(entity) {
        if (!entity || !entity.id) {
             const logger = this.game?.debug || console;
             logger.error("[EntityManager] Attempted to add invalid entity:", entity);
             return null;
        }
        if (this.entities[entity.id]) {
            const logger = this.game?.debug || console;
             logger.log(`[EntityManager] Entity with ID ${entity.id} already exists. Overwriting.`);
        }
        // Use a single collection for core entity management
        this.entities[entity.id] = entity;

        // Maintain specific maps for faster lookups by type/ID
        if (entity.type === 'player') {
            this.playerEntities[entity.id] = entity;
        } else if (entity.type === 'light_source') { // Handle light sources
            this.lightSources[entity.id] = entity;
        }

        // Log adding vehicles or lights specifically
        if (entity.type === 'vehicle' || entity.type === 'light_source') { // Modified log condition
             const logger = this.game?.debug || console;
             logger.log(`[EntityManager] Added ${entity.type} entity: ${entity.id}`, entity);
        }

        return entity;
    }

    remove(entityId) {
        const entity = this.entities[entityId];
        if (entity) {
            // --- NEW: Clean up owned lights ---
            if (entity.type === 'player' || entity.type === 'vehicle') {
                this.removeOwnedLights(entityId);
            }
            // --- END NEW ---

            // Log removing vehicles or lights specifically
             if (entity.type === 'vehicle' || entity.type === 'light_source') { // Modified log condition
                 const logger = this.game?.debug || console;
                 logger.log(`[EntityManager] Removing ${entity.type} entity: ${entityId}`);
             }
            // Clean up specific maps
            if (entity.type === 'player') {
                delete this.playerEntities[entityId];
            } else if (entity.type === 'light_source') { // Handle light sources
                 delete this.lightSources[entityId];
            }
            // Remove from the main collection
            delete this.entities[entityId];
            return true;
        }
        return false;
    }

    removeOwnedLights(ownerId) {
        const lightsToRemove = [];
        for (const lightId in this.lightSources) {
            if (this.lightSources[lightId]?.ownerId === ownerId) {
                lightsToRemove.push(lightId);
            }
        }
        if (lightsToRemove.length > 0) {
             const logger = this.game?.debug || console;
             logger.log(`[EntityManager] Removing ${lightsToRemove.length} light(s) owned by entity ${ownerId}`);
             lightsToRemove.forEach(lightId => {
                // Use the main remove method to ensure proper cleanup
                this.remove(lightId);
             });
        }
    }

    get(entityId) {
        return this.entities[entityId] || null;
    }

    getAll() {
        return Object.values(this.entities);
    }

    getByType(type) {
        return Object.values(this.entities).filter(entity => entity && entity.type === type); // Add check for entity validity
    }

    getPlayersInRadius(x, y, radius) {
        const radiusSq = radius * radius;
        return Object.values(this.playerEntities).filter(player => {
            if (!player) return false; // Safety check
            const dx = player.x - x;
            const dy = player.y - y;
            return (dx * dx + dy * dy) <= radiusSq;
        });
    }

    getLightsInRadius(x, y, radius) {
        const radiusSq = radius * radius;
        const nearbyLights = [];
        for (const lightId in this.lightSources) {
             const light = this.lightSources[lightId];
             if (!light) continue; // Safety check

             const dx = light.x - x;
             const dy = light.y - y;
             if ((dx * dx + dy * dy) <= radiusSq) {
                 nearbyLights.push(light);
             }
        }
        return nearbyLights;
    }

    update(deltaTime) {
        for (const entityId in this.entities) {
            const entity = this.entities[entityId];
             if (!entity) continue;

             // Special handling for light sources if they have owners
             if (entity.type === 'light_source' && entity.ownerId) {
                 if (entity.update && typeof entity.update === 'function') {
                      entity.update(deltaTime, this.game); // Pass game instance
                 }
             } else if (entity.update && typeof entity.update === 'function') {
                // Standard update for other entities
                entity.update(deltaTime);
             }
        }
    }

    count() {
        return Object.keys(this.entities).length;
    }

    clear() {
        this.entities = {};
        this.playerEntities = {};
        this.lightSources = {};
    }
}