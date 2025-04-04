import InputManager from './InputManager.js';
import Renderer from '../rendering/Renderer.js';
import World from '../world/World.js';
import EntityManager from '../entities/EntityManager.js';
import Player from '../entities/Player.js';
import NetworkManager from './NetworkManager.js';
import ResourceManager from './ResourceManager.js';
import { Config } from '../config/GameConfig.js';
import UIManager from '../ui/UIManager.js';
import Vehicle from '../entities/Vehicle.js'; // Needed for initial spawn
import CollisionManager from './CollisionManager.js';
import InteractionManager from './InteractionManager.js'; // NEW
import PerformanceMonitor from './PerformanceMonitor.js'; // NEW

// Make Player class globally accessible for EntityManager remote player creation
window.Player = Player;
// Make Vehicle class accessible if needed by NetworkManager sync (consider better dependency management later)
window.Vehicle = Vehicle;

export default class Game {
    constructor(options) {
        this.canvas = options.canvas;
        this.debug = options.debug;

        // Game state variables
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.deltaTime = 0; // Capped delta time for updates
        this.rawDeltaTime = 0; // Uncapped delta time for FPS calculation
        this.isGuestMode = false; // Flag for guest observer mode
        this.timeOfDay = 0.25; // Start at dawn (0 = midnight, 0.5 = noon, 1 = next midnight)

        // Initialize core systems
        this.resources = new ResourceManager();
        this.input = new InputManager(this.canvas);
        this.renderer = new Renderer(this.canvas, this); // Pass game instance
        this.entities = new EntityManager();
        this.network = new NetworkManager(this); // Pass game instance
        this.ui = new UIManager(this); // Pass game instance
        this.collisions = new CollisionManager(this);
        this.interactions = new InteractionManager(this); // NEW
        this.performance = new PerformanceMonitor(this); // NEW

        // Make config available to the game
        this.config = Config;

        // Player reference (potentially null in guest mode)
        this.player = null;
        this.world = null; // Initialize world as null

        // --- NEW: Seed Handling ---
        this.worldSeed = null;
        this.worldSeedPromise = null;
        this.worldSeedResolve = null;
        this.worldSeedConfirmed = false;
        // --- END NEW ---

        // Bind game loop to maintain this context
        this.gameLoop = this.gameLoop.bind(this);
    }

    async initializeNetwork() {
        try {
            // --- NEW: Set up promise for waiting on seed ---
            this.worldSeedPromise = new Promise((resolve) => {
                 this.worldSeedResolve = resolve;
            });
            // --- END NEW ---

            await this.network.initialize();

            if (!this.network.clientId) {
                 this.isGuestMode = true;
                 this.debug.warn("No client ID received. Entering Guest Mode.");
                 this.ui.showNotification("Running in Guest Mode (Observer)", "warn", 5000);
                 this.player = null;
                 this.ui.setGuestMode(true);
                 // Resolve seed promise immediately for guests if seed already available
                 if (this.network.worldSeedConfirmed) {
                    this.worldSeedResolve(this.network.worldSeed);
                 }
            } else {
                 this.isGuestMode = false;
                 this.player = new Player(this.network.clientId, this);
                 this.entities.add(this.player);
                 this.updatePlayerNameFromPeers();
                 this.ui.setGuestMode(false);
                 // Resolve seed promise immediately for non-guests if seed already available/proposed
                 if (this.network.worldSeed !== null) {
                    this.worldSeedResolve(this.network.worldSeed);
                 }
            }

            this.addInitialTestVehicle();

            return true;
        } catch (error) {
            this.debug.error('Network initialization failed', error);
            const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `Network Error: ${error.message}`;
            // Reject the seed promise on network error
            if(this.worldSeedResolve) this.worldSeedResolve(null); // Resolve with null on error? Or reject? Let's resolve null.
            throw error;
        }
    }

    // --- NEW: Method called by NetworkManager when seed is confirmed ---
    confirmWorldSeed(seed) {
         if (this.worldSeed === null && this.worldSeedResolve) {
            this.worldSeed = seed;
            this.worldSeedResolve(seed);
            this.debug.log(`World seed confirmed in Game: ${seed}`);
         } else if (this.worldSeed !== seed) {
            this.debug.warn(`Received seed confirmation (${seed}), but game already had seed (${this.worldSeed}). Ignoring.`);
         }
    }
    // --- END NEW ---

