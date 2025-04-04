/**
 * Handles rendering sprites from the interior furniture spritesheet
 * Used by both VehicleBuildingRenderer and InteriorRenderer
 */
export default class InteriorSpriteRenderer {
    constructor(game) {
        this.game = game;
    }

    /**
     * Renders an interior sprite either directly or via SpriteManager
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} spriteId - ID of the sprite to render from INTERIOR_SPRITES
     * @param {number} x - X position to render at
     * @param {number} y - Y position to render at
     * @param {number} width - Width to render at
     * @param {number} height - Height to render at
     * @param {Object} options - Additional options for rendering
     * @returns {boolean} - Whether rendering was successful
     */
    renderSprite(ctx, spriteId, x, y, width, height, options = {}) {
        // If no sprite ID, return immediately
        if (!spriteId) return false;

        // Try to use the SpriteManager if available
        if (this.game.renderer?.spriteManager) {
            return this.renderViaSpriteManager(ctx, spriteId, x, y, width, height, options);
        }

        // Fallback to direct rendering if SpriteManager not available
        return this.renderDirectly(ctx, spriteId, x, y, width, height, options);
    }

    /**
     * Renders an interior sprite using the SpriteManager
     */
    renderViaSpriteManager(ctx, spriteId, x, y, width, height, options = {}) {
        // Use the game's sprite manager
        return this.game.renderer.spriteManager.drawSprite(
            ctx,
            spriteId,
            x,
            y,
            width,
            height,
            options
        );
    }

    /**
     * Renders an interior sprite directly from the INTERIOR_SPRITES config
     * This is a fallback if SpriteManager is not available
     */
    renderDirectly(ctx, spriteId, x, y, width, height, options = {}) {
        // Get sprite info from config
        const spriteInfo = this.game.config?.INTERIOR_SPRITES?.[spriteId];
        if (!spriteInfo) {
            return false;
        }

        // Get the spritesheet
        const sheetConfig = this.game.config?.SPRITESHEET_CONFIG?.[spriteInfo.sheet];
        if (!sheetConfig) {
            return false;
        }

        // Get the image from resources
        const image = this.game.resources?.get(sheetConfig.id);
        if (!image) {
            return false;
        }

        try {
            ctx.save();
            
            // Apply alpha if specified
            if (options.alpha !== undefined) {
                ctx.globalAlpha = options.alpha;
            }
            
            // Apply rotation if specified
            if (options.rotation) {
                ctx.translate(x, y);
                ctx.rotate(options.rotation);
                x = 0;
                y = 0;
            } else {
                ctx.translate(x, y);
            }
            
            // Apply image smoothing setting
            ctx.imageSmoothingEnabled = options.smoothing !== undefined ? options.smoothing : false;
            
            // Draw the sprite
            ctx.drawImage(
                image,
                spriteInfo.x, spriteInfo.y, 
                spriteInfo.width, spriteInfo.height,
                -width / 2, -height / 2, 
                width, height
            );
            
            ctx.restore();
            return true;
        } catch (error) {
            console.error(`Error rendering interior sprite ${spriteId}:`, error);
            ctx.restore();
            return false;
        }
    }

    /**
     * Gets the sprite ID for a tile or object based on its type
     * @param {string} id - Tile or object type ID
     * @param {string} category - 'tile' or 'object'
     * @returns {string|null} - The sprite ID or null if not found
     */
    getSpriteIdForItem(id, category) {
        if (!id) return null;
        
        let item = null;
        
        // Find the item configuration
        if (category === 'tile') {
            item = this.game.config?.INTERIOR_TILE_TYPES?.find(t => t.id === id);
        } else if (category === 'object') {
            item = this.game.config?.INTERIOR_OBJECT_TYPES?.find(o => o.id === id);
        }
        
        // Return the sprite ID if found
        return item?.spriteId || null;
    }
}