import MovementController from '../core/MovementController.js';
import LightSource from '../lighting/LightSource.js'; 

export default class Player {
    constructor(id, game) {
        this.id = id;
        this.game = game;

        // Basic properties
        this.type = 'player';
        this.name = 'Player'; 
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = 200;
        this.acceleration = 200;
        this.deceleration = 300;
        this.rotationSpeed = 3; 
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
        this.playerState = 'Overworld'; 
        this.currentVehicleId = null; 
        this.gridX = 0; 
        this.gridY = 0; 
        this.interiorMoveSpeed = 5; 

        this.lightSourceId = null; 
        this.createPersonalLightSource(); 

        // Equipment
        this.equipment = {
            weapon: null,
            armor: null,
            tool: null
        };

        // Collision properties
        this.radius = this.size / 2;
        this.mass = 10;
        this.collidesWith = this.collidesWith; 
        this.onCollision = this.onCollision; 

        // Network state tracking
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;

        // Add movement controller
        this.movementController = new MovementController();
    }

    createPersonalLightSource() {
        if (!this.game?.entities || this.lightSourceId) {
            return; 
        }

        const lightId = `playerlight-${this.id}`;
        const lightOptions = {
            x: this.x,
            y: this.y,
            color: { r: 255, g: 230, b: 180 }, 
            intensity: 0.8,
            range: 250, 
            ownerId: this.id 
        };

        try {
            const lightSource = new LightSource(lightId, lightOptions);
            const addedLight = this.game.entities.add(lightSource);
            if (addedLight) {
                this.lightSourceId = lightId;
                this.game.debug.log(`[Player ${this.id}] Created personal light source: ${lightId}`);
            } else {
                this.game.debug.error(`[Player ${this.id}] Failed to add personal light source to EntityManager.`);
            }
        } catch (error) {
            this.game.debug.error(`[Player ${this.id}] Error creating LightSource:`, error);
        }
    }

