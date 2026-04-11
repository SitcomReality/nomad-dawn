/**
 * NetworkManager - Single-player stub.
 *
 * Provides the same public API surface as the original multiplayer
 * NetworkManager so the rest of the codebase can remain unchanged.
 * All "network" state is managed locally in memory.
 *
 * When multiplayer is re-introduced, replace this file with the real
 * WebsimSocket-based implementation.
 */
export default class NetworkManager {
    constructor(game) {
        this.game = game;
        this.clientId = null;
        this.connected = false;
        this.lastSyncTime = 0;
        this.syncInterval = 100;

        // Local room-state store (replaces the server-authoritative room state)
        this.roomState = {};

        // World Seed Tracking
        this.worldSeed = null;
        this.worldSeedConfirmed = false;
    }

    /**
     * In single-player mode we generate a local client ID and world seed
     * immediately — no server round-trip required.
     */
    async initialize() {
        try {
            // Generate a local client ID
            this.clientId = 'local-' + Math.random().toString(36).substring(2, 10);
            this.connected = true;

            // Generate world seed locally
            this.worldSeed = Math.floor(Math.random() * 9999999);
            this.worldSeedConfirmed = true;

            this.game.debug.log('Single-player mode initialized. Client ID:', this.clientId);
            this.game.debug.log(`World seed generated locally: ${this.worldSeed}`);

            return true;
        } catch (error) {
            this.game.debug.error('Failed to initialize (single-player)', error);
            throw error;
        }
    }

    disconnect() {
        this.connected = false;
        this.clientId = null;
        this.roomState = {};
        this.worldSeed = null;
        this.worldSeedConfirmed = false;
        this.game.debug.log('Single-player session ended.');
    }

    // ------------------------------------------------------------------
    // State update stubs — apply changes to local roomState immediately
    // ------------------------------------------------------------------

    updatePresence(_presenceData) {
        // No-op in single-player; the local player state is the source of truth.
    }

    updateRoomState(stateData) {
        if (!stateData) return;
        // Deep-merge the incoming state into our local roomState
        this._mergeState(this.roomState, stateData);
    }

    requestPresenceUpdate(_clientId, _updateData) {
        // No-op in single-player.
    }

    send(_eventData) {
        // No-op in single-player.
    }

    // ------------------------------------------------------------------
    // Subscription stubs — return no-op unsubscribe functions
    // ------------------------------------------------------------------

    subscribePresence(_callback) { return () => {}; }
    subscribeRoomState(_callback) { return () => {}; }
    subscribePresenceUpdateRequests(_callback) { return () => {}; }

    // Kept for back-compat; no-op in single-player
    setupNetworkHandlers() {}
    syncVehiclesFromNetwork(_networkVehicles) {}

    // ------------------------------------------------------------------
    // Peer / presence helpers
    // ------------------------------------------------------------------

    getPeers() {
        // Return ourselves as the only "peer"
        if (!this.clientId) return {};
        return {
            [this.clientId]: { username: 'Player' }
        };
    }

    getPeerUsername(clientId) {
        if (clientId === this.clientId) return 'Player';
        return clientId ? `Unknown (${clientId.substring(0, 4)})` : 'Unknown';
    }

    getMyPresence() {
        return {};
    }

    isClientConnected(clientId) {
        return clientId === this.clientId;
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Recursively merge `source` into `target` (shallow for non-object values,
     * deep for plain objects). Null values delete keys (mirrors the previous
     * WebsimSocket convention for resource / vehicle deletion).
     */
    _mergeState(target, source) {
        for (const key of Object.keys(source)) {
            const val = source[key];
            if (val === null) {
                delete target[key];
            } else if (typeof val === 'object' && !Array.isArray(val)) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this._mergeState(target[key], val);
            } else {
                target[key] = val;
            }
        }
    }
}