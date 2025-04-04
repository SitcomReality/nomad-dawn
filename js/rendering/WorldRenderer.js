import WorldObjectRenderer from './WorldObjectRenderer.js';

export default class WorldRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
        this.worldObjectRenderer = new WorldObjectRenderer(renderer, game);
        this.lastVisibleObjectCount = 0; // For debug logging
    }

    render(world, player, viewWidthWorld, viewHeightWorld) {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);

        const lightAtCenter = this.game.lightManager.calculateLightAt(this.renderer.camera.x, this.renderer.camera.y);
        const baseBrightness = 10; // Minimum background brightness
        const lightBrightness = (lightAtCenter.color.r + lightAtCenter.color.g + lightAtCenter.color.b) / 3; // Average brightness
        const finalBrightness = baseBrightness + (lightBrightness * 0.1); // Scale effect, avoid pure black/white
        const bgColor = `rgb(${Math.floor(finalBrightness)}, ${Math.floor(finalBrightness)}, ${Math.floor(finalBrightness)})`;

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);

        const camera = this.renderer.camera;
        const halfWidthWorld = viewWidthWorld / 2;
        const halfHeightWorld = viewHeightWorld / 2;
        const viewBounds = {
            minX: camera.x - halfWidthWorld - 100, // Add buffer for large objects/shadows
            minY: camera.y - halfHeightWorld - 100,
            maxX: camera.x + halfWidthWorld + 100,
            maxY: camera.y + halfHeightWorld + 100
        };

        const visibleChunks = world.getVisibleChunks(
            this.renderer.camera.x,
            this.renderer.camera.y,
            viewWidthWorld,
            viewHeightWorld
        );

        for (const chunk of visibleChunks) {
            this.renderChunkTerrain(chunk);
        }

        if (world.worldObjectManager) {
            const visibleObjects = world.worldObjectManager.getVisibleObjects(
                viewBounds.minX, viewBounds.minY, viewBounds.maxX, viewBounds.maxY
            );
            this.lastVisibleObjectCount = visibleObjects.length;

            for (const obj of visibleObjects) {
                this.worldObjectRenderer.render(obj);
            }
        } else {
            if (this.game?.debug?.isEnabled()) {
                this.game.debug.warn("[WorldRenderer] WorldObjectManager not available.");
            }
            this.lastVisibleObjectCount = 0;
        }

        if (this.game?.debug?.isEnabled()) {
            this.renderGrid(world);
            this.renderDebugText(visibleChunks.length, this.lastVisibleObjectCount);
        }
    }

    renderChunkTerrain(chunk) {
        const screenPos = this.renderer.worldToScreen(chunk.x, chunk.y);
        const screenSize = chunk.size * this.renderer.camera.zoom;

        const screenLeft = screenPos.x - screenSize / 2;
        const screenTop = screenPos.y - screenSize / 2;
        const screenRight = screenLeft + screenSize;
        const screenBottom = screenTop + screenSize;

        if (
            screenRight < 0 ||
            screenBottom < 0 ||
            screenLeft > this.renderer.canvas.width ||
            screenTop > this.renderer.canvas.height
        ) {
            return;
        }

        let terrainColor = chunk.biome.color;

        const light = this.game.lightManager.calculateLightAt(chunk.x, chunk.y);
        terrainColor = this.adjustColorForLighting(
            terrainColor,
            light.color,
            light.intensity
        );

        this.ctx.fillStyle = terrainColor;
        this.ctx.fillRect(screenLeft, screenTop, screenSize, screenSize);

        if (this.game?.debug?.isEnabled() && this.game.config.SHOW_CHUNK_BOUNDARIES) {
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenLeft, screenTop, screenSize, screenSize);
        }
    }

    renderGrid(world) {
        const gridSize = world.chunkSize;
        const worldLeft = this.renderer.camera.x - (this.renderer.canvas.width / 2 / this.renderer.camera.zoom);
        const worldRight = this.renderer.camera.x + (this.renderer.canvas.width / 2 / this.renderer.camera.zoom);
        const worldTop = this.renderer.camera.y - (this.renderer.canvas.height / 2 / this.renderer.camera.zoom);
        const worldBottom = this.renderer.camera.y + (this.renderer.canvas.height / 2 / this.renderer.camera.zoom);
        const startGridX = Math.floor(worldLeft / gridSize) * gridSize;
        const endGridX = Math.ceil(worldRight / gridSize) * gridSize;
        const startGridY = Math.floor(worldTop / gridSize) * gridSize;
        const endGridY = Math.ceil(worldBottom / gridSize) * gridSize;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = startGridX; x <= endGridX; x += gridSize) {
            const screenX = this.renderer.worldToScreen(x, worldTop).x;
            if (screenX >= 0 && screenX <= this.renderer.canvas.width) {
                this.ctx.moveTo(screenX, 0);
                this.ctx.lineTo(screenX, this.renderer.canvas.height);
            }
        }
        for (let y = startGridY; y <= endGridY; y += gridSize) {
            const screenY = this.renderer.worldToScreen(worldLeft, y).y;
            if (screenY >= 0 && screenY <= this.renderer.canvas.height) {
                this.ctx.moveTo(0, screenY);
                this.ctx.lineTo(this.renderer.canvas.width, screenY);
            }
        }
        this.ctx.stroke();
        const screenOrigin = this.renderer.worldToScreen(0, 0);
        if (screenOrigin.x > 0 && screenOrigin.x < this.renderer.canvas.width &&
            screenOrigin.y > 0 && screenOrigin.y < this.renderer.canvas.height)
        {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(screenOrigin.x - 10, screenOrigin.y);
            this.ctx.lineTo(screenOrigin.x + 10, screenOrigin.y);
            this.ctx.moveTo(screenOrigin.x, screenOrigin.y - 10);
            this.ctx.lineTo(screenOrigin.x, screenOrigin.y + 10);
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('(0,0)', screenOrigin.x + 15, screenOrigin.y + 5);
            this.ctx.restore();
        }
    }

    renderDebugText(chunkCount, objectCount) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Visible Chunks: ${chunkCount}`, 10, this.renderer.canvas.height - 30);
        this.ctx.fillText(`Rendered Objects: ${objectCount}`, 10, this.renderer.canvas.height - 15);
    }

    adjustColorForLighting(colorString, lightColor, lightIntensity) {
        let r, g, b;

        if (!colorString) colorString = '#888'; 

        if (typeof colorString !== 'string') {
            console.warn('[adjustColorForLighting] Received non-string color:', colorString, 'Using default #888.');
            colorString = '#888';
        }

        if (colorString.startsWith('#')) {
            const hex = colorString.substring(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            } else return colorString;
        } else if (colorString.startsWith('rgb')) {
            const rgb = colorString.match(/\d+/g);
            if (!rgb || rgb.length < 3) return colorString;
            r = parseInt(rgb[0]);
            g = parseInt(rgb[1]);
            b = parseInt(rgb[2]);
        } else return colorString;

        const lightRNorm = (lightColor.r / 255) * lightIntensity;
        const lightGNorm = (lightColor.g / 255) * lightIntensity;
        const lightBNorm = (lightColor.b / 255) * lightIntensity;

        r = Math.floor(r * lightRNorm);
        g = Math.floor(g * lightGNorm);
        b = Math.floor(b * lightBNorm);

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return `rgb(${r}, ${g}, ${b})`;
    }
}