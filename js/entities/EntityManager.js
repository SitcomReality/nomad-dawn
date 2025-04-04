export default class EntityManager {
    constructor() {
        this.entities = {};
        this.playerEntities = {}; // Maps clientId to player entity
        this.lightSources = {}; // Track light sources separately
    }

    add(entity) {
        if (!entity || !entity.id) {
             const logger = window.game?.debug || console;
             logger.error("[EntityManager] Attempted to add invalid entity:", entity);
             return null;
        }
        if (this.entities[entity.id]) {
            const logger = window.game?.debug || console;
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
             const logger = window.game?.debug || console;
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
                 const logger = window.game?.debug || console;
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
             const logger = window.game?.debug || console;
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
                      entity.update(deltaTime, window.game); // Pass game instance
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
        this.lightSources = {}; // Clear lights too
    }

    syncFromNetworkPresence(presenceData, localPlayerId) {
        const presentIds = new Set(Object.keys(presenceData));

        // Process network presence data to update or create entities
        for (const clientId in presenceData) {
            // Skip self and null/undefined data entries
            if (clientId === localPlayerId || !presenceData[clientId]) {
                presentIds.delete(clientId); // Remove self from list of present IDs
                continue;
            }

            const data = presenceData[clientId];
            let entity = this.playerEntities[clientId]; // Use specific map for players
            const peerInfo = (window.room && window.room.peers) ? window.room.peers[clientId] : null; // Get peer info once

            if (!entity) {
                // Create new remote player entity if it doesn't exist
                 const Player = window.Player; // Ensure Player class is accessible
                 if (!Player) {
                    console.error("Player class not globally accessible in EntityManager");
                    continue;
                 }
                 entity = new Player(clientId, window.game);

                // Set initial properties from network data and peer info
                 entity.name = peerInfo ? peerInfo.username : `Player ${clientId.substring(0, 4)}`;
                 entity.x = data.x ?? 0;
                 entity.y = data.y ?? 0;
                 entity.angle = data.angle ?? 0;
                 entity.speed = data.speed ?? 0;
                 entity.size = data.size ?? entity.size; // Use default from Player class if not provided
                 entity.health = data.health ?? entity.maxHealth; // Use default maxHealth if health missing
                 entity.maxHealth = data.maxHealth ?? entity.maxHealth;
                 entity.resources = data.resources || {}; // Use default from Player class if not provided
                 // entity.vehicleId = data.vehicleId ?? null; // This seems deprecated by playerState
                 entity.color = '#5af'; // Remote player color override

                 // Sync interior state
                 entity.playerState = data.playerState ?? 'Overworld';
                 entity.currentVehicleId = data.currentVehicleId ?? null;
                 entity.gridX = data.gridX ?? 0;
                 entity.gridY = data.gridY ?? 0;

                // Store target state for interpolation
                entity._targetX = entity.x;
                entity._targetY = entity.y;
                entity._targetAngle = entity.angle;
                 entity._lastUpdateTime = performance.now(); // Track last update time

                 // Override the update method for remote player interpolation
                 entity.update = function(deltaTime) {
                     const lerpFactor = 0.2; // Adjust for smoothness
                     this.x += (this._targetX - this.x) * lerpFactor;
                     this.y += (this._targetY - this.y) * lerpFactor;
                     if (typeof this.normalizeAngle === 'function') {
                        const angleDiff = this.normalizeAngle(this._targetAngle - this.angle);
                         this.angle = this.normalizeAngle(this.angle + angleDiff * lerpFactor);
                     } else {
                         this.angle += (this._targetAngle - this.angle) * lerpFactor;
                     }
                 };

                 const added = this.add(entity); // Add the fully configured remote player
                 if (added && added.createPersonalLightSource) {
                    added.createPersonalLightSource(); // Create light for remote player too
                 }

            } else {
                // Update existing remote player entity
                 entity._targetX = data.x ?? entity._targetX;
                 entity._targetY = data.y ?? entity._targetY;
                 entity._targetAngle = data.angle ?? entity._targetAngle;
                 entity._lastUpdateTime = performance.now();

                // Update other properties directly (non-interpolated)
                entity.speed = data.speed ?? entity.speed;
                 if (data.health !== undefined) entity.health = data.health;
                 if (data.maxHealth !== undefined) entity.maxHealth = data.maxHealth;
                 if (data.resources) entity.resources = data.resources;
                 // if (data.vehicleId !== undefined) entity.vehicleId = data.vehicleId; // Deprecated?
                 if (data.size !== undefined) entity.size = data.size;

                 // Sync interior state
                 if (data.playerState !== undefined) entity.playerState = data.playerState;
                 if (data.currentVehicleId !== undefined) entity.currentVehicleId = data.currentVehicleId;
                 if (data.gridX !== undefined) entity.gridX = data.gridX;
                 if (data.gridY !== undefined) entity.gridY = data.gridY;

                 if (peerInfo && entity.name !== peerInfo.username) {
                     entity.name = peerInfo.username;
                 }
            }
        }

        // Remove remote player entities that are no longer in the presence data
        const currentRemotePlayers = Object.keys(this.playerEntities);
        for (const clientId of currentRemotePlayers) {
            if (clientId !== localPlayerId && !presentIds.has(clientId)) {
                 // Use the main remove method to ensure owned lights are cleaned up
                 this.remove(clientId);
            }
        }
    }
}