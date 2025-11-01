import Vehicle from '../entities/Vehicle.js'; // Keep for syncVehiclesFromNetwork
import { syncVehiclesFromNetwork } from './VehicleSync.js'; // NEW
import { setupNetworkHandlers } from './NetworkHandlers.js'; // NEW

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
            // Delegate handler registration to the extracted module
            setupNetworkHandlers(this);

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

    // setupNetworkHandlers() moved to js/core/NetworkHandlers.js
    // Keep backward-compatible method name in case other code calls it
    setupNetworkHandlers() { setupNetworkHandlers(this); }

    // syncVehiclesFromNetwork() moved to js/core/VehicleSync.js and re-exported above for compatibility
    syncVehiclesFromNetwork(networkVehicles) { syncVehiclesFromNetwork(this, networkVehicles); }

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