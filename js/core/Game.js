import InputManager from './InputManager.js';
import Renderer from './Renderer.js';
import World from '../world/World.js';
import EntityManager from '../entities/EntityManager.js';
import Player from '../entities/Player.js';
import NetworkManager from './NetworkManager.js';
import ResourceManager from './ResourceManager.js';
import { Config } from '../config/GameConfig.js';
import MinimapRenderer from '../ui/MinimapRenderer.js';

export default class Game {
    constructor(options) {
        this.canvas = options.canvas;
        this.debug = options.debug;
        
        // Game state variables
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        
        // Initialize core systems
        this.resources = new ResourceManager();
        this.input = new InputManager(this.canvas);
        this.renderer = new Renderer(this.canvas);
        this.entities = new EntityManager();
        this.network = new NetworkManager(this);
        
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
            // This ensures the clientId is available
            if (this.network.clientId) {
                this.player = new Player(this.network.clientId, this);
                // Add player to entity manager BEFORE trying to set position/send updates
                this.entities.add(this.player); 
                
                // Update player name using peer info if available immediately
                const peers = this.network.getPeers();
                if (peers && peers[this.player.id]) {
                    this.player.name = peers[this.player.id].username || `Player ${this.player.id.substring(0, 4)}`;
                } else {
                     this.player.name = `Player ${this.player.id.substring(0, 4)}`; // Fallback name
                }

            } else {
                 throw new Error("Network initialized but clientId is missing.");
            }

            // Set up network event handling
            this.setupNetworkHandlers();
            
            return true;
        } catch (error) {
            this.debug.error('Network initialization failed', error);
            // Display error to user?
            const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `Network Error: ${error.message}`;
            throw error; // Re-throw to stop initialization
        }
    }
    
    async loadAssets() {
        try {
            // Load essential game assets
            await this.resources.loadAssets([
                // List assets to load here
                // { type: 'texture', id: 'player', url: 'path/to/texture' },
            ]);
            
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
                seed: Math.floor(Math.random() * 999999),
                size: Config.WORLD_SIZE,
                chunkSize: Config.CHUNK_SIZE,
                // Pass the debug instance to the world
                debug: this.debug 
            });
            
            // Initialize the world (generate starting chunks, etc.)
            await this.world.initialize();
            
            // Position player in the world *only if player exists*
            if (this.player) {
                const startPosition = this.world.getRandomSpawnPoint();
                this.player.setPosition(startPosition.x, startPosition.y); // Use the method
                
                // Sync initial player state to network
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged(); // Clear the flag after initial sync
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
        if (!this.network) return; // Guard against missing network manager

        // Handle peer presence updates (player movements, etc.)
        this.network.subscribePresence((presence) => {
            // Update peer names when presence changes (catches late joins/name updates)
            const peers = this.network.getPeers();
            for (const entity of this.entities.getByType('player')) {
                 if (peers && peers[entity.id] && entity.name !== peers[entity.id].username) {
                    entity.name = peers[entity.id].username || `Player ${entity.id.substring(0,4)}`;
                 }
            }
            // Sync entity states from presence data
            this.entities.syncFromNetworkPresence(presence, this.player ? this.player.id : null); 
        });
        
        // Handle room state updates (world objects, resources, etc.)
        this.network.subscribeRoomState((roomState) => {
            if (this.world) {
                this.world.syncFromNetworkState(roomState);
            }
        });
        
        // Handle presence update requests (damage, resource transfers, etc.)
        this.network.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });
        
        // Handle network events (sounds, effects, etc.)
        // Ensure onmessage is assigned correctly
        this.network.room.onmessage = (event) => {
            // The event structure might be { data: { type: ..., payload: ... } }
            // Adjust based on WebsimSocket specifics if needed
            this.handleNetworkEvent(event.data || event); 
        };
    }

    handlePresenceUpdateRequest(updateRequest, fromClientId) {
        // Handle incoming presence update requests targeting this client
        if (!this.player) return; // Should not happen if initialized correctly

        switch (updateRequest.type) {
            case 'damage':
                this.player.takeDamage(updateRequest.amount);
                
                // Update our network presence with new health
                this.network.updatePresence({
                    health: this.player.health,
                    dead: this.player.health <= 0
                    // Add other relevant fields if needed
                });
                
                // Optionally trigger local damage effect
                this.renderer.createEffect('damage_taken', this.player.x, this.player.y);
                break;

             case 'give_resource':
                 if (updateRequest.resourceType && updateRequest.amount > 0) {
                     if (this.player.addResource(updateRequest.resourceType, updateRequest.amount)) {
                         // Resource added successfully, update presence
                         this.network.updatePresence({
                             resources: this.player.resources
                         });
                          // Optionally show feedback to the player
                         this.debug.log(`Received ${updateRequest.amount} ${updateRequest.resourceType} from ${fromClientId}`);
                     } else {
                          console.warn(`Failed to add resource type: ${updateRequest.resourceType}`);
                     }
                 }
                 break;

            default:
                 this.debug.log(`Received unknown presence update request type: ${updateRequest.type} from ${fromClientId}`);
                 break;
        }
    }
    
    handleNetworkEvent(eventData) {
        // Ensure eventData has a type
        if (!eventData || !eventData.type) {
            // console.warn("Received network event without data or type:", eventData);
            // Handle built-in connect/disconnect if they don't follow the type structure
             if (typeof eventData === 'string' && eventData.includes('connected')) {
                 // Basic handling for simple connection messages if applicable
                 this.debug.log(`Network message: ${eventData}`);
             }
            return; 
        }

        // Process different types of network events
        switch (eventData.type) {
            // Built-in Websim events (confirm structure if needed)
            case 'connected':
                 const connectedPeer = this.network.getPeers()[eventData.clientId];
                 const connectedUsername = connectedPeer ? connectedPeer.username : 'Unknown';
                this.debug.log(`Player connected: ${connectedUsername} (${eventData.clientId})`);
                 // Add entity if it doesn't exist yet (handles late joins)
                 if (!this.entities.get(eventData.clientId) && eventData.clientId !== this.player.id) {
                     this.entities.syncFromNetworkPresence({ [eventData.clientId]: {} }); // Trigger creation
                 }
                break;
                
            case 'disconnected':
                 const disconnectedPeer = this.network.getPeers()[eventData.clientId];
                 const disconnectedUsername = disconnectedPeer ? disconnectedPeer.username : eventData.username || 'Unknown'; // Use username from event if peer info already removed
                this.debug.log(`Player disconnected: ${disconnectedUsername} (${eventData.clientId})`);
                // Removal is handled by syncFromNetworkPresence when presence entry disappears
                break;
                
            // Handle custom event types
            case 'explosion':
                // Create explosion effect at given location
                if (this.renderer) {
                    this.renderer.createEffect(
                        'explosion', 
                        eventData.x || 0, 
                        eventData.y || 0, 
                        { size: eventData.size || 1 } // Pass size via options
                    );
                }
                break;

            // Example: Handle resource collection confirmation/broadcast if needed
            // case 'resource_collected_event':
            //     if (eventData.playerId === this.player.id) {
            //          // Confirmation for self, maybe update UI state
            //     } else {
            //          // Another player collected, maybe play a sound
            //          const resource = this.world.resources[eventData.resourceId]; // Might already be removed by roomState sync
            //          if (resource && this.renderer) {
            //               this.renderer.createEffect('collect_remote', resource.x, resource.y, { color: resource.color });
            //          }
            //     }
            //     break;
                
            default:
                // this.debug.log('Unknown event received:', eventData); // Can be noisy
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
    }
    
    gameLoop(timestamp) {
        if (!this.isRunning) return; // Exit if stopped

        // Calculate delta time in seconds
        const dt = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;
        
        // Cap delta time to prevent large jumps after tab switching, etc.
        this.deltaTime = Math.min(dt, 0.1); // Use capped value for updates
        
        // Update performance metrics using raw dt for accurate FPS
        this.updatePerformanceMetrics(timestamp, dt); 
        
        // Process input
        this.input.update(); // Input manager might reset states here
        
        // Update game state
        this.update(this.deltaTime);
        
        // Render the frame
        this.render();
        
        // Continue loop
        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // Update player
        if (this.player && !this.player.insideVehicle) { // Only control player directly if not in vehicle
            this.player.update(deltaTime, this.input);
            
            // Sync player state to network if changed
            if (this.player.hasStateChanged()) {
                const state = this.player.getNetworkState();
                 // Only send necessary updates if possible, otherwise send full state
                this.network.updatePresence(state); 
                this.player.clearStateChanged();
            }
        } else if (this.player && this.player.insideVehicle) {
             // Handle vehicle control input separately if needed
             // e.g., pass input to the vehicle entity
             const vehicle = this.entities.get(this.player.vehicleId);
             if (vehicle && vehicle.update) {
                 // Vehicle might need input passed to it
                 // vehicle.update(deltaTime, this.input); 
             }
        }
        
        // Update world (chunk loading/unloading based on player position)
        if (this.world && this.player) {
            this.world.update(deltaTime, this.player.x, this.player.y);
        }
        
        // Update all entities (including remote players, vehicles, etc.)
        this.entities.update(deltaTime);
        
        // Check for collisions
        this.checkCollisions();
    }

    checkCollisions() {
        // Basic collision detection between entities
        // For more complex games, this would be handled by a dedicated physics system
        const entities = this.entities.getAll();
        
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                if (entities[i].collidesWith(entities[j])) {
                    entities[i].onCollision(entities[j]);
                    entities[j].onCollision(entities[i]);
                }
            }
        }
    }

    render() {
        if (!this.renderer) return; // Ensure renderer exists

        // Clear the canvas
        this.renderer.clear();
        
        // Render the world (if initialized)
        if (this.world && this.player) { // Need player for camera focus
            this.renderer.renderWorld(this.world, this.player);
        }
        
        // Render all entities (pass player for highlighting)
        this.renderer.renderEntities(this.entities.getAll(), this.player);
        
        // Render visual effects
        this.renderer.renderEffects(); // Ensure effects are rendered
        
        // Render UI elements (HUD, minimap)
        this.renderer.renderUI(this);
        
        // Render debug information if enabled
        if (this.debug && this.debug.isEnabled()) {
            this.renderer.renderDebugInfo(this.debug.getDebugData());
        }
    }

    updatePerformanceMetrics(timestamp, rawDeltaTime) { // Use raw dt for FPS calc
        this.frameCounter++;
        // Use the actual time difference for accurate FPS calculation
        this.frameTimeAccumulator += rawDeltaTime; 
        
        // Update FPS counter every second
        if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            const fps = Math.round(this.frameCounter / this.frameTimeAccumulator); // FPS = frames / time elapsed
            const averageFrameTime = (this.frameTimeAccumulator / this.frameCounter) * 1000; // Avg time in ms
            
            // Update debug stats
            if (this.debug) {
                 this.debug.updateStats({
                    fps: fps || 0,
                    frameTime: averageFrameTime ? averageFrameTime.toFixed(2) : '0.00',
                    entityCount: this.entities ? this.entities.count() : 0,
                    playerPosition: this.player ? `(${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})` : 'N/A',
                    memory: performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'N/A',
                    activeChunks: this.world ? this.world.activeChunkIds.size : 'N/A'
                });
            }
            
            // Reset counters
            this.frameCounter = 0;
            this.frameTimeAccumulator = 0;
            this.lastFpsUpdate = timestamp;
        }
    }
}