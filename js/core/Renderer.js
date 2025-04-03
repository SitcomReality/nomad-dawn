import MinimapRenderer from '../ui/MinimapRenderer.js';

export default class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
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
        this.minimapRenderer = new MinimapRenderer('minimap');
        
        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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
            this.camera.targetZoom = Math.max(0.5, Math.min(2, targetZoom));
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
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Get visible chunks based on player position and screen size
        const visibleChunks = world.getVisibleChunks(
            this.camera.x,
            this.camera.y,
            this.canvas.width / this.camera.zoom,
            this.canvas.height / this.camera.zoom
        );
        
        // Render each visible chunk
        for (const chunk of visibleChunks) {
            this.renderChunk(chunk);
        }
        
        // Render grid lines for debugging
        if (world.debug && world.debug.isEnabled && world.debug.isEnabled()) {
            this.renderGrid(world);
        }
    }
    
    renderChunk(chunk) {
        // Render chunk terrain and features
        const screenPos = this.worldToScreen(chunk.x, chunk.y);
        const screenSize = chunk.size * this.camera.zoom;
        
        // Only render if chunk is visible on screen
        if (
            screenPos.x + screenSize < 0 ||
            screenPos.y + screenSize < 0 ||
            screenPos.x - screenSize > this.canvas.width ||
            screenPos.y - screenSize > this.canvas.height
        ) {
            return;
        }
        
        // Draw chunk terrain (simple placeholder for now)
        this.ctx.fillStyle = chunk.biome.color;
        this.ctx.fillRect(
            screenPos.x - screenSize / 2,
            screenPos.y - screenSize / 2,
            screenSize,
            screenSize
        );
        
        // Draw chunk border for debugging
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.strokeRect(
            screenPos.x - screenSize / 2,
            screenPos.y - screenSize / 2,
            screenSize,
            screenSize
        );
        
        // Render chunk features (trees, rocks, etc.)
        // Combine features and resources for rendering
        const objectsToRender = [...chunk.features, ...chunk.resources];
        for (const feature of objectsToRender) {
            this.renderWorldObject(feature);
        }
    }
    
    renderGrid(world) {
        // Draw world grid for debugging
        const gridSize = world.chunkSize;
        const screenOrigin = this.worldToScreen(0, 0);
        
        // Calculate grid boundaries
        const leftBound = Math.floor((this.camera.x - this.canvas.width / 2 / this.camera.zoom) / gridSize) * gridSize;
        const rightBound = Math.ceil((this.camera.x + this.canvas.width / 2 / this.camera.zoom) / gridSize) * gridSize;
        const topBound = Math.floor((this.camera.y - this.canvas.height / 2 / this.camera.zoom) / gridSize) * gridSize;
        const bottomBound = Math.ceil((this.camera.y + this.canvas.height / 2 / this.camera.zoom) / gridSize) * gridSize;
        
        // Set up grid style
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        // Draw vertical lines
        for (let x = leftBound; x <= rightBound; x += gridSize) {
            const screenX = this.worldToScreen(x, 0).x;
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
        }
        
        // Draw horizontal lines
        for (let y = topBound; y <= bottomBound; y += gridSize) {
            const screenY = this.worldToScreen(0, y).y;
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
        }
        
        // Draw origin marker
        this.ctx.moveTo(screenOrigin.x - 10, screenOrigin.y);
        this.ctx.lineTo(screenOrigin.x + 10, screenOrigin.y);
        this.ctx.moveTo(screenOrigin.x, screenOrigin.y - 10);
        this.ctx.lineTo(screenOrigin.x, screenOrigin.y + 10);
        
        this.ctx.stroke();
        
        // Draw origin label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px monospace';
        this.ctx.fillText('(0,0)', screenOrigin.x + 15, screenOrigin.y + 15);
    }
    
    renderWorldObject(obj) {
        const screenPos = this.worldToScreen(obj.x, obj.y);
        const screenSize = obj.size * this.camera.zoom;
        
        // Skip if not visible
        if (
            screenPos.x + screenSize < 0 ||
            screenPos.y + screenSize < 0 ||
            screenPos.x - screenSize > this.canvas.width ||
            screenPos.y - screenSize > this.canvas.height
        ) {
            return;
        }
        
        // Simple object rendering based on type
        switch (obj.type) {
            case 'tree':
                this.ctx.fillStyle = '#2d4';
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            case 'rock':
                this.ctx.fillStyle = '#999';
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            case 'resource':
                this.ctx.fillStyle = obj.color || '#ff0';
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            default:
                // Generic object rendering
                this.ctx.fillStyle = obj.color || '#f0f';
                this.ctx.fillRect(
                    screenPos.x - screenSize / 2,
                    screenPos.y - screenSize / 2,
                    screenSize,
                    screenSize
                );
        }
        
        // Draw object name if applicable
        if (obj.name && this.camera.zoom > 0.5) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(obj.name, screenPos.x, screenPos.y - screenSize / 2 - 5);
            this.ctx.textAlign = 'left';
        }
    }
    
    renderEntities(entities, player) {
        // Sort entities by y position for proper layering
        const sortedEntities = [...entities].sort((a, b) => a.y - b.y);
        
        // Process and render each entity
        for (const entity of sortedEntities) {
            // Skip offscreen entities
            const screenPos = this.worldToScreen(entity.x, entity.y);
            const screenSize = (entity.size || 20) * this.camera.zoom;
            
            if (
                screenPos.x + screenSize < 0 ||
                screenPos.y + screenSize < 0 ||
                screenPos.x - screenSize > this.canvas.width ||
                screenPos.y - screenSize > this.canvas.height
            ) {
                continue;
            }
            
            // Render the entity
            this.ctx.save();
            
            // Highlight the player entity
            if (player && entity.id === player.id) {
                this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
                this.ctx.shadowBlur = 10;
            }
            
            // Apply entity rotation
            this.ctx.translate(screenPos.x, screenPos.y);
            if (entity.angle) {
                this.ctx.rotate(entity.angle);
            }
            
            // Draw entity
            if (entity.render && typeof entity.render === 'function') {
                // Use entity's custom render method if available
                entity.render(this.ctx, 0, 0, screenSize);
            } else {
                // Default entity rendering
                this.ctx.fillStyle = entity.color || '#f00';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, screenSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw direction indicator
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 1 / this.camera.zoom;
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(screenSize / 2, 0);
                this.ctx.stroke();
            }
            
            this.ctx.restore();
            
            // Draw entity name/label if applicable
            if (entity.name) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '14px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(entity.name, screenPos.x, screenPos.y - screenSize / 2 - 10);
                
                // Draw health bar if entity has health
                if (entity.health !== undefined && entity.maxHealth !== undefined && entity.maxHealth > 0) {
                    const healthPercent = entity.health / entity.maxHealth;
                    const barWidth = Math.max(20, screenSize * 0.8);
                    const barHeight = 5;
                    const barYOffset = screenSize / 2 + 5;
                    
                    // Health bar background
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.fillRect(
                        screenPos.x - barWidth / 2,
                        screenPos.y + barYOffset,
                        barWidth,
                        barHeight
                    );
                    
                    // Health bar fill
                    this.ctx.fillStyle = healthPercent > 0.5 ? '#4caf50' : (healthPercent > 0.25 ? '#ff9800' : '#f44336');
                    this.ctx.fillRect(
                        screenPos.x - barWidth / 2,
                        screenPos.y + barYOffset,
                        barWidth * Math.max(0, healthPercent),
                        barHeight
                    );
                }
                
                this.ctx.textAlign = 'left';
            }
        }
    }
    
    renderUI(game) {
        // Draw player resource information
        if (game.player) {
            const resources = game.player.resources;
            const resourceElement = document.getElementById('resources');
            
            if (resourceElement) {
                resourceElement.innerHTML = `
                    <div>Health: ${game.player.health}/${game.player.maxHealth}</div>
                    <div>Position: (${Math.floor(game.player.x)}, ${Math.floor(game.player.y)})</div>
                    <div>Resources: ${Object.entries(resources).map(([key, value]) => 
                        `${key}: ${value}`
                    ).join(', ')}</div>
                `;
            }
            
            // Render minimap using the dedicated renderer
            if (this.minimapRenderer && game.world) {
                this.minimapRenderer.render(
                    game.world, 
                    game.player, 
                    game.entities.getAll(), 
                    this.camera, 
                    this.canvas.width, 
                    this.canvas.height
                );
            }
        }
    }
    
    createEffect(type, x, y, size = 1) {
        // Create a new visual effect
        const screenPos = this.worldToScreen(x, y);
        
        let effect;
        switch (type) {
            case 'explosion':
                effect = {
                    type,
                    x: screenPos.x,
                    y: screenPos.y,
                    size: size * this.camera.zoom,
                    duration: 500, // milliseconds
                    startTime: performance.now(),
                    update: (ctx, currentTime, delta) => {
                        const progress = (currentTime - effect.startTime) / effect.duration;
                        if (progress >= 1) return false; // Remove effect when done
                        
                        const radius = effect.size * progress;
                        const alpha = 1 - progress;
                        
                        ctx.save();
                        ctx.globalAlpha = alpha;
                        
                        // Draw explosion circle
                        ctx.fillStyle = `rgba(255, ${Math.floor(200 * (1 - progress))}, 0, ${alpha})`;
                        ctx.beginPath();
                        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Draw shock wave
                        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(effect.x, effect.y, radius * 1.2, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        ctx.restore();
                        return true; // Keep effect alive
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
        const delta = currentTime - this.lastFrameTime; // Use pre-calculated delta if available, or calculate here
        this.lastFrameTime = currentTime; // Update last frame time for next effect calculation
        
        // Update and render all active effects
        this.effects = this.effects.filter(effect => {
            // Pass context for drawing
            return effect.update(this.ctx, currentTime, delta);
        });
    }
    
    renderDebugInfo(debugData) {
        const debugOverlay = document.getElementById('debug-overlay');
        if (!debugOverlay) return;
        
        // Show debug overlay if enabled
        const isEnabled = (window.debug && window.debug.isEnabled && window.debug.isEnabled());
        debugOverlay.classList.toggle('hidden', !isEnabled);
        if (!isEnabled) return;
        
        // Update debug information
        let debugHTML = '<h3>Debug Info</h3>';
        for (const [key, value] of Object.entries(debugData)) {
            debugHTML += `<div><strong>${key}:</strong> ${value}</div>`;
        }
        
        debugOverlay.innerHTML = debugHTML;
    }
}