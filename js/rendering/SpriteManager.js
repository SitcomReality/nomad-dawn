export default class SpriteManager {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.spriteCache = {};
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
        if (spriteConfig.sw === 0 || spriteConfig.sh === 0) {
            // Log error only if debug enabled
             if (this.game?.debug?.isEnabled()) {
                 this.game.debug.error(`[SpriteManager] Sprite config for ${spriteCellId} has zero source dimensions (sw/sh).`);
             }
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
        // Tinting logic remains the same
        if (options.tint && options.tint.enabled) {
            const tintColor = options.tint.lightColor;
            // TODO: Implement tinting logic if needed, possibly using getTintedSprite
            // For now, just use the original config
        }

        if (!options.rotation) {
            ctx.translate(x, y);
        }

        ctx.imageSmoothingEnabled = options.smoothing !== undefined ? options.smoothing : false;
        try {
            // REMOVED: console.log for drawImage call
            ctx.drawImage(
                tintedConfig.image,
                tintedConfig.sx, tintedConfig.sy, tintedConfig.sw, tintedConfig.sh,
                -width / 2, -height / 2, width, height
            );
            // REMOVED: console.log for successful draw
        } catch (e) {
            // Keep error logging
            this.game?.debug?.error(`[SpriteManager] Error drawing sprite ${spriteCellId}:`, e);
            ctx.restore();
            return false;
        }

        ctx.restore();
        return true;
    }

    // getTintedSprite logic remains the same
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
            // Log warning only if debug enabled
            if (this.game?.debug?.isEnabled()) {
                this.game.debug.warn(`OffscreenCanvas not supported or failed, using regular canvas for tinting ${spriteCellId}. Performance may be affected.`);
            }
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