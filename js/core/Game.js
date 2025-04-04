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

// Make Player class globally accessible for EntityManager remote player creation
window.Player = Player;

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

        // Make Vehicle class accessible if needed by NetworkManager sync (consider better dependency management later)
        window.Vehicle = Vehicle; 
        
        // Added for Interior State Transitions
        this.interactionCooldown = 500; // ms cooldown for 'E' key interactions
        this.lastInteractionTime = 0;

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
            
             // Define the vehicle state
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
                 // Add default grid properties for the new vehicle
                 gridWidth: 10, // Default
                 gridHeight: 10, // Default
                 gridTiles: {},
                 gridObjects: {},
                 doorLocation: { x: 5, y: 9 }, // Centered bottom
                 pilotSeatLocation: { x: 5, y: 1 } // Centered top
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

            // Set progress callback
            this.resources.setOnProgress((loaded, total) => {
                const progress = total > 0 ? (loaded / total) * 100 : 100;
                 // Update loading screen progress bar (requires a function or direct access)
                 // updateLoadingProgress(progress, `Loading asset ${loaded}/${total}...`); // Assuming updateLoadingProgress exists globally or is passed
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

        // Process input (Moved before update)
        this.input.update(); // Reset one-time inputs like mouse wheel
        this.handleInputInteractions(now); // Handle E key interactions

        // Update game logic
        this.update(this.deltaTime);
        
        // Render the scene
        this.render();
        
        // Request next frame
        requestAnimationFrame(this.gameLoop);
    }

    handleInputInteractions(currentTime) {
        if (!this.input.isKeyDown('KeyE') || currentTime < this.lastInteractionTime + this.interactionCooldown) {
            return;
        }

        if (this.isGuestMode || !this.player) return;

        const player = this.player;
        const playerState = player.playerState;
        let transitionMade = false; // Flag to apply cooldown only if interaction happens

        this.debug.log(`Handling 'E' press. Player state: ${playerState}, Coords: (${player.x.toFixed(0)}, ${player.y.toFixed(0)}), Grid Coords: (${player.gridX.toFixed(1)}, ${player.gridY.toFixed(1)})`);

        if (playerState === 'Overworld') {
            // Find nearby vehicle
            const interactionDistance = 50; // Smaller radius for entering
            let nearbyVehicle = null;
            let closestDistanceSq = interactionDistance * interactionDistance;

            for (const vehicle of this.entities.getByType('vehicle')) {
                 if (!vehicle) continue; // Skip invalid vehicles
                const dx = vehicle.x - player.x;
                const dy = vehicle.y - player.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq < closestDistanceSq) {
                    closestDistanceSq = distanceSq;
                    nearbyVehicle = vehicle;
                }
            }

            if (nearbyVehicle) {
                this.debug.log(`Transitioning to Interior: Vehicle ${nearbyVehicle.id}`);
                player.playerState = 'Interior';
                player.currentVehicleId = nearbyVehicle.id;
                // Use door location from vehicle data
                player.gridX = nearbyVehicle.doorLocation?.x ?? Math.floor(nearbyVehicle.gridWidth / 2); // Default to center X if missing
                player.gridY = nearbyVehicle.doorLocation?.y ?? nearbyVehicle.gridHeight -1; // Default to bottom Y if missing
                // Stop player's overworld movement
                player.speed = 0;
                player._stateChanged = true; // Mark state changed for network sync
                transitionMade = true;
            }
        } else if (playerState === 'Interior') {
            const vehicle = this.entities.get(player.currentVehicleId);
            if (!vehicle) {
                this.debug.warn(`Player in Interior state but vehicle ${player.currentVehicleId} not found.`);
                // Attempt to recover by resetting state
                player.playerState = 'Overworld';
                player.currentVehicleId = null;
                player._stateChanged = true;
                this.ui.showNotification("Error: Exited invalid vehicle", "error");
                return;
            }

            // Check if player is near the door grid coordinates
            const doorX = vehicle.doorLocation?.x ?? Math.floor(vehicle.gridWidth / 2);
            const doorY = vehicle.doorLocation?.y ?? vehicle.gridHeight - 1;
            const isNearDoor = Math.abs(player.gridX - doorX) < 0.6 && Math.abs(player.gridY - doorY) < 0.6; // Use tolerance

            // Check if player is near the pilot seat grid coordinates
            const pilotX = vehicle.pilotSeatLocation?.x ?? Math.floor(vehicle.gridWidth / 2);
            const pilotY = vehicle.pilotSeatLocation?.y ?? 1;
            const isNearPilotSeat = Math.abs(player.gridX - pilotX) < 0.6 && Math.abs(player.gridY - pilotY) < 0.6;

            if (isNearDoor) {
                this.debug.log(`Transitioning to Overworld from vehicle ${vehicle.id}`);
                player.playerState = 'Overworld';
                // Place player slightly outside the vehicle
                const exitOffset = vehicle.size ? vehicle.size / 2 + player.size / 2 + 5 : 20;
                player.x = vehicle.x + Math.cos(vehicle.angle) * exitOffset;
                player.y = vehicle.y + Math.sin(vehicle.angle) * exitOffset;
                player.currentVehicleId = null;
                player._stateChanged = true;
                transitionMade = true;
            } else if (isNearPilotSeat && vehicle.driver !== player.id) { // Can only pilot if not already driving
                this.debug.log(`Transitioning to Piloting vehicle ${vehicle.id}`);
                player.playerState = 'Piloting';
                // Set vehicle driver (this marks vehicle state changed implicitly)
                if (vehicle.setDriver) vehicle.setDriver(player.id);
                 else vehicle.driver = player.id; // Direct set if method missing
                 vehicle._stateChanged = true; // Mark vehicle changed
                // Update room state for vehicle driver
                this.network.updateRoomState({
                    vehicles: {
                        [vehicle.id]: { driver: player.id }
                    }
                });
                player._stateChanged = true;
                transitionMade = true;
            } else {
                 this.debug.log(`'E' pressed in Interior at (${player.gridX.toFixed(1)}, ${player.gridY.toFixed(1)}). No action.`);
            }
        } else if (playerState === 'Piloting') {
             const vehicle = this.entities.get(player.currentVehicleId);
             if (!vehicle) {
                 this.debug.warn(`Player in Piloting state but vehicle ${player.currentVehicleId} not found.`);
                  // Attempt to recover by resetting state
                 player.playerState = 'Overworld';
                 player.currentVehicleId = null;
                 player._stateChanged = true;
                 this.ui.showNotification("Error: Exited invalid vehicle while piloting", "error");
                 return;
             }
             this.debug.log(`Transitioning from Piloting to Interior in vehicle ${vehicle.id}`);
             player.playerState = 'Interior';
             // Place player back near pilot seat
             player.gridX = vehicle.pilotSeatLocation?.x ?? Math.floor(vehicle.gridWidth / 2);
             player.gridY = vehicle.pilotSeatLocation?.y ?? 1;
             // Remove vehicle driver (this marks vehicle state changed implicitly)
             if (vehicle.removeDriver) vehicle.removeDriver();
              else vehicle.driver = null; // Direct set if method missing
              vehicle._stateChanged = true; // Mark vehicle changed
              // Update room state for vehicle driver
             this.network.updateRoomState({
                 vehicles: {
                     [vehicle.id]: { driver: null }
                 }
             });
             player._stateChanged = true;
             transitionMade = true;
        }
        // Add handling for 'Building' state if 'E' should do something here
        // (Currently, closing via Esc is handled by UIManager/BaseBuildingUI)
        else if (playerState === 'Building') {
            // Maybe 'E' confirms a placement or exits? For now, do nothing.
            this.debug.log("'E' pressed while in Building mode. No action defined.");
            // Allow Esc to close handled by UIManager/BaseBuildingUI.hide()
        }


        if (transitionMade) {
            this.lastInteractionTime = currentTime; // Apply cooldown
             // Force immediate presence update after state transition
             this.network.updatePresence(player.getNetworkState());
             player.clearStateChanged();
        }
    }

    update(deltaTime) {
        // --- Update Time of Day ---
        const cycleDuration = this.config.DAY_NIGHT_CYCLE_DURATION_SECONDS || 90; // Use value from config
        const timeIncrement = deltaTime / cycleDuration;
        this.timeOfDay = (this.timeOfDay + timeIncrement) % 1; // Keep time between 0 and 1

        // --- Player Update (Handle Guest Mode & States) ---
        if (this.player && !this.isGuestMode) {
            const vehicle = this.player.currentVehicleId ? this.entities.get(this.player.currentVehicleId) : null;
            const playerState = this.player.playerState;

            // Update based on player state
            switch (playerState) {
                case 'Overworld':
                case 'Interior':
                    // Player movement/action update handled by player.update
                    this.player.update(deltaTime, this.input);
                    break;
                case 'Piloting':
                    // Player doesn't update directly, vehicle update handles input
                     if (vehicle && vehicle.update) {
                         vehicle.update(deltaTime, this.input);
                         // Sync vehicle state if it changed
                         if (vehicle.hasStateChanged && vehicle.hasStateChanged()) {
                             this.network.updateRoomState({
                                 vehicles: {
                                     [vehicle.id]: vehicle.getMinimalNetworkState() // Send minimal state from pilot
                                 }
                             });
                             if(vehicle.clearStateChanged) vehicle.clearStateChanged();
                         }
                     }
                    break;
                case 'Building':
                    // No player movement update needed in Building mode.
                    // The player entity still exists, but its position etc. is static.
                    // Input is handled by the Building UI and Building Manager.
                    // Call Building Manager update if it needs per-frame logic
                    if (this.ui?.baseBuilding?.buildingManager?.update) {
                        this.ui.baseBuilding.buildingManager.update(deltaTime);
                    }
                    break;
            }

            // Sync player state if changed (covers all state changes including position, grid pos, playerState)
            if (this.player.hasStateChanged()) {
                this.network.updatePresence(this.player.getNetworkState());
                this.player.clearStateChanged();
            }
        } // End Player Update

        // --- World Update ---
        // Determine camera center for chunk loading
        const cameraCenterX = this.player ? this.player.x : 0; // Center on 0,0 in guest mode
        const cameraCenterY = this.player ? this.player.y : 0;
        if (this.world) {
            this.world.update(deltaTime, cameraCenterX, cameraCenterY);
        }
        
        // --- Entity Updates ---
        // Update all other entities (remote players, AI, non-driven vehicles)
        // Make sure vehicles only update if NOT driven by local player (handled above)
        for (const entity of this.entities.getAll()) {
             // Skip local player (already updated or state handled above)
             if (this.player && entity.id === this.player.id) continue;
             // Skip vehicle driven by local player (already updated in Piloting state)
             if (entity.type === 'vehicle' && this.player && entity.driver === this.player.id && this.player.playerState === 'Piloting') continue;

             if (entity.update && typeof entity.update === 'function') {
                 // Provide null input for non-driven updates
                 entity.update(deltaTime, null);
             }
        }
        
        // --- UI Update ---
        this.ui.update(); // Updates HUD, checks open panels
        
        // --- Collision Checks (Use CollisionManager, Skip for Guests) ---
        if (!this.isGuestMode) {
             // Only run Overworld collisions for now
             if (this.player && this.player.playerState === 'Overworld') {
                 this.collisions.checkCollisions(); // Use the collision manager
             }
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
        
        // Render based on player state
        if (this.player && this.player.playerState === 'Interior') {
            const vehicle = this.entities.get(this.player.currentVehicleId);
            if (vehicle && this.renderer.interiorRenderer) {
                 // Call Interior Renderer
                 this.renderer.interiorRenderer.render(vehicle, this.player);
            } else {
                 // Handle case where player is 'Interior' but vehicle/renderer doesn't exist
                 const errorMsg = !vehicle ? 'Vehicle Not Found!' : 'Interior Renderer Missing!';
                 this.renderer.ctx.fillStyle = 'red';
                 this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
                 this.renderer.ctx.fillStyle = 'white';
                 this.renderer.ctx.font = '20px monospace';
                 this.renderer.ctx.textAlign = 'center';
                 this.renderer.ctx.fillText(`Error: ${errorMsg}`, this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);
            }
        } else if (this.player && this.player.playerState === 'Building') {
             // Render Building UI Background (Placeholder)
             // The actual UI (canvas grid + tools) is a DOM overlay managed by BaseBuildingUI
             // We might want a simplified world view or just a dark screen behind the DOM UI.
             this.renderer.ctx.fillStyle = '#151515'; // Very dark background
             this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
             // Optionally, render a dim overlay text if the UI fails to show
             // this.renderer.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
             // this.renderer.ctx.font = '30px monospace';
             // this.renderer.ctx.textAlign = 'center';
             // this.renderer.ctx.fillText('BUILDING MODE ACTIVE', this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);

        } else {
            // --- Default Overworld Rendering ---
            // Determine camera target for rendering
            const cameraTarget = (this.player && this.player.playerState === 'Piloting')
                ? this.entities.get(this.player.currentVehicleId) // Follow vehicle if piloting
                : (this.player ? this.player : { x: 0, y: 0 }); // Follow player or origin

            // Render world background and chunks
            if (this.world) {
                this.renderer.renderWorld(this.world, cameraTarget);
            } else {
                // Fallback background
                this.renderer.ctx.fillStyle = '#111';
                this.renderer.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
            }
            
            // Render entities (players, vehicles, etc.)
            // Don't render the player if they are piloting (camera follows vehicle)
             const entitiesToRender = (this.player && this.player.playerState === 'Piloting')
                 ? this.entities.getAll().filter(e => e.id !== this.player.id)
                 : this.entities.getAll();
            this.renderer.renderEntities(entitiesToRender, this.player);
            
            // Render visual effects
            this.renderer.renderEffects();
        }
        
        // Render canvas UI overlays (Minimap) - Always render UI?
        this.renderer.renderUI(this);
        
        // Render debug information onto the DOM overlay
        if (this.debug && this.debug.isEnabled()) {
            this.renderer.renderDebugInfo(this.debug.getDebugData());
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
                 const playerPos = this.player ? (
                      this.player.playerState === 'Interior' ? `Interior (${this.player.gridX.toFixed(1)}, ${this.player.gridY.toFixed(1)})` :
                      this.player.playerState === 'Piloting' ? `Piloting (${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})` : // Show vehicle pos when piloting
                      this.player.playerState === 'Building' ? `Building (${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})` : // Show player world pos (static) in building mode
                      `Overworld (${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})`
                 ) : (this.isGuestMode ? 'Guest Mode' : 'N/A');
                 const playerStateStr = this.player ? this.player.playerState : (this.isGuestMode ? 'Guest' : 'N/A');
                 const clientId = this.network ? (this.network.clientId ? this.network.clientId.substring(0, 8) : (this.isGuestMode ? 'Guest' : 'None')) : 'N/A';
                 const timeOfDayStr = this.timeOfDay.toFixed(3); // Add time of day to debug
                 const vehiclesCount = this.entities ? this.entities.getByType('vehicle').length : 'N/A'; // Count vehicles

                 this.debug.updateStats({
                    FPS: avgFps,
                    FrameTime: avgFrameTimeMs.toFixed(2) + ' ms',
                    TimeOfDay: timeOfDayStr, // Display time of day
                    Mode: playerStateStr, // Show actual player state
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
}