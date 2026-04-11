import InputManager from './InputManager.js';
import Renderer from '../rendering/Renderer.js';
import World from '../world/World.js';
import EntityManager from '../entities/EntityManager.js';
import Player from '../entities/Player.js';
import NetworkManager from './NetworkManager.js';
import ResourceManager from './ResourceManager.js';
import { Config } from '../config/GameConfig.js';
import UIManager from '../ui/UIManager.js';
import Vehicle from '../entities/Vehicle.js';
import CollisionManager from './CollisionManager.js';
import InteractionManager from './InteractionManager.js';
import PerformanceMonitor from './PerformanceMonitor.js';
import WorldObjectManager from '../world/WorldObjectManager.js';
import LightManager from '../lighting/LightManager.js';
import ShadowManager from '../lighting/ShadowManager.js';
import GameLoop from './GameLoop.js';

export default class Game {
    constructor(options) {
        this.canvas = options.canvas;
        this.debug = options.debug;

        // Game state variables
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.rawDeltaTime = 0;
        this.isGuestMode = false; // Always false in single-player; kept for API compatibility
        this.timeOfDay = 0.25;
        this.timeAuthority = true; // Always true in single-player
        this.lastTimeSync = 0;
        this.timeSyncInterval = 15000;

        // Initialize core systems
        this.resources = new ResourceManager();
        this.input = new InputManager(this.canvas);
        this.renderer = new Renderer(this.canvas, this);
        this.entities = new EntityManager(this);
        this.network = new NetworkManager(this);
        this.ui = new UIManager(this);
        this.collisions = new CollisionManager(this);
        this.interactions = new InteractionManager(this);
        this.performance = new PerformanceMonitor(this);
        this.worldObjectManager = new WorldObjectManager(this);
        this.lightManager = new LightManager(this);
        this.shadowManager = new ShadowManager(this);

        // Make config available to the game
        this.config = Config;

        // Player reference
        this.player = null;
        this.world = null;
        this.noiseGenerator = null;
        this.noiseFunction = null;

        // Seed Handling
        this.worldSeed = null;
        this.worldSeedConfirmed = false;

        // Initialize the game loop controller
        this.loop = new GameLoop(this);
    }

    /**
     * Initialize the "network" layer (single-player stub) and create the
     * local player entity.
     */
    async initializeNetwork() {
        try {
            await this.network.initialize();

            // In single-player the network always provides a clientId and seed.
            this.isGuestMode = false;
            this.worldSeed = this.network.worldSeed;
            this.worldSeedConfirmed = true;

            this.player = new Player(this.network.clientId, this);
            this.player.name = 'Player';
            this.entities.add(this.player);

            this.ui.setGuestMode(false);
            this.addInitialTestVehicle();

            return true;
        } catch (error) {
            this.debug.error('Initialization failed', error);
            const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `Init Error: ${error.message}`;
            throw error;
        }
    }

    /**
     * Spawn a starter hauler vehicle near the origin so the player has
     * something to interact with immediately.
     */
    addInitialTestVehicle() {
        const testVehicleId = 'vehicle-test-hauler-initial';
        const vehicleConfig = this.config?.VEHICLE_TYPES.find(v => v.id === 'hauler');
        if (!vehicleConfig) {
            this.debug.error("Could not find 'hauler' vehicle config to spawn test vehicle.");
            return;
        }

        const vehicle = new Vehicle(testVehicleId, vehicleConfig, null, this);
        vehicle.x = 50;
        vehicle.y = 50;
        vehicle.gridTiles = {
            '5,9': 'floor_metal', '6,9': 'floor_metal', '7,9': 'floor_metal',
            '5,8': 'floor_metal', '6,8': 'floor_metal', '7,8': 'floor_metal',
            '5,1': 'floor_metal', '6,1': 'floor_metal', '7,1': 'floor_metal',
        };
        this.entities.add(vehicle);
        this.debug.log(`Initial test vehicle (${testVehicleId}) spawned locally.`);
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
            this.resources.setOnProgress((_loaded, _total) => {
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
            if (typeof Noise === 'undefined') {
                throw new Error("Noise library (noisejs) not loaded.");
            }
            this.noiseGenerator = new Noise(this.worldSeed);
            this.noiseFunction = this.noiseGenerator.simplex2.bind(this.noiseGenerator);
            this.debug.log(`Noise generator initialized with seed ${this.worldSeed}`);

            this.world = new World({
                seed: this.worldSeed,
                size: this.config.WORLD_SIZE,
                chunkSize: this.config.CHUNK_SIZE,
                maxLoadDistance: this.config.MAX_LOAD_DISTANCE,
                noiseFunction: this.noiseFunction,
                debug: this.debug,
                worldObjectManager: this.worldObjectManager
            });
            await this.world.initialize();

            if (this.player) {
                const startPosition = this.world.getRandomSpawnPoint();
                this.player.setPosition(startPosition.x, startPosition.y);
                this.debug.log(`Player spawned at (${startPosition.x.toFixed(0)}, ${startPosition.y.toFixed(0)})`);
                this.player.clearStateChanged();
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
    renderErrorState(message) { return this.loop.renderErrorState(message); }
    renderFallbackBackground() { return this.loop.renderFallbackBackground(); }
}