    addInitialTestVehicle() {
        if (this.isGuestMode || !this.network || !this.network.room) {
            this.debug.log("Guest mode or network not ready, skipping initial vehicle check.");
            return;
        }

        const currentVehicles = this.network.room.roomState?.vehicles;
        const testVehicleId = 'vehicle-test-hauler-initial';

        this.debug.log("Checking for initial test vehicle...");

        if (!currentVehicles || Object.keys(currentVehicles).length === 0 || !currentVehicles[testVehicleId]) {
             this.debug.log(`Attempting to add initial test vehicle (${testVehicleId})...`);
             const vehicleConfig = this.config?.VEHICLE_TYPES.find(v => v.id === 'hauler');
             if (!vehicleConfig) {
                 this.debug.error("Could not find 'hauler' vehicle config to spawn test vehicle.");
                 return;
             }
             const testVehicleState = {
                 id: testVehicleId,
                 type: 'vehicle',
                 vehicleType: 'hauler',
                 owner: null, x: 50, y: 50, angle: 0,
                 health: vehicleConfig.health,
                 maxHealth: vehicleConfig.health,
                 modules: [],
                 gridWidth: vehicleConfig.gridWidth || 12,
                 gridHeight: vehicleConfig.gridHeight || 10,
                 gridTiles: {}, gridObjects: {},
                 doorLocation: vehicleConfig.doorLocation || { x: 6, y: 9 },
                 pilotSeatLocation: vehicleConfig.pilotSeatLocation || { x: 6, y: 1 }
             };
             this.network.updateRoomState({ vehicles: { [testVehicleId]: testVehicleState } });
             this.debug.log(`Initial test vehicle added request sent.`);
        } else {
            this.debug.log(`Initial test vehicle (${testVehicleId}) already exists or other vehicles present.`);
        }
    }

    updatePlayerNameFromPeers() {
        if (!this.player || !this.network || this.isGuestMode) return;
        const peers = this.network.getPeers();
        const myPeerInfo = peers ? peers[this.player.id] : null;
        const newName = myPeerInfo ? myPeerInfo.username : `Player ${this.player.id.substring(0, 4)}`;
        if (this.player.name !== newName) {
             this.player.name = newName;
             this.debug.log(`Player name set to: ${this.player.name}`);
        }
    }

