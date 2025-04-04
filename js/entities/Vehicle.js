export default class Vehicle {
    constructor(id, config, owner) {
        if (!config || typeof config !== 'object') {
             const logger = window.game?.debug || console;
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
        this.size = 30; 
        this.color = config.color || '#fa5'; 
        this.modules = []; 

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
    }

    update(deltaTime, input) {
        const driverEntity = this.driver ? window.game?.entities.get(this.driver) : null;
        const driverState = driverEntity ? driverEntity.playerState : null;

        if (!this.driver || !input || driverState !== 'Piloting') {
            const previousSpeed = this.speed;
            this.speed = Math.max(0, this.speed - this.deceleration * deltaTime);

            if (this.speed !== previousSpeed) {
                this._stateChanged = true;
            }
            if (this.speed > 0) {
                this.x += Math.cos(this.angle) * this.speed * deltaTime;
                this.y += Math.sin(this.angle) * this.speed * deltaTime;
                this._stateChanged = true; 
            }
            return;
        }

        const prevState = { x: this.x, y: this.y, angle: this.angle, speed: this.speed };

        const direction = input.getMovementDirection();

        if (direction.x !== 0 || direction.y !== 0) {
            const targetAngle = Math.atan2(direction.y, direction.x);

            const angleDiff = this.normalizeAngle(targetAngle - this.angle);
            this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotationSpeed * deltaTime);

            this.speed = Math.min(this.speed + this.acceleration * deltaTime, this.maxSpeed);
        } else {
            this.speed = Math.max(0, this.speed - this.deceleration * deltaTime);
        }

        if (this.speed > 0) {
            this.x += Math.cos(this.angle) * this.speed * deltaTime;
            this.y += Math.sin(this.angle) * this.speed * deltaTime;
        }

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
        return this.health;
    }

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
                            case 'maxHealth':
                                this.maxHealth += value;
                                break;
                            case 'maxSpeed':
                                this.maxSpeed += value;
                                break;
                            case 'storage':
                                this.storage += value;
                                break;
                            case 'scanRadius':
                                this.scanRadius += value;
                                break;
                        }
                    }
                }
            });
        } else {
            const logger = window.game?.debug || console;
            logger.warn(`[Vehicle ${this.id}] Attempted to recalculate stats but this.modules is not an array:`, this.modules);
            this.modules = []; 
        }

        this.maxHealth = Math.max(1, this.maxHealth);
        this.maxSpeed = Math.max(0, this.maxSpeed);
        this.storage = Math.max(0, this.storage);
        this.scanRadius = Math.max(0, this.scanRadius);

        this.health = Math.min(this.health, this.maxHealth);
    }

    collidesWith(other) {
        const radiusA = this.radius;
        const radiusB = (other.radius || other.size / 2 || 0);
        if (radiusB === 0) return false;

        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distanceSq = dx * dx + dy * dy;
        const radiiSumSq = (radiusA + radiusB) * (radiusA + radiusB);
        return distanceSq < radiiSumSq;
    }

    onCollision(other) {
        // Vehicle specific collision response
        // Example: Take damage from projectiles or hazards
        // Example: Push lighter objects (requires physics)
    }

    render(ctx, x, y, size) {
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size / 2, y);
        ctx.stroke();
    }

    setPosition(x, y) {
        if (this.x !== x || this.y !== y) {
            this.x = x;
            this.y = y;
            this._stateChanged = true;
        }
    }

    getMinimalNetworkState() {
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            driver: this.driver,
        };
    }

    getFullNetworkState() {
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
            maxHealth: this.maxHealth,
            driver: this.driver,
            passengers: [...this.passengers],
            modules: this.modules.map(m => ({ ...m })), 
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            gridTiles: { ...this.gridTiles }, 
            gridObjects: { ...this.gridObjects }, 
            doorLocation: { ...this.doorLocation }, 
            pilotSeatLocation: { ...this.pilotSeatLocation }, 
        };
    }

    hasStateChanged() {
        if (this._stateChanged) return true;

        const currentState = this.getMinimalNetworkState();
        const lastState = this._lastNetworkState;

        const positionThresholdSq = 1 * 1;
        const dx = currentState.x - lastState.x;
        const dy = currentState.y - lastState.y;
        const positionChanged = (dx * dx + dy * dy) > positionThresholdSq;

        const angleThreshold = 0.1;
        const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - lastState.angle)) > angleThreshold;

        const speedThreshold = 1;
        const speedChanged = Math.abs(currentState.speed - lastState.speed) > speedThreshold;

        const healthChanged = currentState.health !== lastState.health;
        const driverChanged = currentState.driver !== lastState.driver;

        return positionChanged || angleChanged || speedChanged || healthChanged || driverChanged;
    }

    clearStateChanged() {
        this._lastNetworkState = this.getMinimalNetworkState(); 
        this._stateChanged = false;
    }
}