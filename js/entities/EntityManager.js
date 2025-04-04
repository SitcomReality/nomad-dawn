export default class EntityManager {
    constructor() {
        this.entities = {};
        this.playerEntities = {}; // Maps clientId to player entity
    }

    add(entity) {
        if (!entity || !entity.id) {
             // Use game debug if available, otherwise console
             const logger = window.game?.debug || console;
             logger.error("[EntityManager] Attempted to add invalid entity:", entity);
             return null;
        }
        if (this.entities[entity.id]) {
            // Use game debug if available, otherwise console
            const logger = window.game?.debug || console;
             // This is common during sync, make it a log instead of warn
             logger.log(`[EntityManager] Entity with ID ${entity.id} already exists. Overwriting.`);
        }
        this.entities[entity.id] = entity;

        // Log adding vehicles specifically
        if (entity.type === 'vehicle') {
             // Use game debug if available, otherwise console
             const logger = window.game?.debug || console;
             logger.log(`[EntityManager] Added vehicle entity: ${entity.id}`, entity);
        }

        // Track player entities separately for quick access using clientId
        if (entity.type === 'player') {
            this.playerEntities[entity.id] = entity;
        }

        return entity; // Return the added entity
    }

    remove(entityId) {
        const entity = this.entities[entityId];
        if (entity) {
            // Log removing vehicles specifically
             if (entity.type === 'vehicle') {
                 // Use game debug if available, otherwise console
                 const logger = window.game?.debug || console;
                 logger.log(`[EntityManager] Removing vehicle entity: ${entityId}`);
             }
            if (entity.type === 'player') {
                delete this.playerEntities[entityId];
            }
            delete this.entities[entityId];
             // logger.log(`Removed entity: ${entityId}`); // Debugging removal
            return true;
        }
        return false;
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
        const radiusSq = radius * radius; // Use squared distance for efficiency
        return Object.values(this.playerEntities).filter(player => {
            const dx = player.x - x;
            const dy = player.y - y;
            return (dx * dx + dy * dy) <= radiusSq;
        });
    }

    update(deltaTime) {
        for (const entityId in this.entities) {
            const entity = this.entities[entityId];
             // Check if entity still exists (could be removed during loop?) - unlikely here but good practice
             if (!entity) continue; 
             
            if (entity.update && typeof entity.update === 'function') {
                // Only update if the entity has an update method
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
    }

    // Added localPlayerId to prevent self-update/creation loop
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
                 // console.log(`Creating remote player entity for ${clientId}`); // Debugging creation

                // Create a Player instance for remote players too, for consistency
                 // Ensure game reference is passed correctly
                 entity = new Player(clientId, window.game);

                // Set initial properties from network data and peer info
                 entity.name = peerInfo ? peerInfo.username : `Player ${clientId.substring(0, 4)}`;
                 entity.x = data.x !== undefined ? data.x : 0;
                 entity.y = data.y !== undefined ? data.y : 0;
                 entity.angle = data.angle !== undefined ? data.angle : 0;
                 entity.speed = data.speed !== undefined ? data.speed : 0;
                 entity.size = data.size !== undefined ? data.size : entity.size; // Use default from Player class if not provided
                 entity.health = data.health !== undefined ? data.health : entity.maxHealth; // Use default maxHealth if health missing
                 entity.maxHealth = data.maxHealth !== undefined ? data.maxHealth : entity.maxHealth;
                 entity.resources = data.resources || {}; // Use default from Player class if not provided
                 entity.vehicleId = data.vehicleId !== undefined ? data.vehicleId : null; // Legacy field
                 entity.color = '#5af'; // Remote player color override

                 // --- Sync New Player State ---
                 entity.playerState = data.playerState || 'Overworld';
                 entity.currentVehicleId = data.currentVehicleId || null;
                 entity.gridX = data.gridX !== undefined ? data.gridX : 0;
                 entity.gridY = data.gridY !== undefined ? data.gridY : 0;
                 // --- End Sync New Player State ---


                // Store target state for interpolation
                entity._targetX = entity.x;
                entity._targetY = entity.y;
                entity._targetAngle = entity.angle;
                 entity._lastUpdateTime = performance.now(); // Track last update time

                 // Override the update method for remote player interpolation
                 entity.update = function(deltaTime) {
                     // Skip interpolation if player is not in Overworld state
                     if (this.playerState !== 'Overworld') {
                          // Keep visual position roughly matching network state if not interpolating
                          this.x = this._targetX;
                          this.y = this._targetY;
                          this.angle = this._targetAngle;
                         return;
                     }

                     // Interpolate towards target state
                     const lerpFactor = 0.2; // Adjust for smoothness

                     this.x += (this._targetX - this.x) * lerpFactor;
                     this.y += (this._targetY - this.y) * lerpFactor;

                     // Interpolate angle carefully (handle wrapping)
                     if (typeof this.normalizeAngle === 'function') {
                        const angleDiff = this.normalizeAngle(this._targetAngle - this.angle);
                         this.angle = this.normalizeAngle(this.angle + angleDiff * lerpFactor);
                     } else if (typeof Player.prototype.normalizeAngle === 'function') {
                         const angleDiff = Player.prototype.normalizeAngle.call(this, this._targetAngle - this.angle);
                         this.angle = Player.prototype.normalizeAngle.call(this, this.angle + angleDiff * lerpFactor);
                     } else {
                         this.angle += (this._targetAngle - this.angle) * lerpFactor;
                     }
                 };

                this.add(entity); // Add the fully configured remote player
            } else {
                // Update existing remote player entity
                // Update target positions for interpolation
                 entity._targetX = data.x !== undefined ? data.x : entity._targetX;
                 entity._targetY = data.y !== undefined ? data.y : entity._targetY;
                 entity._targetAngle = data.angle !== undefined ? data.angle : entity._targetAngle;
                 entity._lastUpdateTime = performance.now();

                // Update other properties directly (non-interpolated)
                entity.speed = data.speed !== undefined ? data.speed : entity.speed;
                 if (data.health !== undefined) entity.health = data.health;
                 if (data.maxHealth !== undefined) entity.maxHealth = data.maxHealth;
                 if (data.resources) entity.resources = data.resources;
                 if (data.vehicleId !== undefined) entity.vehicleId = data.vehicleId; // Legacy
                 if (data.size !== undefined) entity.size = data.size;

                 // --- Sync New Player State ---
                 if (data.playerState !== undefined) entity.playerState = data.playerState;
                 if (data.currentVehicleId !== undefined) entity.currentVehicleId = data.currentVehicleId;
                 if (data.gridX !== undefined) entity.gridX = data.gridX;
                 if (data.gridY !== undefined) entity.gridY = data.gridY;
                 // --- End Sync New Player State ---

                 // Update name if peer info is available and different
                 if (peerInfo && entity.name !== peerInfo.username) {
                     entity.name = peerInfo.username;
                 }
            }
        }

        // Remove remote player entities that are no longer in the presence data
        const currentRemotePlayers = Object.keys(this.playerEntities);
        for (const clientId of currentRemotePlayers) {
            if (clientId !== localPlayerId && !presentIds.has(clientId)) {
                // console.log(`Removing remote player entity ${clientId} (no longer present)`); // Debugging removal
                this.remove(clientId);
            }
        }
    }
}