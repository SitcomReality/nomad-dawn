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
    }

    async initialize() {
        try {
            this.room = new WebsimSocket();
            await this.room.initialize();

            this.clientId = this.room.clientId;
            this.connected = true;

            // If clientId is still null/undefined after init, something is wrong.
            // Game class will handle turning this into guest mode.
            if (!this.clientId) {
                 this.game.debug.warn('Network initialized, but Client ID is missing.');
            } else {
                 this.game.debug.log('Network connection initialized. Client ID:', this.clientId);
            }

            // Set up handlers *after* successful initialization
            this.setupNetworkHandlers();

            return true; // Indicate successful initialization attempt
        } catch (error) {
            this.game.debug.error('Failed to initialize network connection', error);
            // Let the Game class handle the error display/state
            throw error;
        }
    }

    // Method to clean up subscriptions
    disconnect() {
        if (this.unsubscribePresence) this.unsubscribePresence();
        if (this.unsubscribeRoomState) this.unsubscribeRoomState();
        if (this.unsubscribePresenceRequests) this.unsubscribePresenceRequests();
        this.connected = false;
        this.clientId = null;
        this.room = null; // Release room reference
        this.game.debug.log('Network disconnected and listeners cleaned up.');
    }

    // Moved from Game.js: Set up network event handling
    setupNetworkHandlers() {
        if (!this.room) {
            this.game.debug.error("Network room not available for setting up handlers.");
            return;
        }

        // Store unsubscribe functions to call them later if needed
        this.unsubscribePresence = this.subscribePresence((presence) => {
             // Update peer names dynamically (important for UI/debug)
             const peers = this.getPeers();
             for (const entity of this.game.entities.getByType('player')) {
                 const peerInfo = peers ? peers[entity.id] : null;
                 const expectedName = peerInfo ? peerInfo.username : `Player ${entity.id.substring(0,4)}`;
                 if (entity.name !== expectedName) {
                    entity.name = expectedName;
                 }
             }
            // Sync entity states from presence data
            // Pass localPlayerId to avoid self-updating position based on network echo
            this.game.entities.syncFromNetworkPresence(presence, this.clientId); // Use this.clientId
        });

        this.unsubscribeRoomState = this.subscribeRoomState((roomState) => {
            // --- DEBUG ---
            if (roomState.vehicles) {
                // this.game.debug.log("Received roomState update with vehicles:", JSON.parse(JSON.stringify(roomState.vehicles))); // Log a copy
            }
            // --- END DEBUG ---

            if (this.game.world) {
                this.game.world.syncFromNetworkState(roomState);
            }
             // Sync vehicle states if they are in roomState
             if (roomState.vehicles) {
                 this.syncVehiclesFromNetwork(roomState.vehicles);
             }
        });

        this.unsubscribePresenceRequests = this.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });

        // Handle network events (onmessage)
        this.room.onmessage = (event) => {
            // Assuming event structure is { data: { type: ..., payload: ... } }
            this.handleNetworkEvent(event.data || event);
        };
    }

    // Moved from Game.js: Sync Vehicles
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

        // Update or create vehicles
        for (const vehicleId in networkVehicles) {
            const data = networkVehicles[vehicleId];
            let vehicle = this.game.entities.get(vehicleId);

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

                 // --- NEW: Sync grid properties ---
                 vehicle.gridWidth = data.gridWidth ?? vehicle.gridWidth;
                 vehicle.gridHeight = data.gridHeight ?? vehicle.gridHeight;
                 // Ensure gridTiles and gridObjects are objects, not null/undefined
                 vehicle.gridTiles = typeof data.gridTiles === 'object' && data.gridTiles !== null ? data.gridTiles : {};
                 vehicle.gridObjects = typeof data.gridObjects === 'object' && data.gridObjects !== null ? data.gridObjects : {};
                 vehicle.doorLocation = data.doorLocation ?? vehicle.doorLocation;
                 vehicle.pilotSeatLocation = data.pilotSeatLocation ?? vehicle.pilotSeatLocation;
                 // --- END NEW ---

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

                 // --- NEW: Sync grid properties ---
                 vehicle.gridWidth = data.gridWidth ?? vehicle.gridWidth;
                 vehicle.gridHeight = data.gridHeight ?? vehicle.gridHeight;
                 // Ensure gridTiles and gridObjects are objects, not null/undefined
                 vehicle.gridTiles = typeof data.gridTiles === 'object' && data.gridTiles !== null ? data.gridTiles : vehicle.gridTiles;
                 vehicle.gridObjects = typeof data.gridObjects === 'object' && data.gridObjects !== null ? data.gridObjects : vehicle.gridObjects;
                 vehicle.doorLocation = data.doorLocation ?? vehicle.doorLocation;
                 vehicle.pilotSeatLocation = data.pilotSeatLocation ?? vehicle.pilotSeatLocation;
                 // --- END NEW ---

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
    }

    // Moved from Game.js: Handle Presence Update Requests
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

    // Moved from Game.js: Handle Network Events
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
                 break;

             case 'disconnected':
                 this.game.debug.log(`Player disconnected: ${eventData.username || 'Unknown'} (${eventData.clientId})`);
                 // Entity removal handled by syncFromNetworkPresence
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

    // --- Existing methods ---

    updatePresence(presenceData) {
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        const now = performance.now();
        if (now - this.lastSyncTime < this.syncInterval) return;
        this.lastSyncTime = now;
        this.room.updatePresence(presenceData);
    }

    updateRoomState(stateData) {
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        // this.game.debug.log(`Sending updateRoomState:`, JSON.parse(JSON.stringify(stateData)));
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
            try { callback(roomState); } catch (error) { this.game.debug.error('Error in room state subscription callback:', error); }
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