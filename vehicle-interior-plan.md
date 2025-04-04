// Vehicle.js
class Vehicle {
  constructor() {
    this.gridWidth = 10; // default grid width
    this.gridHeight = 10; // default grid height
    this.gridTiles = {}; // object/map storing the type of tile at each {x},{y} coordinate
    this.gridObjects = {}; // object/map storing placed objects {objectId: {type, x, y, ...}}
    this.doorLocation = { x: 0, y: 0 }; // {x, y} of the designated entrance/exit tile
    this.pilotSeatLocation = { x: 1, y: 1 }; // {x, y} of the designated pilot seat tile
  }

  getFullNetworkState() {
    return {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      gridTiles: this.gridTiles,
      gridObjects: this.gridObjects,
      doorLocation: this.doorLocation,
      pilotSeatLocation: this.pilotSeatLocation,
    };
  }

  setDriver(playerId) {
    // add driver logic
  }

  removeDriver() {
    // remove driver logic
  }
}

// Player.js
class Player {
  constructor() {
    this.playerState = 'Overworld'; // default player state
    this.currentVehicleId = null; // ID of the vehicle the player is interacting with/inside
    this.gridX = 0; // player's position on the vehicle grid when in Interior state
    this.gridY = 0; // player's position on the vehicle grid when in Interior state
  }

  getNetworkState() {
    return {
      playerState: this.playerState,
      currentVehicleId: this.currentVehicleId,
      gridX: this.gridX,
      gridY: this.gridY,
    };
  }

  syncFromNetworkPresence(presence) {
    this.playerState = presence.playerState;
    this.currentVehicleId = presence.currentVehicleId;
    this.gridX = presence.gridX;
    this.gridY = presence.gridY;
  }

  isNearVehicle() {
    // implement isNearVehicle logic
  }

  update() {
    if (this.playerState === 'Piloting' || this.playerState === 'Interior') return;
    // overworld movement logic
  }

  enterVehicle(vehicle) {
    this.playerState = 'Interior';
    this.currentVehicleId = vehicle.id;
    this.gridX = vehicle.doorLocation.x;
    this.gridY = vehicle.doorLocation.y;
    console.log('Transitioning to Interior');
  }

  exitVehicle() {
    this.playerState = 'Overworld';
    this.currentVehicleId = null;
    console.log('Transitioning to Overworld');
  }

  startPilotingVehicle(vehicle) {
    this.playerState = 'Piloting';
    vehicle.setDriver(this.id);
    game.room.sendUpdate({ vehicles: { [vehicle.id]: { driver: this.id } } });
    console.log('Transitioning to Piloting');
  }

  stopPilotingVehicle(vehicle) {
    this.playerState = 'Interior';
    this.gridX = vehicle.pilotSeatLocation.x;
    this.gridY = vehicle.pilotSeatLocation.y;
    vehicle.removeDriver();
    game.room.sendUpdate({ vehicles: { [vehicle.id]: { driver: null } } });
    console.log('Transitioning back to Interior');
  }
}

// NetworkManager.js
class NetworkManager {
  syncVehiclesFromNetwork(roomState) {
    // sync vehicle grid properties from roomState to local vehicle entity
    for (const vehicleId in roomState.vehicles) {
      const vehicleData = roomState.vehicles[vehicleId];
      const vehicle = game.getVehicle(vehicleId);
      vehicle.gridWidth = vehicleData.gridWidth;
      vehicle.gridHeight = vehicleData.gridHeight;
      vehicle.gridTiles = vehicleData.gridTiles;
      vehicle.gridObjects = vehicleData.gridObjects;
      vehicle.doorLocation = vehicleData.doorLocation;
      vehicle.pilotSeatLocation = vehicleData.pilotSeatLocation;
    }
  }

  updateRoomState(updateData) {
    // update roomState with vehicle grid changes
    game.room.sendUpdate(updateData);
  }
}

// Game.js
class Game {
  update() {
    // handle player input
    if (input.isKeyPressed('E')) {
      if (player.playerState === 'Overworld' && player.isNearVehicle()) {
        player.enterVehicle(vehicle);
      } else if (player.playerState === 'Interior') {
        if (player.gridX === vehicle.doorLocation.x && player.gridY === vehicle.doorLocation.y) {
          player.exitVehicle();
        } else if (player.gridX === vehicle.pilotSeatLocation.x && player.gridY === vehicle.pilotSeatLocation.y) {
          player.startPilotingVehicle(vehicle);
        }
      } else if (player.playerState === 'Piloting') {
        player.stopPilotingVehicle(vehicle);
      }
    }
  }
}

// Renderer.js
class Renderer {
  render() {
    if (player.playerState === 'Interior') {
      // clear screen and draw placeholder message or basic grid representation
    } else {
      // render game world
    }
  }
}

// InteriorRenderer.js
class InteriorRenderer {
  constructor(vehicle, player) {
    this.vehicle = vehicle;
    this.player = player;
  }

  render() {
    // draw vehicle's grid (gridTiles), placed objects (gridObjects), and player character at their gridX, gridY position
  }
}