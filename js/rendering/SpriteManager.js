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
            return null;
        }

        const cellInfo = this.game.config.SPRITE_CELLS[spriteCellId];
        if (!cellInfo) return null;

        const sheetConfig = this.game.config.SPRITESHEET_CONFIG[cellInfo.sheet];
        if (!sheetConfig) return null;

        const image = this.game.resources.get(sheetConfig.id);
        if (!image) return null; // Image not loaded yet

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
        if (!spriteConfig) return false;
        
        ctx.save();
        
        // Apply options
        if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
        if (options.rotation) ctx.rotate(options.rotation);
        if (options.tint && options.tint.enabled) {
            // Apply color tinting (for future day/night cycle)
            // This would require a more complex implementation with canvas filters
            // or rendering to an offscreen canvas with color manipulation
        }
        
        // Draw the sprite
        ctx.imageSmoothingEnabled = options.smoothing !== undefined ? options.smoothing : false;
        ctx.drawImage(
            spriteConfig.image,
            spriteConfig.sx, spriteConfig.sy, spriteConfig.sw, spriteConfig.sh,
            x - width / 2, y - height / 2, width, height
        );
        
        // Draw shadow if enabled (for future day/night cycle)
        if (options.shadow && this.renderer.lightingSystem.shadowLength > 0) {
            // Placeholder for future shadow implementation
            // Would use shadowDirection and shadowLength from lighting system
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
        const offscreenCanvas = document.createElement('canvas');
        const offCtx = offscreenCanvas.getContext('2d');
        
        offscreenCanvas.width = srcConfig.sw;
        offscreenCanvas.height = srcConfig.sh;
        
        // Draw the original sprite
        offCtx.drawImage(
            srcConfig.image,
            srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
            0, 0, srcConfig.sw, srcConfig.sh
        );
        
        // Apply the tint
        offCtx.globalCompositeOperation = 'multiply';
        offCtx.fillStyle = `rgb(${tintColor.r}, ${tintColor.g}, ${tintColor.b})`;
        offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        // Restore original alpha
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.drawImage(
            srcConfig.image,
            srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
            0, 0, srcConfig.sw, srcConfig.sh
        );
        
        // Store in cache
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