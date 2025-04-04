import InputManager from './InputManager.js';
import Renderer from '../rendering/Renderer.js';
import World from '../world/World.js';
import EntityManager from '../entities/EntityManager.js';
import Player from '../entities/Player.js';
import NetworkManager from './NetworkManager.js';
import ResourceManager from './ResourceManager.js';
import { Config } from '../config/GameConfig.js';
import UIManager from '../ui/UIManager.js';
import Vehicle from '../entities/Vehicle.js'; // Needed for collision checks and initial spawn
import CollisionManager from './CollisionManager.js'; // Import the new CollisionManager

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
        // Pass game instance to Renderer constructor
        this.renderer = new Renderer(this.canvas, this);
        this.entities = new EntityManager();
        // Pass game instance to NetworkManager constructor
        this.network = new NetworkManager(this);
        // Pass game instance to UIManager constructor
        this.ui = new UIManager(this);
        // Initialize CollisionManager
        this.collisions = new CollisionManager(this);

        // Make config available to the game
        this.config = Config;

        // Player reference (potentially null in guest mode)
        this.player = null;

        // Debug performance metrics
        this.frameCounter = 0;
        this.frameTimeAccumulator = 0;
        this.fpsUpdateInterval = 1000; // Update FPS display every second
        this.lastFpsUpdate = 0;

        // Interaction settings
        this.interactionDistance = 75; // Max distance to interact with vehicles

        // Make Vehicle class accessible if needed by NetworkManager sync (consider better dependency management later)
        window.Vehicle = Vehicle;

        // Bind game loop to maintain this context
        this.gameLoop = this.gameLoop.bind(this);
    }

    async initializeNetwork() {
        try {
            await this.network.initialize();

            // Check if we got a client ID. If not, enter guest mode.
            if (!this.network.clientId) {
                 this.isGuestMode = true;
                 this.debug.warn("No client ID received. Entering Guest Mode.");
                 this.ui.showNotification("Running in Guest Mode (Observer)", "warn", 5000);
                 // Don't initialize player object
                 this.player = null;
                 // Modify UI for guest mode
                 this.ui.setGuestMode(true); 
            } else {
                 this.isGuestMode = false;
                 // Initialize the player *after* network connection
                 this.player = new Player(this.network.clientId, this);
                 this.entities.add(this.player); // Add player to manager immediately

                 // Update player name using peer info
                 this.updatePlayerNameFromPeers(); 

                 // Modify UI for player mode
                 this.ui.setGuestMode(false);
            }

            // Network handlers are now set up inside network.initialize()

            // Add initial test vehicle if none exists in room state
            // We check inside the method if guest or not
            this.addInitialTestVehicle();

            return true;
        } catch (error) {
            // If network init *itself* fails catastrophically
            this.debug.error('Network initialization failed', error);
            const loadingMessage = document.querySelector('#loading-screen p');
            if (loadingMessage) loadingMessage.textContent = `Network Error: ${error.message}`;
            // Potentially force guest mode on catastrophic failure? Or just halt.
            // For now, halt by re-throwing.
            throw error; 
        }
    }

    // Function to add the initial test vehicle if needed
    addInitialTestVehicle() {
         // Guests cannot add vehicles
        if (this.isGuestMode || !this.network || !this.network.room) {
            this.debug.log("Guest mode or network not ready, skipping initial vehicle check.");
            return;
        }

        const currentVehicles = this.network.room.roomState?.vehicles;
        const testVehicleId = 'vehicle-test-hauler-initial';

        this.debug.log("Checking for initial test vehicle...");
        this.debug.log("Current roomState.vehicles:", currentVehicles);

        // Check if the room state already has vehicles or the specific test vehicle
        // Check if currentVehicles is truthy before checking keys or content
        if (!currentVehicles || Object.keys(currentVehicles).length === 0 || !currentVehicles[testVehicleId]) {
             this.debug.log(`Attempting to add initial test vehicle (${testVehicleId})...`);

             // Find the config for the 'hauler' vehicle
             const vehicleConfig = this.config?.VEHICLE_TYPES.find(v => v.id === 'hauler');
             if (!vehicleConfig) {
                 this.debug.error("Could not find 'hauler' vehicle config to spawn test vehicle.");
                 return;
             }

             // Define the vehicle state including default grid properties
             const testVehicleState = {
                 id: testVehicleId,
                 type: 'vehicle',
                 vehicleType: 'hauler',
                 owner: null, // No owner initially
                 x: 50,       // Position near origin
                 y: 50,
                 angle: 0,
                 health: vehicleConfig.health,
                 maxHealth: vehicleConfig.health,
                 modules: [],
                 // Add default grid properties
                 gridWidth: 5,
                 gridHeight: 5,
                 gridTiles: { // Example basic floor
                    '0,0':'Floor', '1,0':'Floor', '2,0':'Floor', '3,0':'Floor', '4,0':'Floor',
                    '0,1':'Floor', '1,1':'Floor', '2,1':'Floor', '3,1':'Floor', '4,1':'Floor',
                    '0,2':'Floor', '1,2':'Floor', '2,2':'Floor', '3,2':'Floor', '4,2':'Floor',
                    '0,3':'Floor', '1,3':'Floor', '2,3':'Floor', '3,3':'Floor', '4,3':'Floor',
                    '0,4':'Floor', '1,4':'Floor', '2,4':'Floor', '3,4':'Floor', '4,4':'Floor',
                 },
                 gridObjects: {},
                 doorLocation: { x: 0, y: 0 },
                 pilotSeatLocation: { x: 1, y: 0 },
             };

             this.debug.log(`Sending updateRoomState for vehicle:`, testVehicleState);
             // Send the update to the room state
             this.network.updateRoomState({
                 vehicles: {
                     [testVehicleId]: testVehicleState
                 }
             });
             this.debug.log(`Initial test vehicle added request sent.`);
        } else {
            this.debug.log(`Initial test vehicle (${testVehicleId}) already exists in room state or other vehicles present.`);
        }
    }

    // Function to update player name (kept in Game for access to this.player)
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
            const assetsToLoad = [
                // Define any non-spritesheet assets here if needed
                // { type: 'audio', id: 'collect_sound', url: '/sounds/collect.wav' },
            ];

            // Add spritesheets from config
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
                noise: window.perlin, 
                // Pass the debug instance itself, not just the boolean flag
                debug: this.debug, 
            });

            await this.world.initialize();

            // Position player in the world only if not in guest mode
            if (this.player && !this.isGuestMode) {
                const startPosition = this.world.getRandomSpawnPoint();
                this.player.setPosition(startPosition.x, startPosition.y);
                this.debug.log(`Player spawned at (${startPosition.x.toFixed(0)}, ${startPosition.y.toFixed(0)})`);

                // Sync initial player state to network
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged(); // Mark initial state as sent
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
            this.lastFpsUpdate = this.lastFrameTime;
            requestAnimationFrame(this.gameLoop);
            this.debug.log('Game started');
        }
    }

    stop() {
        this.isRunning = false;
        this.debug.log('Game stopped');
        if (this.network) {
            this.network.disconnect(); // Clean up network listeners
        }
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        // Calculate delta time
        const now = performance.now();
        const rawDt = (now - this.lastFrameTime) / 1000; // Delta time in seconds
        this.lastFrameTime = now;

        // Cap delta time for physics/updates to prevent instability
        this.deltaTime = Math.min(rawDt, 1 / 30); // Cap at 30 FPS equivalent
        this.rawDeltaTime = rawDt; // Store uncapped for FPS calculation

        // Update performance metrics first
        this.updatePerformanceMetrics(now);

        // Process input
        this.input.update(); // Reset one-time inputs like mouse wheel

        // Update game logic
        this.update(this.deltaTime);

        // Render the scene
        this.render();

        // Request next frame
        requestAnimationFrame(this.gameLoop);
    }

    // --- Refactored Input Handling ---
    handlePlayerInput(deltaTime) {
        if (!this.player || this.isGuestMode || !this.input) return;

        const player = this.player;
        const input = this.input;

        // --- State Transition Logic ---
        if (input.isKeyDown('KeyE')) {
            input.keys['KeyE'] = false; // Consume the key press to prevent repeated triggers

            if (player.playerState === 'Overworld') {
                const nearbyVehicle = this.findClosestVehicle(player.x, player.y, this.interactionDistance);
                if (nearbyVehicle) {
                    this.debug.log("Attempting to enter vehicle...");
                    player.enterVehicle(nearbyVehicle); // Player handles state change internally
                }
            } else if (player.playerState === 'Interior') {
                const currentVehicle = this.entities.get(player.currentVehicleId);
                if (currentVehicle) {
                     // Check if at door
                     if (player.gridX === currentVehicle.doorLocation?.x && player.gridY === currentVehicle.doorLocation?.y) {
                         this.debug.log("Attempting to exit vehicle...");
                         player.exitVehicle();
                     }
                     // Check if at pilot seat
                     else if (player.gridX === currentVehicle.pilotSeatLocation?.x && player.gridY === currentVehicle.pilotSeatLocation?.y) {
                         this.debug.log("Attempting to start piloting...");
                         player.startPilotingVehicle();
                     }
                     // Add checks for other interactive grid objects later
                }
            } else if (player.playerState === 'Piloting') {
                this.debug.log("Attempting to stop piloting...");
                player.stopPilotingVehicle();
            }
        }
        // --- End State Transition Logic ---

        // Handle Player Movement / Action (if not driving/in specific UI state)
        const vehicle = player.currentVehicleId ? this.entities.get(player.currentVehicleId) : null;
        const isDriving = player.playerState === 'Piloting' && vehicle;
        const isUIActive = this.ui.isMajorUIActive();

        if (!isDriving && !isUIActive) {
            player.update(deltaTime, input);
        }

        // Handle Vehicle Movement (if player is driving)
        if (isDriving && vehicle && !isUIActive) {
            vehicle.update(deltaTime, input);
             // Sync vehicle state if it changed
             if (vehicle.hasStateChanged && vehicle.hasStateChanged()) {
                 this.network.updateRoomState({
                     vehicles: {
                         [vehicle.id]: vehicle.getNetworkState()
                     }
                 });
                 if(vehicle.clearStateChanged) vehicle.clearStateChanged();
             }
        }

        // Sync player state if changed
        if (player.hasStateChanged()) {
            this.network.updatePresence(player.getNetworkState());
            player.clearStateChanged();
        }
    }
    // --- End Refactored Input Handling ---

    update(deltaTime) {
        // --- Update Time of Day ---
        const cycleDuration = this.config.DAY_NIGHT_CYCLE_DURATION_SECONDS || 60;
        const timeIncrement = deltaTime / cycleDuration;
        this.timeOfDay = (this.timeOfDay + timeIncrement) % 1; // Keep time between 0 and 1

        // --- Handle Player Input & Updates (Refactored) ---
        this.handlePlayerInput(deltaTime);

        // --- World Update ---
        const cameraCenterX = this.player ? this.player.x : 0; // Center on 0,0 in guest mode
        const cameraCenterY = this.player ? this.player.y : 0;
        if (this.world) {
            this.world.update(deltaTime, cameraCenterX, cameraCenterY);
        }

        // --- Entity Updates ---
        // Update all OTHER entities (remote players, AI, non-driven vehicles)
        // Find entities that are NOT the local player AND NOT the vehicle driven by the local player
        const localPlayerId = this.player ? this.player.id : null;
        const drivenVehicleId = (this.player && this.player.playerState === 'Piloting') ? this.player.currentVehicleId : null;

        this.entities.getAll().forEach(entity => {
             if (!entity) return;
             // Skip local player and the vehicle they are piloting (handled in handlePlayerInput)
             if (entity.id === localPlayerId || entity.id === drivenVehicleId) {
                 return;
             }
             // Remote player interpolation and other entity updates happen here
             if (entity.update) {
                 entity.update(deltaTime);
             }
        });

        // --- UI Update ---
        this.ui.update(); // Updates HUD, checks open panels

        // --- Collision Checks (Use CollisionManager, Skip for Guests) ---
        if (!this.isGuestMode) {
            this.collisions.checkCollisions(); // Use the collision manager
        }
    }

    render() {
        if (!this.renderer) return;

        // Update renderer's internal timer for effects
        this.renderer.lastFrameTime = this.lastFrameTime;

        // Update renderer's lighting system time
        this.renderer.setTimeOfDay(this.timeOfDay);

        // Clear canvas
        this.renderer.clear();

        // Determine camera target for rendering
        // Follow player in Overworld, center on 0,0 otherwise (or maybe vehicle pos?)
        let cameraTarget = { x: 0, y: 0 };
        if (this.player) {
            if (this.player.playerState === 'Overworld') {
                cameraTarget = this.player;
            } else if (this.player.playerState === 'Piloting') {
                const vehicle = this.entities.get(this.player.currentVehicleId);
                if (vehicle) cameraTarget = vehicle;
            }
            // In 'Interior' or 'Building' state, keep camera centered or handle differently later
        } else if (this.isGuestMode) {
            // Maybe follow a selected player in guest mode? For now, origin.
            cameraTarget = { x: 0, y: 0 };
        }

        // Render world background and chunks (Renderer handles camera update based on target)
        if (this.world) {
             // TODO: Conditional Rendering based on playerState
             if (this.player && this.player.playerState === 'Interior') {
                 // Call InteriorRenderer (Phase 2)
                 // this.renderer.renderInterior(this.entities.get(this.player.currentVehicleId), this.player);
                 // Clear background for now
                  this.renderer.clear();
                  this.renderer.ctx.fillStyle = '#050510';
                  this.renderer.ctx.fillRect(0,0, this.renderer.canvas.width, this.renderer.canvas.height);
                  // Add text placeholder
                   this.renderer.ctx.fillStyle = 'white';
                   this.renderer.ctx.font = '20px monospace';
                   this.renderer.ctx.textAlign = 'center';
                   this.renderer.ctx.fillText(`Inside Vehicle ${this.player.currentVehicleId} (Grid: ${this.player.gridX}, ${this.player.gridY}) - Rendering TBD`, this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);

             } else if (this.player && this.player.playerState === 'Building') {
                 // World still visible, but Building UI is overlayed (handled by UIManager)
                  this.renderer.renderWorld(this.world, cameraTarget);
             } else {
                 // Render Overworld normally
                 this.renderer.renderWorld(this.world, cameraTarget);
             }

        } else {
             // Fallback background if world not ready
             this.renderer.clear();
             this.renderer.ctx.fillStyle = '#111';
             this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        }

        // Render entities (players, vehicles, etc.)
        // Conditionally render based on player state
        if (!this.player || (this.player.playerState !== 'Interior')) {
             // Don't render the local player entity if they are inside a vehicle
             const entitiesToRender = this.entities.getAll().filter(e => {
                return !(this.player && e.id === this.player.id && this.player.playerState !== 'Overworld');
             });
            this.renderer.renderEntities(entitiesToRender, this.player);
        }

        // Render visual effects (always render)
        this.renderer.renderEffects();

        // Render UI overlays (Minimap rendered here, HUD elements are DOM)
        // Pass game state which includes player (or null)
        this.renderer.renderUI(this);

        // Render debug information onto the DOM overlay
        if (this.debug && this.debug.isEnabled()) {
            // The actual DOM update happens in updatePerformanceMetrics
            // No need to call renderDebugInfo here if it's handled there.
            // this.renderer.renderDebugInfo(this.debug.getDebugData());
        }
    }

    updatePerformanceMetrics(timestamp) {
        this.frameCounter++;
        // Use the raw delta time for FPS calculation
        this.frameTimeAccumulator += this.rawDeltaTime;

        if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
             const avgFps = this.frameTimeAccumulator > 0 ? Math.round(this.frameCounter / this.frameTimeAccumulator) : 0;
             const avgFrameTimeMs = this.frameCounter > 0 ? (this.frameTimeAccumulator / this.frameCounter) * 1000 : 0;

            // Update debug stats using DebugUtils
            if (this.debug) {
                 const memoryUsage = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'N/A';
                 const networkState = this.network ? (this.network.connected ? 'Connected' : 'Disconnected') : 'N/A';
                 const playerPos = this.player ?
                     (this.player.playerState === 'Interior' ? `Vehicle Grid (${this.player.gridX},${this.player.gridY})` : `(${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})`) :
                     (this.isGuestMode ? 'Guest Mode' : 'N/A');
                 const clientId = this.network ? (this.network.clientId ? this.network.clientId.substring(0, 8) : (this.isGuestMode ? 'Guest' : 'None')) : 'N/A';
                 const timeOfDayStr = this.timeOfDay.toFixed(3); // Add time of day to debug
                 const vehiclesCount = this.entities ? this.entities.getByType('vehicle').length : 'N/A'; // Count vehicles
                 const playerStateStr = this.player ? this.player.playerState : (this.isGuestMode ? 'Guest' : 'N/A');

                 this.debug.updateStats({
                     FPS: avgFps,
                     FrameTime: avgFrameTimeMs.toFixed(2) + ' ms',
                     TimeOfDay: timeOfDayStr, // Display time of day
                     Mode: this.isGuestMode ? 'Guest' : 'Player',
                     PlayerState: playerStateStr, // Add player state
                     Entities: this.entities ? this.entities.count() : 'N/A',
                     Vehicles: vehiclesCount, // Show vehicle count
                     PlayerPos: playerPos,
                     Memory: memoryUsage,
                     ActiveChunks: this.world ? this.world.chunkManager.activeChunkIds.size : 'N/A',
                     Network: networkState,
                     ClientID: clientId
                });
                 // Directly update the DOM element via renderer as DebugUtils only stores data
                 this.renderer.renderDebugInfo(this.debug.getDebugData());
            }

            // Reset counters for the next interval
            this.frameCounter = 0;
            this.frameTimeAccumulator = 0;
            this.lastFpsUpdate = timestamp;
        }
    }

     // Placeholder simulation pause/resume for menu (tricky in multiplayer)
     pauseSimulation() {
         this.debug.log("Simulation Paused (Input Disabled)");
     }

     resumeSimulation() {
         this.debug.log("Simulation Resumed");
     }

     // Helper to find the closest vehicle within a radius
     findClosestVehicle(x, y, radius) {
        const vehicles = this.entities.getByType('vehicle');
        let closestVehicle = null;
        let closestDistanceSq = radius * radius;

        for (const vehicle of vehicles) {
            const dx = vehicle.x - x;
            const dy = vehicle.y - y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestVehicle = vehicle;
            }
        }
        return closestVehicle;
    }
}