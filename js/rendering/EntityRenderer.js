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

            const screenPos = this.renderer.worldToScreen(entity.x, entity.y);
            const screenSize = (entity.size || 20) * this.renderer.camera.zoom;

            // Culling check
            const cullMargin = screenSize;
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
            // Slightly dim remote players
            this.ctx.globalAlpha = 0.9;
        }

        // --- Shadow Rendering (using new logic) ---
        if (light.enabled && light.shadowVisibility > 0 && entity.type !== 'projectile') {
            const shadowAlpha = 0.3 * light.shadowVisibility; // Fade shadow with visibility

            // Base shadow size & position calculation
            // Increased max horizontal displacement by 25% (0.6 * 1.25 = 0.75)
            const maxShadowDisplacement = screenSize * 0.75; 
            // Reduce base vertical offset (move shadow up slightly at midday)
            const baseVerticalOffset = screenSize * 0.075; 
            // Keep additional offset based on factor
            const additionalVerticalOffset = screenSize * 0.1 * light.shadowVerticalOffsetFactor; // Lower at dawn/dusk
            const shadowX = screenPos.x + light.shadowHorizontalOffsetFactor * maxShadowDisplacement; // Use max displacement
            const shadowY = screenPos.y + baseVerticalOffset + additionalVerticalOffset;

            // Shadow shape calculation
            const baseWidthRadius = screenSize * 0.3; // Base width radius at noon
            const baseHeightRadius = screenSize * 0.25; // Base height radius at noon
            
            // Increased stretching factors by 25%
            const shadowWidthFactor = 1.0 + light.shadowVerticalOffsetFactor * 1.5; // Max stretch = 2.5
            const shadowHeightFactor = 1.0 - light.shadowVerticalOffsetFactor * 0.55; // Max squash = 0.45

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

        // Apply entity rotation around its center
        this.ctx.translate(screenPos.x, screenPos.y);
        if (entity.angle !== undefined && entity.angle !== 0) {
            this.ctx.rotate(entity.angle);
        }

        // Draw entity shape/sprite
        if (entity.render && typeof entity.render === 'function') {
            // Use entity's custom render method
            // Apply tinting if lighting is enabled
            if (light.enabled && entity.color) {
                const originalColor = entity.color;
                entity.color = this.renderer.worldRenderer.adjustColorForLighting(
                    originalColor,
                    light.lightColor,
                    light.ambientLight
                );
                entity.render(this.ctx, 0, 0, screenSize);
                entity.color = originalColor; // Restore original color
            } else {
                 entity.render(this.ctx, 0, 0, screenSize);
            }
        } else {
            // Default entity rendering (circle)
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

            // Default direction indicator
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
        // Draw entity name/label if applicable and zoomed in
        if (entity.name && this.renderer.camera.zoom > 0.5) {
            this.ctx.fillStyle = (player && entity.id === player.id) ? 'white' : 'rgba(220, 220, 220, 0.9)';
            this.ctx.font = `bold ${Math.max(9, 12 * this.renderer.camera.zoom)}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 3;
            this.ctx.fillText(entity.name, screenPos.x, screenPos.y - screenSize / 2 - 10);
            this.ctx.shadowBlur = 0;
        }

        // Draw health bar if entity has health and is not at full health OR is the player
        const showHealthBar = entity.health !== undefined && entity.maxHealth !== undefined && entity.maxHealth > 0 &&
                            (entity.health < entity.maxHealth || (player && entity.id === player.id));

        if (showHealthBar && this.renderer.camera.zoom > 0.3) {
            const healthPercent = Math.max(0, entity.health / entity.maxHealth);
            const barWidth = Math.max(20, screenSize * 0.7) * this.renderer.camera.zoom;
            const barHeight = Math.max(3, 5 * this.renderer.camera.zoom);
            const barYOffset = screenSize / 2 + 5 * this.renderer.camera.zoom;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + barYOffset;

            // Health bar background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            // Health bar fill color based on percentage
            const healthColor = healthPercent > 0.6 ? '#4caf50' : (healthPercent > 0.3 ? '#ffc107' : '#f44336');
            this.ctx.fillStyle = healthColor;
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            // Optional: Add border to health bar
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        this.ctx.textAlign = 'left'; // Reset alignment
    }
}