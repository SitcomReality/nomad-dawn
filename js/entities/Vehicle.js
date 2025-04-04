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
                 baseMaxHealth: 100, // Add base stats
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
        this.baseScanRadius = config.scanRadius || 0; // Add base scan radius if vehicles have it

        // Current stats (potentially modified by modules)
        this.maxSpeed = this.baseMaxSpeed; 
        this.maxHealth = this.baseMaxHealth;
        this.storage = this.baseStorage;
        this.scanRadius = this.baseScanRadius; // Initialize current scan radius

        this.health = this.maxHealth; // Start at full health based on initial maxHealth
        
        // Common properties
        this.acceleration = 150;
        this.deceleration = 200;
        this.rotationSpeed = 2;
        this.size = 30; // Consider making this configurable too
        this.color = config.color || '#fa5'; // Use config color or default
        this.modules = []; // Initialize as empty array
        
        // Interaction properties
        this.driver = null;
        this.passengers = [];
        this.maxPassengers = config.maxPassengers || 1;
        
        // Collision properties
        this.radius = this.size / 2;
        this.mass = 20; // Consider making this configurable
        
        // Network state tracking
        this._lastNetworkState = this.getNetworkState(); // Store initial minimal state
        this._stateChanged = false;
    }
    
    update(deltaTime, input) {
        // Only allow updates if driven or if it's an AI vehicle (future)
        // For now, only update if driven AND input is provided
        if (!this.driver || !input) {
            this.speed = 0; // Stop if not driven
             // Check if state changed due to stopping
            if (this._lastNetworkState.speed > 0) {
                this._stateChanged = true;
            }
            return;
        }
        
        // Store previous state to detect changes
        const prevState = { x: this.x, y: this.y, angle: this.angle, speed: this.speed };
        
        // Apply movement based on directional input
        const direction = input.getMovementDirection();
        
        if (direction.x !== 0 || direction.y !== 0) {
            // Calculate target angle based on direction
            const targetAngle = Math.atan2(direction.y, direction.x);
            
            // Smoothly rotate towards target angle
            const angleDiff = this.normalizeAngle(targetAngle - this.angle);
            this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotationSpeed * deltaTime);
            
            // Accelerate
            this.speed = Math.min(this.speed + this.acceleration * deltaTime, this.maxSpeed);
        } else {
            // Decelerate when no input
            this.speed = Math.max(0, this.speed - this.deceleration * deltaTime);
        }
        
        // Apply movement
        if (this.speed > 0) {
            this.x += Math.cos(this.angle) * this.speed * deltaTime;
            this.y += Math.sin(this.angle) * this.speed * deltaTime;
        }
        
        // Check for state changes
        if (
            this.x !== prevState.x ||
            this.y !== prevState.y ||
            this.angle !== prevState.angle ||
            this.speed !== prevState.speed // Check speed change too
        ) {
            this._stateChanged = true;
        }
    }
    
    normalizeAngle(angle) {
        // Normalize angle to be between -PI and PI
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
        // Avoid adding duplicates? For now, allow multiple of same type
        this.modules.push(module);
        this.recalculateStatsFromModules(); // Recalculate after adding
        this._stateChanged = true;
    }
    
    removeModule(moduleId) {
        const initialLength = this.modules.length;
        this.modules = this.modules.filter(m => m.id !== moduleId);
        if (this.modules.length !== initialLength) {
             this.recalculateStatsFromModules(); // Recalculate after removing
             this._stateChanged = true;
        }
    }

    // New method to recalculate stats based on current modules
    recalculateStatsFromModules() {
        // Reset stats to base values
        this.maxHealth = this.baseMaxHealth;
        this.maxSpeed = this.baseMaxSpeed;
        this.storage = this.baseStorage;
        this.scanRadius = this.baseScanRadius;

        // Apply effects from all currently installed modules
        if (this.modules && Array.isArray(this.modules)) {
            this.modules.forEach(module => {
                if (module && module.effect) {
                    for (const [stat, value] of Object.entries(module.effect)) {
                        if (typeof value !== 'number') continue; // Skip non-numeric values

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
                            // Add cases for other potential stats (e.g., acceleration, armor)
                        }
                    }
                }
            });
        } else {
             // Log warning if modules isn't an array
             const logger = window.game?.debug || console;
             logger.warn(`[Vehicle ${this.id}] Attempted to recalculate stats but this.modules is not an array:`, this.modules);
             this.modules = []; // Reset to empty array if invalid
        }

        // Ensure stats don't go below reasonable minimums (e.g., 1 health, 0 speed/storage)
        this.maxHealth = Math.max(1, this.maxHealth);
        this.maxSpeed = Math.max(0, this.maxSpeed);
        this.storage = Math.max(0, this.storage);
        this.scanRadius = Math.max(0, this.scanRadius);

        // Ensure current health doesn't exceed the new max health
        this.health = Math.min(this.health, this.maxHealth);

        // Mark state changed if recalculation resulted in changes (optional, depends on what triggers sync)
        // This might cause unnecessary syncs if called frequently, rely on module add/remove triggering sync.
        // this._stateChanged = true; 
    }
    
    collidesWith(other) {
        // Basic circle collision detection
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
        // Custom rendering for vehicle
        ctx.fillStyle = this.color;
        
        // Draw vehicle body
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw direction indicator
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
    
    getNetworkState() {
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
        };
    }
    
    getFullNetworkState() {
        return {
            id: this.id,
            type: this.type,
            vehicleType: this.vehicleType,
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            maxHealth: this.maxHealth,
            driver: this.driver,
            passengers: [...this.passengers],
            modules: this.modules.map(m => ({ ...m })), 
        };
    }
    
    hasStateChanged() {
        if (this._stateChanged) return true;

        const currentState = this.getNetworkState(); 
        const lastState = this._lastNetworkState;

        const positionThresholdSq = 1 * 1; 
        const dx = currentState.x - lastState.x;
        const dy = currentState.y - lastState.y;
        const positionChanged = (dx * dx + dy * dy) > positionThresholdSq;

        const angleThreshold = 0.1; 
        const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - lastState.angle)) > angleThreshold;

        const speedThreshold = 1;
        const speedChanged = Math.abs(currentState.speed - lastState.speed) > speedThreshold;

        return positionChanged || angleChanged || speedChanged;
    }
    
    clearStateChanged() {
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}