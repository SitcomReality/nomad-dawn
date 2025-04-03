import MinimapRenderer from '../ui/MinimapRenderer.js';

export default class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.resizeCanvas();
        this.setupResizeListener();
        
        // Camera properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            targetZoom: 1,
            zoomSpeed: 0.1
        };
        
        // Visual effects container
        this.effects = [];
        
        // Instantiate the MinimapRenderer
        // Ensure the minimap container exists before creating the renderer
        if (document.getElementById('minimap')) {
            this.minimapRenderer = new MinimapRenderer('minimap');
        } else {
            console.warn("Minimap container not found during Renderer initialization.");
            this.minimapRenderer = null;
        }
        
        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();
        
        // Cache for sprite config lookups
        this.spriteConfigCache = {};
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
         // Re-initialize minimap canvas size if it exists
         if (this.minimapRenderer) {
             this.minimapRenderer.initializeCanvas(); // Re-run initialization which includes setting size
         }
    }
    
    setupResizeListener() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Update camera position to follow a target (usually the player)
    updateCamera(targetX, targetY, targetZoom = null) {
        // Smoothly interpolate camera position to target
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;
        
        // Update zoom if provided
        if (targetZoom !== null) {
            // Clamp zoom level
            this.camera.targetZoom = Math.max(0.2, Math.min(3, targetZoom));
        }
        
        // Smoothly interpolate zoom
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSpeed;
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.zoom + this.canvas.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + this.canvas.height / 2;
        return { x: screenX, y: screenY };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        return { x: worldX, y: worldY };
    }
    
    // Render the world
    renderWorld(world, player) {
        if (!world || !player) return;
        
        // Update camera to follow player
        this.updateCamera(player.x, player.y);
        
        // Draw world background
        this.ctx.fillStyle = '#1a1a1a'; // Slightly lighter dark background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Get visible chunks based on player position and screen size
        const viewWidthWorld = this.canvas.width / this.camera.zoom;
        const viewHeightWorld = this.canvas.height / this.camera.zoom;
        
        const visibleChunks = world.getVisibleChunks(
            this.camera.x,
            this.camera.y,
            viewWidthWorld,
            viewHeightWorld
        );
        
        // Render each visible chunk
        for (const chunk of visibleChunks) {
            // Chunk culling already happens before this loop
            this.renderChunk(chunk);
        }
        
        // Render grid lines for debugging
        // Access debug instance via game object now
        if (this.game && this.game.debug && this.game.debug.isEnabled()) {
            this.renderGrid(world);
        }
    }
    
    renderChunk(chunk) {
        // Render chunk terrain and features
        const screenPos = this.worldToScreen(chunk.x, chunk.y);
        const screenSize = chunk.size * this.camera.zoom;
        
        // Calculate screen boundaries for culling
        const screenLeft = screenPos.x - screenSize / 2;
        const screenTop = screenPos.y - screenSize / 2;
        const screenRight = screenLeft + screenSize;
        const screenBottom = screenTop + screenSize;

        // Only render if chunk is visible on screen (more precise check)
        if (
            screenRight < 0 ||
            screenBottom < 0 ||
            screenLeft > this.canvas.width ||
            screenTop > this.canvas.height
        ) {
            return;
        }
        
        // Draw chunk terrain
        this.ctx.fillStyle = chunk.biome.color;
        this.ctx.fillRect(screenLeft, screenTop, screenSize, screenSize);
        
        // Draw chunk border for debugging
        // Access debug instance via game object now
        if (this.game && this.game.debug && this.game.debug.isEnabled()) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenLeft, screenTop, screenSize, screenSize);
        }
        
        // Render chunk features and resources
        // Combine features and resources for efficient rendering loop
        const objectsToRender = [...(chunk.features || []), ...(chunk.resources || [])];
        for (const obj of objectsToRender) {
            // Individual object culling check might be useful for very dense chunks
            this.renderWorldObject(obj);
        }
    }
    
    renderGrid(world) {
        // Draw world grid for debugging
        const gridSize = world.chunkSize;
        
        // Calculate world boundaries visible on screen
        const worldLeft = this.camera.x - (this.canvas.width / 2 / this.camera.zoom);
        const worldRight = this.camera.x + (this.canvas.width / 2 / this.camera.zoom);
        const worldTop = this.camera.y - (this.canvas.height / 2 / this.camera.zoom);
        const worldBottom = this.camera.y + (this.canvas.height / 2 / this.camera.zoom);

        // Calculate grid boundaries aligned to grid size
        const startGridX = Math.floor(worldLeft / gridSize) * gridSize;
        const endGridX = Math.ceil(worldRight / gridSize) * gridSize;
        const startGridY = Math.floor(worldTop / gridSize) * gridSize;
        const endGridY = Math.ceil(worldBottom / gridSize) * gridSize;
        
        // Set up grid style
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // Dimmer grid
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        // Draw vertical lines
        for (let x = startGridX; x <= endGridX; x += gridSize) {
            const screenX = this.worldToScreen(x, worldTop).x; // Use world bounds for y to ensure full height
            if (screenX >= 0 && screenX <= this.canvas.width) { // Cull lines outside screen width
                 this.ctx.moveTo(screenX, 0);
                 this.ctx.lineTo(screenX, this.canvas.height);
            }
        }
        
        // Draw horizontal lines
        for (let y = startGridY; y <= endGridY; y += gridSize) {
            const screenY = this.worldToScreen(worldLeft, y).y; // Use world bounds for x
            if (screenY >= 0 && screenY <= this.canvas.height) { // Cull lines outside screen height
                 this.ctx.moveTo(0, screenY);
                 this.ctx.lineTo(this.canvas.width, screenY);
            }
        }
        
        this.ctx.stroke();

         // Draw origin marker if visible
         const screenOrigin = this.worldToScreen(0, 0);
         if (screenOrigin.x > 0 && screenOrigin.x < this.canvas.width &&
             screenOrigin.y > 0 && screenOrigin.y < this.canvas.height)
         {
             this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Red origin marker
             this.ctx.lineWidth = 2;
             this.ctx.beginPath();
             this.ctx.moveTo(screenOrigin.x - 10, screenOrigin.y);
             this.ctx.lineTo(screenOrigin.x + 10, screenOrigin.y);
             this.ctx.moveTo(screenOrigin.x, screenOrigin.y - 10);
             this.ctx.lineTo(screenOrigin.x, screenOrigin.y + 10);
             this.ctx.stroke();

             // Draw origin label
             this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
             this.ctx.font = '12px monospace';
             this.ctx.textAlign = 'left';
             this.ctx.fillText('(0,0)', screenOrigin.x + 15, screenOrigin.y + 5);
         }
    }
    
    renderWorldObject(obj) {
         if (!obj) return; // Guard against null/undefined objects

        const screenPos = this.worldToScreen(obj.x, obj.y);
        const screenSize = (obj.size || 10) * this.camera.zoom; // Default size if undefined

         // More aggressive culling: check based on radius/half-size
         const cullMargin = screenSize / 2;
        if (
            screenPos.x + cullMargin < 0 ||
            screenPos.y + cullMargin < 0 ||
            screenPos.x - cullMargin > this.canvas.width ||
            screenPos.y - cullMargin > this.canvas.height
        ) {
            return;
        }
        
        this.ctx.save(); // Save context state before drawing object

        // --- Sprite Rendering ---
        let spriteDrawn = false;
        if (obj.spriteCellId) {
            const spriteConfig = this.getSpriteRenderConfig(obj.spriteCellId);
            if (spriteConfig) {
                const drawWidth = screenSize;
                const drawHeight = screenSize;
                const drawX = screenPos.x - drawWidth / 2;
                const drawY = screenPos.y - drawHeight / 2;

                this.ctx.imageSmoothingEnabled = false; // Use nearest-neighbor for pixel art if desired
                this.ctx.drawImage(
                    spriteConfig.image,
                    spriteConfig.sx, spriteConfig.sy, spriteConfig.sw, spriteConfig.sh,
                    drawX, drawY, drawWidth, drawHeight
                );
                spriteDrawn = true;
            }
        }

         // Simple object rendering based on type
         switch (obj.type) {
             case 'tree':
             case 'rock':
             case 'bush':
             case 'cactus':
             case 'ruin':
             case 'debris':
                 if (!spriteDrawn) {
                     // Fallback rendering if sprite failed
                     this.ctx.fillStyle = obj.color || '#f0f'; // Default color if missing
                     this.ctx.beginPath();
                     this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                     this.ctx.fill();
                 }
                 break;
                 
             case 'resource':
                 if (!spriteDrawn) {
                     this.ctx.fillStyle = obj.color || '#ff0';
                     this.ctx.beginPath();
                     this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                     this.ctx.fill();
                 }
                 
                  // Inner highlight for visual interest
                  this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                  this.ctx.beginPath();
                  this.ctx.arc(screenPos.x - screenSize * 0.1, screenPos.y - screenSize * 0.1,
                              screenSize * 0.25, 0, Math.PI * 2);
                  this.ctx.fill();

                // Add a glow effect for rare resources (only if zoomed in enough)
                 if (obj.rare && this.camera.zoom > 0.4) {
                     // Apply glow BEFORE redrawing if sprite was drawn, otherwise draw over fallback
                     this.ctx.shadowColor = obj.color || '#ff0';
                     this.ctx.shadowBlur = screenSize * 0.6; // Slightly larger blur
                     if (spriteDrawn) {
                         // If sprite was drawn, re-draw it with the shadow enabled
                         const spriteConfig = this.getSpriteRenderConfig(obj.spriteCellId);
                         if(spriteConfig) { // Should exist if spriteDrawn is true
                             const drawWidth = screenSize * 0.9; // Slightly smaller to enhance glow
                             const drawHeight = screenSize * 0.9;
                             const drawX = screenPos.x - drawWidth / 2;
                             const drawY = screenPos.y - drawHeight / 2;
                              this.ctx.drawImage(spriteConfig.image, spriteConfig.sx, spriteConfig.sy, spriteConfig.sw, spriteConfig.sh, drawX, drawY, drawWidth, drawHeight);
                         }
                     } else {
                         // If using fallback, draw the circle again
                         this.ctx.fillStyle = obj.color || '#ff0';
                         this.ctx.beginPath();
                         this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2 * 0.9, 0, Math.PI * 2);
                         this.ctx.fill();
                     }

                     // Add pulsing outline effect (subtle)
                     const time = performance.now() * 0.0015; // Slightly faster pulse
                     const pulseSize = (Math.sin(time * Math.PI) * 0.05 + 1) * (screenSize / 2); // More subtle size change
                     this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * Math.PI) * 0.2})`; // Pulsing alpha
                     this.ctx.lineWidth = 1;
                     this.ctx.beginPath();
                     this.ctx.arc(screenPos.x, screenPos.y, pulseSize, 0, Math.PI * 2);
                     this.ctx.stroke();
                 }
                 break;
                
            default:
                if (!spriteDrawn) {
                    // Generic square rendering for unknown types if no sprite
                    this.ctx.fillStyle = obj.color || '#f0f'; // Magenta for unknown
                    this.ctx.fillRect(
                        screenPos.x - screenSize / 2,
                        screenPos.y - screenSize / 2,
                        screenSize,
                        screenSize
                    );
                }
         }
         
         this.ctx.restore(); // Restore context state (removes shadow, etc.)

        // Draw object name label if zoomed in enough
        if (obj.name && this.camera.zoom > 0.6) {
            this.ctx.fillStyle = obj.rare ? 'gold' : 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = `bold ${Math.max(8, 10 * this.camera.zoom)}px monospace`; // Scale font size slightly
            this.ctx.textAlign = 'center';
             this.ctx.shadowColor = 'black';
             this.ctx.shadowBlur = 2;
            this.ctx.fillText(obj.name, screenPos.x, screenPos.y - screenSize / 2 - 5);
             this.ctx.shadowBlur = 0; // Reset shadow for other text
            this.ctx.textAlign = 'left'; // Reset alignment
        }
    }
    
    // Pre-calculate or cache sprite config lookups for performance
    getSpriteRenderConfig(spriteCellId) {
        if (this.spriteConfigCache[spriteCellId]) {
            return this.spriteConfigCache[spriteCellId];
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
        
        this.spriteConfigCache[spriteCellId] = config; // Cache the result
        return config;
    }
    
    renderEntities(entities, player) {
        // Sort entities by y position for basic depth sorting
        const sortedEntities = [...entities].sort((a, b) => a.y - b.y);
        
        // Process and render each entity
        for (const entity of sortedEntities) {
             if (!entity) continue; // Skip if entity is somehow null/undefined

            const screenPos = this.worldToScreen(entity.x, entity.y);
            const screenSize = (entity.size || 20) * this.camera.zoom;
            
            // Culling check
            const cullMargin = screenSize; // Use full size for margin
            if (
                screenPos.x + cullMargin < 0 ||
                screenPos.y + cullMargin < 0 ||
                screenPos.x - cullMargin > this.canvas.width ||
                screenPos.y - cullMargin > this.canvas.height
            ) {
                continue;
            }
            
            this.ctx.save();
            
            // Highlight the local player entity with a subtle glow
            if (player && entity.id === player.id) {
                this.ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
                this.ctx.shadowBlur = 8 * this.camera.zoom;
            } else if (entity.type === 'player') {
                 // Slightly dim remote players
                 this.ctx.globalAlpha = 0.9;
            }
            
            // Apply entity rotation around its center
            this.ctx.translate(screenPos.x, screenPos.y);
            // Only rotate if angle is defined and non-zero
            if (entity.angle !== undefined && entity.angle !== 0) {
                this.ctx.rotate(entity.angle);
            }
            
            // Draw entity shape/sprite
            if (entity.render && typeof entity.render === 'function') {
                // Use entity's custom render method (pass 0,0 for center)
                entity.render(this.ctx, 0, 0, screenSize);
            } else {
                // Default entity rendering (circle)
                this.ctx.fillStyle = entity.color || '#e04f5f'; // Default redish color
                this.ctx.beginPath();
                this.ctx.arc(0, 0, screenSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Default direction indicator (line pointing right before rotation)
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = Math.max(1, 2 * this.camera.zoom); // Scale line width
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(screenSize / 2, 0);
                this.ctx.stroke();
            }
            
            // Restore context before drawing text/health bars (to avoid rotation/alpha issues)
            this.ctx.restore();
            
            // --- Draw overlays (Name, Health Bar) ---
            // These are drawn *after* restoring context to avoid being rotated

             // Draw entity name/label if applicable and zoomed in
            if (entity.name && this.camera.zoom > 0.5) {
                 this.ctx.fillStyle = (player && entity.id === player.id) ? 'white' : 'rgba(220, 220, 220, 0.9)';
                 this.ctx.font = `bold ${Math.max(9, 12 * this.camera.zoom)}px monospace`;
                 this.ctx.textAlign = 'center';
                 this.ctx.shadowColor = 'black';
                 this.ctx.shadowBlur = 3;
                 this.ctx.fillText(entity.name, screenPos.x, screenPos.y - screenSize / 2 - 10);
                 this.ctx.shadowBlur = 0; // Reset shadow
            }

             // Draw health bar if entity has health and is not at full health OR is the player
             const showHealthBar = entity.health !== undefined && entity.maxHealth !== undefined && entity.maxHealth > 0 &&
                                (entity.health < entity.maxHealth || (player && entity.id === player.id));

             if (showHealthBar && this.camera.zoom > 0.3) {
                 const healthPercent = Math.max(0, entity.health / entity.maxHealth);
                 const barWidth = Math.max(20, screenSize * 0.7) * this.camera.zoom;
                 const barHeight = Math.max(3, 5 * this.camera.zoom);
                 const barYOffset = screenSize / 2 + 5 * this.camera.zoom; // Offset below entity
                 const barX = screenPos.x - barWidth / 2;
                 const barY = screenPos.y + barYOffset;

                 // Health bar background
                 this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                 this.ctx.fillRect(barX, barY, barWidth, barHeight);

                 // Health bar fill color based on percentage
                 const healthColor = healthPercent > 0.6 ? '#4caf50' : (healthPercent > 0.3 ? '#ffc107' : '#f44336');
                 this.ctx.fillStyle = healthColor;
                 this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

                 // Optional: Add border to health bar
                 this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                 this.ctx.lineWidth = 1;
                 this.ctx.strokeRect(barX, barY, barWidth, barHeight);
             }

             this.ctx.textAlign = 'left'; // Reset alignment
        }
    }
    
    renderUI(game) {
        // --- HUD elements are now handled by HUD.js and UIManager ---
        // // Draw player resource information (REMOVED - Handled by HUD.js)
        // if (game.player) {
        //     const resources = game.player.resources;
        //     const resourceElement = document.getElementById('resources');
        //
        //     if (resourceElement) {
        //         resourceElement.innerHTML = ` ... `; // Removed DOM manipulation
        //     }
        // }

        // Render minimap using the dedicated renderer (Keep this)
        if (this.minimapRenderer && game.world && game.player) {
            this.minimapRenderer.render(
                game.world,
                game.player,
                game.entities.getAll(), // Pass all entities for minimap icons
                this.camera,
                this.canvas.width,
                this.canvas.height
            );
        }
    }
    
    createEffect(type, x, y, options = {}) { 
        // Create a new visual effect (needs world coordinates)
        
        // Initial screen position calculated here for immediate placement,
        // but the effect update loop should ideally recalculate based on camera movement
        // OR effects can be stored with world coordinates. Let's store world coords.
        let effect;
        const startTime = performance.now();

        switch (type) {
            case 'explosion':
                const explosionWorldSize = options.size || 30; // Size in world units
                effect = {
                    type,
                    worldX: x, worldY: y, // Store world coords
                    worldSize: explosionWorldSize,
                    duration: options.duration || 400, // Shorter explosion
                    startTime: startTime,
                    update: (ctx, currentTime, delta) => {
                        const elapsed = currentTime - effect.startTime;
                        const progress = elapsed / effect.duration;
                        if (progress >= 1) return false; // Remove effect

                        const screenPos = this.worldToScreen(effect.worldX, effect.worldY);
                        const currentScreenRadius = effect.worldSize * this.camera.zoom * progress;
                        const alpha = 1 - progress * progress; // Fade out faster

                        ctx.save();
                        ctx.globalAlpha = alpha;
                        
                        // Draw expanding circle
                        const colorVal = Math.floor(220 * (1 - progress));
                        ctx.fillStyle = `rgba(255, ${colorVal}, 0, ${alpha * 0.8})`;
                        ctx.beginPath();
                        ctx.arc(screenPos.x, screenPos.y, currentScreenRadius, 0, Math.PI * 2);
                        ctx.fill();
                        
                         // Optional: Inner brighter core
                         ctx.fillStyle = `rgba(255, 255, 150, ${alpha})`;
                         ctx.beginPath();
                         ctx.arc(screenPos.x, screenPos.y, currentScreenRadius * 0.5, 0, Math.PI * 2);
                         ctx.fill();

                        ctx.restore();
                        return true; // Keep effect alive
                    }
                };
                break;

             case 'collect':
                 const collectWorldSize = options.size || 8; // World units
                 const collectColor = options.color || '#ffff00';
                 effect = {
                     type,
                     worldX: x, worldY: y, // Store world coords
                     worldSize: collectWorldSize,
                     color: collectColor,
                     particleCount: 5 + Math.floor(Math.random() * 3), // Randomized count
                     particles: [],
                     duration: options.duration || 400, // Slightly longer
                     startTime: startTime,
                     init: () => {
                          // Initialize particles relative to the effect's world origin
                         for (let i = 0; i < effect.particleCount; i++) {
                             const angle = Math.random() * Math.PI * 2;
                              // Speed in world units per second
                             const speed = effect.worldSize * (1.5 + Math.random() * 1.0);
                             effect.particles.push({
                                 ox: 0, oy: 0, // Offset from worldX/worldY
                                 vx: Math.cos(angle) * speed,
                                 vy: Math.sin(angle) * speed,
                                 alpha: 1.0,
                                 size: (1 + Math.random()) // Particle size variation
                             });
                         }
                     },
                     update: (ctx, currentTime, delta) => {
                         const elapsed = currentTime - effect.startTime;
                         const progress = elapsed / effect.duration;
                         if (progress >= 1) return false;

                         if (!effect.particles.length) effect.init();

                         ctx.save();
                         ctx.fillStyle = effect.color;

                         const deltaSeconds = delta / 1000;

                         for (const p of effect.particles) {
                              // Update particle world offset
                             p.ox += p.vx * deltaSeconds;
                             p.oy += p.vy * deltaSeconds;
                             p.alpha = 1.0 - progress; // Fade out linearly

                             if (p.alpha <= 0) continue;

                             // Calculate current screen position of the particle
                             const screenPos = this.worldToScreen(effect.worldX + p.ox, effect.worldY + p.oy);
                             const particleScreenSize = Math.max(1, p.size * this.camera.zoom);

                             ctx.globalAlpha = p.alpha;
                             // Simple square particles
                             ctx.fillRect(
                                 screenPos.x - particleScreenSize / 2,
                                 screenPos.y - particleScreenSize / 2,
                                 particleScreenSize, particleScreenSize
                             );
                         }

                         ctx.restore();
                         return true;
                     }
                 };
                 break;

             // Add 'damage_taken' effect for player feedback
             case 'damage_taken':
                 effect = {
                     type,
                     worldX: x, worldY: y,
                     duration: 200, // Quick flash
                     startTime: startTime,
                     update: (ctx, currentTime, delta) => {
                         const elapsed = currentTime - effect.startTime;
                         const progress = elapsed / effect.duration;
                         if (progress >= 1) return false;

                         const screenPos = this.worldToScreen(effect.worldX, effect.worldY);
                         const alpha = Math.sin(progress * Math.PI); // Fade in and out

                         ctx.save();
                         ctx.globalAlpha = alpha * 0.6; // Semi-transparent red overlay
                         ctx.fillStyle = '#ff0000';
                         // Fill screen briefly? Or just around player? Let's try screen flash
                         ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                         ctx.restore();
                         return true;
                     }
                 };
                 break;
                
            default:
                console.warn(`Unknown effect type: ${type}`);
                return; // Unknown effect type
        }
        
        // Add effect to the list
        this.effects.push(effect);
    }
    
    renderEffects() {
        const currentTime = performance.now();
        const delta = currentTime - this.lastFrameTime; 
        // this.lastFrameTime = currentTime; // lastFrameTime is updated in the main render call now

         if (delta <= 0) return; // Avoid issues if delta is zero or negative

        // Use filter to create a new array of active effects
        this.effects = this.effects.filter(effect => {
             // Ensure update method exists before calling
            if (effect && typeof effect.update === 'function') {
                return effect.update(this.ctx, currentTime, delta);
            }
            return false; // Remove invalid effects
        });
    }
    
    renderDebugInfo(debugData) {
        // Debug overlay is now managed by UIManager and DebugUtils itself
        // This method can be removed or kept empty
         const debugOverlay = document.getElementById('debug-overlay');
         if (!debugOverlay || !window.debug || !window.debug.isEnabled()) {
             if (debugOverlay && !debugOverlay.classList.contains('hidden')) {
                 debugOverlay.classList.add('hidden'); // Ensure it's hidden if debug is disabled
             }
             return;
         }

         debugOverlay.classList.remove('hidden'); // Ensure it's visible if debug is enabled

         // Update debug information (Example - content is set by Game.js updatePerformanceMetrics)
         let debugHTML = ''; // Start fresh
         for (const [key, value] of Object.entries(debugData)) {
             // Format specific values if needed
             let displayValue = value;
             if (typeof value === 'number' && !Number.isInteger(value)) {
                 displayValue = value.toFixed(2);
             }
             debugHTML += `<div><strong>${key}:</strong> ${displayValue}</div>`;
         }

         // Add log history preview if desired
         // const logHistory = window.debug.getLogHistory ? window.debug.getLogHistory().slice(0, 5) : [];
         // if (logHistory.length > 0) {
         //     debugHTML += '<hr><strong>Logs:</strong>';
         //     logHistory.forEach(log => {
         //         debugHTML += `<div style="font-size: 10px; color: ${log.type === 'error' ? 'red' : (log.type === 'warn' ? 'orange' : 'lightgray')}">${log.timestamp} ${log.message}</div>`;
         //     });
         // }


         debugOverlay.innerHTML = debugHTML;
    }
}