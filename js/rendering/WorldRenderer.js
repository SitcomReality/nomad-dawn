export default class WorldRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
    }
    
    render(world, player, viewWidthWorld, viewHeightWorld) {
        // Draw world background
        this.ctx.fillStyle = '#1a1a1a'; // Slightly lighter dark background
        this.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        
        // Apply ambient lighting from lighting system if enabled
        if (this.renderer.lightingSystem.enabled) {
            // Darken the background based on ambient light level
            const ambientLight = this.renderer.lightingSystem.ambientLight;
            const bgBrightness = Math.max(10, Math.floor(26 * ambientLight));
            this.ctx.fillStyle = `rgb(${bgBrightness}, ${bgBrightness}, ${bgBrightness})`;
            this.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        }
        
        // Get visible chunks based on player position and screen size
        const visibleChunks = world.getVisibleChunks(
            this.renderer.camera.x,
            this.renderer.camera.y,
            viewWidthWorld,
            viewHeightWorld
        );
        
        // Render each visible chunk
        for (const chunk of visibleChunks) {
            this.renderChunk(chunk);
        }
        
        // Render grid lines for debugging
        if (this.game && this.game.debug && this.game.debug.isEnabled()) {
            this.renderGrid(world);
        }
    }
    
    renderChunk(chunk) {
        // Render chunk terrain and features
        const screenPos = this.renderer.worldToScreen(chunk.x, chunk.y);
        const screenSize = chunk.size * this.renderer.camera.zoom;
        
        // Calculate screen boundaries for culling
        const screenLeft = screenPos.x - screenSize / 2;
        const screenTop = screenPos.y - screenSize / 2;
        const screenRight = screenLeft + screenSize;
        const screenBottom = screenTop + screenSize;

        // Only render if chunk is visible on screen (more precise check)
        if (
            screenRight < 0 ||
            screenBottom < 0 ||
            screenLeft > this.renderer.canvas.width ||
            screenTop > this.renderer.canvas.height
        ) {
            return;
        }
        
        // Draw chunk terrain
        let terrainColor = chunk.biome.color;
        
        // Apply time-of-day tinting if lighting system is enabled
        if (this.renderer.lightingSystem.enabled) {
            // Adjust biome color based on light color and ambient light
            const light = this.renderer.lightingSystem;
            terrainColor = this.adjustColorForLighting(
                terrainColor, 
                light.lightColor, 
                light.ambientLight
            );
        }
        
        this.ctx.fillStyle = terrainColor;
        this.ctx.fillRect(screenLeft, screenTop, screenSize, screenSize);
        
        // Draw chunk border for debugging
        if (this.game && this.game.debug && this.game.debug.isEnabled()) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenLeft, screenTop, screenSize, screenSize);
        }
        
        // Render chunk features and resources
        // Combine features and resources for efficient rendering loop
        const objectsToRender = [...(chunk.features || []), ...(chunk.resources || [])];

        // Sort objects by Y position for basic Z-ordering
        objectsToRender.sort((a, b) => a.y - b.y);

        for (const obj of objectsToRender) {
            // Individual object culling check might be useful for very dense chunks
            this.renderWorldObject(obj);
        }
    }
    
    renderWorldObject(obj) {
        if (!obj) return; // Guard against null/undefined objects

        const screenPos = this.renderer.worldToScreen(obj.x, obj.y);
        const screenSize = (obj.size || 10) * this.renderer.camera.zoom; // Default size if undefined

        // More aggressive culling: check based on radius/half-size
        const cullMargin = screenSize; // Use full size as margin for simplicity
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

        // Prepare shadow options for future day/night cycle
        const shadowOptions = {
            enabled: this.renderer.lightingSystem.enabled,
            direction: this.renderer.lightingSystem.shadowDirection,
            length: this.renderer.lightingSystem.shadowLength * screenSize / 30,
            // We'll pass size info for potential scaling
            targetScreenX: screenPos.x,
            targetScreenY: screenPos.y,
            targetScreenSize: screenSize
        };

        // Prepare tint options for day/night cycle
        const tintOptions = {
            enabled: this.renderer.lightingSystem.enabled,
            lightColor: this.renderer.lightingSystem.lightColor,
            ambientLight: this.renderer.lightingSystem.ambientLight
        };

        // Try to draw using sprite if available
        let spriteDrawn = false;
        if (obj.spriteCellId) {
             // Pass shadow and tint options to sprite manager
            spriteDrawn = this.renderer.spriteManager.drawSprite(
                this.ctx,
                obj.spriteCellId,
                screenPos.x,
                screenPos.y,
                screenSize,
                screenSize, // Use same width/height for now, could customize per sprite later
                {
                    shadow: shadowOptions,
                    tint: tintOptions,
                    smoothing: false // Prefer crisp pixel art look
                    // Rotation could be added here if needed: rotation: obj.angle || 0
                }
            );
        }

        // Fallback rendering if sprite not available or failed to draw
        if (!spriteDrawn) {
             // --- Debug Log Start ---
             if (obj.spriteCellId && this.game?.debug?.isEnabled()) {
                 console.log(`[WorldRenderer] Fallback rendering triggered for object:`, {
                     id: obj.id,
                     type: obj.type,
                     spriteCellId: obj.spriteCellId,
                     position: { x: obj.x, y: obj.y },
                 });
             }
             // --- Debug Log End ---

            // Draw shadow first if lighting is enabled (so it's behind the object)
            if (shadowOptions.enabled && shadowOptions.length > 0) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                const shadowX = screenPos.x + shadowOptions.direction.x * shadowOptions.length;
                const shadowY = screenPos.y + shadowOptions.direction.y * shadowOptions.length;
                
                this.ctx.beginPath();
                this.ctx.ellipse(
                    shadowX, 
                    shadowY, 
                    screenSize * 0.4, // Basic oval shadow
                    screenSize * 0.2, 
                    0, 0, Math.PI * 2
                );
                this.ctx.fill();
            }

            // Simple object rendering based on type - MAKE SURE TO USE obj.color or FALLBACK
            let fallbackColor = '#888'; // Grey default
            if (obj.type === 'resource') fallbackColor = '#ff0'; // Yellow default for resources
            if (obj.color) fallbackColor = obj.color; // Use object's defined color if available

            this.ctx.fillStyle = this.renderer.lightingSystem.enabled ? 
                this.adjustColorForLighting(fallbackColor, tintOptions.lightColor, tintOptions.ambientLight) : 
                fallbackColor; 
                
            // Draw shape based on type
            switch (obj.type) {
                case 'resource':
                    this.ctx.beginPath();
                    this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Inner highlight for visual interest
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.beginPath();
                    this.ctx.arc(screenPos.x - screenSize * 0.1, screenPos.y - screenSize * 0.1,
                                screenSize * 0.25, 0, Math.PI * 2);
                    this.ctx.fill();

                    // Add glow effect for rare resources (only if zoomed in enough)
                    if (obj.rare && this.renderer.camera.zoom > 0.4) {
                        this.ctx.shadowColor = obj.color || '#ff0';
                        this.ctx.shadowBlur = screenSize * 0.6;
                        
                        // Draw a pulsing highlight
                        const time = performance.now() * 0.0015;
                        const pulseSize = (Math.sin(time * Math.PI) * 0.05 + 1) * (screenSize / 2);
                        this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * Math.PI) * 0.2})`;
                        this.ctx.lineWidth = 1;
                        this.ctx.beginPath();
                        this.ctx.arc(screenPos.x, screenPos.y, pulseSize, 0, Math.PI * 2);
                        this.ctx.stroke();
                    }
                    break;
                    
                case 'tree':
                case 'rock':
                case 'bush':
                case 'cactus':
                case 'ruin':
                case 'debris':
                case 'boulder':
                case 'pebbles':
                    // Fallback: Draw circle for features
                    this.ctx.beginPath();
                    this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                
                default:
                    // Generic square rendering for unknown types
                    this.ctx.fillRect(
                        screenPos.x - screenSize / 2,
                        screenPos.y - screenSize / 2,
                        screenSize,
                        screenSize
                    );
            }
        }
        
        // Restore context state only after overlays are drawn
        // ctx.restore(); // Moved to end of function

        // Draw object name label if zoomed in enough
        if (obj.name && this.renderer.camera.zoom > 0.6) {
            this.ctx.fillStyle = obj.rare ? 'gold' : 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = `bold ${Math.max(8, 10 * this.renderer.camera.zoom)}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 2;
            this.ctx.fillText(obj.name, screenPos.x, screenPos.y - screenSize / 2 - 5);
            this.ctx.shadowBlur = 0; // Reset shadow for next text/element
        }

         // Restore context state after drawing object AND overlays
         this.ctx.restore(); 
    }
    
    renderGrid(world) {
        // Draw world grid for debugging
        const gridSize = world.chunkSize;
        
        // Calculate world boundaries visible on screen
        const worldLeft = this.renderer.camera.x - (this.renderer.canvas.width / 2 / this.renderer.camera.zoom);
        const worldRight = this.renderer.camera.x + (this.renderer.canvas.width / 2 / this.renderer.camera.zoom);
        const worldTop = this.renderer.camera.y - (this.renderer.canvas.height / 2 / this.renderer.camera.zoom);
        const worldBottom = this.renderer.camera.y + (this.renderer.canvas.height / 2 / this.renderer.camera.zoom);

        // Calculate grid boundaries aligned to grid size
        const startGridX = Math.floor(worldLeft / gridSize) * gridSize;
        const endGridX = Math.ceil(worldRight / gridSize) * gridSize;
        const startGridY = Math.floor(worldTop / gridSize) * gridSize;
        const endGridY = Math.ceil(worldBottom / gridSize) * gridSize;
        
        // Set up grid style
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        // Draw vertical lines
        for (let x = startGridX; x <= endGridX; x += gridSize) {
            const screenX = this.renderer.worldToScreen(x, worldTop).x;
            if (screenX >= 0 && screenX <= this.renderer.canvas.width) {
                this.ctx.moveTo(screenX, 0);
                this.ctx.lineTo(screenX, this.renderer.canvas.height);
            }
        }
        
        // Draw horizontal lines
        for (let y = startGridY; y <= endGridY; y += gridSize) {
            const screenY = this.renderer.worldToScreen(worldLeft, y).y;
            if (screenY >= 0 && screenY <= this.renderer.canvas.height) {
                this.ctx.moveTo(0, screenY);
                this.ctx.lineTo(this.renderer.canvas.width, screenY);
            }
        }
        
        this.ctx.stroke();

        // Draw origin marker if visible
        const screenOrigin = this.renderer.worldToScreen(0, 0);
        if (screenOrigin.x > 0 && screenOrigin.x < this.renderer.canvas.width &&
            screenOrigin.y > 0 && screenOrigin.y < this.renderer.canvas.height)
        {
            this.ctx.save(); // Save before changing styles
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(screenOrigin.x - 10, screenOrigin.y);
            this.ctx.lineTo(screenOrigin.x + 10, screenOrigin.y);
            this.ctx.moveTo(screenOrigin.x, screenOrigin.y - 10);
            this.ctx.lineTo(screenOrigin.x, screenOrigin.y + 10);
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('(0,0)', screenOrigin.x + 15, screenOrigin.y + 5);
            this.ctx.restore(); // Restore styles
        }
    }

    adjustColorForLighting(colorString, lightColor, ambientLight) {
        // Parse color string to RGB
        let r, g, b;
        
        if (!colorString) colorString = '#888'; // Default grey if color is undefined

        if (colorString.startsWith('#')) {
            // Parse hex color
            const hex = colorString.substring(1);
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (colorString.startsWith('rgb')) {
            // Parse rgb or rgba color
            const rgb = colorString.match(/\d+/g);
            if (!rgb || rgb.length < 3) return colorString; // Invalid rgb string
            r = parseInt(rgb[0]);
            g = parseInt(rgb[1]);
            b = parseInt(rgb[2]);
        } else {
            // Default if color can't be parsed
            return colorString;
        }
        
        // Apply ambient light and light color
        r = Math.floor(r * lightColor.r / 255 * ambientLight);
        g = Math.floor(g * lightColor.g / 255 * ambientLight);
        b = Math.floor(b * lightColor.b / 255 * ambientLight);
        
        // Clamp values
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
}