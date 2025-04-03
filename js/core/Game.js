import InputManager from './InputManager.js';
import Renderer from './Renderer.js';
import World from '../world/World.js';
import EntityManager from '../entities/EntityManager.js';
import Player from '../entities/Player.js';
import NetworkManager from './NetworkManager.js';
import ResourceManager from './ResourceManager.js';
import { Config } from '../config/GameConfig.js';
import UIManager from '../ui/UIManager.js';
import Vehicle from '../entities/Vehicle.js';
// Import noise library if needed for world generation options
import perlin from 'perlin'; // Assuming perlin is available via import map

export default class Game {
    constructor(options) {
        this.canvas = options.canvas;
        this.debug = options.debug;
        
        // Game state variables
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.deltaTime = 0; // Capped delta time for updates
        this.rawDeltaTime = 0; // Uncapped delta time for FPS calculation

        // Initialize core systems
        this.resources = new ResourceManager();
        this.input = new InputManager(this.canvas);
        this.renderer = new Renderer(this.canvas, this); // Pass game reference to renderer
        this.entities = new EntityManager();
        this.network = new NetworkManager(this);
        this.ui = new UIManager(this); 
        
        // Make config available to the game
        this.config = Config;
        
        // Player reference (initialized after network)
        this.player = null;

        // Debug performance metrics
        this.frameCounter = 0;
        this.frameTimeAccumulator = 0;
        this.fpsUpdateInterval = 1000; // Update FPS display every second
        this.lastFpsUpdate = 0;
        
        // Bind game loop to maintain this context
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    async initializeNetwork() {
        try {
            await this.network.initialize();
            this.debug.log('Network connection established');
            
            // Initialize the player *after* network connection
            if (this.network.clientId) {
                this.player = new Player(this.network.clientId, this);
                this.entities.add(this.player); // Add player to manager immediately
                
                // Update player name using peer info
                this.updatePlayerNameFromPeers(); // Use helper function

            } else {
                 throw new Error("Network initialized but clientId is missing.");
            }

            // Set up network event handling
            this.setupNetworkHandlers();
            
            return true;
        } catch (error) {
            this.debug.error('Network initialization failed', error);
            const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `Network Error: ${error.message}`;
            throw error;
        }
    }

    updatePlayerNameFromPeers() {
        if (!this.player || !this.network) return;
        const peers = this.network.getPeers();
        const myPeerInfo = peers ? peers[this.player.id] : null;
        this.player.name = myPeerInfo ? myPeerInfo.username : `Player ${this.player.id.substring(0, 4)}`;
        this.debug.log(`Player name set to: ${this.player.name}`);
    }
    
    async loadAssets() {
        try {
            const assetsToLoad = [];

            // Add spritesheets from config
            if (this.config.SPRITESHEET_CONFIG) {
                for (const key in this.config.SPRITESHEET_CONFIG) {
                    const sheet = this.config.SPRITESHEET_CONFIG[key];
                     // Use the ID specified within the sheet config object
                    assetsToLoad.push({ type: 'image', id: sheet.id, url: sheet.url }); 
                }
            }

            await this.resources.loadAssets(assetsToLoad);
            
            this.debug.log('Assets loaded successfully');
            return true;
        } catch (error) {
            this.debug.error('Asset loading failed', error);
            throw error;
        }
    }
    
    async initializeWorld() {
        try {
            // Create the game world
            this.world = new World({
                seed: this.config.WORLD_SEED || Math.floor(Math.random() * 999999),
                size: this.config.WORLD_SIZE,
                chunkSize: this.config.CHUNK_SIZE,
                maxLoadDistance: this.config.MAX_LOAD_DISTANCE,
                noise: perlin, // Pass the imported noise generator
                debug: this.debug, // Pass debug instance
            });
            
            await this.world.initialize();
            
            // Position player in the world
            if (this.player) {
                const startPosition = this.world.getRandomSpawnPoint();
                this.player.setPosition(startPosition.x, startPosition.y);
                this.debug.log(`Player spawned at (${startPosition.x.toFixed(0)}, ${startPosition.y.toFixed(0)})`);
                
                // Sync initial player state to network
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged(); // Mark initial state as sent
            } else {
                 this.debug.warn("Player entity not initialized before world initialization completed.");
            }
            
            this.debug.log('World initialized successfully');
            return true;
        } catch (error) {
            this.debug.error('World initialization failed', error);
             const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `World Error: ${error.message}`;
            throw error;
        }
    }
    
    setupNetworkHandlers() {
        if (!this.network || !this.network.room) {
            this.debug.error("Network manager or room not available for setting up handlers.");
            return;
        }

        // Handle peer presence updates
        this.network.subscribePresence((presence) => {
            // Update peer names dynamically
            const peers = this.network.getPeers();
            for (const entity of this.entities.getByType('player')) {
                 const peerInfo = peers ? peers[entity.id] : null;
                 const expectedName = peerInfo ? peerInfo.username : `Player ${entity.id.substring(0,4)}`;
                 if (entity.name !== expectedName) {
                    entity.name = expectedName;
                 }
            }
            // Sync entity states from presence data
            // Pass localPlayerId to avoid self-updating position based on network echo
            this.entities.syncFromNetworkPresence(presence, this.player ? this.player.id : null);
        });
        
        // Handle room state updates
        this.network.subscribeRoomState((roomState) => {
            if (this.world) {
                this.world.syncFromNetworkState(roomState);
            }
             // Sync vehicle states if they are in roomState
             if (roomState.vehicles) {
                 this.syncVehiclesFromNetwork(roomState.vehicles);
             }
        });
        
        // Handle presence update requests
        this.network.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });
        
