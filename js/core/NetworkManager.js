import Vehicle from '../entities/Vehicle.js'; // Keep for syncVehiclesFromNetwork

export default class NetworkManager {
    constructor(game) {
        this.game = game;
        this.room = null;
        this.clientId = null;
        this.connected = false;
        this.lastSyncTime = 0;
        this.syncInterval = 100; // Minimum time between syncs (ms)

        // Unsubscribe functions
        this.unsubscribePresence = null;
        this.unsubscribeRoomState = null;
        this.unsubscribePresenceRequests = null;

        // World Seed Tracking
        this.worldSeed = null;
        this.worldSeedConfirmed = false;
    }

    async initialize() {
        try {
            this.room = new WebsimSocket();
            await this.room.initialize();

            this.clientId = this.room.clientId;
            this.connected = true;

            let isGuest = false; // Local flag for logic within initialize

            // If clientId is still null/undefined after init, it's likely guest mode.
            if (!this.clientId) {
                 this.game.debug.warn('Network initialized, but Client ID is missing. Assuming Guest Mode.');
                 isGuest = true;
            } else {
                 this.game.debug.log('Network connection initialized. Client ID:', this.clientId);
            }

            // Handle World Seed
            const initialRoomState = this.room.roomState || {};
            if (initialRoomState.worldSeed !== undefined && initialRoomState.worldSeed !== null) {
                this.worldSeed = initialRoomState.worldSeed;
                this.worldSeedConfirmed = true;
                this.game.debug.log(`World seed received from room state: ${this.worldSeed}`);
            } else if (!isGuest) {
                this.worldSeed = Math.floor(Math.random() * 9999999);
                this.worldSeedConfirmed = false; // Not confirmed until echoed back
                this.game.debug.log(`No world seed found. Proposing seed: ${this.worldSeed}`);
                 const initialState = { worldSeed: this.worldSeed };
                 if (this.game.timeAuthority && initialRoomState.timeOfDay === undefined) {
                     initialState.timeOfDay = this.game.timeOfDay;
                     this.game.lastTimeSync = performance.now();
                 }
                 this.updateRoomState(initialState);
            } else {
                 this.game.debug.log("Guest mode: Waiting for world seed from room state...");
            }

            // Set up handlers *after* successful initialization
            this.setupNetworkHandlers();

            return true; // Indicate successful initialization attempt
        } catch (error) {
            this.game.debug.error('Failed to initialize network connection', error);
            throw error;
        }
    }

    disconnect() {
        if (this.unsubscribePresence) this.unsubscribePresence();
        if (this.unsubscribeRoomState) this.unsubscribeRoomState();
        if (this.unsubscribePresenceRequests) this.unsubscribePresenceRequests();
        this.connected = false;
        this.clientId = null;
        this.room = null; // Release room reference
        this.worldSeed = null; // Reset seed
        this.worldSeedConfirmed = false;
        this.game.debug.log('Network disconnected and listeners cleaned up.');
    }

