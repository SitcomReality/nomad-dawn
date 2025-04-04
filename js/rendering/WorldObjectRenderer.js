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
        // Define a base world size where the sprite is drawn at 1x scale
        const baseWorldSizeFor1xScale = 16; // e.g., an object with size 16 uses the sprite at its native resolution conceptually
        const scaleRelativeToBase = (obj.size || 10) / baseWorldSizeFor1xScale;
        // Define a pixel size multiplier for the drawn sprite
        const spritePixelMultiplier = 3 * this.renderer.camera.zoom; // Adjust this factor as needed for visual style
        const finalDrawSize = baseWorldSizeFor1xScale * scaleRelativeToBase * spritePixelMultiplier;
        // --- End Dynamic Sprite Scaling ---

        // More aggressive culling: check based on the final draw size
        const cullMargin = finalDrawSize / 2; // Use half of the draw size
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

        // --- Shadow Rendering (using new logic) ---
        const shadowAlpha = 0.3 * this.renderer.lightingSystem.shadowVisibility; // Fade shadow with visibility

        // Adjust shadow size based on the *base* screen size before the pixel multiplier
        const shadowBaseSize = baseScreenSize;
        const maxShadowDisplacement = shadowBaseSize * 0.75;
        // --- MODIFIED: Increased base vertical offset ---
        const baseVerticalOffset = shadowBaseSize * 0.10; // Increased from 0.075 to lower the shadow
        // --- END MODIFIED ---
        const additionalVerticalOffset = shadowBaseSize * 0.1 * this.renderer.lightingSystem.shadowVerticalOffsetFactor; // Lower at dawn/dusk
        const shadowX = screenPos.x + this.renderer.lightingSystem.shadowHorizontalOffsetFactor * maxShadowDisplacement;
        const shadowY = screenPos.y + baseVerticalOffset + additionalVerticalOffset;

        const baseWidthRadius = shadowBaseSize * 0.3; // Base width radius at noon
        const baseHeightRadius = shadowBaseSize * 0.25; // Base height radius at noon

        const shadowWidthFactor = this.renderer.lightingSystem.shadowWidthFactor; // Use factor from Renderer
        const shadowHeightFactor = this.renderer.lightingSystem.shadowHeightFactor; // Use factor from Renderer

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


        // --- Sprite Rendering ---
        if (obj.spriteCellId && this.renderer.spriteManager) {
            const spriteOptions = {
                smoothing: false, // Pixel art style
                // Apply lighting tint if enabled
                tint: this.renderer.lightingSystem.enabled ? {
                    enabled: true,
                    lightColor: this.renderer.lightingSystem.lightColor,
                    ambientLight: this.renderer.lightingSystem.ambientLight
                } : { enabled: false }
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
                 this.drawFallbackObject(obj, screenPos, finalDrawSize);
            }
        } else {
            // Fallback rendering if no sprite info or manager
             this.drawFallbackObject(obj, screenPos, finalDrawSize);
        }


        // Restore context state after drawing object and overlays
        this.ctx.restore();
    }

    drawFallbackObject(obj, screenPos, drawSize) {
        // Simple circle fallback
        let fallbackColor = obj.color || '#888'; // Use object color or default grey
         if (this.renderer.lightingSystem.enabled) {
             const light = this.renderer.lightingSystem;
             fallbackColor = this.adjustColorForLighting(
                 fallbackColor,
                 light.lightColor,
                 light.ambientLight
             );
         }

        this.ctx.fillStyle = fallbackColor;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, drawSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

         // Optional: Add a border for visibility
         this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
         this.ctx.lineWidth = 1;
         this.ctx.stroke();
    }

    adjustColorForLighting(colorString, lightColor, ambientLight) {
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

        // Modulate by light color AND ambient intensity
        r = Math.floor(r * (lightColor.r / 255) * ambientLight);
        g = Math.floor(g * (lightColor.g / 255) * ambientLight);
        b = Math.floor(b * (lightColor.b / 255) * ambientLight);

        // Clamp values
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        return `rgb(${r}, ${g}, ${b})`;
    }
}