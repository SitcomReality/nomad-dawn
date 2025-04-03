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
            description: 'Basic building material for structures and vehicles',
            spriteCellId: 'metal_lump'
        },
        {
            id: 'energy',
            name: 'Energy Crystals',
            color: '#f0e050',
            description: 'Powers vehicles and advanced structures',
            spriteCellId: 'battery_car'
        },
        {
            id: 'food',
            name: 'Food Source',
            color: '#50c020',
            description: 'Required for player survival and healing',
            spriteCellId: 'food_fruit'
        },
        // Rare resources
        {
            id: 'uranium',
            name: 'Uranium',
            color: '#2ea83b',
            description: 'Highly efficient but dangerous energy source',
            rare: true,
            spriteCellId: 'barrel_toxic'
        },
        {
            id: 'silicon',
            name: 'Pure Silicon',
            color: '#b9d0d7',
            description: 'Used for advanced electronics and solar panels',
            rare: true,
            spriteCellId: 'metal_ingots'
        },
        {
            id: 'crystal',
            name: 'Crystal Formation',
            color: '#9966cc',
            description: 'Exotic material with unique properties',
            rare: true,
            spriteCellId: null
        },
        {
            id: 'medicine',
            name: 'Medicinal Plants',
            color: '#d14a87',
            description: 'Used for crafting advanced medical supplies',
            rare: true,
            spriteCellId: 'flowers_pink'
        },
        {
            id: 'exotic_wood',
            name: 'Exotic Wood',
            color: '#8b4513',
            description: 'Rare material for specialized construction',
            rare: true,
            spriteCellId: 'tree_round'
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
    
    // Module configuration
    MODULE_TYPES: [
        {
            id: 'storage',
            name: 'Storage Module',
            description: 'Increases vehicle storage capacity',
            effect: { storage: 100 },
            cost: { metal: 25, energy: 10 },
            color: '#5af',
            size: 10
        },
        {
            id: 'armor',
            name: 'Armor Plating',
            description: 'Increases vehicle durability',
            effect: { maxHealth: 100 },
            cost: { metal: 50 },
            color: '#888',
            size: 12
        },
        {
            id: 'engine',
            name: 'Engine Upgrade',
            description: 'Increases vehicle speed',
            effect: { maxSpeed: 50 },
            cost: { metal: 30, energy: 30 },
            color: '#f55',
            size: 8
        },
        {
            id: 'scanner',
            name: 'Resource Scanner',
            description: 'Reveals nearby resources on the minimap',
            effect: { scanRadius: 500 },
            cost: { metal: 15, energy: 40 },
            color: '#5e5',
            size: 7
        }
    ],
    
    // Equipment configuration
    EQUIPMENT_TYPES: [
        {
            id: 'mining_laser',
            name: 'Mining Laser',
            slot: 'tool',
            description: 'Efficient resource collection tool',
            effect: { collectionSpeed: 2 },
            cost: { metal: 30, energy: 20 },
            color: '#f55'
        },
        {
            id: 'combat_rifle',
            name: 'Combat Rifle',
            slot: 'weapon',
            description: 'Standard defensive weapon',
            effect: { damage: 15, range: 300 },
            cost: { metal: 40, energy: 15 },
            color: '#a55'
        },
        {
            id: 'energy_shield',
            name: 'Energy Shield',
            slot: 'armor',
            description: 'Provides protection against damage',
            effect: { maxHealth: 50, damageReduction: 0.2 },
            cost: { metal: 20, energy: 30 },
            color: '#55f'
        }
    ],
    
    // Network configuration
    NETWORK_UPDATE_RATE: 100,  // milliseconds between presence updates
    
    // Debug settings
    DEBUG_ENABLED: false,
    SHOW_COLLISION_SHAPES: false,
    SHOW_CHUNK_BOUNDARIES: false,

    // Spritesheet Configuration
    SPRITESHEET_CONFIG: {
        environmental: {
            id: 'env_sprites',
            url: '/nd_enviro_features_ss.png',
            spriteWidth: 512,
            spriteHeight: 512,
            columns: 4,
            rows: 4
        }
    },

    // Sprite Cell Mappings (using descriptive names)
    // Maps a logical name to its cell coordinates (col, row) starting from 0,0 top-left
    SPRITE_CELLS: {
        // Row 0
        'tree_pine': { sheet: 'env_sprites', col: 0, row: 0 },
        'tree_round': { sheet: 'env_sprites', col: 1, row: 0 },
        'shrub_round': { sheet: 'env_sprites', col: 2, row: 0 },
        'cactus_tall': { sheet: 'env_sprites', col: 3, row: 0 },
        // Row 1
        'flowers_pink': { sheet: 'env_sprites', col: 0, row: 1 },
        'rock_medium': { sheet: 'env_sprites', col: 1, row: 1 },
        'boulder_large': { sheet: 'env_sprites', col: 2, row: 1 },
        'pebbles_small': { sheet: 'env_sprites', col: 3, row: 1 },
        // Row 2
        'barrel_toxic': { sheet: 'env_sprites', col: 0, row: 2 },
        'barrel_fuel': { sheet: 'env_sprites', col: 1, row: 2 },
        'food_meat': { sheet: 'env_sprites', col: 2, row: 2 },
        'food_fruit': { sheet: 'env_sprites', col: 3, row: 2 },
        // Row 3
        'battery_car': { sheet: 'env_sprites', col: 0, row: 3 },
        'tire': { sheet: 'env_sprites', col: 1, row: 3 },
        'metal_ingots': { sheet: 'env_sprites', col: 2, row: 3 },
        'metal_lump': { sheet: 'env_sprites', col: 3, row: 3 }
    },

    // Define Feature Types with Sprite Info (if not already defined elsewhere)
    // We'll integrate this with FeatureGenerator later
    FEATURE_SPRITES: {
        'tree': 'tree_pine',
        'bush': 'shrub_round',
        'rock': 'rock_medium',
        'debris': 'tire', // Using tire for generic debris
        'cactus': 'cactus_tall',
        'ruin': 'boulder_large', // Using boulder as placeholder for ruin
        // Add mappings for any other feature types used in FeatureGenerator
    }
};