    setupNetworkHandlers() {
        if (!this.room) {
            this.game.debug.error("Network room not available for setting up handlers.");
            return;
        }

        // Presence Subscription
        this.unsubscribePresence = this.subscribePresence((presence) => {
             // Update peer names dynamically
             const peers = this.getPeers();
             for (const entity of this.game.entities.getByType('player')) {
                 const peerInfo = peers ? peers[entity.id] : null;
                 const expectedName = peerInfo ? peerInfo.username : `Player ${entity.id.substring(0,4)}`;
                 if (entity.name !== expectedName) {
                    entity.name = expectedName;
                 }
             }
            // Sync entity states from presence data
            this.game.entities.syncFromNetworkPresence(presence, this.clientId);
        });

        // Room State Subscription
        this.unsubscribeRoomState = this.subscribeRoomState((roomState) => {
             // Handle world seed updates
             if (!this.worldSeedConfirmed && roomState.worldSeed !== undefined && roomState.worldSeed !== null) {
                 this.worldSeed = roomState.worldSeed;
                 this.worldSeedConfirmed = true;
                 this.game.debug.log(`World seed confirmed via subscription: ${this.worldSeed}`);
                 this.game.confirmWorldSeed?.(this.worldSeed);
             }

             // Pass relevant parts to World and WorldObjectManager
             // Pass resource overrides to WorldObjectManager
             if (roomState.resources !== undefined && this.game.worldObjectManager) {
                 this.game.worldObjectManager.updateResourceOverrides(roomState.resources);
             }
             // Pass time/other world state to World (World no longer handles resources directly)
             if (this.game.world?.syncFromNetworkState) {
                  // Create a copy excluding resources, as World doesn't need them directly
                  const worldStateOnly = { ...roomState };
                  delete worldStateOnly.resources;
                  this.game.world.syncFromNetworkState(worldStateOnly);
             }

             // Sync vehicle states if they are in roomState
             if (roomState.vehicles) {
                 this.syncVehiclesFromNetwork(roomState.vehicles);
             }
        });

        // Presence Update Request Subscription
        this.unsubscribePresenceRequests = this.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });

        // Message Handling
        this.room.onmessage = (event) => {
            this.handleNetworkEvent(event.data || event);
        };
    }

    syncVehiclesFromNetwork(networkVehicles) {
         // Lazily import Vehicle or ensure it's globally available
         const Vehicle = window.Vehicle; // Assuming Vehicle is globally accessible
         if (!Vehicle) {
             this.game.debug.error("[SyncVehicles] Vehicle class not found!");
             return;
         }

         if (!networkVehicles || typeof networkVehicles !== 'object') {
             this.game.debug.warn("[SyncVehicles] Received invalid networkVehicles data (not an object):", networkVehicles);
             return;
         }

        const presentVehicleIds = new Set(Object.keys(networkVehicles));

        const confirmedModifications = {}; // vehicleId -> array of "cellKey:gridType"

        // Update or create vehicles
        for (const vehicleId in networkVehicles) {
            const data = networkVehicles[vehicleId];
            let vehicle = this.game.entities.get(vehicleId);

            confirmedModifications[vehicleId] = [];

            if (data === null) { // Vehicle removed
                 if (vehicle) {
                     this.game.debug.log(`[SyncVehicles] Removing vehicle ${vehicleId} due to null in network state.`);
                     this.game.entities.remove(vehicleId);
                 }
                 continue;
            }

            // Basic data validation
             if (!data || typeof data !== 'object' || !data.vehicleType || typeof data.x !== 'number' || typeof data.y !== 'number') {
                 this.game.debug.warn(`[SyncVehicles] Received incomplete/invalid vehicle data for ID ${vehicleId}, skipping sync. Data:`, data);
                 presentVehicleIds.delete(vehicleId);
                 continue;
             }

            if (!vehicle) {
                 // Create new vehicle entity
                 const vehicleConfig = this.game.config.VEHICLE_TYPES.find(v => v.id === data.vehicleType);
                 if (!vehicleConfig) {
                     this.game.debug.warn(`[SyncVehicles] Received data for unknown vehicle type: ${data.vehicleType}. Cannot create ${vehicleId}.`);
                     continue;
                 }

                 try {
                     vehicle = new Vehicle(vehicleId, vehicleConfig, data.owner);
                 } catch(e) {
                     this.game.debug.error(`[SyncVehicles] Error creating Vehicle instance for ${vehicleId}:`, e);
                     continue;
                 }

                 // Update state from network data *after* creation
                 vehicle.x = data.x;
                 vehicle.y = data.y;
                 vehicle.angle = data.angle ?? vehicle.angle;
                 vehicle.health = data.health ?? vehicle.health;
                 vehicle.maxHealth = data.maxHealth ?? vehicle.maxHealth;
                 vehicle.driver = data.driver ?? null;
                 vehicle.passengers = data.passengers ?? [];
                 vehicle.modules = data.modules ?? [];

                 vehicle.gridWidth = data.gridWidth ?? vehicle.gridWidth;
                 vehicle.gridHeight = data.gridHeight ?? vehicle.gridHeight;
                 const newTiles = typeof data.gridTiles === 'object' && data.gridTiles !== null ? data.gridTiles : {};
                 const newObjects = typeof data.gridObjects === 'object' && data.gridObjects !== null ? data.gridObjects : {};

                 Object.keys(newTiles).forEach(key => confirmedModifications[vehicleId].push(`${key}:gridTiles`));
                 Object.keys(newObjects).forEach(key => confirmedModifications[vehicleId].push(`${key}:gridObjects`));

                 vehicle.gridTiles = newTiles;
                 vehicle.gridObjects = newObjects;
                 vehicle.doorLocation = data.doorLocation ?? vehicle.doorLocation;
                 vehicle.pilotSeatLocation = data.pilotSeatLocation ?? vehicle.pilotSeatLocation;

                // Recalculate stats based on initial modules received
                if (vehicle.recalculateStatsFromModules) {
                    vehicle.recalculateStatsFromModules();
                }

                 const addedEntity = this.game.entities.add(vehicle);
                 if(!addedEntity) {
                     this.game.debug.error(`[SyncVehicles] Failed to add ${vehicleId} to EntityManager.`);
                 }

            } else {
                 // Update existing vehicle state
                 const modulesChanged = JSON.stringify(vehicle.modules) !== JSON.stringify(data.modules ?? []);

                 vehicle.x = data.x ?? vehicle.x;
                 vehicle.y = data.y ?? vehicle.y;
                 vehicle.angle = data.angle ?? vehicle.angle;
                 vehicle.health = data.health ?? vehicle.health;
                 vehicle.maxHealth = data.maxHealth ?? vehicle.maxHealth;
                 vehicle.driver = data.driver ?? null;
                 vehicle.passengers = data.passengers ?? [];
                 vehicle.modules = data.modules ?? [];

                 vehicle.gridWidth = data.gridWidth ?? vehicle.gridWidth;
                 vehicle.gridHeight = data.gridHeight ?? vehicle.gridHeight;

                 const newTiles = typeof data.gridTiles === 'object' && data.gridTiles !== null ? data.gridTiles : {};
                 const currentTiles = vehicle.gridTiles || {};
                 Object.keys(newTiles).forEach(key => {
                     if (currentTiles[key] !== newTiles[key]) {
                         currentTiles[key] = newTiles[key];
                         confirmedModifications[vehicleId].push(`${key}:gridTiles`);
                     }
                 });
                 Object.keys(currentTiles).forEach(key => {
                     if (!(key in newTiles)) {
                         delete currentTiles[key];
                         confirmedModifications[vehicleId].push(`${key}:gridTiles`);
                     }
                 });
                 vehicle.gridTiles = currentTiles;

                 const newObjects = typeof data.gridObjects === 'object' && data.gridObjects !== null ? data.gridObjects : {};
                 const currentObjects = vehicle.gridObjects || {};
                 Object.keys(newObjects).forEach(key => {
                     if (currentObjects[key] !== newObjects[key]) {
                         currentObjects[key] = newObjects[key];
                         confirmedModifications[vehicleId].push(`${key}:gridObjects`);
                     }
                 });
                 Object.keys(currentObjects).forEach(key => {
                     if (!(key in newObjects)) {
                         delete currentObjects[key];
                         confirmedModifications[vehicleId].push(`${key}:gridObjects`);
                     }
                 });
                 vehicle.gridObjects = currentObjects;
                 vehicle.doorLocation = data.doorLocation ?? vehicle.doorLocation;
                 vehicle.pilotSeatLocation = data.pilotSeatLocation ?? vehicle.pilotSeatLocation;

                 // Recalculate stats ONLY if modules changed or if maxHealth isn't matching
                 const vehicleConfig = this.game.config.VEHICLE_TYPES.find(v => v.id === data.vehicleType);
                 if (modulesChanged || vehicle.maxHealth !== (data.maxHealth ?? vehicleConfig?.health ?? 200)) {
                     if (vehicle.recalculateStatsFromModules) {
                         vehicle.recalculateStatsFromModules();
                     } else {
                         this.game.debug.warn(`[SyncVehicles] Vehicle ${vehicleId} missing recalculateStatsFromModules method.`);
                     }
                 }

                 vehicle.health = Math.min(vehicle.health, vehicle.maxHealth);
            }
        }

         // Remove local vehicles no longer in network state
         const currentVehicles = this.game.entities.getByType('vehicle');
         for (const localVehicle of currentVehicles) {
             if (!localVehicle || !localVehicle.id) continue;

             if (!presentVehicleIds.has(localVehicle.id)) {
                 this.game.debug.log(`[SyncVehicles] Removing local vehicle ${localVehicle.id} (no longer in network state)`);
                 this.game.entities.remove(localVehicle.id);
             }
         }

         if (this.game.ui?.baseBuilding?.buildingManager?.confirmModifications) {
            for (const vehicleId in confirmedModifications) {
                if (confirmedModifications[vehicleId].length > 0) {
                    this.game.ui.baseBuilding.buildingManager.confirmModifications(vehicleId, confirmedModifications[vehicleId]);
                }
            }
         }
    }

    handlePresenceUpdateRequest(updateRequest, fromClientId) {
         // Guest mode check
         if (this.game.isGuestMode || !this.game.player) return;

         const player = this.game.player;

         switch (updateRequest.type) {
             case 'damage':
                 const damageAmount = updateRequest.amount || 0;
                 if (damageAmount > 0) {
                     const previousHealth = player.health;
                     player.takeDamage(damageAmount);
                     this.game.debug.log(`Took ${damageAmount} damage from ${this.getPeerUsername(fromClientId)}. Health: ${player.health}`);

                     if (player.health !== previousHealth) {
                         this.updatePresence({
                             health: player.health,
                         });
                         this.game.renderer.createEffect('damage_taken', player.x, player.y);
                     }
                 }
                 break;

             case 'give_resource':
                 if (updateRequest.resourceType && updateRequest.amount > 0) {
                     if (player.addResource(updateRequest.resourceType, updateRequest.amount)) {
                         this.updatePresence({
                             resources: player.resources
                         });
                         this.game.ui.showNotification(`Received ${updateRequest.amount} ${updateRequest.resourceType} from ${this.getPeerUsername(fromClientId)}`, 'success');
                     } else {
                          console.warn(`Failed to add resource type: ${updateRequest.resourceType} from ${fromClientId}`);
                     }
                 }
                 break;

             default:
                 this.game.debug.log(`Received unknown presence update request type: ${updateRequest.type} from ${fromClientId}`);
                 break;
         }
    }

    handleNetworkEvent(eventData) {
         if (!eventData || !eventData.type) return;

         switch (eventData.type) {
             case 'connected':
                 this.game.debug.log(`Player connected: ${eventData.username || 'Unknown'} (${eventData.clientId})`);
                 if (this.game.player && eventData.clientId === this.game.player.id) {
                      this.game.updatePlayerNameFromPeers();
                 } else {
                     if (this.room && this.room.presence) {
                          this.game.entities.syncFromNetworkPresence(this.room.presence, this.clientId);
                     }
                 }
                 // Re-check time authority when peers change
                 this.game.handlePeersChanged?.();
                 break;

             case 'disconnected':
                 this.game.debug.log(`Player disconnected: ${eventData.username || 'Unknown'} (${eventData.clientId})`);
                 // Entity removal handled by syncFromNetworkPresence
                 // Re-check time authority when peers change
                 this.game.handlePeersChanged?.();
                 break;

             case 'explosion':
                 if (this.game.renderer && typeof eventData.x === 'number' && typeof eventData.y === 'number') {
                     this.game.renderer.createEffect(
                         'explosion',
                         eventData.x,
                         eventData.y,
                         { size: eventData.size || 30 }
                     );
                 }
                 break;

             case 'play_sound':
                 // Placeholder
                 break;

             default:
                 break;
         }
    }

    updatePresence(presenceData) {
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        const now = performance.now();
        if (now - this.lastSyncTime < this.syncInterval) return;
        this.lastSyncTime = now;
        this.room.updatePresence(presenceData);
    }

    updateRoomState(stateData) {
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        this.room.updateRoomState(stateData);
    }

    requestPresenceUpdate(clientId, updateData) {
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        this.room.requestPresenceUpdate(clientId, updateData);
    }

    subscribePresence(callback) {
        if (!this.connected || !this.room) return () => {};
        const wrappedCallback = (presence) => {
            try { callback(presence); } catch (error) { this.game.debug.error('Error in presence subscription callback:', error); }
        };
        return this.room.subscribePresence(wrappedCallback);
    }

    subscribeRoomState(callback) {
        if (!this.connected || !this.room) return () => {};
        const wrappedCallback = (roomState) => {
            try { 
                // ... existing code ...
                // Pass resource overrides to WorldObjectManager
                if (roomState.resources !== undefined && this.game.worldObjectManager) {
                    this.game.worldObjectManager.updateResourceOverrides(roomState.resources);
                }
                // ... existing code ...
                callback(roomState); 
            } catch (error) { this.game.debug.error('Error in room state subscription callback:', error); }
        };
        return this.room.subscribeRoomState(wrappedCallback);
    }

    subscribePresenceUpdateRequests(callback) {
        if (!this.connected || !this.room) return () => {};
         const wrappedCallback = (updateRequest, fromClientId) => {
             try { callback(updateRequest, fromClientId); } catch (error) { this.game.debug.error('Error in presence update request callback:', error); }
         };
        return this.room.subscribePresenceUpdateRequests(wrappedCallback);
    }

    send(eventData) {
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        const data = { ...eventData, clientId: this.clientId, username: this.getPeerUsername(this.clientId) || 'Guest' };
        this.room.send(data);
    }

    getPeers() {
        if (!this.connected || !this.room) return {};
        return this.room.peers;
    }

    getPeerUsername(clientId) {
        if (!this.connected || !this.room || !this.room.peers || !this.room.peers[clientId]) {
            return clientId ? `Guest (${clientId.substring(0,4)})` : 'Unknown';
        }
        return this.room.peers[clientId].username;
    }

    getMyPresence() {
        if (!this.connected || !this.room || !this.clientId) return {};
        return this.room.presence[this.clientId] || {};
    }

    isClientConnected(clientId) {
        if (!this.connected || !this.room) return false;
        return !!this.room.peers[clientId];
    }
}