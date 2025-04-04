export default class Vehicle {
    constructor(id, type, owner) {
        this.id = id;
        this.type = 'vehicle';
        this.vehicleType = type;
        this.owner = owner;
        this.name = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = type.speed || 150;
        this.acceleration = 150;
        this.deceleration = 200;
        this.rotationSpeed = 2;
        this.size = 30;
        this.color = '#fa5';
        
        // Vehicle stats
        this.health = type.health || 200;
        this.maxHealth = type.health || 200;
        this.storage = type.storage || 100;
        this.modules = [];
        
        // Interaction properties
        this.driver = null;
        this.passengers = [];
        this.maxPassengers = type.maxPassengers || 1;
        
        // Collision properties
        this.radius = this.size / 2;
        this.mass = 20;
        
        // Network state tracking
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;

        // Debug only
        console.log(`Vehicle constructor called: id=${id}, type=${JSON.stringify(type)}, owner=${owner}`);
    }
    
    update(deltaTime, input) {
        if (!input) return;
        
        // Store previous state to detect changes
        const prevState = { x: this.x, y: this.y, angle: this.angle };
        
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
            this.angle !== prevState.angle
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
        this.driver = playerId;
        this._stateChanged = true;
    }
    
    removeDriver() {
        this.driver = null;
        this._stateChanged = true;
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
        this.health = Math.max(0, this.health - amount);
        this._stateChanged = true;
        return this.health;
    }
    
    repair(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this._stateChanged = true;
        return this.health;
    }
    
    addModule(module) {
        this.modules.push(module);
        this._stateChanged = true;
    }
    
    removeModule(moduleId) {
        this.modules = this.modules.filter(m => m.id !== moduleId);
        this._stateChanged = true;
    }
    
    collidesWith(other) {
        // Basic circle collision detection
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.radius + other.radius);
    }
    
    onCollision(other) {
        // Vehicle specific collision response
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

        // Debug indicator - draw a clear indication this is a vehicle
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x, y, size / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this._stateChanged = true;
    }
    
    getNetworkState() {
        return {
            id: this.id,
            type: this.type,
            vehicleType: this.vehicleType,
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            driver: this.driver,
            passengers: [...this.passengers],
            modules: this.modules.map(m => ({ ...m }))
        };
    }
    
    hasStateChanged() {
        return this._stateChanged;
    }
    
    clearStateChanged() {
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}