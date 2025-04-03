export default class EntityManager {
    constructor() {
        this.entities = {};
        this.playerEntities = {};
    }
    
    add(entity) {
        this.entities[entity.id] = entity;
        
        // Track player entities separately for quick access
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
        return Object.values(this.playerEntities).filter(player => {
            const dx = player.x - x;
            const dy = player.y - y;
            return (dx * dx + dy * dy) <= radius * radius;
        });
    }
    
    update(deltaTime) {
        for (const entity of Object.values(this.entities)) {
            if (entity.update) {
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
    
    syncFromNetworkPresence(presenceData) {
        // Process network presence data to update or create entities
        for (const [clientId, data] of Object.entries(presenceData)) {
            // Skip if no data or disconnected
            if (!data) continue;
            
            let entity = this.playerEntities[clientId];
            
            if (!entity) {
                // Create new player entity if it doesn't exist
                entity = {
                    id: clientId,
                    type: 'player',
                    name: clientId,  // Default to clientId until we get username
                    x: data.x || 0,
                    y: data.y || 0,
                    angle: data.angle || 0,
                    speed: data.speed || 0,
                    size: 20,
                    color: '#5af',
                    health: data.health || 100,
                    maxHealth: data.maxHealth || 100,
                    resources: data.resources || {},
                    vehicleId: data.vehicleId || null,
                    update(deltaTime) {
                        // Basic prediction for remote players
                        if (this.speed) {
                            this.x += Math.cos(this.angle) * this.speed * deltaTime;
                            this.y += Math.sin(this.angle) * this.speed * deltaTime;
                        }
                    }
                };
                
                this.add(entity);
            } else {
                // Update existing player entity
                entity.x = data.x !== undefined ? data.x : entity.x;
                entity.y = data.y !== undefined ? data.y : entity.y;
                entity.angle = data.angle !== undefined ? data.angle : entity.angle;
                entity.speed = data.speed !== undefined ? data.speed : entity.speed;
                entity.health = data.health !== undefined ? data.health : entity.health;
                entity.maxHealth = data.maxHealth !== undefined ? data.maxHealth : entity.maxHealth;
                entity.resources = data.resources || entity.resources;
                entity.vehicleId = data.vehicleId !== undefined ? data.vehicleId : entity.vehicleId;
            }
            
            // Update entity name from network peers info
            if (window.room && window.room.peers && window.room.peers[clientId]) {
                entity.name = window.room.peers[clientId].username;
            }
        }
        
        // Remove entities that no longer exist in the presence data
        for (const clientId of Object.keys(this.playerEntities)) {
            if (!presenceData[clientId]) {
                this.remove(clientId);
            }
        }
    }
}

