export default class NetworkManager {
    constructor(game) {
        this.game = game;
        this.room = null;
        this.clientId = null;
        this.connected = false;
        this.lastSyncTime = 0;
        this.syncInterval = 100; // Minimum time between syncs (ms)
    }
    
    async initialize() {
        try {
            this.room = new WebsimSocket();
            await this.room.initialize();
            
            this.clientId = this.room.clientId;
            this.connected = true;
            
            this.game.debug.log('Network connection initialized. Client ID:', this.clientId);
            return true;
        } catch (error) {
            this.game.debug.error('Failed to initialize network connection', error);
            throw error;
        }
    }
    
    // Update this client's presence
    updatePresence(presenceData) {
        if (!this.connected || !this.room) return;
        
        const now = performance.now();
        if (now - this.lastSyncTime < this.syncInterval) return;
        
        this.lastSyncTime = now;
        this.room.updatePresence(presenceData);
    }
    
    // Update room state (shared world state)
    updateRoomState(stateData) {
        if (!this.connected || !this.room) return;
        
        this.room.updateRoomState(stateData);
    }
    
    // Request update to another client's presence
    requestPresenceUpdate(clientId, updateData) {
        if (!this.connected || !this.room) return;
        
        this.room.requestPresenceUpdate(clientId, updateData);
    }
    
    // Subscribe to presence updates
    subscribePresence(callback) {
        if (!this.connected || !this.room) return () => {};
        
        return this.room.subscribePresence(callback);
    }
    
    // Subscribe to room state updates
    subscribeRoomState(callback) {
        if (!this.connected || !this.room) return () => {};
        
        return this.room.subscribeRoomState(callback);
    }
    
    // Subscribe to presence update requests
    subscribePresenceUpdateRequests(callback) {
        if (!this.connected || !this.room) return () => {};
        
        return this.room.subscribePresenceUpdateRequests(callback);
    }
    
    // Send a message/event to all clients
    send(eventData) {
        if (!this.connected || !this.room) return;
        
        // Add client identification to the event
        const data = {
            ...eventData,
            clientId: this.clientId,
            username: this.getPeerUsername(this.clientId)
        };
        
        this.room.send(data);
    }
    
    // Get all peers (connected clients)
    getPeers() {
        if (!this.connected || !this.room) return {};
        
        return this.room.peers;
    }
    
    // Get username for specific client ID
    getPeerUsername(clientId) {
        if (!this.connected || !this.room || !this.room.peers[clientId]) {
            return 'Unknown';
        }
        
        return this.room.peers[clientId].username;
    }
    
    // Get current client's presence state
    getMyPresence() {
        if (!this.connected || !this.room) return {};
        
        return this.room.presence[this.clientId] || {};
    }
    
    // Check if a specific client is connected
    isClientConnected(clientId) {
        if (!this.connected || !this.room) return false;
        
        return !!this.room.peers[clientId];
    }
}

