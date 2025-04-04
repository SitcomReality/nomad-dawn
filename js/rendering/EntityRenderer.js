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

            // --- NEW: Check player state and skip rendering if inside a vehicle ---
            // We hide players (both local and remote) from the overworld view
            // if their state indicates they are inside a vehicle.
            // The InteriorRenderer is responsible for drawing the player when inside.
            if (entity.type === 'player' && (entity.playerState === 'Interior' || entity.playerState === 'Piloting' || entity.playerState === 'Building')) {
                 // Skip rendering players who are not in the 'Overworld' state
                 continue;
            }
            // --- END NEW ---


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

            // Extract lighting system for easier access
            const light = this.renderer.lightingSystem;

            this.renderEntity(entity, screenPos, screenSize, player, light);
            this.renderEntityOverlays(entity, screenPos, screenSize, player);
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

        // --- Shadow Rendering (using new logic) ---
        if (light.enabled && light.shadowVisibility > 0 && entity.type !== 'projectile') {
            const shadowAlpha = 0.3 * light.shadowVisibility;

            // --- MODIFIED: Increased horizontal shadow displacement ---
            const maxShadowDisplacement = screenSize * 0.95; 
            // --- END MODIFIED ---
            const baseVerticalOffset = screenSize * 0.15; 
            const additionalVerticalOffset = screenSize * 0.15 * light.shadowVerticalOffsetFactor; 
            const shadowX = screenPos.x + light.shadowHorizontalOffsetFactor * maxShadowDisplacement;
            const shadowY = screenPos.y + baseVerticalOffset + additionalVerticalOffset;

            const baseWidthRadius = screenSize * 0.6; 
            const baseHeightRadius = screenSize * 0.5; 

            const shadowWidthFactor = light.shadowWidthFactor; 
            const shadowHeightFactor = light.shadowHeightFactor; 

            const shadowWidth = baseWidthRadius * shadowWidthFactor;
            const shadowHeight = baseHeightRadius * shadowHeightFactor;

            this.ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
            this.ctx.beginPath();
            this.ctx.ellipse(
                shadowX,
                shadowY,
                shadowWidth,
                shadowHeight,
                0, 0, Math.PI * 2
            );
            this.ctx.fill();
        }

        this.ctx.translate(screenPos.x, screenPos.y);
        if (entity.angle !== undefined && entity.angle !== 0) {
            this.ctx.rotate(entity.angle);
        }

        if (entity.render && typeof entity.render === 'function') {
            let originalColor = entity.color;
            if (light.enabled && entity.color) {
                entity.color = this.renderer.worldRenderer.adjustColorForLighting(
                    originalColor,
                    light.lightColor,
                    light.ambientLight
                );
            }
            entity.render(this.ctx, 0, 0, screenSize);
            if (light.enabled && entity.color) {
                entity.color = originalColor;
            }
        } else {
            let entityColor = entity.color || '#e04f5f';
            if (light.enabled) {
                entityColor = this.renderer.worldRenderer.adjustColorForLighting(
                    entityColor,
                    light.lightColor,
                    light.ambientLight
                );
            }
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

    renderEntityOverlays(entity, screenPos, screenSize, player) {
        // Reset shadow blur just in case
        this.ctx.shadowBlur = 0;

        if (entity.name && this.renderer.camera.zoom > 0.5) {
            this.ctx.fillStyle = (player && entity.id === player.id) ? 'white' : 'rgba(220, 220, 220, 0.9)';
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

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const healthColor = healthPercent > 0.6 ? '#4caf50' : (healthPercent > 0.3 ? '#ffc107' : '#f44336');
            this.ctx.fillStyle = healthColor;
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        this.ctx.textAlign = 'left';
    }
}