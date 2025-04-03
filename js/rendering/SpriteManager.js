export default class SpriteManager {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.spriteCache = {};
    }

    getSpriteConfig(spriteCellId) {
        const debugLog = (message, ...args) => {
            if (this.game?.debug?.isEnabled()) {
                console.log(`[SpriteManager][${spriteCellId}] ${message}`, ...args);
            }
        };
        debugLog("Attempting to get sprite config.");

        if (this.spriteCache[spriteCellId]) {
            debugLog("Found in cache.");
            return this.spriteCache[spriteCellId];
        }

        if (!this.game || !this.game.config || !this.game.config.SPRITE_CELLS || !this.game.config.SPRITESHEET_CONFIG) {
            debugLog("Game config or sprite config missing.");
            return null;
        }

        const cellInfo = this.game.config.SPRITE_CELLS[spriteCellId];
        if (!cellInfo) {
            this.game?.debug?.warn(`[SpriteManager] Sprite cell info not found for ID: ${spriteCellId}`);
            debugLog("Cell info not found in SPRITE_CELLS.");
            return null;
        }
        debugLog("Found cell info:", cellInfo);

        const sheetConfig = this.game.config.SPRITESHEET_CONFIG[cellInfo.sheet];
        if (!sheetConfig) {
            this.game?.debug?.warn(`[SpriteManager] Spritesheet config not found for sheet ID: ${cellInfo.sheet} (from sprite ${spriteCellId})`);
            debugLog(`Spritesheet config '${cellInfo.sheet}' not found in SPRITESHEET_CONFIG.`);
            return null;
        }
        debugLog("Found sheet config:", sheetConfig);

        const image = this.game.resources.get(sheetConfig.id);
        if (!image) {
            debugLog(`Spritesheet image '${sheetConfig.id}' not found in ResourceManager. Is it loaded?`);
            if (this.game?.debug?.isEnabled()) {
                // console.log(`[SpriteManager] Spritesheet image not yet loaded: ${sheetConfig.id} (for sprite ${spriteCellId})`);
            }
            return null; 
        }
        debugLog(`Found image asset '${sheetConfig.id}'. Image dimensions: ${image.width}x${image.height}`);

        const sx = cellInfo.col * sheetConfig.spriteWidth;
        const sy = cellInfo.row * sheetConfig.spriteHeight;
        const sw = sheetConfig.spriteWidth;
        const sh = sheetConfig.spriteHeight;
        debugLog(`Calculated source rect: sx=${sx}, sy=${sy}, sw=${sw}, sh=${sh}`);
        if (sx + sw > image.width || sy + sh > image.height) {
            debugLog(`Warning: Calculated source rect exceeds image dimensions!`);
            this.game?.debug?.warn(`[SpriteManager] Calculated source rect for ${spriteCellId} exceeds image dimensions! sx=${sx}, sy=${sy}, sw=${sw}, sh=${sh}, imgW=${image.width}, imgH=${image.height}`);
        }

        const config = {
            image: image,
            sx: sx,
            sy: sy,
            sw: sw,
            sh: sh,
        };

        this.spriteCache[spriteCellId] = config; 
        debugLog("Successfully created and cached config.");
        return config;
    }

    drawSprite(ctx, spriteCellId, x, y, width, height, options = {}) {
        const debugLog = (message, ...args) => {
            if (this.game?.debug?.isEnabled()) {
                console.log(`[SpriteManager][${spriteCellId}] ${message}`, ...args);
            }
        };
        debugLog(`Attempting to draw at (${x.toFixed(0)}, ${y.toFixed(0)}) with size ${width.toFixed(0)}x${height.toFixed(0)}`);

        const spriteConfig = this.getSpriteConfig(spriteCellId);
        if (!spriteConfig) {
            debugLog("Draw failed: Could not get sprite config.");
            return false; 
        }

        if (!(spriteConfig.image instanceof HTMLImageElement || spriteConfig.image instanceof OffscreenCanvas || spriteConfig.image instanceof HTMLCanvasElement)) {
            debugLog("Draw failed: spriteConfig.image is not a drawable type.", spriteConfig.image);
            return false;
        }
        if (spriteConfig.image.width === 0 || spriteConfig.image.height === 0) {
            debugLog("Draw failed: spriteConfig.image has zero dimensions.");
            return false;
        }
        if (spriteConfig.sw === 0 || spriteConfig.sh === 0) {
            debugLog("Draw failed: spriteConfig has zero source dimensions (sw/sh).");
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
            debugLog(`Drawing with config: sx=${tintedConfig.sx}, sy=${tintedConfig.sy}, sw=${tintedConfig.sw}, sh=${tintedConfig.sh}, dest=(-${(width/2).toFixed(0)}, -${(height/2).toFixed(0)}), dw=${width.toFixed(0)}, dh=${height.toFixed(0)}`);
            ctx.drawImage(
                tintedConfig.image, 
                tintedConfig.sx, tintedConfig.sy, tintedConfig.sw, tintedConfig.sh,
                -width / 2, -height / 2, width, height 
            );
            debugLog("Draw successful.");
        } catch (e) {
            debugLog("Draw failed: drawImage threw an error.", e);
            this.game?.debug?.error(`[SpriteManager] Error drawing sprite ${spriteCellId}:`, e);
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