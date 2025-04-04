/**
 * Renders entities like players and vehicles.
 */
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
            const cullMargin = screenSize * 2; // Increased margin slightly due to larger shadows
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

        // --- Shadow Rendering ---
        if (light.enabled && light.shadowVisibility > 0 && entity.type !== 'projectile') {
            const shadowAlpha = 0.3 * light.shadowVisibility;

            const maxShadowDisplacement = screenSize * 0.75; // Max horizontal shift based on screen size

            // --- MODIFIED: Increased vertical offset by 50% ---
            const baseVerticalOffset = screenSize * 0.225; // Was 0.15
            const additionalVerticalOffset = screenSize * 0.225 * light.shadowVerticalOffsetFactor; // Was 0.15 * factor
            // --- END MODIFIED ---

            const shadowX = screenPos.x + light.shadowHorizontalOffsetFactor * maxShadowDisplacement;
            const shadowY = screenPos.y + baseVerticalOffset + additionalVerticalOffset; // Final vertical position

            // --- MODIFIED: Doubled base shadow radius ---
            const baseWidthRadius = screenSize * 1.2; // Was 0.6
            const baseHeightRadius = screenSize * 1.0; // Was 0.5
            // --- END MODIFIED ---

            const shadowWidthFactor = light.shadowWidthFactor; // Calculated in Renderer
            const shadowHeightFactor = light.shadowHeightFactor; // Calculated in Renderer

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

        // Render the actual entity (sprite or fallback)
        if (entity.render && typeof entity.render === 'function') {
            let originalColor = entity.color;
            if (light.enabled && entity.color) {
                 // Apply lighting adjustments directly to color if available
                 const worldRenderer = this.game.renderer.worldRenderer; // Access WorldRenderer instance
                 if (worldRenderer?.adjustColorForLighting) { // Check if method exists
                     entity.color = worldRenderer.adjustColorForLighting(
                         originalColor,
                         light.lightColor,
                         light.ambientLight
                     );
                 }
            }
            // Call entity's own render method
            entity.render(this.ctx, 0, 0, screenSize);
            // Restore original color if modified
            if (light.enabled && entity.color && originalColor) {
                entity.color = originalColor;
            }
        } else {
            // Fallback rendering if entity has no custom render method
            let entityColor = entity.color || '#e04f5f';
            if (light.enabled) {
                 // Apply lighting adjustments directly to color if available
                 const worldRenderer = this.game.renderer.worldRenderer;
                 if (worldRenderer?.adjustColorForLighting) {
                     entityColor = worldRenderer.adjustColorForLighting(
                         entityColor,
                         light.lightColor,
                         light.ambientLight
                     );
                 }
            }
            this.ctx.fillStyle = entityColor;

            // Default circular shape
            this.ctx.beginPath();
            this.ctx.arc(0, 0, screenSize / 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Optional: Direction indicator
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

        // Render Name Tag
        if (entity.name && this.renderer.camera.zoom > 0.5) {
            this.ctx.fillStyle = (player && entity.id === player.id) ? 'white' : 'rgba(220, 220, 220, 0.9)';
            this.ctx.font = `bold ${Math.max(9, 12 * this.renderer.camera.zoom)}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 3;
            // Adjust vertical position based on entity size
            const nameYOffset = entity.size > 0 ? (entity.size * this.renderer.camera.zoom / 2 + 10) : 10;
            this.ctx.fillText(entity.name, screenPos.x, screenPos.y - nameYOffset);
            this.ctx.shadowBlur = 0;
        }

        // Render Health Bar
        const showHealthBar = entity.health !== undefined && entity.maxHealth !== undefined && entity.maxHealth > 0 &&
                            (entity.health < entity.maxHealth || (player && entity.id === player.id));

        if (showHealthBar && this.renderer.camera.zoom > 0.3) {
            const healthPercent = Math.max(0, entity.health / entity.maxHealth);
            const barWidth = Math.max(20, screenSize * 0.7) * this.renderer.camera.zoom;
            const barHeight = Math.max(3, 5 * this.renderer.camera.zoom);
            // Adjust vertical position based on entity size
            const barYOffset = entity.size > 0 ? (entity.size * this.renderer.camera.zoom / 2 + 5 * this.renderer.camera.zoom) : (5 * this.renderer.camera.zoom);
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y + barYOffset;

            // Background of health bar
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            // Determine health color based on percentage
            const healthColor = healthPercent > 0.6 ? '#4caf50' : (healthPercent > 0.3 ? '#ffc107' : '#f44336');
            this.ctx.fillStyle = healthColor;
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            // Border for the health bar
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        // Reset text alignment
        this.ctx.textAlign = 'left';
    }
}