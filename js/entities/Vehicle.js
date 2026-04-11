import MovementController from '../core/MovementController.js';
import LightSource from '../lighting/LightSource.js'; // Import LightSource

export default class Vehicle {
    constructor(id, config, owner, game) {
        this.game = game || this.game;
        if (!config || typeof config !== 'object') {
             const logger = this.game?.debug || console;
             logger.error(`[Vehicle] Invalid config passed to constructor for ID ${id}:`, config);
             config = {
                 id: 'unknown',
                 name: 'Unknown Vehicle',
                 speed: 100,
                 health: 100,
                 storage: 50,
                 maxPassengers: 0,
                 baseMaxHealth: 100,
                 baseMaxSpeed: 100,
                 baseStorage: 50
             };
        }

        this.id = id;
        this.type = 'vehicle';
        this.vehicleType = config.id;
        this.owner = owner;
        this.name = config.name || `${config.id.charAt(0).toUpperCase() + config.id.slice(1)}`;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;

        // Store base stats from config
        this.baseMaxHealth = config.health || 100;
        this.baseMaxSpeed = config.speed || 150;
        this.baseStorage = config.storage || 100;
        this.baseScanRadius = config.scanRadius || 0;

        // Current stats (potentially modified by modules)
        this.maxSpeed = this.baseMaxSpeed;
        this.maxHealth = this.baseMaxHealth;
        this.storage = this.baseStorage;
        this.scanRadius = this.baseScanRadius;

        this.health = this.maxHealth;

        // Common properties
        this.acceleration = 150;
        this.deceleration = 200;
        this.rotationSpeed = 2;
        this.size = config.size || 30; // Use config size or default
        this.color = config.color || '#fa5';
        this.modules = [];

        // --- UPDATED: Renamed headlightSourceIds to lightSourceIds ---
        this.lightSourceIds = []; // Array of IDs for ALL attached light sources
        // --- END UPDATED ---

        // Interaction properties
        this.driver = null;
        this.passengers = [];
        this.maxPassengers = config.maxPassengers || 1;

        // Collision properties
        this.radius = this.size / 2;
        this.mass = 20;

        // Vehicle Interior Grid Properties
        this.gridWidth = config.gridWidth || 10;
        this.gridHeight = config.gridHeight || 10;
        this.gridTiles = {};
        this.gridObjects = {};
        this.doorLocation = config.doorLocation || { x: Math.floor(this.gridWidth / 2), y: this.gridHeight - 1 };
        this.pilotSeatLocation = config.pilotSeatLocation || { x: Math.floor(this.gridWidth / 2), y: 1 };

        // Network state tracking
        this._lastNetworkState = this.getMinimalNetworkState();
        this._stateChanged = false;

        // Add movement controller
        this.movementController = new MovementController();

        // --- NEW: Create lights after properties are set ---
        this.createVehicleLights();
        // --- END NEW ---
    }

    // --- NEW: Method to create and manage vehicle lights ---
    createVehicleLights() {
        const game = this.game; // Access global game instance
        if (!game?.entities) {
            console.warn(`[Vehicle ${this.id}] Cannot create lights: Game or EntityManager not available.`);
            return;
        }

        // Clear existing lights managed by this vehicle first
        this.lightSourceIds.forEach(lightId => game.entities.remove(lightId));
        this.lightSourceIds = [];

        // Define light configurations (example: two headlights)
        const lightsConfig = [
            { // Left Headlight
                idSuffix: '-headlight-L',
                options: {
                    offsetX: this.size * 0.5, // Forward offset
                    offsetY: -this.size * 0.3, // Left offset
                    color: { r: 255, g: 255, b: 220 },
                    intensity: 0.9,
                    range: 400, // Long range for headlights
                }
            },
            { // Right Headlight
                 idSuffix: '-headlight-R',
                 options: {
                     offsetX: this.size * 0.5, // Forward offset
                     offsetY: this.size * 0.3, // Right offset
                     color: { r: 255, g: 255, b: 220 },
                     intensity: 0.9,
                     range: 400,
                 }
            },
            // Add more lights here (e.g., taillights, interior lights?)
             { // Simple Interior Light (example)
                  idSuffix: '-interior',
                  options: {
                      offsetX: 0, // Centered
                      offsetY: 0,
                      color: { r: 180, g: 180, b: 200 },
                      intensity: 0.5,
                      range: 150, // Shorter range for interior
                  }
             }
        ];

        lightsConfig.forEach(config => {
            const lightId = `${this.id}${config.idSuffix}`;
            const lightOptions = {
                ...config.options, // Spread base options
                ownerId: this.id,  // Set the owner ID
                // Initial x/y don't matter much as update() will set them based on owner
            };

            try {
                const lightSource = new LightSource(lightId, lightOptions);
                const addedLight = game.entities.add(lightSource);
                if (addedLight) {
                    this.lightSourceIds.push(lightId);
                    game.debug.log(`[Vehicle ${this.id}] Created light source: ${lightId}`);
                } else {
                     game.debug.error(`[Vehicle ${this.id}] Failed to add light source ${lightId} to EntityManager.`);
                }
            } catch (error) {
                 game.debug.error(`[Vehicle ${this.id}] Error creating LightSource (${lightId}):`, error);
            }
        });
         this._stateChanged = true; // Mark state changed if lights were potentially added/removed
    }
    // --- END NEW ---

