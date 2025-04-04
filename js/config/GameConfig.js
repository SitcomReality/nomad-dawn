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
            spriteCellId: 'crystal' // Assuming a sprite exists or will be added
        },
        {
            id: 'medicine',
            name: 'Medicinal Plants',
            color: '#d14a87',
            description: 'Used for crafting advanced medical supplies',
            rare: true,
            spriteCellId: 'flowers_pink' // Placeholder sprite
        },
        {
            id: 'exotic_wood',
            name: 'Exotic Wood',
            color: '#8b4513',
            description: 'Rare material for specialized construction',
            rare: true,
            spriteCellId: 'tree_round' // Placeholder sprite
        }
    ],
    
    // Game mechanics
    RESOURCE_RESPAWN_TIME: 300,  // seconds
    PLAYER_HUNGER_RATE: 0.5,     // food units per minute
    DAY_NIGHT_CYCLE_DURATION_SECONDS: 90, // Total duration for one cycle (day + night)
    
    // Vehicle configuration
    VEHICLE_TYPES: [
        {
            id: 'rover',
            name: 'Rover',
            description: 'Small, fast vehicle with minimal storage',
            speed: 300,
            health: 150,
            storage: 100,
            cost: { metal: 50, energy: 30 },
            // Interior Defaults
            gridWidth: 8,
            gridHeight: 6,
            doorLocation: { x: 4, y: 5 },
            pilotSeatLocation: { x: 4, y: 1 }
        },
        {
            id: 'hauler',
            name: 'Hauler',
            description: 'Medium-sized vehicle with good storage capacity',
            speed: 200,
            health: 250,
            storage: 300,
            cost: { metal: 100, energy: 50 },
            // Interior Defaults
            gridWidth: 12,
            gridHeight: 10,
            doorLocation: { x: 6, y: 9 },
            pilotSeatLocation: { x: 6, y: 1 }
        },
        {
            id: 'base',
            name: 'Mobile Base',
            description: 'Large, slow vehicle that functions as a mobile base',
            speed: 100,
            health: 500,
            storage: 500,
            cost: { metal: 200, energy: 100, food: 50 },
            // Interior Defaults
            gridWidth: 16,
            gridHeight: 12,
            doorLocation: { x: 8, y: 11 },
            pilotSeatLocation: { x: 8, y: 1 }
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
    
    // --- NEW: Interior Object Types ---
    INTERIOR_OBJECT_TYPES: [
        {
            id: 'wall_metal',
            name: 'Metal Wall',
            description: 'Basic structural element.',
            collides: true, 
            cost: { metal: 5 },
            color: '#6c757d',
            icon: '🧱',
            spriteId: 'wall_panel_small_black'
        },
        {
            id: 'storage_small',
            name: 'Small Storage Crate',
            description: 'Provides a small amount of storage space.',
            collides: true,
            interactable: true,
            effect: { storage: 50 },
            cost: { metal: 15 },
            color: '#8b4513',
            icon: '📦',
            spriteId: 'boxes_stacked'
        },
        {
            id: 'console_basic',
            name: 'Basic Console',
            description: 'Interface for vehicle systems.',
            collides: true,
            interactable: true,
            cost: { metal: 10, energy: 5 },
            color: '#457b9d',
            icon: '💻',
            spriteId: 'control_panel_small'
        },
        {
            id: 'bed_simple',
            name: 'Simple Cot',
            description: 'A place to rest.',
            collides: true,
            interactable: true,
            cost: { metal: 10, food: 5 },
            color: '#7d9951',
            icon: '🛏️',
            spriteId: 'desk_dark_large'
        }
        // Add more objects like lights, power conduits, specific workstations etc.
    ],
    // --- END NEW ---
    
    // --- NEW: Interior Tile Types ---
    INTERIOR_TILE_TYPES: [
        {
            id: 'floor_metal',
            name: 'Metal Floor Plate',
            description: 'Basic, durable flooring.',
            cost: { metal: 2 },
            color: '#555',
            spriteId: 'floor_dark_teal'
        },
        {
            id: 'floor_grate',
            name: 'Grated Floor Panel',
            description: 'Allows visibility below, less sturdy.',
            cost: { metal: 3 },
            color: '#777',
            spriteId: 'floor_cobblestone'
        },
        {
            id: 'floor_hazard',
            name: 'Hazard Stripe Floor',
            description: 'Marking for potentially dangerous areas.',
            cost: { metal: 2, energy: 1 },
            color: '#ffcc00',
            spriteId: 'floor_blue_gradient'
        }
        // Add more tile types like carpet, reinforced plating, etc.
    ],
    // --- END NEW ---

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
        },
        interior: {
            id: 'interior_furniture',
            url: '/Interior-Furniture.png',
            spriteWidth: 32,
            spriteHeight: 32,
            columns: 16,
            rows: 32
        }
    },

    // Sprite Cell Mappings (using descriptive names)
    // Maps a logical name to its cell coordinates (col, row) starting from 0,0 top-left
    SPRITE_CELLS: {
        // Row 0
        'tree_pine': { sheet: 'environmental', col: 0, row: 0 },
        'tree_round': { sheet: 'environmental', col: 1, row: 0 },
        'shrub_round': { sheet: 'environmental', col: 2, row: 0 },
        'cactus_tall': { sheet: 'environmental', col: 3, row: 0 },
        // Row 1
        'flowers_pink': { sheet: 'environmental', col: 0, row: 1 },
        'rock_medium': { sheet: 'environmental', col: 1, row: 1 },
        'boulder_large': { sheet: 'environmental', col: 2, row: 1 },
        'pebbles_small': { sheet: 'environmental', col: 3, row: 1 },
        // Row 2
        'barrel_toxic': { sheet: 'environmental', col: 0, row: 2 },
        'barrel_fuel': { sheet: 'environmental', col: 1, row: 2 },
        'food_meat': { sheet: 'environmental', col: 2, row: 2 },
        'food_fruit': { sheet: 'environmental', col: 3, row: 2 },
        // Row 3
        'battery_car': { sheet: 'environmental', col: 0, row: 3 },
        'tire': { sheet: 'environmental', col: 1, row: 3 },
        'metal_ingots': { sheet: 'environmental', col: 2, row: 3 },
        'metal_lump': { sheet: 'environmental', col: 3, row: 3 },
        'crystal': { sheet: 'environmental', col: 0, row: 3 } // Assuming this is the correct position
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
    },
    
    INTERIOR_SPRITES: {
        "wardrobe_teal": { sheet: 'interior', x: 0, y: 0, width: 64, height: 80 },
        "chair_office_gray_1": { sheet: 'interior', x: 80, y: 8, width: 32, height: 40 },
        "chair_office_gray_2": { sheet: 'interior', x: 120, y: 8, width: 32, height: 40 },
        "wall_panel_small_black": { sheet: 'interior', x: 160, y: 8, width: 16, height: 16 },
        "paper_note": { sheet: 'interior', x: 160, y: 32, width: 16, height: 16 },
        "paper_scattered": { sheet: 'interior', x: 184, y: 32, width: 16, height: 16 },
        "boxes_stacked": { sheet: 'interior', x: 88, y: 56, width: 32, height: 32 },
        "chair_office_dark_1": { sheet: 'interior', x: 160, y: 56, width: 32, height: 32 },
        "chair_office_dark_2": { sheet: 'interior', x: 200, y: 56, width: 32, height: 32 },
        "window_double_closed": { sheet: 'interior', x: 216, y: 0, width: 64, height: 64 },
        "window_single_closed_1": { sheet: 'interior', x: 288, y: 0, width: 32, height: 64 },
        "window_single_closed_2": { sheet: 'interior', x: 336, y: 0, width: 32, height: 64 },
        "window_single_narrow": { sheet: 'interior', x: 384, y: 0, width: 16, height: 64 },
        "floor_water_dark": { sheet: 'interior', x: 128, y: 128, width: 64, height: 32 },
        "floor_purple_gradient": { sheet: 'interior', x: 192, y: 128, width: 32, height: 32 },
        "floor_green_gradient": { sheet: 'interior', x: 192, y: 160, width: 32, height: 32 },
        "floor_blue_gradient": { sheet: 'interior', x: 192, y: 192, width: 32, height: 32 },
        "floor_dark_blue_gradient": { sheet: 'interior', x: 192, y: 224, width: 32, height: 32 },
        "wall_dark_diagonal_large": { sheet: 'interior', x: 224, y: 128, width: 192, height: 192 },
        "control_panel_small": { sheet: 'interior', x: 8, y: 192, width: 24, height: 24 },
        "counter_grate_left": { sheet: 'interior', x: 40, y: 184, width: 64, height: 40 },
        "counter_safe_middle": { sheet: 'interior', x: 104, y: 184, width: 32, height: 40 },
        "counter_plain_right": { sheet: 'interior', x: 136, y: 184, width: 32, height: 40 },
        "grate_large": { sheet: 'interior', x: 0, y: 288, width: 160, height: 64 },
        "desk_lamp_on": { sheet: 'interior', x: 176, y: 368, width: 32, height: 32 },
        "desk_lamp_base": { sheet: 'interior', x: 160, y: 416, width: 64, height: 16 },
        "vent_small_dark": { sheet: 'interior', x: 256, y: 320, width: 32, height: 32 },
        "floor_tech_light_large": { sheet: 'interior', x: 224, y: 352, width: 128, height: 128 },
        "console_complex": { sheet: 'interior', x: 352, y: 352, width: 128, height: 128 },
        "wall_edge_vertical": { sheet: 'interior', x: 416, y: 352, width: 16, height: 192 },
        "desk_dark_large": { sheet: 'interior', x: 0, y: 448, width: 128, height: 160 },
        "desk_dark_sidepiece": { sheet: 'interior', x: 128, y: 464, width: 32, height: 112 },
        "floor_blue_squares": { sheet: 'interior', x: 224, y: 480, width: 64, height: 32 },
        "floor_dark_teal": { sheet: 'interior', x: 288, y: 480, width: 32, height: 32 },
        "floor_beige_dirt": { sheet: 'interior', x: 352, y: 480, width: 32, height: 32 },
        "floor_tech_gray_complex": { sheet: 'interior', x: 384, y: 480, width: 96, height: 32 },
        "floor_cobblestone": { sheet: 'interior', x: 224, y: 512, width: 32, height: 32 },
        "door_double_gray": { sheet: 'interior', x: 272, y: 512, width: 64, height: 64 },
        "frame_dark_rect": { sheet: 'interior', x: 160, y: 624, width: 160, height: 64 },
        "frame_dark_small": { sheet: 'interior', x: 0, y: 736, width: 128, height: 128 },
        "bar_blue_short": { sheet: 'interior', x: 160, y: 768, width: 64, height: 16 },
        "bar_blue_long": { sheet: 'interior', x: 160, y: 800, width: 256, height: 16 },
        "bar_blue_medium_1": { sheet: 'interior', x: 160, y: 832, width: 128, height: 16 },
        "bar_blue_medium_2": { sheet: 'interior', x: 160, y: 864, width: 128, height: 16 }
    }
};