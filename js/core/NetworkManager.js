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
                this.game.debug.log("Received roomState update with vehicles:", JSON.parse(JSON.stringify(roomState.vehicles))); // Log a copy
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
         this.game.debug.log("Starting syncVehiclesFromNetwork..."); // DEBUG
         // Lazily import Vehicle to avoid circular dependency issues if NetworkManager is imported elsewhere
         // Or ensure Vehicle class is loaded before this is called. For simplicity, assuming Vehicle is available.
         const Vehicle = window.Vehicle; // Assuming Vehicle is globally accessible or loaded appropriately
         if (!Vehicle) {
             this.game.debug.error("Vehicle class not found for syncVehiclesFromNetwork");
             return;
         }

        const presentVehicleIds = new Set(Object.keys(networkVehicles));

        // Update or create vehicles
        for (const vehicleId in networkVehicles) {
            const data = networkVehicles[vehicleId];
            let vehicle = this.game.entities.get(vehicleId);

            if (data === null) { // Vehicle removed
                 if (vehicle) {
                     this.game.debug.log(`Removing vehicle ${vehicleId} due to null in network state.`); // DEBUG
                     this.game.entities.remove(vehicleId);
                 }
                 continue;
            }

            // Check for minimum required data to create/update a vehicle
             if (!data || typeof data !== 'object' || !data.vehicleType || typeof data.x !== 'number' || typeof data.y !== 'number') {
                 this.game.debug.warn(`Received incomplete or invalid vehicle data for ID ${vehicleId}, skipping sync. Data:`, data);
                 presentVehicleIds.delete(vehicleId); // Remove invalid ID from tracking
                 continue;
             }

            if (!vehicle) {
                 // Create new vehicle entity if it doesn't exist
                 const vehicleConfig = this.game.config.VEHICLE_TYPES.find(v => v.id === data.vehicleType);
                 if (!vehicleConfig) {
                     console.warn(`Received data for unknown vehicle type: ${data.vehicleType}`);
                     continue;
                 }
                 // Pass config and owner ID
                 vehicle = new Vehicle(vehicleId, vehicleConfig, data.owner);
                 this.game.debug.log(`Created network vehicle ${vehicleId} of type ${data.vehicleType} at (${data.x}, ${data.y})`); // DEBUG
                 this.game.entities.add(vehicle); // Add should also log
            }

             // --- DEBUG: Log state before update ---
             // const oldState = JSON.parse(JSON.stringify(vehicle)); // Deep copy

             // Update vehicle state
             vehicle.x = data.x ?? vehicle.x;
             vehicle.y = data.y ?? vehicle.y;
             vehicle.angle = data.angle ?? vehicle.angle;
             vehicle.health = data.health ?? vehicle.health;
             vehicle.maxHealth = data.maxHealth ?? vehicle.maxHealth; // Make sure maxHealth is synced too
             vehicle.driver = data.driver ?? null;
             vehicle.passengers = data.passengers ?? [];
             vehicle.modules = data.modules ?? [];

              // --- DEBUG: Log state after update and compare ---
              // const newState = JSON.parse(JSON.stringify(vehicle));
              // if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
              //      this.game.debug.log(`Updated vehicle ${vehicleId}. Old:`, oldState, 'New:', newState);
              // } else {
              //      // Only log if nothing changed and we expected it to
              //      // this.game.debug.log(`Vehicle ${vehicleId} state unchanged.`);
              // }


             // If vehicle has an interpolation target, update it here
             // if (vehicle.updateTargetState) {
             //    vehicle.updateTargetState(data);
             // }
             
             // Ensure state change flag is managed if needed for network optimization
             // vehicle._stateChanged = true; // Force update or let Vehicle class handle this?
        }

         // Remove local vehicle entities that are no longer in the room state
         const currentVehicles = this.game.entities.getByType('vehicle');
         for (const localVehicle of currentVehicles) {
             if (!presentVehicleIds.has(localVehicle.id)) {
                 this.game.debug.log(`Removing vehicle ${localVehicle.id} (no longer in network state)`);
                 this.game.entities.remove(localVehicle.id);
             }
         }
         this.game.debug.log("Finished syncVehiclesFromNetwork."); // DEBUG
    }


     // Moved from Game.js: Handle Presence Update Requests
     handlePresenceUpdateRequest(updateRequest, fromClientId) {
         // Guest mode check: Guests cannot respond to requests.
         // Also need the player object to exist.
         if (this.game.isGuestMode || !this.game.player) return;

         const player = this.game.player;

         switch (updateRequest.type) {
             case 'damage':
                 const damageAmount = updateRequest.amount || 0;
                 if (damageAmount > 0) {
                     const previousHealth = player.health;
                     player.takeDamage(damageAmount);
                     this.game.debug.log(`Took ${damageAmount} damage from ${this.getPeerUsername(fromClientId)}. Health: ${player.health}`);

                     // Update network presence ONLY if health actually changed
                     if (player.health !== previousHealth) {
                         this.updatePresence({
                             health: player.health,
                         });
                         // Trigger local damage effect
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
                 // Ensure player name is updated if they connect after initial load
                 if (this.game.player && eventData.clientId === this.game.player.id) {
                      this.game.updatePlayerNameFromPeers(); // Call Game's helper method
                 } else {
                     // Trigger presence sync to potentially create the new player entity
                     // Need presence data, get it from room object
                     if (this.room && this.room.presence) {
                          this.game.entities.syncFromNetworkPresence(this.room.presence, this.clientId);
                     }
                 }
                 break;

             case 'disconnected':
                 this.game.debug.log(`Player disconnected: ${eventData.username || 'Unknown'} (${eventData.clientId})`);
                 // Entity removal is handled by syncFromNetworkPresence
                 break;

             case 'explosion':
                 if (this.game.renderer && typeof eventData.x === 'number' && typeof eventData.y === 'number') {
                     this.game.renderer.createEffect(
                         'explosion',
                         eventData.x,
                         eventData.y,
                         { size: eventData.size || 30 } // Use default size from effect renderer
                     );
                 }
                 break;

             case 'play_sound':
                 // Placeholder
                 // this.game.debug.log(`Received play_sound event: ${eventData.soundId}`);
                 break;

             default:
                 // this.game.debug.log('Received event:', eventData);
                 break;
         }
     }
    
    // --- Existing methods ---
    
    updatePresence(presenceData) {
        // Prevent guests from sending presence updates
        if (this.game.isGuestMode || !this.connected || !this.room) return; 
        
        const now = performance.now();
        // Throttle updates based on syncInterval
        if (now - this.lastSyncTime < this.syncInterval) return; 
        
        this.lastSyncTime = now;
        this.room.updatePresence(presenceData);
    }
    
    updateRoomState(stateData) {
         // Prevent guests from modifying room state
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        
        // --- DEBUG ---
        this.game.debug.log(`Sending updateRoomState:`, JSON.parse(JSON.stringify(stateData))); 
        // --- END DEBUG ---

        this.room.updateRoomState(stateData);
    }
    
    requestPresenceUpdate(clientId, updateData) {
        // Prevent guests from sending requests
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        
        this.room.requestPresenceUpdate(clientId, updateData);
    }
    
    subscribePresence(callback) {
        if (!this.connected || !this.room) return () => {};
        
        // Wrap callback to handle potential errors during execution
        const wrappedCallback = (presence) => {
            try {
                 callback(presence);
            } catch (error) {
                 this.game.debug.error('Error in presence subscription callback:', error);
            }
        };
        return this.room.subscribePresence(wrappedCallback);
    }
    
    subscribeRoomState(callback) {
        if (!this.connected || !this.room) return () => {};
        
        // Wrap callback for error handling
        const wrappedCallback = (roomState) => {
            try {
                 callback(roomState);
            } catch (error) {
                 this.game.debug.error('Error in room state subscription callback:', error);
            }
        };
        return this.room.subscribeRoomState(wrappedCallback);
    }
    
    subscribePresenceUpdateRequests(callback) {
        if (!this.connected || !this.room) return () => {};
        
        // Wrap callback for error handling
         const wrappedCallback = (updateRequest, fromClientId) => {
             try {
                 callback(updateRequest, fromClientId);
             } catch (error) {
                 this.game.debug.error('Error in presence update request callback:', error);
             }
         };
        return this.room.subscribePresenceUpdateRequests(wrappedCallback);
    }
    
    send(eventData) {
        // Prevent guests from sending events
        if (this.game.isGuestMode || !this.connected || !this.room) return;
        
        // Add client identification to the event
        const data = {
            ...eventData,
            // Use stored clientId, don't rely on game.player which might be null in guest mode
            clientId: this.clientId, 
            username: this.getPeerUsername(this.clientId) || 'Guest'
        };
        
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