    update(deltaTime, input) {
        const driverEntity = this.driver ? this.game?.entities.get(this.driver) : null;
        const driverState = driverEntity ? driverEntity.playerState : null;

        if (!this.driver || !input || driverState !== 'Piloting') {
            const previousSpeed = this.speed;
            // Apply deceleration only if speed is positive (prevent moving backwards when idle)
            if (this.speed > 0) {
                 this.speed = Math.max(0, this.speed - this.deceleration * deltaTime);
            } else if (this.speed < 0) { // Apply deceleration if moving backwards
                 this.speed = Math.min(0, this.speed + this.deceleration * deltaTime);
            }


            if (this.speed !== previousSpeed) {
                this._stateChanged = true;
            }
            if (this.speed !== 0) { // Apply movement if speed is non-zero
                this.x += Math.cos(this.angle) * this.speed * deltaTime;
                this.y += Math.sin(this.angle) * this.speed * deltaTime;
                this._stateChanged = true;
            }
            return;
        }

        const prevState = { x: this.x, y: this.y, angle: this.angle, speed: this.speed };
        this.movementController.updateTankControls(this, input, deltaTime);

        if (
            this.x !== prevState.x ||
            this.y !== prevState.y ||
            this.angle !== prevState.angle ||
            this.speed !== prevState.speed
        ) {
            this._stateChanged = true;
        }
    }

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    setDriver(playerId) {
        if (this.driver !== playerId) {
            this.driver = playerId;
            this._stateChanged = true;
        }
    }

    removeDriver() {
        if (this.driver !== null) {
            this.driver = null;
            this._stateChanged = true;
        }
    }

    addPassenger(playerId) {
        if (this.passengers.length < this.maxPassengers && !this.passengers.includes(playerId)) {
            this.passengers.push(playerId);
            this._stateChanged = true;
            return true;
        }
        return false;
    }

    removePassenger(playerId) {
        const index = this.passengers.indexOf(playerId);
        if (index !== -1) {
            this.passengers.splice(index, 1);
            this._stateChanged = true;
            return true;
        }
        return false;
    }

    takeDamage(amount) {
        const previousHealth = this.health;
        this.health = Math.max(0, this.health - amount);
        if (this.health !== previousHealth) {
            this._stateChanged = true;
        }
        if (this.health <= 0) {
             // Handle vehicle destruction (e.g., create explosion effect, drop items, remove entity)
             this.handleDestruction();
        }
        return this.health;
    }

    // --- NEW: Handle vehicle destruction ---
    handleDestruction() {
        const game = this.game;
        if (!game) return;

        game.debug.log(`Vehicle ${this.id} destroyed!`);

        // Create explosion effect
        game.renderer?.createEffect('explosion', this.x, this.y, { size: this.size * 1.5 });

        // Remove the vehicle entity locally
        game.entities.remove(this.id);
    }
    // --- END NEW ---

    repair(amount) {
        const previousHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        if (this.health !== previousHealth) {
            this._stateChanged = true;
        }
        return this.health;
    }

    addModule(module) {
        this.modules.push(module);
        this.recalculateStatsFromModules();
        this._stateChanged = true;
    }

    removeModule(moduleId) {
        const initialLength = this.modules.length;
        this.modules = this.modules.filter(m => m.id !== moduleId);
        if (this.modules.length !== initialLength) {
            this.recalculateStatsFromModules();
            this._stateChanged = true;
        }
    }

    recalculateStatsFromModules() {
        this.maxHealth = this.baseMaxHealth;
        this.maxSpeed = this.baseMaxSpeed;
        this.storage = this.baseStorage;
        this.scanRadius = this.baseScanRadius;

        if (this.modules && Array.isArray(this.modules)) {
            this.modules.forEach(module => {
                if (module && module.effect) {
                    for (const [stat, value] of Object.entries(module.effect)) {
                        if (typeof value !== 'number') continue;

                        switch (stat) {
                            case 'maxHealth': this.maxHealth += value; break;
                            case 'maxSpeed': this.maxSpeed += value; break;
                            case 'storage': this.storage += value; break;
                            case 'scanRadius': this.scanRadius += value; break;
                                // Add handling for other potential module effects
                        }
                    }
                }
            });
        } else {
            const logger = this.game?.debug || console;
            logger.warn(`[Vehicle ${this.id}] Attempted to recalculate stats but this.modules is not an array:`, this.modules);
            this.modules = [];
        }

        // Ensure stats don't go below reasonable minimums
        this.maxHealth = Math.max(1, this.maxHealth);
        this.maxSpeed = Math.max(0, this.maxSpeed);
        this.storage = Math.max(0, this.storage);
        this.scanRadius = Math.max(0, this.scanRadius);

        // Clamp current health to new maxHealth
        this.health = Math.min(this.health, this.maxHealth);
    }

