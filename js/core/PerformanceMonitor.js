// New file: js/core/PerformanceMonitor.js
export default class PerformanceMonitor {
    constructor(game) {
        this.game = game;
        this.frameCounter = 0;
        this.frameTimeAccumulator = 0;
        this.fpsUpdateInterval = 1000; // ms
        this.lastFpsUpdate = 0;
    }

    reset() {
        this.frameCounter = 0;
        this.frameTimeAccumulator = 0;
        this.lastFpsUpdate = performance.now();
    }

    update(timestamp, rawDeltaTime) {
        this.frameCounter++;
        this.frameTimeAccumulator += rawDeltaTime;

        if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
             const avgFps = this.frameTimeAccumulator > 0 ? Math.round(this.frameCounter * 1000 / this.frameTimeAccumulator) : 0; 
             const avgFrameTimeMs = this.frameCounter > 0 ? (this.frameTimeAccumulator / this.frameCounter) : 0; 

            // Update debug stats
            if (this.game.debug) {
                 const memoryUsage = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 'N/A';
                 const networkState = this.game.network ? (this.game.network.connected ? 'Connected' : 'Disconnected') : 'N/A';
                 const player = this.game.player;
                 let playerPos = 'N/A';
                 if (player) {
                     switch(player.playerState) {
                         case 'Interior': playerPos = `Interior (${player.gridX.toFixed(1)}, ${player.gridY.toFixed(1)})`; break;
                         case 'Piloting': playerPos = `Piloting (${Math.floor(player.x)}, ${Math.floor(player.y)})`; break;
                         case 'Building': playerPos = `Building (${Math.floor(player.x)}, ${Math.floor(player.y)})`; break;
                         case 'Overworld': playerPos = `Overworld (${Math.floor(player.x)}, ${Math.floor(player.y)})`; break;
                         default: playerPos = `Unknown State (${Math.floor(player.x)}, ${Math.floor(player.y)})`; break;
                     }
                 } else if (this.game.isGuestMode) {
                     playerPos = 'Guest Mode';
                 }

                 const playerStateStr = player ? player.playerState : (this.game.isGuestMode ? 'Guest' : 'N/A');
                 const clientId = this.game.network ? (this.game.network.clientId ? this.game.network.clientId.substring(0, 8) : (this.game.isGuestMode ? 'Guest' : 'None')) : 'N/A';
                 const timeOfDayStr = this.game.timeOfDay.toFixed(3);
                 const vehiclesCount = this.game.entities ? this.game.entities.getByType('vehicle').length : 'N/A';

                 const womStats = this.game.worldObjectManager?.getPerformanceStats() || {};

                 this.game.debug.updateStats({
                    FPS: avgFps,
                    FrameTime: avgFrameTimeMs.toFixed(2) + ' ms',
                    TimeOfDay: timeOfDayStr,
                    Mode: playerStateStr,
                    Entities: this.game.entities ? this.game.entities.count() : 'N/A',
                    Vehicles: vehiclesCount,
                    PlayerPos: playerPos,
                    Memory: memoryUsage,
                    ActiveChunks: this.game.world ? this.game.world.chunkManager.activeChunkIds.size : 'N/A',
                    Network: networkState,
                    ClientID: clientId,
                    WOM_Total: womStats.totalObjects ?? 'N/A',
                    WOM_Visible: womStats.lastReturnCount ?? 'N/A',
                    WOM_Checked: womStats.lastCheckCount ?? 'N/A',
                    WOM_CheckMs: womStats.lastCheckMs ?? 'N/A'
                });

                 if (this.game.renderer && this.game.debug.isEnabled()) {
                    this.game.renderer.renderDebugInfo(this.game.debug.getDebugData());
                 }
            }

            this.frameCounter = 0;
            this.frameTimeAccumulator = 0;
            this.lastFpsUpdate = timestamp;
        }
    }
}