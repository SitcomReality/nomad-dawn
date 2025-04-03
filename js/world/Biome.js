export class Biome {
    constructor(options) {
        this.name = options.name;
        this.color = options.color;
        this.featureDensity = options.featureDensity || 1.0;
        this.resources = options.resources || [];
        this.features = options.features || [];
        this.rareResources = options.rareResources || [];
    }
}

export const BiomeTypes = {
    WASTELAND: new Biome({
        name: 'Wasteland',
        color: '#a89078',
        featureDensity: 0.5,
        resources: ['metal', 'energy'],
        features: ['debris', 'rock', 'ruin'],
        rareResources: ['uranium']
    }),
    
    DESERT: new Biome({
        name: 'Desert',
        color: '#d6c88e',
        featureDensity: 0.3,
        resources: ['energy'],
        features: ['rock', 'cactus', 'debris'],
        rareResources: ['silicon']
    }),
    
    GRASSLAND: new Biome({
        name: 'Grassland',
        color: '#7d9951',
        featureDensity: 1.2,
        resources: ['food', 'metal'],
        features: ['tree', 'rock', 'bush'],
        rareResources: ['medicine']
    }),
    
    HILLS: new Biome({
        name: 'Hills',
        color: '#8cad81',
        featureDensity: 0.8,
        resources: ['metal', 'food'],
        features: ['rock', 'tree', 'bush'],
        rareResources: ['crystal']
    }),
    
    FOREST: new Biome({
        name: 'Forest',
        color: '#4b7339',
        featureDensity: 1.5,
        resources: ['food', 'energy'],
        features: ['tree', 'tree', 'bush', 'rock'],
        rareResources: ['exotic_wood']
    })
};