    // --- UPDATED: collidesWith to match Player's signature ---
    collidesWith(other) {
        const radiusA = this.radius;
        const radiusB = (other.radius || other.size / 2 || 0);
        if (radiusA <= 0 || radiusB <= 0) return false;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy); // Use sqrt for accurate distance
        return distance < (radiusA + radiusB);
    }
    // --- END UPDATED ---

    // --- UPDATED: onCollision logic ---
    onCollision(other) {
        if (!other) return;

        const isSolidWorldObject = other.collides === true && !other.collidesWith; // Assuming world objects lack collidesWith
        const isOtherVehicle = other.type === 'vehicle';

        if (isSolidWorldObject || isOtherVehicle) {
            const radiusA = this.radius;
            const radiusB = (other.radius || other.size / 2 || 0);
            if (radiusA <= 0 || radiusB <= 0) return;

            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const distanceSq = dx * dx + dy * dy;
            const radiiSum = radiusA + radiusB;
            const radiiSumSq = radiiSum * radiiSum;

            if (distanceSq < radiiSumSq && distanceSq > 0) {
                const distance = Math.sqrt(distanceSq);
                const penetration = radiiSum - distance;

                // More realistic push based on relative velocity/mass could be added later
                const pushFactor = isOtherVehicle ? 0.51 : 0.8; // Push away more from static objects
                const nx = dx / distance;
                const ny = dy / distance;

                // Move vehicle back slightly more forcefully
                this.x += nx * penetration * pushFactor;
                this.y += ny * penetration * pushFactor;

                // Dampen speed significantly on collision
                this.speed *= 0.2; // Reduce speed drastically

                this._stateChanged = true;

                // Apply minor damage on collision?
                // this.takeDamage(5); // Example damage amount
            }
        }
        // Add other collision responses if needed (e.g., vs players)
    }
    // --- END UPDATED ---

    render(ctx, x, y, size) {
        // Use entity's actual x/y for positioning, ignore passed x/y
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Simple rectangle representation for vehicles
        const width = size * 1.2; // Make slightly wider than tall
        const height = size;
        ctx.rect(-width / 2, -height / 2, width, height);
        ctx.fill();

        // Draw a line indicating the front
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0); // Center
        ctx.lineTo(width / 2, 0); // Pointing forward along the local x-axis
        ctx.stroke();

        // Optional: Render headlights/taillights indicators?
    }


    setPosition(x, y) {
        if (this.x !== x || this.y !== y) {
            this.x = x;
            this.y = y;
            this._stateChanged = true;
        }
    }

    getMinimalNetworkState() {
        // Only include frequently changing essential state for regular updates
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            driver: this.driver,
            // Maybe include gridTiles/gridObjects if they change frequently?
            // For now, keep them in full state.
        };
    }

    getFullNetworkState() {
        // Include everything, usually sent less frequently or on significant change
        return {
            id: this.id,
            type: this.type,
            vehicleType: this.vehicleType,
            owner: this.owner,
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            maxHealth: this.maxHealth, // Important for clients to know max health
            driver: this.driver,
            passengers: [...this.passengers], // Send copy
            modules: this.modules.map(m => ({ ...m })), // Send copy of module data
            // Interior Grid State
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            gridTiles: { ...this.gridTiles }, // Send copy
            gridObjects: { ...this.gridObjects }, // Send copy
            doorLocation: { ...this.doorLocation },
            pilotSeatLocation: { ...this.pilotSeatLocation },
        };
    }

    hasStateChanged() {
        if (this._stateChanged) return true;
        const currentState = this.getMinimalNetworkState();
        // Ensure _lastNetworkState exists before accessing properties
        const lastState = this._lastNetworkState || {};
        const positionThresholdSq = 0.5 * 0.5; // Reduced threshold for vehicles?
        const dx = currentState.x - (lastState.x || 0);
        const dy = currentState.y - (lastState.y || 0);
        const positionChanged = (dx * dx + dy * dy) > positionThresholdSq;
        const angleThreshold = 0.05; // Smaller threshold for smoother rotation sync
        const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - (lastState.angle || 0))) > angleThreshold;
        const speedThreshold = 0.5; // Smaller threshold for speed changes
        const speedChanged = Math.abs(currentState.speed - (lastState.speed || 0)) > speedThreshold;
        const healthChanged = currentState.health !== lastState.health;
        const driverChanged = currentState.driver !== lastState.driver;
        // Interior grid changes are handled via full state updates triggered by building manager
        return positionChanged || angleChanged || speedChanged || healthChanged || driverChanged;
    }

    clearStateChanged() {
        this._lastNetworkState = this.getMinimalNetworkState();
        this._stateChanged = false;
    }
}