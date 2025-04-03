export default class Player {
    constructor(id, game) {
        this.id = id;
        this.game = game;
        
        // Basic properties
        this.type = 'player';
        this.name = 'Player'; // Will be updated with network username
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = 200;
        this.acceleration = 200;
        this.deceleration = 300;
        this.rotationSpeed = 3; // radians per second
        this.size = 20;
        
        // Game stats
        this.health = 100;
        this.maxHealth = 100;
        this.resources = {
            metal: 0,
            energy: 0,
            food: 0
        };
        
        // Vehicle / base properties
        this.vehicleId = null;
        this.insideVehicle = false;
        
        // Collision properties
        this.radius = this.size / 2;
        this.mass = 10;
        
        // Network state tracking
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
    
    update(deltaTime, input) {
        if (!input) return;
        
        // Store previous position to detect changes
        const prevX = this.x;
        const prevY = this.y;
        const prevAngle = this.angle;
        
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
        
        // Check for state changes to trigger network updates
        if (
            this.x !== prevX ||
            this.y !== prevY ||
            this.angle !== prevAngle
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
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this._stateChanged = true;
        
        // Trigger damage effect
        // this.game.renderer.createEffect('damage', this.x, this.y);
        
        return this.health;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this._stateChanged = true;
        return this.health;
    }
    
    addResource(type, amount) {
        if (this.resources[type] !== undefined) {
            this.resources[type] += amount;
            this._stateChanged = true;
            return true;
        }
        return false;
    }
    
    collidesWith(other) {
        // Basic circle collision detection
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.radius + other.radius);
    }
    
    onCollision(other) {
        // Handle collision with other entities
        if (other.type === 'resource') {
            // Collect resource
            this.addResource(other.resourceType, other.amount);
            // Remove the resource entity
            this.game.entities.remove(other.id);
        } else if (other.type === 'vehicle' && !this.insideVehicle) {
            // Check if can enter vehicle
            if (input.isKeyDown('KeyE')) {
                this.enterVehicle(other);
            }
        }
    }
    
    enterVehicle(vehicle) {
        if (!vehicle || this.insideVehicle) return false;
        
        this.vehicleId = vehicle.id;
        this.insideVehicle = true;
        this._stateChanged = true;
        
        // Activate vehicle controller
        vehicle.setDriver(this.id);
        
        return true;
    }
    
    exitVehicle() {
        if (!this.insideVehicle) return false;
        
        const vehicle = this.game.entities.get(this.vehicleId);
        if (vehicle) {
            vehicle.removeDriver();
        }
        
        this.vehicleId = null;
        this.insideVehicle = false;
        this._stateChanged = true;
        
        return true;
    }
    
    render(ctx, x, y, size) {
        // Custom rendering for player
        // Adjust color based on health
        const healthPercent = this.health / this.maxHealth;
        const g = Math.floor(255 * healthPercent);
        ctx.fillStyle = `rgb(100, ${g}, 255)`;
        
        // Draw player body
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
    
    getNetworkState() {
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            resources: { ...this.resources },
            vehicleId: this.vehicleId
        };
    }
    
    hasStateChanged() {
        if (!this._stateChanged) return false;
        
        // Deep compare with last network state
        const currentState = this.getNetworkState();
        const lastState = this._lastNetworkState;
        
        // Check for significant changes (position threshold, etc)
        const positionThreshold = 0.5;
        const positionChanged = 
            Math.abs(currentState.x - lastState.x) > positionThreshold ||
            Math.abs(currentState.y - lastState.y) > positionThreshold;
            
        const angleThreshold = 0.1;
        const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - lastState.angle)) > angleThreshold;
        
        const healthChanged = currentState.health !== lastState.health;
        const vehicleChanged = currentState.vehicleId !== lastState.vehicleId;
        
        const resourcesChanged = Object.keys(currentState.resources).some(
            key => currentState.resources[key] !== lastState.resources[key]
        );
        
        return positionChanged || angleChanged || healthChanged || vehicleChanged || resourcesChanged;
    }
    
    clearStateChanged() {
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}

