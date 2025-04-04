export default class EntityRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
    }

    render(entities, player) {
        // Sort entities by y position for basic depth sorting
        const sortedEntities = [...entities].sort((a, b) => a.y - b.y);

        // Process and render each entity
        for (const entity of sortedEntities) {
            if (!entity) continue;

            // Check player state and skip rendering if inside a vehicle
            if (entity.type === 'player' && (entity.playerState === 'Interior' || entity.playerState === 'Piloting' || entity.playerState === 'Building')) {
                 continue;
            }

            const screenPos = this.renderer.worldToScreen(entity.x, entity.y);
            const screenSize = (entity.size || 20) * this.renderer.camera.zoom;

            // Culling check
            const cullMargin = screenSize * 2;
            if (
                screenPos.x + cullMargin < 0 ||
                screenPos.y + cullMargin < 0 ||
                screenPos.x - cullMargin > this.renderer.canvas.width ||
                screenPos.y - cullMargin > this.renderer.canvas.height
            ) {
                continue;
            }

            // --- Get Light Information ---
            const light = this.game.lightManager.calculateLightAt(entity.x, entity.y);

            this.renderEntity(entity, screenPos, screenSize, player, light); // Pass light info
            this.renderEntityOverlays(entity, screenPos, screenSize, player, light); // Pass light info
        }
    }

    renderEntity(entity, screenPos, screenSize, player, light) {
        this.ctx.save();

        // Highlight the local player entity with a subtle glow
        if (player && entity.id === player.id) {
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
            this.ctx.shadowBlur = 8 * this.renderer.camera.zoom;
        } else if (entity.type === 'player') {
            // Slight transparency for remote players for visual distinction
            this.ctx.globalAlpha = 0.9;
        }

        this.ctx.translate(screenPos.x, screenPos.y);
        if (entity.angle !== undefined && entity.angle !== 0) {
            this.ctx.rotate(entity.angle);
        }

        if (entity.render && typeof entity.render === 'function') {
            let originalColor = entity.color;
            entity.color = this.renderer.worldRenderer.adjustColorForLighting(
                originalColor,
                light.color,
                light.intensity
            );
            entity.render(this.ctx, 0, 0, screenSize); 
            entity.color = originalColor; 
        } else {
            let entityColor = entity.color || '#e04f5f';
            entityColor = this.renderer.worldRenderer.adjustColorForLighting(
                entityColor,
                light.color,
                light.intensity
            );
            this.ctx.fillStyle = entityColor;

            this.ctx.beginPath();
            this.ctx.arc(0, 0, screenSize / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = Math.max(1, 2 * this.renderer.camera.zoom);
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(screenSize / 2, 0);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    renderEntityOverlays(entity, screenPos, screenSize, player, light) {
        // Reset shadow blur just in case
        this.ctx.shadowBlur = 0;

        const overlayAlpha = 1.0; 

        if (entity.name && this.renderer.camera.zoom > 0.5) {
            this.ctx.fillStyle = (player && entity.id === player.id) ? `rgba(255, 255, 255, ${overlayAlpha})` : `rgba(220, 220, 220, ${overlayAlpha * 0.9})`;
            this.ctx.font = `bold ${Math.max(9, 12 * this.renderer.camera.zoom)}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 3;
            this.ctx.fillText(entity.name, screenPos.x, screenPos.y - screenSize / 2 - 10);
            this.ctx.shadowBlur = 0;
        }

        const showHealthBar = entity.health !== undefined && entity.maxHealth !== undefined && entity.maxHealth > 0 &&
                            (entity.health < entity.maxHealth || (player && entity.id === player.id));

        if (showHealthBar && this.renderer.camera.zoom > 0.3) {
            const healthPercent = Math.max(0, entity.health / entity.maxHealth);
            const barWidth = Math.max(20, screenSize * 0.7) * this.renderer.camera.zoom;
            const barHeight = Math.max(3, 5 * this.renderer.camera.zoom);
            const barYOffset = screenSize / 2 + 5 * this.renderer.camera.zoom;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + barYOffset;

            this.ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha * 0.6})`;
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const healthColor = healthPercent > 0.6 ? '#4caf50' : (healthPercent > 0.3 ? '#ffc107' : '#f44336');
            this.ctx.fillStyle = healthColor;
            this.ctx.globalAlpha = overlayAlpha;
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
            this.ctx.globalAlpha = 1.0; 

            this.ctx.strokeStyle = `rgba(0, 0, 0, ${overlayAlpha * 0.8})`;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        this.ctx.textAlign = 'left';
    }
}