    async loadAssets() {
        try {
            const assetsToLoad = [];
            if (this.config.SPRITESHEET_CONFIG) {
                for (const key in this.config.SPRITESHEET_CONFIG) {
                    const sheet = this.config.SPRITESHEET_CONFIG[key];
                    if (sheet.id && sheet.url) {
                         assetsToLoad.push({ type: 'image', id: sheet.id, url: sheet.url });
                    } else {
                         this.debug.warn(`Invalid spritesheet config entry: ${key}`, sheet);
                    }
                }
            }
            this.resources.setOnProgress((loaded, total) => {
                // Progress handled in main.js
            });
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
            // --- NEW: Wait for world seed ---
            if (!this.worldSeedConfirmed) {
                this.debug.log("Waiting for world seed confirmation...");
                this.worldSeed = await this.worldSeedPromise; // Wait for the promise to resolve
                if (this.worldSeed === null) {
                     throw new Error("Failed to obtain world seed.");
                }
                this.worldSeedConfirmed = true; // Mark as confirmed after await
                this.debug.log(`World seed obtained: ${this.worldSeed}`);
            }
            // --- END NEW ---

            this.world = new World({
                // --- MODIFIED: Use confirmed seed ---
                seed: this.worldSeed,
                // --- END MODIFIED ---
                size: this.config.WORLD_SIZE,
                chunkSize: this.config.CHUNK_SIZE,
                maxLoadDistance: this.config.MAX_LOAD_DISTANCE,
                noise: window.perlin, // Assumes perlin is globally available
                debug: this.debug,
            });
            await this.world.initialize();

            // Player spawning logic remains the same
            if (this.player && !this.isGuestMode) {
                const startPosition = this.world.getRandomSpawnPoint();
                this.player.setPosition(startPosition.x, startPosition.y);
                this.debug.log(`Player spawned at (${startPosition.x.toFixed(0)}, ${startPosition.y.toFixed(0)})`);
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged();
            } else if (this.isGuestMode) {
                 this.debug.log("Guest mode: Skipping player spawn and initial sync.");
            } else {
                 this.debug.warn("World initialized, but player entity not found (and not in guest mode).");
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

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            this.performance.reset(); // Reset performance monitor on start
            requestAnimationFrame(this.gameLoop);
            this.debug.log('Game started');
        }
    }

    stop() {
        this.isRunning = false;
        this.debug.log('Game stopped');
        if (this.network) {
            this.network.disconnect();
        }
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        // Calculate delta time
        const now = performance.now();
        const rawDt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        this.deltaTime = Math.min(rawDt, 1 / 30);
        this.rawDeltaTime = rawDt;

        // Update performance metrics (moved here, uses timestamp and rawDt)
        this.performance.update(timestamp, this.rawDeltaTime);

        // Process input
        this.input.update();
        this.interactions.handleInput(now); // Call interaction manager

        // Update game logic
        this.update(this.deltaTime);

        // Render the scene
        this.render();

        // Request next frame
        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // --- Update Time of Day ---
        const cycleDuration = this.config.DAY_NIGHT_CYCLE_DURATION_SECONDS || 90;
        const timeIncrement = deltaTime / cycleDuration;
        this.timeOfDay = (this.timeOfDay + timeIncrement) % 1;

        // --- Player & Vehicle Update (Driven) ---
        if (this.player && !this.isGuestMode) {
            const vehicle = this.player.currentVehicleId ? this.entities.get(this.player.currentVehicleId) : null;
            const playerState = this.player.playerState;

            switch (playerState) {
                case 'Overworld':
                case 'Interior':
                    this.player.update(deltaTime, this.input);
                    break;
                case 'Piloting':
                     if (vehicle?.update) {
                         vehicle.update(deltaTime, this.input);
                         if (vehicle.hasStateChanged && vehicle.hasStateChanged()) {
                             this.network.updateRoomState({
                                 vehicles: { [vehicle.id]: vehicle.getMinimalNetworkState() }
                             });
                             if(vehicle.clearStateChanged) vehicle.clearStateChanged();
                         }
                     }
                    break;
                case 'Building':
                    // Call Building Manager update
                    this.ui?.baseBuilding?.buildingManager?.update?.(deltaTime);
                    break;
            }
            // Sync player state if changed
            if (this.player.hasStateChanged()) {
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged();
            }
        }

        // --- World Update ---
        const cameraCenterX = this.player ? this.player.x : 0;
        const cameraCenterY = this.player ? this.player.y : 0;
        this.world?.update(deltaTime, cameraCenterX, cameraCenterY);

        // --- Entity Updates (Non-Player/Non-Driven) ---
        for (const entity of this.entities.getAll()) {
             if (this.player && entity.id === this.player.id) continue;
             if (entity.type === 'vehicle' && this.player && entity.driver === this.player.id && this.player.playerState === 'Piloting') continue;
             entity.update?.(deltaTime, null);
        }

        // --- UI Update ---
        this.ui.update();

        // --- Collision Checks ---
        if (!this.isGuestMode && this.player?.playerState === 'Overworld') {
             this.collisions.checkCollisions();
        }
    }

    render() {
        if (!this.renderer) return;

        this.renderer.lastFrameTime = this.lastFrameTime;
        this.renderer.setTimeOfDay(this.timeOfDay);
        this.renderer.clear();

        if (this.player?.playerState === 'Interior') {
            const vehicle = this.entities.get(this.player.currentVehicleId);
            if (vehicle && this.renderer.interiorRenderer) {
                 this.renderer.interiorRenderer.render(vehicle, this.player);
            } else {
                 // Handle error rendering
                 const errorMsg = !vehicle ? 'Vehicle Not Found!' : 'Interior Renderer Missing!';
                 this.renderer.ctx.fillStyle = 'red';
                 this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
                 this.renderer.ctx.fillStyle = 'white';
                 this.renderer.ctx.font = '20px monospace';
                 this.renderer.ctx.textAlign = 'center';
                 this.renderer.ctx.fillText(`Error: ${errorMsg}`, this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);
            }
        } else if (this.player?.playerState === 'Building') {
             this.renderer.ctx.fillStyle = '#151515';
             this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        } else {
            // --- Overworld Rendering ---
            const cameraTarget = (this.player?.playerState === 'Piloting')
                ? this.entities.get(this.player.currentVehicleId)
                : (this.player ? this.player : { x: 0, y: 0 });

            this.world ? this.renderer.renderWorld(this.world, cameraTarget) : this.renderFallbackBackground();

             const entitiesToRender = (this.player?.playerState === 'Piloting')
                 ? this.entities.getAll().filter(e => e.id !== this.player.id)
                 : this.entities.getAll();
            this.renderer.renderEntities(entitiesToRender, this.player);
            this.renderer.renderEffects();
        }

        this.renderer.renderUI(this);
        // Debug info rendering is now handled by PerformanceMonitor calling renderer.renderDebugInfo

    }

    renderFallbackBackground() {
        this.renderer.ctx.fillStyle = '#111';
        this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
    }

    pauseSimulation() {
         this.debug.log("Simulation Paused (Input Disabled)");
     }

     resumeSimulation() {
         this.debug.log("Simulation Resumed");
     }
}