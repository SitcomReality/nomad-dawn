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
            if (this.game?.debug?.isEnabled()) {
                // console.log(`[SpriteManager] Spritesheet image not yet loaded: ${sheetConfig.id} (for sprite ${spriteCellId})`);
            }
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
            return false; 
        }
        
        ctx.save();
        
        if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
        if (options.rotation) {
            ctx.translate(x, y);
            ctx.rotate(options.rotation);
            x = 0; 
            y = 0;
        }

        if (options.shadow && options.shadow.enabled && options.shadow.length > 0) {
            ctx.save(); 
            if (!options.rotation) ctx.translate(x, y); 

            const shadowX = options.shadow.direction.x * options.shadow.length;
            const shadowY = options.shadow.direction.y * options.shadow.length;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(
                shadowX, 
                shadowY, 
                width * 0.4, 
                width * 0.2, 
                0, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore(); 
        }
        
        let tintedConfig = spriteConfig;
        if (options.tint && options.tint.enabled) {
            const tintColor = options.tint.lightColor; 
        }
        
        if (!options.rotation) {
            ctx.translate(x, y);
        }

        ctx.imageSmoothingEnabled = options.smoothing !== undefined ? options.smoothing : false;
        try {
            ctx.drawImage(
                tintedConfig.image, 
                tintedConfig.sx, tintedConfig.sy, tintedConfig.sw, tintedConfig.sh,
                -width / 2, -height / 2, width, height 
            );
        } catch (e) {
            this.game?.debug?.error(`Error drawing sprite ${spriteCellId}:`, e);
            ctx.restore(); 
            return false;
        }
        
        ctx.restore();
        return true;
    }
    
    getTintedSprite(spriteCellId, tintColor) {
        const cacheKey = `${spriteCellId}_tint_${tintColor.r}_${tintColor.g}_${tintColor.b}`;
        
        if (this.spriteCache[cacheKey]) {
            return this.spriteCache[cacheKey];
        }
        
        const srcConfig = this.getSpriteConfig(spriteCellId);
        if (!srcConfig) return null;
        
        let offscreenCanvas, offCtx;
        try {
            offscreenCanvas = new OffscreenCanvas(srcConfig.sw, srcConfig.sh);
            offCtx = offscreenCanvas.getContext('2d');
            if (!offCtx) throw new Error("Could not get OffscreenCanvas 2D context");
        } catch (e) {
            this.game?.debug?.warn(`OffscreenCanvas not supported or failed, using regular canvas for tinting ${spriteCellId}. Performance may be affected.`);
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = srcConfig.sw;
            offscreenCanvas.height = srcConfig.sh;
            offCtx = offscreenCanvas.getContext('2d');
            if (!offCtx) {
                this.game?.debug?.error(`Failed to get canvas context for tinting ${spriteCellId}`);
                return srcConfig; 
            }
        }

        offCtx.drawImage(
            srcConfig.image,
            srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
            0, 0, srcConfig.sw, srcConfig.sh
        );
        
        offCtx.globalCompositeOperation = 'multiply';
        offCtx.fillStyle = `rgb(${tintColor.r}, ${tintColor.g}, ${tintColor.b})`;
        offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.drawImage(
            srcConfig.image,
            srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
            0, 0, srcConfig.sw, srcConfig.sh
        );

        offCtx.globalCompositeOperation = 'source-over';
        
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