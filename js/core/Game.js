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
import InteractionManager from './InteractionManager.js';
import PerformanceMonitor from './PerformanceMonitor.js';
import WorldObjectManager from '../world/WorldObjectManager.js';
import LightManager from '../lighting/LightManager.js';
import ShadowManager from '../lighting/ShadowManager.js'; // NEW: Import ShadowManager
import GameLoop from './GameLoop.js'; // NEW: Import GameLoop

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
        this.timeOfDay = 0.25; // Local default start time
        this.timeAuthority = false; // Is this client responsible for updating time?
        this.lastTimeSync = 0;
        this.timeSyncInterval = 15000; // Update time every 15 seconds if authority

        // Initialize core systems
        this.resources = new ResourceManager();
        this.input = new InputManager(this.canvas);
        this.renderer = new Renderer(this.canvas, this); // Pass game instance
        this.entities = new EntityManager();
        this.network = new NetworkManager(this); // Pass game instance
        this.ui = new UIManager(this); // Pass game instance
        this.collisions = new CollisionManager(this);
        this.interactions = new InteractionManager(this);
        this.performance = new PerformanceMonitor(this);
        this.worldObjectManager = new WorldObjectManager(this);
        this.lightManager = new LightManager(this);
        this.shadowManager = new ShadowManager(this); // NEW: Instantiate ShadowManager

        // Make config available to the game
        this.config = Config;

        // Player reference (potentially null in guest mode)
        this.player = null;
        this.world = null; // Initialize world as null
        this.noiseGenerator = null;
        this.noiseFunction = null; // Will be assigned after noiseGenerator is seeded

        // Seed Handling
        this.worldSeed = null;
        this.worldSeedPromise = null;
        this.worldSeedResolve = null;
        this.worldSeedConfirmed = false;

        // Bind game loop to maintain this context
        // Initialize the game loop controller (handles timing, update/render loop)
        this.loop = new GameLoop(this);
    }

    async initializeNetwork() {
        try {
            this.worldSeedPromise = new Promise((resolve) => {
                this.worldSeedResolve = resolve;
            });

            await this.network.initialize();

            if (!this.network.clientId) {
                this.isGuestMode = true;
                this.debug.warn("No client ID received. Entering Guest Mode.");
                this.ui.showNotification("Running in Guest Mode (Observer)", "warn", 5000);
                this.player = null;
                this.ui.setGuestMode(true);
                if (this.network.worldSeedConfirmed) {
                    this.worldSeedResolve(this.network.worldSeed);
                }
                this.timeAuthority = false;
            } else {
                this.isGuestMode = false;
                this.player = new Player(this.network.clientId, this);
                this.entities.add(this.player);
                this.updatePlayerNameFromPeers();
                this.ui.setGuestMode(false);
                if (this.network.worldSeed !== null) {
                    this.worldSeedResolve(this.network.worldSeed);
                }
                this.determineTimeAuthority();
            }

            this.addInitialTestVehicle();

            return true;
        } catch (error) {
            this.debug.error('Network initialization failed', error);
            const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `Network Error: ${error.message}`;
            if (this.worldSeedResolve) this.worldSeedResolve(null);
            throw error;
        }
    }

    determineTimeAuthority() {
        if (this.isGuestMode || !this.network?.clientId || !this.network?.room?.peers) {
            this.timeAuthority = false;
            return;
        }
        const clientIds = Object.keys(this.network.room.peers).sort();
        this.timeAuthority = clientIds.length > 0 && this.network.clientId === clientIds[0];
        this.debug.log(`Time authority check: ${this.timeAuthority ? 'Yes' : 'No'} (My ID: ${this.network.clientId}, Authority: ${clientIds[0]})`);

        if (this.timeAuthority && this.network.room.roomState?.timeOfDay === undefined) {
            this.debug.log("Assuming time authority and proposing initial timeOfDay.");
            this.network.updateRoomState({ timeOfDay: this.timeOfDay });
            this.lastTimeSync = performance.now();
        }
    }

    handlePeersChanged() {
        this.determineTimeAuthority();
        // Update local player name in case own peer info changed
        this.updatePlayerNameFromPeers();
    }

    setTimeOfDay(networkTime) {
        if (Math.abs(this.timeOfDay - networkTime) > 0.001) {
            this.timeOfDay = networkTime % 1;
        }
    }

    confirmWorldSeed(seed) {
        if (this.worldSeed === null && this.worldSeedResolve) {
            this.worldSeed = seed;
            this.worldSeedResolve(seed);
            this.debug.log(`World seed confirmed in Game: ${seed}`);
        } else if (this.worldSeed !== seed) {
            this.debug.warn(`Received seed confirmation (${seed}), but game already had seed (${this.worldSeed}). Ignoring.`);
        }
    }

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
                gridTiles: { // Add some default tiles for testing
                    '5,9': 'floor_metal', '6,9': 'floor_metal', '7,9': 'floor_metal',
                    '5,8': 'floor_metal', '6,8': 'floor_metal', '7,8': 'floor_metal',
                    '5,1': 'floor_metal', '6,1': 'floor_metal', '7,1': 'floor_metal',
                },
                gridObjects: {},
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
            if (!this.worldSeedConfirmed) {
                this.debug.log("Waiting for world seed confirmation...");
                this.worldSeed = await this.worldSeedPromise;
                if (this.worldSeed === null) {
                    throw new Error("Failed to obtain world seed.");
                }
                this.worldSeedConfirmed = true;
                this.debug.log(`World seed obtained: ${this.worldSeed}`);
            }

            if (typeof Noise === 'undefined') {
                throw new Error("Noise library (noisejs) not loaded.");
            }
            this.noiseGenerator = new Noise(this.worldSeed);
            this.noiseFunction = this.noiseGenerator.simplex2.bind(this.noiseGenerator); // Bind context
            this.debug.log(`Noise generator initialized with seed ${this.worldSeed}`);

            this.world = new World({
                seed: this.worldSeed,
                size: this.config.WORLD_SIZE,
                chunkSize: this.config.CHUNK_SIZE,
                maxLoadDistance: this.config.MAX_LOAD_DISTANCE,
                noiseFunction: this.noiseFunction,
                debug: this.debug,
                worldObjectManager: this.worldObjectManager // Pass the manager
            });
            await this.world.initialize();

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

    // Delegated control methods for the GameLoop
    start() { this.loop.start(); }
    stop() { this.loop.stop(); }
    renderErrorState(message) { return this.loop.renderErrorState(message); } // Keep compatibility
    renderFallbackBackground() { return this.loop.renderFallbackBackground(); } // Keep compatibility
}