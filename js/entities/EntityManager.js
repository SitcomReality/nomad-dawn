export default class EntityManager {
    constructor() {
        this.entities = {};
        this.playerEntities = {}; // Maps clientId to player entity
    }
    
    add(entity) {
        if (!entity || !entity.id) {
             console.error("Attempted to add invalid entity:", entity);
             return null;
        }
        if (this.entities[entity.id]) {
            // console.warn(`Entity with ID ${entity.id} already exists. Overwriting.`);
        }
        this.entities[entity.id] = entity;
        
        // Track player entities separately for quick access using clientId
        if (entity.type === 'player') {
            this.playerEntities[entity.id] = entity;
        }
        
        return entity;
    }
    
    remove(entityId) {
        const entity = this.entities[entityId];
        if (entity) {
            if (entity.type === 'player') {
                delete this.playerEntities[entityId];
            }
            delete this.entities[entityId];
            // console.log(`Removed entity: ${entityId}`); // Debugging removal
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
        return Object.values(this.entities).filter(entity => entity.type === type);
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
            let entity = this.playerEntities[clientId];
            
            if (!entity) {
                // Create new remote player entity if it doesn't exist
                // console.log(`Creating remote player entity for ${clientId}`); // Debugging creation
                const peerInfo = (window.room && window.room.peers) ? window.room.peers[clientId] : null;
                entity = {
                    id: clientId,
                    type: 'player', // Assume presence data is for players unless specified otherwise
                    name: peerInfo ? peerInfo.username : `Player ${clientId.substring(0, 4)}`,
                    x: data.x !== undefined ? data.x : 0, // Use received data or default
                    y: data.y !== undefined ? data.y : 0,
                    angle: data.angle !== undefined ? data.angle : 0,
                    speed: data.speed !== undefined ? data.speed : 0, // Store speed for potential interpolation
                    size: data.size !== undefined ? data.size : 20, // Use remote size if provided
                    color: '#5af', // Default remote player color
                    health: data.health !== undefined ? data.health : 100,
                    maxHealth: data.maxHealth !== undefined ? data.maxHealth : 100,
                    resources: data.resources || {}, // Sync resources if provided
                    vehicleId: data.vehicleId !== undefined ? data.vehicleId : null,
                    // Remote player update logic (interpolation/prediction)
                    // Store target state for interpolation
                    _targetX: data.x !== undefined ? data.x : 0,
                    _targetY: data.y !== undefined ? data.y : 0,
                    _targetAngle: data.angle !== undefined ? data.angle : 0,
                    update(deltaTime) {
                        // Simple interpolation towards target state
                        const lerpFactor = 0.2; // Adjust for smoothness
                        this.x += (this._targetX - this.x) * lerpFactor;
                        this.y += (this._targetY - this.y) * lerpFactor;

                        // Interpolate angle carefully (handle wrapping)
                        const angleDiff = this.normalizeAngle(this._targetAngle - this.angle);
                        this.angle = this.normalizeAngle(this.angle + angleDiff * lerpFactor);
                    },
                    // Helper to normalize angle for interpolation
                     normalizeAngle(angle) {
                        while (angle <= -Math.PI) angle += 2 * Math.PI;
                        while (angle > Math.PI) angle -= 2 * Math.PI;
                        return angle;
                    }
                };
                
                this.add(entity);
            } else {
                // Update existing remote player entity
                // Update target positions for interpolation
                entity._targetX = data.x !== undefined ? data.x : entity._targetX;
                entity._targetY = data.y !== undefined ? data.y : entity._targetY;
                entity._targetAngle = data.angle !== undefined ? data.angle : entity._targetAngle;

                // Update other properties directly (non-interpolated)
                entity.speed = data.speed !== undefined ? data.speed : entity.speed;
                entity.health = data.health !== undefined ? data.health : entity.health;
                entity.maxHealth = data.maxHealth !== undefined ? data.maxHealth : entity.maxHealth;
                entity.resources = data.resources || entity.resources;
                entity.vehicleId = data.vehicleId !== undefined ? data.vehicleId : entity.vehicleId;
                 entity.size = data.size !== undefined ? data.size : entity.size;

                 // Update name if peer info is available and different
                 const peerInfo = (window.room && window.room.peers) ? window.room.peers[clientId] : null;
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