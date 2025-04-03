export default class SpriteManager {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.spriteCache = {};
    }
    
    getSpriteConfig(spriteCellId) {
        if (this.spriteCache[spriteCellId]) {
            return this.spriteCache[spriteCellId];
        }

        if (!this.game || !this.game.config || !this.game.config.SPRITE_CELLS || !this.game.config.SPRITESHEET_CONFIG) {
            this.game?.debug?.warn(`Sprite config or game config missing when requesting: ${spriteCellId}`);
            return null;
        }

        const cellInfo = this.game.config.SPRITE_CELLS[spriteCellId];
        if (!cellInfo) {
            this.game?.debug?.warn(`Sprite cell info not found for ID: ${spriteCellId}`);
            return null;
        }

        const sheetConfig = this.game.config.SPRITESHEET_CONFIG[cellInfo.sheet];
        if (!sheetConfig) {
             this.game?.debug?.warn(`Spritesheet config not found for sheet ID: ${cellInfo.sheet} (from sprite ${spriteCellId})`);
            return null;
        }

        const image = this.game.resources.get(sheetConfig.id);
        if (!image) {
             // This is expected during initial load, don't warn every frame
             // this.game?.debug?.warn(`Spritesheet image not yet loaded: ${sheetConfig.id} (from sprite ${spriteCellId})`);
            return null; // Image not loaded yet
        }

        const config = {
            image: image,
            sx: cellInfo.col * sheetConfig.spriteWidth,
            sy: cellInfo.row * sheetConfig.spriteHeight,
            sw: sheetConfig.spriteWidth,
            sh: sheetConfig.spriteHeight,
        };
        
        this.spriteCache[spriteCellId] = config; // Cache the result
        return config;
    }
    
    drawSprite(ctx, spriteCellId, x, y, width, height, options = {}) {
        const spriteConfig = this.getSpriteConfig(spriteCellId);
        if (!spriteConfig) {
            // Fallback handled in WorldRenderer, don't log error here
            return false; 
        }
        
        ctx.save();
        
        // Apply options
        if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
        if (options.rotation) {
             // Ensure rotation happens around the center
             ctx.translate(x, y);
             ctx.rotate(options.rotation);
             ctx.translate(-x, -y); // Translate back
        }

        // Draw shadow first if enabled (so it's behind the sprite)
        if (options.shadow && options.shadow.enabled && options.shadow.length > 0) {
             const shadowX = x + options.shadow.direction.x * options.shadow.length;
             const shadowY = y + options.shadow.direction.y * options.shadow.length;
            
             // Use a simple oval shadow based on the sprite's target size
             ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
             ctx.beginPath();
             ctx.ellipse(
                 shadowX, 
                 shadowY, 
                 width * 0.4, // Shadow width based on sprite width
                 width * 0.2, // Shadow height based on sprite width
                 0, 0, Math.PI * 2
             );
             ctx.fill();
        }
        
        // Apply tint if enabled
        let tintedConfig = spriteConfig;
        if (options.tint && options.tint.enabled) {
             // Use cached tinted version or generate on the fly
             // Note: Day/night cycle tinting is more complex, this is a basic placeholder
             const tintColor = options.tint.lightColor; // Example: Using lightColor
             // tintedConfig = this.getTintedSprite(spriteCellId, tintColor); // Requires offscreen canvas generation
             
             // Simpler tint effect using globalAlpha and fillRect (less accurate)
             // ctx.globalAlpha = options.tint.ambientLight * (options.alpha ?? 1); // Apply ambient light dimming
             // ctx.fillStyle = `rgb(${tintColor.r}, ${tintColor.g}, ${tintColor.b})`;
             // ctx.globalCompositeOperation = 'multiply'; // Experiment with composite ops
             // ctx.fillRect(x - width / 2, y - height / 2, width, height);
             // ctx.globalCompositeOperation = 'source-over'; // Reset composite op
             // ctx.globalAlpha = options.alpha ?? 1; // Reset alpha
        }
        
        // Draw the sprite image
        ctx.imageSmoothingEnabled = options.smoothing !== undefined ? options.smoothing : false;
        try {
             ctx.drawImage(
                 tintedConfig.image, // Use original or tinted image
                 tintedConfig.sx, tintedConfig.sy, tintedConfig.sw, tintedConfig.sh,
                 x - width / 2, y - height / 2, width, height
             );
        } catch (e) {
             // Catch potential errors if image data is bad (e.g., 0x0 dimensions)
             this.game?.debug?.error(`Error drawing sprite ${spriteCellId}:`, e);
             ctx.restore(); // Ensure context is restored on error
             return false;
        }
        
        ctx.restore();
        return true;
    }
    
    // For the future day/night cycle - generate tinted version of sprite
    getTintedSprite(spriteCellId, tintColor) {
        // Key for the tinted sprite cache
        const cacheKey = `${spriteCellId}_tint_${tintColor.r}_${tintColor.g}_${tintColor.b}`;
        
        if (this.spriteCache[cacheKey]) {
            return this.spriteCache[cacheKey];
        }
        
        const srcConfig = this.getSpriteConfig(spriteCellId);
        if (!srcConfig) return null;
        
        // Create an offscreen canvas for the tinted sprite
        let offscreenCanvas, offCtx;
        try {
             offscreenCanvas = new OffscreenCanvas(srcConfig.sw, srcConfig.sh);
             offCtx = offscreenCanvas.getContext('2d');
             if (!offCtx) throw new Error("Could not get OffscreenCanvas 2D context");
        } catch (e) {
             // Fallback for environments without OffscreenCanvas (or errors)
             this.game?.debug?.warn(`OffscreenCanvas not supported or failed, using regular canvas for tinting ${spriteCellId}. Performance may be affected.`);
             offscreenCanvas = document.createElement('canvas');
             offscreenCanvas.width = srcConfig.sw;
             offscreenCanvas.height = srcConfig.sh;
             offCtx = offscreenCanvas.getContext('2d');
             if (!offCtx) {
                this.game?.debug?.error(`Failed to get canvas context for tinting ${spriteCellId}`);
                 return srcConfig; // Return original config if context fails
             }
        }

        // Draw the original sprite
        offCtx.drawImage(
            srcConfig.image,
            srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
            0, 0, srcConfig.sw, srcConfig.sh
        );
        
        // Apply the tint using multiply blend mode
        offCtx.globalCompositeOperation = 'multiply';
        offCtx.fillStyle = `rgb(${tintColor.r}, ${tintColor.g}, ${tintColor.b})`;
        offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        // Restore original alpha values from the source sprite
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.drawImage(
            srcConfig.image,
            srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
            0, 0, srcConfig.sw, srcConfig.sh
        );

        // Reset composite operation for safety
        offCtx.globalCompositeOperation = 'source-over';
        
        // Store in cache
        // The 'image' property will be the OffscreenCanvas or fallback Canvas
        const tintedConfig = {
            image: offscreenCanvas, 
            sx: 0,
            sy: 0,
            sw: srcConfig.sw,
            sh: srcConfig.sh
        };
        
        this.spriteCache[cacheKey] = tintedConfig;
        return tintedConfig;
    }
}