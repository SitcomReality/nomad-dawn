// js/lighting/LightSource.js
class LightSource {
    constructor(id, x, y, color, intensity, range, type = 'point', ownerId = null) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color; // {r, g, b}
        this.intensity = intensity; // 0-1
        this.range = range; // world units
        this.type = type;
        this.ownerId = ownerId;
    }

    update(deltaTime) {
        // Basic update method, might be empty initially
    }
}

// js/entities/EntityManager.js
class EntityManager {
    constructor() {
        // ...
        this.lightSources = {};
    }

    add(entity) {
        // ...
        if (entity instanceof LightSource) {
            this.lightSources[entity.id] = entity;
        }
    }

    remove(entity) {
        // ...
        if (entity instanceof LightSource) {
            delete this.lightSources[entity.id];
        }
    }

    getLightsInRadius(x, y, radius) {
        const lights = [];
        for (const light of Object.values(this.lightSources)) {
            const distance = Math.sqrt((light.x - x) ** 2 + (light.y - y) ** 2);
            if (distance <= radius) {
                lights.push(light);
            }
        }
        return lights;
    }
}

// js/entities/Player.js
class Player {
    constructor() {
        // ...
        this.lightSourceId = null;
    }
}

// js/entities/Vehicle.js
class Vehicle {
    constructor() {
        // ...
        this.headlightSourceIds = [];
    }
}

// js/core/Game.js
class Game {
    constructor() {
        // ...
        this.lightManager = new LightManager();
    }
}

// js/lighting/LightManager.js
class LightManager {
    constructor() {
    }

    calculateLightAt(x, y) {
        const lights = entityManager.getLightsInRadius(x, y, 10); // default radius
        let effectiveColor = { r: 0, g: 0, b: 0 };
        let effectiveIntensity = 0;
        for (const light of lights) {
            const distance = Math.sqrt((light.x - x) ** 2 + (light.y - y) ** 2);
            const intensity = light.intensity * (1 - distance / light.range);
            if (intensity > effectiveIntensity) {
                effectiveIntensity = intensity;
                effectiveColor = light.color;
            }
        }
        return { color: effectiveColor, intensity: effectiveIntensity };
    }
}

// js/rendering/Renderer.js
class Renderer {
    constructor() {
        // ...
        this.lightManager = game.lightManager;
    }

    // Remove old lighting system properties and methods
    // ...
}

// js/rendering/WorldObjectRenderer.js
class WorldObjectRenderer {
    constructor() {
        // ...
    }

    adjustColorForLighting(obj) {
        const light = game.lightManager.calculateLightAt(obj.x, obj.y);
        const spriteOptions = {
            // ...
            tint: light.color,
        };
        return spriteOptions;
    }
}

// js/rendering/EntityRenderer.js
class EntityRenderer {
    constructor() {
        // ...
    }

    adjustColorForLighting(entity) {
        const light = game.lightManager.calculateLightAt(entity.x, entity.y);
        const spriteOptions = {
            // ...
            tint: light.color,
        };
        return spriteOptions;
    }
}

// js/rendering/SpriteManager.js
class SpriteManager {
    constructor() {
        // ...
    }

    getTintedSprite(sprite, effectiveLightColor, effectiveIntensity) {
        // ...
        const cacheKey = `tinted-${sprite}-${effectiveLightColor}-${effectiveIntensity}`;
        // ...
    }
}