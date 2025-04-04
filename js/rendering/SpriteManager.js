export default class SpriteManager {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.spriteCache = {};
        // Cache for tinted sprites: key format `${spriteCellId}_tint_${r}_${g}_${b}_${intensity}`
        this.tintedSpriteCache = {};
        this.tintCanvas = null; // Reusable canvas for tinting
        this.tintCtx = null; // Context for the tinting canvas
    }

    // Initialize or get the offscreen canvas for tinting
    _getTintCanvas(width, height) {
        if (!this.tintCanvas) {
            try {
                this.tintCanvas = new OffscreenCanvas(width, height);
            } catch (e) {
                // Fallback for environments without OffscreenCanvas
                this.tintCanvas = document.createElement('canvas');
            }
            this.tintCanvas.width = width;
            this.tintCanvas.height = height;
            this.tintCtx = this.tintCanvas.getContext('2d', { willReadFrequently: true }); // Optimize for frequent getImageData/putImageData
        } else {
            // Ensure size is adequate
            if (this.tintCanvas.width < width || this.tintCanvas.height < height) {
                this.tintCanvas.width = Math.max(this.tintCanvas.width, width);
                this.tintCanvas.height = Math.max(this.tintCanvas.height, height);
                 // Context might be lost on resize, re-get it
                 this.tintCtx = this.tintCanvas.getContext('2d', { willReadFrequently: true });
            }
        }
        return this.tintCtx;
    }

    getSpriteConfig(spriteCellId) {
        // Minimal logging, only essential warnings/errors
        if (this.spriteCache[spriteCellId]) {
            return this.spriteCache[spriteCellId];
        }

        if (!this.game || !this.game.config) {
            // This is a significant setup issue, keep the warning
            console.warn(`[SpriteManager] Game config missing.`);
            return null;
        }

        // First check INTERIOR_SPRITES for an exact match
        const interiorSprite = this.game.config.INTERIOR_SPRITES?.[spriteCellId];
        if (interiorSprite) {
            const sheetConfig = this.game.config.SPRITESHEET_CONFIG?.[interiorSprite.sheet];
            if (!sheetConfig) {
                // Log only if debug is enabled
                if (this.game?.debug?.isEnabled()) {
                    this.game.debug.log(`[SpriteManager] Spritesheet config not found for sheet ID: ${interiorSprite.sheet} (for sprite ${spriteCellId})`);
                }
                return null;
            }

            const image = this.game.resources.get(sheetConfig.id);
            if (!image) {
                // Log only if debug is enabled
                if (this.game?.debug?.isEnabled()) {
                    // console.log(`[SpriteManager] Spritesheet image not yet loaded: ${sheetConfig.id} (for sprite ${spriteCellId})`);
                }
                return null;
            }

            // Create config using the direct coordinates
            const config = {
                image: image,
                sx: interiorSprite.x,
                sy: interiorSprite.y,
                sw: interiorSprite.width,
                sh: interiorSprite.height,
            };

            this.spriteCache[spriteCellId] = config;
            return config;
        }

        // If not found in INTERIOR_SPRITES, check SPRITE_CELLS (original method)
        if (!this.game.config.SPRITE_CELLS || !this.game.config.SPRITESHEET_CONFIG) {
            // Keep the warning
            console.warn(`[SpriteManager] SPRITE_CELLS, or SPRITESHEET_CONFIG missing.`);
            return null;
        }

        const cellInfo = this.game.config.SPRITE_CELLS[spriteCellId];
        if (!cellInfo) {
            // Log only if debug is enabled
            if (this.game?.debug?.isEnabled()) {
                 this.game.debug.log(`[SpriteManager] Sprite cell info not found for ID: ${spriteCellId}`);
            }
            return null;
        }

        const sheetConfig = this.game.config.SPRITESHEET_CONFIG[cellInfo.sheet];
        if (!sheetConfig) {
             // Log only if debug is enabled
             if (this.game?.debug?.isEnabled()) {
                this.game.debug.log(`[SpriteManager] Spritesheet config not found for sheet ID: ${cellInfo.sheet} (from sprite ${spriteCellId})`);
             }
            return null;
        }

        const image = this.game.resources.get(sheetConfig.id);
        if (!image) {
            // Log only if debug is enabled
            if (this.game?.debug?.isEnabled()) {
                // console.log(`[SpriteManager] Spritesheet image not yet loaded: ${sheetConfig.id} (for sprite ${spriteCellId})`);
            }
            return null;
        }

        const sx = cellInfo.col * sheetConfig.spriteWidth;
        const sy = cellInfo.row * sheetConfig.spriteHeight;
        const sw = sheetConfig.spriteWidth;
        const sh = sheetConfig.spriteHeight;

        if (sx + sw > image.width || sy + sh > image.height) {
             // Log source rect issues only if debug is enabled
             if (this.game?.debug?.isEnabled()) {
                 this.game.debug.log(`[SpriteManager] Calculated source rect for ${spriteCellId} exceeds image dimensions! sx=${sx}, sy=${sy}, sw=${sw}, sh=${sh}, imgW=${image.width}, imgH=${image.height}`);
             }
             // Potentially return null here too if it causes drawing issues? For now, let it try.
        }

        const config = {
            image: image,
            sx: sx,
            sy: sy,
            sw: sw,
            sh: sh,
        };

        this.spriteCache[spriteCellId] = config;
        return config;
    }

    drawSprite(ctx, spriteCellId, x, y, width, height, options = {}) {
        // Minimal logging

        const spriteConfig = this.getSpriteConfig(spriteCellId);
        if (!spriteConfig) {
            return false;
        }

        if (!(spriteConfig.image instanceof HTMLImageElement || spriteConfig.image instanceof OffscreenCanvas || spriteConfig.image instanceof HTMLCanvasElement)) {
            // Log error only if debug enabled
            if (this.game?.debug?.isEnabled()) {
                 this.game.debug.error(`[SpriteManager] Sprite image for ${spriteCellId} is not a drawable type.`, spriteConfig.image);
            }
            return false;
        }
        if (spriteConfig.image.width === 0 || spriteConfig.image.height === 0) {
             // Log error only if debug enabled
             if (this.game?.debug?.isEnabled()) {
                 this.game.debug.error(`[SpriteManager] Sprite image for ${spriteCellId} has zero dimensions.`);
             }
            return false;
        }
        if (spriteConfig.sw <= 0 || spriteConfig.sh <= 0) {
            // Log error only if debug enabled
             if (this.game?.debug?.isEnabled()) {
                 this.game.debug.error(`[SpriteManager] Sprite config for ${spriteCellId} has zero or negative source dimensions (sw/sh). sw=${spriteConfig.sw}, sh=${spriteConfig.sh}`);
             }
            return false;
        }

        ctx.save();

        if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
        // Handle rotation *before* tinting/drawing if needed
        if (options.rotation) {
            ctx.translate(x, y); // Move origin to the drawing center
            ctx.rotate(options.rotation);
            // After rotation, drawing happens relative to the new origin (0,0)
            x = 0;
            y = 0;
        }

        // Tinting logic
        let imageToDraw = spriteConfig.image;
        let sx = spriteConfig.sx;
        let sy = spriteConfig.sy;
        let sw = spriteConfig.sw;
        let sh = spriteConfig.sh;

        if (options.tint && options.tint.enabled) {
             const tintColor = options.tint.lightColor || { r: 255, g: 255, b: 255 };
             const intensity = options.tint.intensity ?? 1.0; 
             const tintedSprite = this.getTintedSprite(spriteCellId, tintColor, intensity); 
             if (tintedSprite) {
                 imageToDraw = tintedSprite.image;
                 sx = tintedSprite.sx;
                 sy = tintedSprite.sy;
                 sw = tintedSprite.sw;
                 sh = tintedSprite.sh;
             } else if (this.game?.debug?.isEnabled()) {
                 this.game.debug.warn(`[SpriteManager] Failed to get tinted sprite for ${spriteCellId}`);
             }
        }

        // Apply translation if not rotating
        if (!options.rotation) {
             ctx.translate(x, y);
        }

        ctx.imageSmoothingEnabled = options.smoothing !== undefined ? options.smoothing : false;
        try {
            // Draw relative to the translated/rotated origin
            ctx.drawImage(
                imageToDraw,
                sx, sy, sw, sh,
                -width / 2, -height / 2, width, height // Draw centered around the origin
            );
        } catch (e) {
            // Keep error logging
            this.game?.debug?.error(`[SpriteManager] Error drawing sprite ${spriteCellId}:`, e);
            ctx.restore();
            return false;
        }

        ctx.restore();
        return true;
    }

    getTintedSprite(spriteCellId, tintColor, intensity) {
        // Generate cache key including intensity
        const r = tintColor.r ?? 255;
        const g = tintColor.g ?? 255;
        const b = tintColor.b ?? 255;
        const intensityKey = Math.round(intensity * 100); 
        const cacheKey = `${spriteCellId}_tint_${r}_${g}_${b}_i${intensityKey}`;

        if (this.tintedSpriteCache[cacheKey]) {
            return this.tintedSpriteCache[cacheKey];
        }

        const srcConfig = this.getSpriteConfig(spriteCellId);
        if (!srcConfig || srcConfig.sw <= 0 || srcConfig.sh <= 0) return null;

        // Get the reusable tint context, ensuring it's large enough
        const tintCtx = this._getTintCanvas(srcConfig.sw, srcConfig.sh);
        if (!tintCtx) {
             this.game?.debug?.error(`Failed to get tinting context for ${spriteCellId}`);
             return null;
        }
        const tintCanvas = tintCtx.canvas;

        // Clear the specific area needed (faster than clearRect(0,0,w,h))
        tintCtx.clearRect(0, 0, srcConfig.sw, srcConfig.sh);

        try {
            // 1. Draw the original sprite onto the tint canvas
            tintCtx.drawImage(
                srcConfig.image,
                srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
                0, 0, srcConfig.sw, srcConfig.sh
            );

            // Adjust tint color by intensity
            const effectiveR = Math.floor(r * intensity);
            const effectiveG = Math.floor(g * intensity);
            const effectiveB = Math.floor(b * intensity);

            tintCtx.globalCompositeOperation = 'multiply';
            tintCtx.fillStyle = `rgb(${effectiveR}, ${effectiveG}, ${effectiveB})`;
            tintCtx.fillRect(0, 0, srcConfig.sw, srcConfig.sh);

            // 3. Use destination-in to retain original alpha channel
            tintCtx.globalCompositeOperation = 'destination-in';
            tintCtx.drawImage(
                srcConfig.image,
                srcConfig.sx, srcConfig.sy, srcConfig.sw, srcConfig.sh,
                0, 0, srcConfig.sw, srcConfig.sh
            );

            // 4. Reset composite operation
            tintCtx.globalCompositeOperation = 'source-over';

            // Create a *new* canvas/image for the cache to avoid mutation issues
            let finalImage;
            if (typeof OffscreenCanvas !== 'undefined' && tintCanvas instanceof OffscreenCanvas) {
                 finalImage = new OffscreenCanvas(srcConfig.sw, srcConfig.sh);
                 finalImage.getContext('2d').drawImage(tintCanvas, 0, 0);

            } else {
                 finalImage = document.createElement('canvas');
                 finalImage.width = srcConfig.sw;
                 finalImage.height = srcConfig.sh;
                 finalImage.getContext('2d').drawImage(tintCanvas, 0, 0);
            }

            const tintedConfig = {
                image: finalImage, 
                sx: 0,
                sy: 0,
                sw: srcConfig.sw,
                sh: srcConfig.sh
            };

            this.tintedSpriteCache[cacheKey] = tintedConfig;
            return tintedConfig;

        } catch (error) {
             this.game?.debug?.error(`[SpriteManager] Error during tinting process for ${spriteCellId}:`, error);
             // Reset composite operation in case of error
             if(tintCtx) tintCtx.globalCompositeOperation = 'source-over';
             return null; 
        }
    }
}