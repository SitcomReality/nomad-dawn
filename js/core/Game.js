import InputManager from './InputManager.js';
import Renderer from './Renderer.js';
import World from '../world/World.js';
import EntityManager from '../entities/EntityManager.js';
import Player from '../entities/Player.js';
import NetworkManager from './NetworkManager.js';
import ResourceManager from './ResourceManager.js';
import { Config } from '../config/GameConfig.js';

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
            
            // Initialize the player with network connection
            this.player = new Player(this.network.clientId, this);
            this.entities.add(this.player);
            
            // Set up network event handling
            this.setupNetworkHandlers();
            
            return true;
        } catch (error) {
            this.debug.error('Network initialization failed', error);
            throw error;
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
                chunkSize: Config.CHUNK_SIZE
            });
            
            // Initialize the world (generate starting chunks, etc.)
            await this.world.initialize();
            
            // Position player in the world
            const startPosition = this.world.getRandomSpawnPoint();
            this.player.setPosition(startPosition.x, startPosition.y);
            
            // Sync initial player state to network
            this.network.updatePresence({
                x: startPosition.x,
                y: startPosition.y,
                vehicleId: null,
                resources: this.player.resources,
                health: this.player.health
            });
            
            this.debug.log('World initialized successfully');
            return true;
        } catch (error) {
            this.debug.error('World initialization failed', error);
            throw error;
        }
    }
    
    setupNetworkHandlers() {
        // Handle peer presence updates (player movements, etc.)
        this.network.subscribePresence((presence) => {
            this.entities.syncFromNetworkPresence(presence);
        });
        
        // Handle room state updates (world objects, resources, etc.)
        this.network.subscribeRoomState((roomState) => {
            this.world.syncFromNetworkState(roomState);
        });
        
        // Handle presence update requests (damage, resource transfers, etc.)
        this.network.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });
        
        // Handle game events (sounds, effects, etc.)
        this.network.onmessage = (event) => {
            this.handleNetworkEvent(event.data);
        };
    }
    
    handlePresenceUpdateRequest(updateRequest, fromClientId) {
        // Handle incoming presence update requests
        if (updateRequest.type === 'damage') {
            this.player.takeDamage(updateRequest.amount);
            
            // Update our network presence with new health
            this.network.updatePresence({
                health: this.player.health,
                dead: this.player.health <= 0
            });
        }
        
        // Handle other types of presence update requests as needed
    }
    
    handleNetworkEvent(eventData) {
        // Process different types of network events
        switch (eventData.type) {
            case 'connected':
                this.debug.log(`Player connected: ${eventData.username} (${eventData.clientId})`);
                break;
                
            case 'disconnected':
                this.debug.log(`Player disconnected: ${eventData.username} (${eventData.clientId})`);
                break;
                
            // Handle custom event types
            case 'explosion':
                // Create explosion effect at given location
                this.renderer.createEffect('explosion', eventData.x, eventData.y, eventData.size);
                break;
                
            default:
                this.debug.log('Unknown event received:', eventData);
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
        // Calculate delta time in seconds
        this.deltaTime = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;
        
        // Cap delta time to prevent large jumps after tab switching, etc.
        if (this.deltaTime > 0.1) this.deltaTime = 0.1;
        
        // Update performance metrics
        this.updatePerformanceMetrics(timestamp);
        
        // Process input
        this.input.update();
        
        // Update game state
        this.update(this.deltaTime);
        
        // Render the frame
        this.render();
        
        // Continue loop if game is still running
        if (this.isRunning) {
            requestAnimationFrame(this.gameLoop);
        }
    }
    
    update(deltaTime) {
        // Update player
        if (this.player) {
            this.player.update(deltaTime, this.input);
            
            // Sync player state to network if changed
            if (this.player.hasStateChanged()) {
                this.network.updatePresence({
                    x: this.player.x,
                    y: this.player.y,
                    angle: this.player.angle,
                    speed: this.player.speed,
                    vehicleId: this.player.vehicleId,
                    resources: this.player.resources,
                    health: this.player.health
                });
                this.player.clearStateChanged();
            }
        }
        
        // Update world (chunk loading/unloading based on player position)
        if (this.world && this.player) {
            this.world.update(deltaTime, this.player.x, this.player.y);
        }
        
        // Update all entities
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
        // Clear the canvas
        this.renderer.clear();
        
        // Render the world (if initialized)
        if (this.world) {
            this.renderer.renderWorld(this.world, this.player);
        }
        
        // Render all entities
        this.renderer.renderEntities(this.entities.getAll(), this.player);
        
        // Render UI elements
        this.renderer.renderUI(this);
        
        // Render debug information if enabled
        if (this.debug.isEnabled()) {
            this.renderer.renderDebugInfo(this.debug.getDebugData());
        }
    }
    
    updatePerformanceMetrics(timestamp) {
        this.frameCounter++;
        this.frameTimeAccumulator += this.deltaTime;
        
        // Update FPS counter every second
        if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            const fps = Math.round(this.frameCounter * 1000 / (timestamp - this.lastFpsUpdate));
            const averageFrameTime = this.frameTimeAccumulator * 1000 / this.frameCounter;
            
            // Update debug stats
            this.debug.updateStats({
                fps: fps,
                frameTime: averageFrameTime.toFixed(2),
                entityCount: this.entities.count(),
                playerPosition: this.player ? `(${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})` : 'N/A',
                memory: performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'N/A'
            });
            
            // Reset counters
            this.frameCounter = 0;
            this.frameTimeAccumulator = 0;
            this.lastFpsUpdate = timestamp;
        }
    }
}

