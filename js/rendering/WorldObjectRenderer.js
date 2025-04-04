// New file: js/rendering/WorldObjectRenderer.js
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
        const spriteDrawScaleFactor = 5; // Factor to scale the sprite drawing
        const finalDrawWidth = baseScreenSize * spriteDrawScaleFactor;
        const finalDrawHeight = baseScreenSize * spriteDrawScaleFactor;

        // More aggressive culling: check based on the final draw size
        const cullMargin = Math.max(finalDrawWidth, finalDrawHeight) / 2; // Use half of the larger dimension
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

        const maxShadowDisplacement = baseScreenSize * 0.75;
        const baseVerticalOffset = baseScreenSize * 0.075;
        const additionalVerticalOffset = baseScreenSize * 0.1 * this.renderer.lightingSystem.shadowVerticalOffsetFactor; // Lower at dawn/dusk
        const shadowX = screenPos.x + this.renderer.lightingSystem.shadowHorizontalOffsetFactor * maxShadowDisplacement;
        const shadowY = screenPos.y + baseVerticalOffset + additionalVerticalOffset;

        const baseWidthRadius = baseScreenSize * 0.3; // Base width radius at noon
        const baseHeightRadius = baseScreenSize * 0.25; // Base height radius at noon

        const shadowWidthFactor = 1.0 + this.renderer.lightingSystem.shadowVerticalOffsetFactor * 1.5; // Max stretch = 2.5
        const shadowHeightFactor = 1.0 - this.renderer.lightingSystem.shadowVerticalOffsetFactor * 0.55; // Max squash = 0.45

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

        r = Math.floor(r * (lightColor.r / 255) * ambientLight);
        g = Math.floor(g * (lightColor.g / 255) * ambientLight);
        b = Math.floor(b * (lightColor.b / 255) * ambientLight);

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        return `rgb(${r}, ${g}, ${b})`;
    }
}