        // Handle network events (onmessage)
        this.network.room.onmessage = (event) => {
            // Assuming event structure is { data: { type: ..., payload: ... } }
            this.handleNetworkEvent(event.data || event);
        };
    }

    syncVehiclesFromNetwork(networkVehicles) {
        const presentVehicleIds = new Set(Object.keys(networkVehicles));

        // Update or create vehicles
        for (const vehicleId in networkVehicles) {
            const data = networkVehicles[vehicleId];
            let vehicle = this.entities.get(vehicleId);

            if (data === null) { // Vehicle removed
                 if (vehicle) this.entities.remove(vehicleId);
                 continue;
            }

            if (!vehicle) {
                 // Create new vehicle entity if it doesn't exist
                 const vehicleConfig = this.config.VEHICLE_TYPES.find(v => v.id === data.vehicleType);
                 if (!vehicleConfig) {
                     console.warn(`Received data for unknown vehicle type: ${data.vehicleType}`);
                     continue;
                 }
                 // Assuming Vehicle class constructor exists and takes initial state
                 vehicle = new Vehicle(vehicleId, vehicleConfig, data.owner); // Might need adjustment based on Vehicle class constructor
                 this.entities.add(vehicle);
                 // console.log(`Created network vehicle ${vehicleId}`); // Less noisy log
            }

             // Update vehicle state (position, health, modules, driver etc.)
             // Avoid directly setting position if interpolation is handled elsewhere,
             // but update other critical state.
             vehicle.x = data.x ?? vehicle.x;
             vehicle.y = data.y ?? vehicle.y;
             vehicle.angle = data.angle ?? vehicle.angle;
             vehicle.health = data.health ?? vehicle.health;
             vehicle.maxHealth = data.maxHealth ?? vehicle.maxHealth; // Ensure maxHealth is synced if it changes (e.g., armor)
             vehicle.driver = data.driver ?? null;
             vehicle.passengers = data.passengers ?? []; // Assuming passengers is an array/object that can be assigned
             vehicle.modules = data.modules ?? []; // Sync modules

             // If vehicle has an interpolation target, update it here
             // if (vehicle.updateTargetState) {
             //    vehicle.updateTargetState(data);
             // }
        }

         // Remove local vehicle entities that are no longer in the room state
         const currentVehicles = this.entities.getByType('vehicle');
         for (const localVehicle of currentVehicles) {
             if (!presentVehicleIds.has(localVehicle.id)) {
                 console.log(`Removing vehicle ${localVehicle.id} (no longer in room state)`);
                 this.entities.remove(localVehicle.id);
             }
         }
    }

    handlePresenceUpdateRequest(updateRequest, fromClientId) {
        if (!this.player) return;

        switch (updateRequest.type) {
            case 'damage':
                 const damageAmount = updateRequest.amount || 0;
                 if (damageAmount > 0) {
                     const previousHealth = this.player.health;
                     this.player.takeDamage(damageAmount);
                     this.debug.log(`Took ${damageAmount} damage from ${fromClientId}. Health: ${this.player.health}`);

                     // Update network presence ONLY if health actually changed
                     if (this.player.health !== previousHealth) {
                         this.network.updatePresence({
                             health: this.player.health,
                             // dead: this.player.health <= 0 // Consider if 'dead' state is needed
                         });
                         // Trigger local damage effect
                         this.renderer.createEffect('damage_taken', this.player.x, this.player.y);
                     }
                 }
                break;

             case 'give_resource':
                 if (updateRequest.resourceType && updateRequest.amount > 0) {
                     if (this.player.addResource(updateRequest.resourceType, updateRequest.amount)) {
                         this.network.updatePresence({
                             resources: this.player.resources
                         });
                         this.ui.showNotification(`Received ${updateRequest.amount} ${updateRequest.resourceType} from ${this.network.getPeerUsername(fromClientId)}`, 'success');
                     } else {
                          console.warn(`Failed to add resource type: ${updateRequest.resourceType} from ${fromClientId}`);
                     }
                 }
                 break;

            // Add more cases as needed (e.g., interaction requests)

            default:
                 this.debug.log(`Received unknown presence update request type: ${updateRequest.type} from ${fromClientId}`);
                 break;
        }
    }
    
    handleNetworkEvent(eventData) {
        if (!eventData || !eventData.type) return;

        // Don't process events sent by self unless echo is explicitly handled
        // if (eventData.clientId === this.network.clientId && !eventData.echo) return;

        switch (eventData.type) {
            case 'connected':
                this.debug.log(`Player connected: ${eventData.username || 'Unknown'} (${eventData.clientId})`);
                 // Ensure player name is updated if they connect after initial load
                 if (this.player && eventData.clientId === this.player.id) {
                     this.updatePlayerNameFromPeers();
                 } else {
                     // Trigger presence sync to potentially create the new player entity
                     this.entities.syncFromNetworkPresence(this.network.room.presence, this.player?.id); // Ensure player exists before accessing id
                 }
                break;
                
            case 'disconnected':
                this.debug.log(`Player disconnected: ${eventData.username || 'Unknown'} (${eventData.clientId})`);
                // Entity removal is handled by syncFromNetworkPresence
                break;
                
            case 'explosion':
                if (this.renderer && typeof eventData.x === 'number' && typeof eventData.y === 'number') {
                    this.renderer.createEffect(
                        'explosion',
                        eventData.x,
                        eventData.y,
                        { size: eventData.size || 1 }
                    );
                }
                break;
             
             // Example: Play sound effect triggered by another player
             case 'play_sound':
                 // Placeholder for audio system integration
                 // AudioManager.playSound(eventData.soundId, eventData.x, eventData.y, eventData.volume);
                 // this.debug.log(`Received play_sound event: ${eventData.soundId}`);
                 break;

            // Handle custom events

            default:
                 // this.debug.log('Received event:', eventData); // Can be very noisy
                 break;
        }
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            this.lastFpsUpdate = this.lastFrameTime;
            requestAnimationFrame(this.gameLoop);
            this.debug.log('Game started');
        }
    }
    
    stop() {
        this.isRunning = false;
        this.debug.log('Game stopped');
        // Consider cleanup tasks here if necessary
    }
    
    gameLoop(timestamp) {
        if (!this.isRunning) return;

        const now = performance.now();
        const rawDt = (now - this.lastFrameTime) / 1000; 
        this.lastFrameTime = now;
        this.deltaTime = Math.min(rawDt, 1 / 30); 
        this.rawDeltaTime = rawDt; 

        this.updatePerformanceMetrics(now);
        this.input.update(); 
        this.update(this.deltaTime);
        this.render();
        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // Update player state (movement, actions)
        if (this.player) {
            const vehicle = this.player.vehicleId ? this.entities.get(this.player.vehicleId) : null;
            const isDriving = vehicle && vehicle.driver === this.player.id;

            if (!isDriving) {
                this.player.update(deltaTime, this.input);
            }

            if (this.player.hasStateChanged()) {
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged();
            }

            if (isDriving && vehicle && vehicle.update) {
                 vehicle.update(deltaTime, this.input);
                 if (vehicle.hasStateChanged && vehicle.hasStateChanged()) {
                     this.network.updateRoomState({
                         vehicles: {
                             [vehicle.id]: vehicle.getNetworkState() 
                         }
                     });
                     if(vehicle.clearStateChanged) vehicle.clearStateChanged();
                 }
            }
        }

        if (this.world && this.player) {
            this.world.update(deltaTime, this.player.x, this.player.y);
        }
        
        this.entities.update(deltaTime);
        this.ui.update(); 
        this.checkCollisions();
    }

    checkCollisions() {
        const entities = this.entities.getAll();
        const checkableEntities = entities.filter(e => e.collidesWith && e.onCollision); 

        for (let i = 0; i < checkableEntities.length; i++) {
            const entityA = checkableEntities[i];
            for (let j = i + 1; j < checkableEntities.length; j++) {
                const entityB = checkableEntities[j];
                 if (this.broadPhaseCheck(entityA, entityB)) {
                    if (entityA.collidesWith(entityB)) {
                        entityA.onCollision(entityB);
                        entityB.onCollision(entityA);
                    }
                 }
            }
             // Check collision with world resources/features
             if (this.world && (entityA.type === 'player' || entityA.type === 'vehicle')) {
                  // Reduce radius slightly for check to avoid overly frequent chunk lookups
                 const checkRadius = (entityA.radius || entityA.size / 2) + 50; 
                 const nearbyChunks = this.world.getChunksInRadius(entityA.x, entityA.y, checkRadius); 
                 for (const chunk of nearbyChunks) {
                      // Combine features and resources for collision check
                     const objects = [...(chunk.features || []), ...(chunk.resources || [])]; 
                     for (const obj of objects) {
                         if (obj && obj.collides && this.simpleCircleCollision(entityA, obj)) {
                             entityA.onCollision(obj);
                         }
                     }
                 }
             }
        }
    }

     broadPhaseCheck(entityA, entityB) {
         const radiusA = (entityA.radius || entityA.size / 2);
         const radiusB = (entityB.radius || entityB.size / 2);
          if (!radiusA || !radiusB) return false; // Avoid checks if size/radius is missing
         const dx = Math.abs(entityA.x - entityB.x);
         const dy = Math.abs(entityA.y - entityB.y);
         return dx < radiusA + radiusB && dy < radiusA + radiusB;
     }

     simpleCircleCollision(entity, obj) {
         const radiusA = (entity.radius || entity.size / 2);
         const radiusB = (obj.radius || obj.size / 2); 
         if (!radiusA || !radiusB) return false; 
         const dx = entity.x - obj.x;
         const dy = entity.y - obj.y;
         const distanceSq = dx * dx + dy * dy;
         const radiiSumSq = (radiusA + radiusB) * (radiusA + radiusB);
         return distanceSq < radiiSumSq;
     }

    render() {
        if (!this.renderer) return;

        this.renderer.lastFrameTime = this.lastFrameTime; // Update renderer timer

        this.renderer.clear();
        
        if (this.world && this.player) {
            this.renderer.renderWorld(this.world, this.player);
        } else {
             this.renderer.ctx.fillStyle = '#111';
             this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        }
        
        this.renderer.renderEntities(this.entities.getAll(), this.player);
        this.renderer.renderEffects();
        this.renderer.renderUI(this); 
        
        // Debug info is rendered via DOM overlay managed by renderer/debug utils now
    }

    updatePerformanceMetrics(timestamp) {
        this.frameCounter++;
        this.frameTimeAccumulator += this.rawDeltaTime;

        if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
             const avgFps = this.frameTimeAccumulator > 0 ? Math.round(this.frameCounter / this.frameTimeAccumulator) : 0;
             const avgFrameTimeMs = this.frameCounter > 0 ? (this.frameTimeAccumulator / this.frameCounter) * 1000 : 0;

            if (this.debug) {
                 const memoryUsage = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'N/A';
                 const networkState = this.network ? (this.network.connected ? 'Connected' : 'Disconnected') : 'N/A';

                 this.debug.updateStats({
                    FPS: avgFps,
                    FrameTime: avgFrameTimeMs.toFixed(2) + ' ms',
                    DeltaTime: this.deltaTime.toFixed(4) + ' s', 
                    Entities: this.entities ? this.entities.count() : 'N/A',
                    PlayerPos: this.player ? `(${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})` : 'N/A',
                    Memory: memoryUsage,
                    ActiveChunks: this.world ? this.world.chunkManager.activeChunkIds.size : 'N/A',
                    Network: networkState,
                    ClientID: this.network ? this.network.clientId?.substring(0, 8) : 'N/A'
                });
                // Renderer updates the DOM overlay using the latest debug data
                 if (this.renderer) {
                     this.renderer.renderDebugInfo(this.debug.getDebugData());
                 }
            }

            this.frameCounter = 0;
            this.frameTimeAccumulator = 0;
            this.lastFpsUpdate = timestamp;
        }
    }

     pauseSimulation() {
         this.debug.log("Simulation Paused (Input Disabled)");
     }

     resumeSimulation() {
         this.debug.log("Simulation Resumed");
     }
}