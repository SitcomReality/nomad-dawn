export default class Vehicle {
    // Constructor now accepts the vehicle configuration object instead of just the type string
    constructor(id, config, owner) { 
        if (!config || typeof config !== 'object') {
             // Use game debug if available, otherwise console
             const logger = window.game?.debug || console;
             logger.error(`[Vehicle] Invalid config passed to constructor for ID ${id}:`, config);
             // Set default values to prevent further errors
             config = { 
                 id: 'unknown', 
                 name: 'Unknown Vehicle', 
                 speed: 100, 
                 health: 100, 
                 storage: 50, 
                 maxPassengers: 0 
             };
        }

        this.id = id;
        this.type = 'vehicle';
        this.vehicleType = config.id; // Store the type ID from config
        this.owner = owner;
        this.name = config.name || `${config.id.charAt(0).toUpperCase() + config.id.slice(1)}`; // Use name from config, fallback to formatting ID
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = config.speed || 150; // Use config value or default
        this.acceleration = 150;
        this.deceleration = 200;
        this.rotationSpeed = 2;
        this.size = 30;
        this.color = '#fa5';
        
        // Vehicle stats from config
        this.health = config.health || 200;
        this.maxHealth = config.health || 200;
        this.storage = config.storage || 100;
        this.modules = [];
        
        // Interaction properties
        this.driver = null;
        this.passengers = [];
        this.maxPassengers = config.maxPassengers || 1; // Use config value or default
        
        // Collision properties
        this.radius = this.size / 2;
        this.mass = 20;
        
        // Network state tracking
        this._lastNetworkState = this.getNetworkState();
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
        this._stateChanged = true;
    }
    
    removeModule(moduleId) {
        const initialLength = this.modules.length;
        this.modules = this.modules.filter(m => m.id !== moduleId);
        if (this.modules.length !== initialLength) {
             this._stateChanged = true;
        }
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
    
    // Get the state relevant for network synchronization
    // Important: This should only include data managed by the *driver* or *server authoritative* logic.
    // Basic state (position, angle, speed) is updated by the driver.
    // Health, modules, passengers might be updated via room state or requests.
    getNetworkState() {
        return {
            // ID and type are less critical for updates but useful for full state sync
            // id: this.id,
            // type: this.type,
            // vehicleType: this.vehicleType,
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            // Health, modules, passengers, driver are typically part of the full room state,
            // not necessarily updated *by* the driver's presence update.
            // Including them here might cause conflicts if driven by room state sync.
            // health: this.health,
            // driver: this.driver,
            // passengers: [...this.passengers],
            // modules: this.modules.map(m => ({ ...m })) // Send copy
        };
    }
    
    // Full state including things potentially managed by room state
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
            maxHealth: this.maxHealth, // Include maxHealth
            driver: this.driver,
            passengers: [...this.passengers],
            modules: this.modules.map(m => ({ ...m })) // Send copy
        };
    }
    
    hasStateChanged() {
        // Check if current state differs significantly from last sent state
        if (this._stateChanged) return true;

        const currentState = this.getNetworkState(); // Only check driver-controlled state
        const lastState = this._lastNetworkState;

        const positionThresholdSq = 1 * 1; // Use squared distance
        const dx = currentState.x - lastState.x;
        const dy = currentState.y - lastState.y;
        const positionChanged = (dx * dx + dy * dy) > positionThresholdSq;

        const angleThreshold = 0.1; // Radians
        const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - lastState.angle)) > angleThreshold;

        const speedThreshold = 1;
        const speedChanged = Math.abs(currentState.speed - lastState.speed) > speedThreshold;

        // Add checks for other driver-controlled properties if any

        return positionChanged || angleChanged || speedChanged;
    }
    
    clearStateChanged() {
        // Update last sent state with the current state *relevant to driver updates*
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}