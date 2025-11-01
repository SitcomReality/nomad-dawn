// New file: js/core/NetworkHandlers.js
import { syncVehiclesFromNetwork } from './VehicleSync.js';

export function setupNetworkHandlers(networkManager) {
    const game = networkManager.game;
    if (!networkManager.room) {
        game.debug.error("Network room not available for setting up handlers.");
        return;
    }

    // Presence subscription
    networkManager.unsubscribePresence = networkManager.subscribePresence((presence) => {
        try {
            const peers = networkManager.getPeers();
            for (const entity of game.entities.getByType('player')) {
                const peerInfo = peers ? peers[entity.id] : null;
                const expectedName = peerInfo ? peerInfo.username : `Player ${entity.id.substring(0,4)}`;
                if (entity.name !== expectedName) entity.name = expectedName;
            }
            game.entities.syncFromNetworkPresence(presence, networkManager.clientId);
        } catch (e) {
            game.debug.error('Error in presence handler:', e);
        }
    });

    // Room state subscription
    networkManager.unsubscribeRoomState = networkManager.subscribeRoomState((roomState) => {
        try {
            if (!networkManager.worldSeedConfirmed && roomState.worldSeed !== undefined && roomState.worldSeed !== null) {
                networkManager.worldSeed = roomState.worldSeed;
                networkManager.worldSeedConfirmed = true;
                game.debug.log(`World seed confirmed via subscription: ${networkManager.worldSeed}`);
                game.confirmWorldSeed?.(networkManager.worldSeed);
            }

            if (roomState.resources !== undefined && game.worldObjectManager) {
                game.worldObjectManager.updateResourceOverrides(roomState.resources);
            }

            if (game.world?.syncFromNetworkState) {
                const worldStateOnly = { ...roomState };
                delete worldStateOnly.resources;
                game.world.syncFromNetworkState(worldStateOnly);
            }

            if (roomState.vehicles) {
                syncVehiclesFromNetwork(networkManager, roomState.vehicles);
            }
        } catch (e) {
            game.debug.error('Error in roomState handler:', e);
        }
    });

    // Presence update requests
    networkManager.unsubscribePresenceRequests = networkManager.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
        try {
            networkManager.handlePresenceUpdateRequest(updateRequest, fromClientId);
        } catch (e) {
            game.debug.error('Error in presence update requests handler:', e);
        }
    });

    // Message handling
    networkManager.room.onmessage = (event) => {
        try {
            networkManager.handleNetworkEvent(event.data || event);
        } catch (e) {
            game.debug.error('Error handling network message:', e);
        }
    };
}