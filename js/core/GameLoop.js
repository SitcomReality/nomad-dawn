export default class GameLoop {
    constructor(game) {
        this.game = game;
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.rawDeltaTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.game.performance.reset();
        requestAnimationFrame(this.gameLoop);
        this.game.debug.log('Game started');
    }

    stop() {
        this.isRunning = false;
        this.game.debug.log('Game stopped');
        if (this.game.network) this.game.network.disconnect();
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        const now = performance.now();
        const rawDt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        this.deltaTime = Math.min(rawDt, 1 / 30);
        this.rawDeltaTime = rawDt;

        this.game.performance.update(timestamp, this.rawDeltaTime);

        this.game.input.update();
        this.game.interactions.handleInput(now);

        // Call the game's update/render responsibilities
        this.gameUpdate(this.deltaTime, timestamp);
        this.gameRender();

        requestAnimationFrame(this.gameLoop);
    }

    gameUpdate(deltaTime, timestamp) {
        const game = this.game;

        // Time of day handling & ambient light
        if (game.timeAuthority) {
            const cycleDuration = game.config.DAY_NIGHT_CYCLE_DURATION_SECONDS || 90;
            const timeIncrement = deltaTime / cycleDuration;
            game.timeOfDay = (game.timeOfDay + timeIncrement) % 1;
            if (timestamp - game.lastTimeSync > game.timeSyncInterval) {
                game.network.updateRoomState({ timeOfDay: game.timeOfDay });
                game.lastTimeSync = timestamp;
            }
        }

        const ambientFactor = Math.cos((game.timeOfDay - 0.5) * Math.PI * 2) * 0.5 + 0.5;
        const ambientIntensity = Math.max(0.1, ambientFactor);
        const baseAmbient = { r: 50, g: 50, b: 70 };
        const dayAmbient = { r: 200, g: 200, b: 220 };
        const currentAmbient = {
            r: Math.floor(baseAmbient.r + (dayAmbient.r - baseAmbient.r) * ambientIntensity),
            g: Math.floor(baseAmbient.g + (dayAmbient.g - baseAmbient.g) * ambientIntensity),
            b: Math.floor(baseAmbient.b + (dayAmbient.b - baseAmbient.b) * ambientIntensity),
        };
        game.lightManager.setGlobalAmbientLight(currentAmbient);

        // World update
        const cameraCenterX = game.player ? game.player.x : game.renderer?.camera?.x ?? 0;
        const cameraCenterY = game.player ? game.player.y : game.renderer?.camera?.y ?? 0;
        game.world?.update(deltaTime, cameraCenterX, cameraCenterY);

        // Player logic
        if (game.player && !game.isGuestMode) {
            const playerState = game.player.playerState;
            switch (playerState) {
                case 'Overworld':
                case 'Interior':
                    game.player.update(deltaTime, game.input);
                    break;
                case 'Piloting':
                    break;
                case 'Building':
                    game.ui?.baseBuilding?.buildingManager?.update?.(deltaTime);
                    break;
            }
        }

        // Entities, collisions, shadows, network sync, UI
        game.entities.update(deltaTime);
        if (game.player?.playerState === 'Overworld' || game.entities.getByType('vehicle').some(v => v)) {
            game.collisions.checkCollisions();
        }
        game.shadowManager.calculateShadows();
        game.syncNetworkState?.();
        game.ui.update();
    }

    gameRender() {
        const game = this.game;
        if (!game.renderer) return;

        game.renderer.lastFrameTime = this.lastFrameTime;
        game.renderer.clear();

        // Camera target selection
        let cameraTarget = game.player ? game.player : { x: 0, y: 0 };
        if (game.player?.playerState === 'Piloting') {
            cameraTarget = game.entities.get(game.player.currentVehicleId) || cameraTarget;
        } else if (game.isGuestMode) {
            const players = game.entities.getByType('player');
            if (players.length > 0) {
                let avgX = 0, avgY = 0;
                players.forEach(p => { avgX += p.x; avgY += p.y; });
                cameraTarget = { x: avgX / players.length, y: avgY / players.length };
            } else cameraTarget = { x: 0, y: 0 };
        }

        // Render modes
        if (game.player?.playerState === 'Interior') {
            const vehicle = game.entities.get(game.player.currentVehicleId);
            if (vehicle && game.renderer.interiorRenderer) {
                game.renderer.interiorRenderer.render(vehicle, game.player);
            } else { this.renderErrorState('Interior Render Error'); }
        } else if (game.player?.playerState === 'Building') {
            if (game.renderer.baseBuildingRenderer) {
                game.renderer.ctx.fillStyle = '#151515';
                game.renderer.ctx.fillRect(0, 0, game.renderer.canvas.width, game.renderer.canvas.height);
            } else { this.renderErrorState('Building Render Error'); }
        } else {
            game.world ? game.renderer.renderWorld(game.world, cameraTarget) : this.renderFallbackBackground();
            const entitiesToRender = (game.player?.playerState === 'Piloting')
                ? game.entities.getAll().filter(e => e.id !== game.player.id)
                : game.entities.getAll();
            game.renderer.renderEntities(entitiesToRender, game.player);
            game.renderer.renderShadows();
            game.renderer.renderEffects();
        }

        game.renderer.renderUI(game);
    }

    // Helper passthroughs for compatibility if Game calls them
    renderErrorState(message) {
        if (!this.game || !this.game.renderer) return;
        this.game.renderer.ctx.fillStyle = 'red';
        this.game.renderer.ctx.fillRect(0, 0, this.game.renderer.canvas.width, this.game.renderer.canvas.height);
        this.game.renderer.ctx.fillStyle = 'white';
        this.game.renderer.ctx.font = '20px monospace';
        this.game.renderer.ctx.textAlign = 'center';
        this.game.renderer.ctx.fillText(`Error: ${message}`, this.game.renderer.canvas.width / 2, this.game.renderer.canvas.height / 2);
    }

    renderFallbackBackground() {
        if (!this.game || !this.game.renderer) return;
        this.game.renderer.ctx.fillStyle = '#111';
        this.game.renderer.ctx.fillRect(0, 0, this.game.renderer.canvas.width, this.game.renderer.canvas.height);
    }
}