    update(deltaTime, input) {
        if (!input) return;
        const prevState = {
            x: this.x, y: this.y, angle: this.angle, speed: this.speed, health: this.health,
            resources: { ...this.resources }, 
            playerState: this.playerState, currentVehicleId: this.currentVehicleId,
            gridX: this.gridX, gridY: this.gridY
        };
        let stateDidChange = false;
        if (this.playerState === 'Overworld') {
             this.movementController.updateTankControls(this, input, deltaTime);
        } else if (this.playerState === 'Interior') {
             const direction = input.getMovementDirection();
             const vehicle = this.game.entities.get(this.currentVehicleId);
             let canMoveX = true;
             let canMoveY = true;
             if (vehicle && (direction.x !== 0 || direction.y !== 0)) {
                 const moveAmount = this.interiorMoveSpeed * deltaTime;
                 const nextGridX = this.gridX + direction.x * moveAmount;
                 const nextGridY = this.gridY + direction.y * moveAmount;
                 if (direction.x !== 0) {
                     const targetCellX = Math.floor(nextGridX + 0.5 * Math.sign(direction.x));
                     const currentCellY = Math.floor(this.gridY);
                     const cellKeyX = `${targetCellX},${currentCellY}`;
                     const objectInCellX = vehicle.gridObjects?.[cellKeyX];
                     const objectConfigX = objectInCellX ? this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectInCellX) : null;
                     if (objectConfigX?.collides) {
                         canMoveX = false;
                     }
                 }
                 if (direction.y !== 0) {
                      const targetCellY = Math.floor(nextGridY + 0.5 * Math.sign(direction.y));
                     const currentCellX = Math.floor(this.gridX);
                     const cellKeyY = `${currentCellX},${targetCellY}`;
                     const objectInCellY = vehicle.gridObjects?.[cellKeyY];
                     const objectConfigY = objectInCellY ? this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectInCellY) : null;
                      if (objectConfigY?.collides) {
                         canMoveY = false;
                      }
                 }
                 if (canMoveX) {
                    this.gridX = nextGridX;
                 }
                 if (canMoveY) {
                    this.gridY = nextGridY;
                 }
                  this.gridX = Math.max(0, Math.min(vehicle.gridWidth ? vehicle.gridWidth - 0.01 : 9.99, this.gridX));
                  this.gridY = Math.max(0, Math.min(vehicle.gridHeight ? vehicle.gridHeight - 0.01 : 9.99, this.gridY));
             }
        } else if (this.playerState === 'Piloting' || this.playerState === 'Building') {
             this.speed = 0;
        }
        if (
            this.x !== prevState.x ||
            this.y !== prevState.y ||
            this.angle !== prevState.angle ||
            this.speed !== prevState.speed ||
            this.health !== prevState.health ||
            this.playerState !== prevState.playerState ||
            this.currentVehicleId !== prevState.currentVehicleId ||
            Math.abs(this.gridX - prevState.gridX) > 0.001 ||
            Math.abs(this.gridY - prevState.gridY) > 0.001 ||
            JSON.stringify(this.resources) !== JSON.stringify(prevState.resources)
        ) {
            stateDidChange = true;
        }
        if (stateDidChange) {
             this._stateChanged = true;
        }
    }

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this._stateChanged = true;

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
         this.resources[type] = amount;
         this._stateChanged = true;
         this.game.debug.log(`Player ${this.id} added new resource type '${type}' with amount ${amount}`);
         return true;
    }

    equipItem(item) {
        if (!item || !item.type || !item.slot) return false;
        const previousItem = this.equipment[item.slot];
        this.equipment[item.slot] = item;
        if (item.effect) {
            for (const [stat, value] of Object.entries(item.effect)) {
                if (stat === 'maxHealth') {
                    this.maxHealth += value;
                }
            }
        }
        this._stateChanged = true;
        return true;
    }

    unequipItem(slot) {
        if (!slot || !this.equipment[slot]) return false;
        const item = this.equipment[slot];
        if (item.effect) {
            for (const [stat, value] of Object.entries(item.effect)) {
                if (stat === 'maxHealth') {
                    this.maxHealth -= value;
                    this.health = Math.min(this.health, this.maxHealth); 
                }
            }
        }
        this.equipment[slot] = null;
        this._stateChanged = true;
        return true;
    }

    collidesWith(other) {
         const radiusA = this.radius;
         const radiusB = (other.radius || other.size / 2 || 0);
         if (radiusA <= 0 || radiusB <= 0) return false;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (radiusA + radiusB);
    }

    onCollision(other) {
        if (!other || this.playerState !== 'Overworld') return; 

        if ((other.type === 'resource' || other.type === 'feature') && other.collides === true) {
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
                const pushFactor = 0.51;
                const nx = dx / distance;
                const ny = dy / distance;
                this.x += nx * penetration * pushFactor;
                this.y += ny * penetration * pushFactor;
                this.speed = 0;
                 this._stateChanged = true;
            }
            return;
        }

        if (other.type === 'player') {
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
                const pushFactor = 0.51;
                const nx = dx / distance;
                const ny = dy / distance;
                this.x += nx * penetration * pushFactor * 0.5;
                this.y += ny * penetration * pushFactor * 0.5;
                this.speed *= 0.8;
                this._stateChanged = true;
            }
        }
    }

    render(ctx, x, y, size) {
        const healthPercent = this.health / this.maxHealth;
        const g = Math.floor(255 * healthPercent);
        ctx.fillStyle = `rgb(100, ${g}, 255)`;
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
        this.x = x;
        this.y = y;
        this._stateChanged = true;
        return this;
    }

    getNetworkState() {
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            speed: this.speed,
            health: this.health,
            resources: { ...this.resources },
            equipment: { ...this.equipment },
            playerState: this.playerState,
            currentVehicleId: this.currentVehicleId,
            gridX: this.gridX,
            gridY: this.gridY,
        };
    }

    hasStateChanged() {
        if (this._stateChanged) return true;
        const currentState = this.getNetworkState();
        const lastState = this._lastNetworkState || {};
        let movementChanged = false;
        if (currentState.playerState === 'Overworld' && lastState.playerState === 'Overworld') {
            const positionThresholdSq = 0.5*0.5;
            const dx = currentState.x - (lastState.x || 0);
            const dy = currentState.y - (lastState.y || 0);
            const positionChanged = (dx * dx + dy * dy) > positionThresholdSq;
            const angleThreshold = 0.05;
            const angleChanged = Math.abs(this.normalizeAngle(currentState.angle - (lastState.angle || 0))) > angleThreshold;
            const speedThreshold = 1;
            const speedChanged = Math.abs(currentState.speed - (lastState.speed || 0)) > speedThreshold;
            movementChanged = positionChanged || angleChanged || speedChanged;
        }
        const healthChanged = currentState.health !== lastState.health;
        const gridPosThreshold = 0.1;
        const interiorStateChanged = currentState.playerState !== lastState.playerState ||
                                     currentState.currentVehicleId !== lastState.currentVehicleId ||
                                     Math.abs(currentState.gridX - (lastState.gridX ?? 0)) > gridPosThreshold ||
                                     Math.abs(currentState.gridY - (lastState.gridY ?? 0)) > gridPosThreshold;
        const resourcesChanged = JSON.stringify(currentState.resources) !== JSON.stringify(lastState.resources || {});
        const equipmentChanged = JSON.stringify(currentState.equipment) !== JSON.stringify(lastState.equipment || {});
        return movementChanged || healthChanged || resourcesChanged || equipmentChanged || interiorStateChanged;
    }

    clearStateChanged() {
        this._lastNetworkState = this.getNetworkState();
        this._stateChanged = false;
    }
}