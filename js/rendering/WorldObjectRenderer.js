/**
 * Handles the rendering of individual world objects (features, resources)
 * Extracted from WorldRenderer to manage file length.
 */
export default class WorldObjectRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
    }

    /**
     * Renders a single world object (feature or resource).
     * Originally from WorldRenderer.renderWorldObject
     * @param {Object} obj - The world object to render.
     */
    render(obj) {
        if (!obj) return; // Guard against null/undefined objects

        const screenPos = this.renderer.worldToScreen(obj.x, obj.y);
        const baseScreenSize = (obj.size || 10) * this.renderer.camera.zoom; // Base size based on obj.size and zoom

        // --- Dynamic Sprite Scaling ---
        const baseWorldSizeFor1xScale = 16;
        const scaleRelativeToBase = (obj.size || 10) / baseWorldSizeFor1xScale;
        const spritePixelMultiplier = 3 * this.renderer.camera.zoom;
        const finalDrawSize = baseWorldSizeFor1xScale * scaleRelativeToBase * spritePixelMultiplier;

        // --- Culling Check (using finalDrawSize) ---
        const cullMargin = finalDrawSize / 2;
        if (
            screenPos.x + cullMargin < 0 ||
            screenPos.y + cullMargin < 0 ||
            screenPos.x - cullMargin > this.renderer.canvas.width ||
            screenPos.y - cullMargin > this.renderer.canvas.height
        ) {
            return;
        }

        // Save context state before drawing object AND overlays
        this.ctx.save();

        // --- Get Light Information ---
        const light = this.game.lightManager.calculateLightAt(obj.x, obj.y);

        // --- Sprite Rendering ---
        if (obj.spriteCellId && this.renderer.spriteManager) {
            const spriteOptions = {
                smoothing: false, // Pixel art style
                // Apply lighting tint using LightManager results
                tint: {
                    enabled: true, // Always attempt tinting now
                    lightColor: light.color,
                    intensity: light.intensity // Pass calculated intensity
                }
            };

            // Use the SpriteManager to draw the sprite
            const drawn = this.renderer.spriteManager.drawSprite(
                this.ctx,
                obj.spriteCellId,
                screenPos.x,
                screenPos.y,
                finalDrawSize, // Use calculated final draw size
                finalDrawSize, // Use calculated final draw size
                spriteOptions
            );

            if (!drawn) {
                 // Fallback rendering if sprite fails
                 this.drawFallbackObject(obj, screenPos, finalDrawSize, light); // Pass light info
            }
        } else {
            // Fallback rendering if no sprite info or manager
             this.drawFallbackObject(obj, screenPos, finalDrawSize, light); // Pass light info
        }

        // Restore context state after drawing object and overlays
        this.ctx.restore();
    }

    // --- UPDATED: drawFallbackObject signature ---
    drawFallbackObject(obj, screenPos, drawSize, light) {
        // Simple circle fallback
        let fallbackColor = obj.color || '#888'; // Use object color or default grey

        // --- UPDATED: Use calculated light ---
        fallbackColor = this.adjustColorForLighting(
            fallbackColor,
            light.color,
            light.intensity
        );
        // --- END UPDATED ---

        this.ctx.fillStyle = fallbackColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, drawSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

         // Optional: Add a border for visibility
         this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
         this.ctx.lineWidth = 1;
         this.ctx.stroke();
    }

    // --- UPDATED: adjustColorForLighting signature ---
    adjustColorForLighting(colorString, lightColor, lightIntensity) {
        let r, g, b;

        if (!colorString) colorString = '#888'; // Default grey if color is undefined

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

        // --- UPDATED: Use calculated light values ---
        // Modulate by light color AND intensity
        // Normalize light color components (0-1) and multiply by intensity
        const lightRNorm = (lightColor.r / 255) * lightIntensity;
        const lightGNorm = (lightColor.g / 255) * lightIntensity;
        const lightBNorm = (lightColor.b / 255) * lightIntensity;

        // Apply modulation
        r = Math.floor(r * lightRNorm);
        g = Math.floor(g * lightGNorm);
        b = Math.floor(b * lightBNorm);
        // --- END UPDATED ---

        // Clamp values
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        return `rgb(${r}, ${g}, ${b})`;
    }
}