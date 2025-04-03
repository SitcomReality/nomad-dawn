export const Config = {
    // World configuration
    WORLD_SIZE: 10000,        // World dimensions
    CHUNK_SIZE: 500,          // Size of world chunks
    MAX_LOAD_DISTANCE: 2000,  // Maximum distance to load chunks
    
    // Player configuration
    PLAYER_MAX_HEALTH: 100,
    PLAYER_SPEED: 200,
    PLAYER_SIZE: 20,
    
    // Resources
    RESOURCE_TYPES: [
        {
            id: 'metal',
            name: 'Metal',
            color: '#a0a0a0',
            description: 'Basic building material for structures and vehicles'
        },
        {
            id: 'energy',
            name: 'Energy',
            color: '#f0e050',
            description: 'Powers vehicles and advanced structures'
        },
        {
            id: 'food',
            name: 'Food',
            color: '#50c020',
            description: 'Required for player survival and healing'
        }
    ],
    
    // Game mechanics
    RESOURCE_RESPAWN_TIME: 300,  // seconds
    PLAYER_HUNGER_RATE: 0.5,     // food units per minute
    DAY_NIGHT_CYCLE: 15 * 60,    // 15 minutes per day-night cycle
    
    // Vehicle configuration
    VEHICLE_TYPES: [
        {
            id: 'rover',
            name: 'Rover',
            description: 'Small, fast vehicle with minimal storage',
            speed: 300,
            health: 150,
            storage: 100,
            cost: { metal: 50, energy: 30 }
        },
        {
            id: 'hauler',
            name: 'Hauler',
            description: 'Medium-sized vehicle with good storage capacity',
            speed: 200,
            health: 250,
            storage: 300,
            cost: { metal: 100, energy: 50 }
        },
        {
            id: 'base',
            name: 'Mobile Base',
            description: 'Large, slow vehicle that functions as a mobile base',
            speed: 100,
            health: 500,
            storage: 500,
            cost: { metal: 200, energy: 100, food: 50 }
        }
    ],
    
    // Network configuration
    NETWORK_UPDATE_RATE: 100,  // milliseconds between presence updates
    
    // Debug settings
    DEBUG_ENABLED: false,
    SHOW_COLLISION_SHAPES: false,
    SHOW_CHUNK_BOUNDARIES: false
};

