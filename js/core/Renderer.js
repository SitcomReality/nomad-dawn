import MinimapRenderer from '../ui/MinimapRenderer.js';

export default class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game; 
        this.resizeCanvas();
        this.setupResizeListener();
        
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            targetZoom: 1,
            zoomSpeed: 0.1
        };
        
        this.effects = [];
        
        if (document.getElementById('minimap')) {
            this.minimapRenderer = new MinimapRenderer('minimap');
        } else {
            console.warn("Minimap container not found during Renderer initialization.");
            this.minimapRenderer = null;
        }
        
        this.lastFrameTime = performance.now();
        
        this.spriteConfigCache = {};
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.minimapRenderer) {
            this.minimapRenderer.initializeCanvas(); 
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
    
    updateCamera(targetX, targetY, targetZoom = null) {
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;
        
        if (targetZoom !== null) {
            this.camera.targetZoom = Math.max(0.2, Math.min(3, targetZoom));
        }
        
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSpeed;
    }
    
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.zoom + this.canvas.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + this.canvas.height / 2;
        return { x: screenX, y: screenY };
    }
    
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        return { x: worldX, y: worldY };
    }
    
    renderWorld(world, player) {
        if (!world || !player) return;
        
        this.updateCamera(player.x, player.y);
        
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const viewWidthWorld = this.canvas.width / this.camera.zoom;
        const viewHeightWorld = this.canvas.height / this.camera.zoom;
        
        const visibleChunks = world.getVisibleChunks(
            this.camera.x,
            this.camera.y,
            viewWidthWorld,
            viewHeightWorld
        );
        
        for (const chunk of visibleChunks) {
            this.renderChunkBackground(chunk);
        }

        const allVisibleObjects = [];
        for (const chunk of visibleChunks) {
            const objects = [...(chunk.features || []), ...(chunk.resources || [])];
            allVisibleObjects.push(...objects);
        }

        allVisibleObjects.sort((a, b) => a.y - b.y);

        for (const obj of allVisibleObjects) {
            this.renderWorldObject(obj);
        }

        if (this.game && this.game.debug && this.game.debug.isEnabled()) {
            this.renderGrid(world); 
        }
    }

    renderChunkBackground(chunk) {
        const screenPos = this.worldToScreen(chunk.x, chunk.y);
        const screenSize = chunk.size * this.camera.zoom;
        
        const screenLeft = screenPos.x - screenSize / 2;
        const screenTop = screenPos.y - screenSize / 2;
        const screenRight = screenLeft + screenSize;
        const screenBottom = screenTop + screenSize;

        if (
            screenRight < 0 ||
            screenBottom < 0 ||
            screenLeft > this.canvas.width ||
            screenTop > this.canvas.height
        ) {
            return;
        }
        
        this.ctx.fillStyle = chunk.biome.color;
        this.ctx.fillRect(screenLeft, screenTop, screenSize, screenSize);
        
        if (this.game && this.game.debug && this.game.debug.isEnabled()) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenLeft, screenTop, screenSize, screenSize);
        }
    }

    renderWorldObject(obj) {
        if (!obj) return;

        const screenPos = this.worldToScreen(obj.x, obj.y);
        const screenSize = (obj.size || 10) * this.camera.zoom; 

        const cullMargin = screenSize; 
        if (
            screenPos.x + cullMargin < 0 ||
            screenPos.y + cullMargin < 0 ||
            screenPos.x - cullMargin > this.canvas.width ||
            screenPos.y - cullMargin > this.canvas.height
        ) {
            return;
        }
        
        this.ctx.save(); 

        let spriteDrawn = false;
        let spriteConfig = null; 

        if (obj.spriteCellId) {
            spriteConfig = this.getSpriteRenderConfig(obj.spriteCellId);
            if (spriteConfig) {
                const drawWidth = screenSize; 
                const drawHeight = screenSize;
                const drawX = screenPos.x - drawWidth / 2;
                const drawY = screenPos.y - drawHeight / 2;

                this.ctx.drawImage(
                    spriteConfig.image,
                    spriteConfig.sx, spriteConfig.sy, spriteConfig.sw, spriteConfig.sh,
                    drawX, drawY, drawWidth, drawHeight
                );
                spriteDrawn = true;
            } 
        }
        
        if (!spriteDrawn) {
            this.ctx.fillStyle = obj.color || '#f0f'; 
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x - 5, screenPos.y - 5);
            this.ctx.lineTo(screenPos.x + 5, screenPos.y + 5);
            this.ctx.moveTo(screenPos.x + 5, screenPos.y - 5);
            this.ctx.lineTo(screenPos.x - 5, screenPos.y + 5);
            this.ctx.stroke();
        }

        if (obj.type === 'resource' && obj.rare && this.camera.zoom > 0.4) {
            this.ctx.shadowColor = obj.color || '#ff0';
            this.ctx.shadowBlur = screenSize * 0.6; 

            if (spriteDrawn && spriteConfig) {
                const drawWidth = screenSize * 0.9; 
                const drawHeight = screenSize * 0.9;
                const drawX = screenPos.x - drawWidth / 2;
                const drawY = screenPos.y - drawHeight / 2;
                this.ctx.drawImage(
                    spriteConfig.image,
                    spriteConfig.sx, spriteConfig.sy, spriteConfig.sw, spriteConfig.sh,
                    drawX, drawY, drawWidth, drawHeight
                );
            } else if (!spriteDrawn) {
                this.ctx.fillStyle = obj.color || '#ff0';
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, screenSize / 2 * 0.9, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            const time = performance.now() * 0.0015; 
            const pulseSize = (Math.sin(time * Math.PI) * 0.05 + 1) * (screenSize / 2); 
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * Math.PI) * 0.2})`; 
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, pulseSize, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore(); 

        if (obj.name && this.camera.zoom > 0.6) {
            this.ctx.fillStyle = obj.rare ? 'gold' : 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = `bold ${Math.max(8, 10 * this.camera.zoom)}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 2;
            this.ctx.fillText(obj.name, screenPos.x, screenPos.y - screenSize / 2 - 5);
            this.ctx.shadowBlur = 0; 
            this.ctx.textAlign = 'left'; 
        }
    }
    
    getSpriteRenderConfig(spriteCellId) {
        if (this.spriteConfigCache[spriteCellId]) {
            return this.spriteConfigCache[spriteCellId];
        }
    
        if (!this.game || !this.game.config || !this.game.config.SPRITE_CELLS || !this.game.config.SPRITESHEET_CONFIG || !this.game.resources) {
            return null;
        }
    
        const cellInfo = this.game.config.SPRITE_CELLS[spriteCellId];
        if (!cellInfo) {
            return null;
        }
    
        const sheetConfig = this.game.config.SPRITESHEET_CONFIG[cellInfo.sheet];
        if (!sheetConfig) {
            return null;
        }
    
        const image = this.game.resources.get(sheetConfig.id); 
        if (!image) {
            return null; 
        }

        if (!sheetConfig.spriteWidth || !sheetConfig.spriteHeight || sheetConfig.spriteWidth <= 0 || sheetConfig.spriteHeight <= 0) {
            console.error(`Invalid sprite dimensions in spritesheet config for: ${cellInfo.sheet}`);
            return null;
        }

        const config = {
            image: image,
            sx: cellInfo.col * sheetConfig.spriteWidth,
            sy: cellInfo.row * sheetConfig.spriteHeight,
            sw: sheetConfig.spriteWidth,
            sh: sheetConfig.spriteHeight,
        };
        
        this.spriteConfigCache[spriteCellId] = config; 
        return config;
    }
    
    renderEntities(entities, player) {
        const sortedEntities = [...entities].sort((a, b) => a.y - b.y);
        
        for (const entity of sortedEntities) {
            if (!entity) continue; 

            const screenPos = this.worldToScreen(entity.x, entity.y);
            const screenSize = (entity.size || 20) * this.camera.zoom;
            
            const cullMargin = screenSize; 
            if (
                screenPos.x + cullMargin < 0 ||
                screenPos.y + cullMargin < 0 ||
                screenPos.x - cullMargin > this.canvas.width ||
                screenPos.y - cullMargin > this.canvas.height
            ) {
                continue;
            }
            
            this.ctx.save();
            
            if (player && entity.id === player.id) {
                this.ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
                this.ctx.shadowBlur = 8 * this.camera.zoom;
            } else if (entity.type === 'player') {
                this.ctx.globalAlpha = 0.9;
            }
            
            this.ctx.translate(screenPos.x, screenPos.y);
            if (entity.angle !== undefined && entity.angle !== 0) {
                this.ctx.rotate(entity.angle);
            }
            
            if (entity.render && typeof entity.render === 'function') {
                entity.render(this.ctx, 0, 0, screenSize);
            } else {
                this.ctx.fillStyle = entity.color || '#e04f5f'; 
                this.ctx.beginPath();
                this.ctx.arc(0, 0, screenSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = Math.max(1, 2 * this.camera.zoom); 
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(screenSize / 2, 0);
                this.ctx.stroke();
            }
            
            this.ctx.restore();
            
            if (entity.name && this.camera.zoom > 0.5) {
                this.ctx.fillStyle = (player && entity.id === player.id) ? 'white' : 'rgba(220, 220, 220, 0.9)';
                this.ctx.font = `bold ${Math.max(9, 12 * this.camera.zoom)}px monospace`;
                this.ctx.textAlign = 'center';
                this.ctx.shadowColor = 'black';
                this.ctx.shadowBlur = 3;
                this.ctx.fillText(entity.name, screenPos.x, screenPos.y - screenSize / 2 - 10);
                this.ctx.shadowBlur = 0; 
            }

            const showHealthBar = entity.health !== undefined && entity.maxHealth !== undefined && entity.maxHealth > 0 &&
                                (entity.health < entity.maxHealth || (player && entity.id === player.id));

            if (showHealthBar && this.camera.zoom > 0.3) {
                const healthPercent = Math.max(0, entity.health / entity.maxHealth);
                const barWidth = Math.max(20, screenSize * 0.7); 
                const barHeight = Math.max(3, 5 * this.camera.zoom);
                const barYOffset = screenSize / 2 + Math.max(4, 5 * this.camera.zoom); 
                const barX = screenPos.x - barWidth / 2;
                const barY = screenPos.y + barYOffset;

                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                this.ctx.fillRect(barX, barY, barWidth, barHeight);

                const healthColor = healthPercent > 0.6 ? '#4caf50' : (healthPercent > 0.3 ? '#ffc107' : '#f44336');
                this.ctx.fillStyle = healthColor;
                this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(barX, barY, barWidth, barHeight);
            }

            this.ctx.textAlign = 'left'; 
        }
    }

    renderUI(game) {
        if (this.minimapRenderer && game.world && game.player) {
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
    
    createEffect(type, x, y, options = {}) { 
        let effect;
        const startTime = performance.now();

        switch (type) {
            case 'explosion':
                const explosionWorldSize = options.size || 30; 
                effect = {
                    type, worldX: x, worldY: y, worldSize: explosionWorldSize,
                    duration: options.duration || 400, startTime: startTime,
                    update: (ctx, currentTime, delta) => {
                        const elapsed = currentTime - effect.startTime; const progress = elapsed / effect.duration;
                        if (progress >= 1) return false; 
                        const screenPos = this.worldToScreen(effect.worldX, effect.worldY);
                        const currentScreenRadius = effect.worldSize * this.camera.zoom * progress;
                        const alpha = 1 - progress * progress; 
                        ctx.save(); ctx.globalAlpha = alpha;
                        const colorVal = Math.floor(220 * (1 - progress));
                        ctx.fillStyle = `rgba(255, ${colorVal}, 0, ${alpha * 0.8})`;
                        ctx.beginPath(); ctx.arc(screenPos.x, screenPos.y, currentScreenRadius, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = `rgba(255, 255, 150, ${alpha})`;
                        ctx.beginPath(); ctx.arc(screenPos.x, screenPos.y, currentScreenRadius * 0.5, 0, Math.PI * 2); ctx.fill();
                        ctx.restore(); return true;
                    }
                };
                break;
            case 'collect':
                const collectWorldSize = options.size || 8; const collectColor = options.color || '#ffff00';
                effect = {
                    type, worldX: x, worldY: y, worldSize: collectWorldSize, color: collectColor,
                    particleCount: 5 + Math.floor(Math.random() * 3), particles: [],
                    duration: options.duration || 400, startTime: startTime,
                    init: () => {
                        for (let i = 0; i < effect.particleCount; i++) {
                            const angle = Math.random() * Math.PI * 2; const speed = effect.worldSize * (1.5 + Math.random() * 1.0);
                            effect.particles.push({ ox: 0, oy: 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1.0, size: (1 + Math.random()) });
                        }
                    },
                    update: (ctx, currentTime, delta) => {
                        const elapsed = currentTime - effect.startTime; const progress = elapsed / effect.duration;
                        if (progress >= 1) return false;
                        if (!effect.particles.length) effect.init();
                        ctx.save(); ctx.fillStyle = effect.color;
                        const deltaSeconds = delta / 1000;
                        for (const p of effect.particles) {
                            p.ox += p.vx * deltaSeconds; p.oy += p.vy * deltaSeconds; p.alpha = 1.0 - progress; 
                            if (p.alpha <= 0) continue;
                            const screenPos = this.worldToScreen(effect.worldX + p.ox, effect.worldY + p.oy);
                            const particleScreenSize = Math.max(1, p.size * this.camera.zoom);
                            ctx.globalAlpha = p.alpha;
                            ctx.fillRect( screenPos.x - particleScreenSize / 2, screenPos.y - particleScreenSize / 2, particleScreenSize, particleScreenSize );
                        }
                        ctx.restore(); return true;
                    }
                };
                break;
            case 'damage_taken':
                effect = {
                    type, worldX: x, worldY: y, duration: 200, startTime: startTime,
                    update: (ctx, currentTime, delta) => {
                        const elapsed = currentTime - effect.startTime; const progress = elapsed / effect.duration;
                        if (progress >= 1) return false;
                        const alpha = Math.sin(progress * Math.PI); 
                        ctx.save(); ctx.globalAlpha = alpha * 0.6; ctx.fillStyle = '#ff0000';
                        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                        ctx.restore(); return true;
                    }
                };
                break;
            default: console.warn(`Unknown effect type: ${type}`); return; 
        }
        this.effects.push(effect);
    }
    
    renderEffects() {
        const currentTime = performance.now();
        const delta = currentTime - this.lastFrameTime; 
        if (delta <= 0) return; 
        this.effects = this.effects.filter(effect => {
            if (effect && typeof effect.update === 'function') {
                return effect.update(this.ctx, currentTime, delta);
            }
            return false;
        });
    }
    
    renderDebugInfo(debugData) {
        const debugOverlay = document.getElementById('debug-overlay');
        if (!debugOverlay || !window.debug || !window.debug.isEnabled()) {
            if (debugOverlay && !debugOverlay.classList.contains('hidden')) {
                debugOverlay.classList.add('hidden'); 
            }
            return;
        }
        debugOverlay.classList.remove('hidden'); 
        let debugHTML = ''; 
        for (const [key, value] of Object.entries(debugData)) {
            let displayValue = value;
            if (typeof value === 'number' && !Number.isInteger(value)) {
                displayValue = value.toFixed(2);
            }
            debugHTML += `<div><strong>${key}:</strong> ${displayValue}</div>`;
        }
        debugOverlay.innerHTML = debugHTML;
    }

    renderGrid(world) {
        const gridSize = world.chunkSize;
        const worldLeft = this.camera.x - (this.canvas.width / 2 / this.camera.zoom);
        const worldRight = this.camera.x + (this.canvas.width / 2 / this.camera.zoom);
        const worldTop = this.camera.y - (this.canvas.height / 2 / this.camera.zoom);
        const worldBottom = this.camera.y + (this.canvas.height / 2 / this.camera.zoom);
        const startGridX = Math.floor(worldLeft / gridSize) * gridSize;
        const endGridX = Math.ceil(worldRight / gridSize) * gridSize;
        const startGridY = Math.floor(worldTop / gridSize) * gridSize;
        const endGridY = Math.ceil(worldBottom / gridSize) * gridSize;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; 
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = startGridX; x <= endGridX; x += gridSize) {
            const screenX = this.worldToScreen(x, worldTop).x;
            if (screenX >= 0 && screenX <= this.canvas.width) {
                this.ctx.moveTo(screenX, 0); this.ctx.lineTo(screenX, this.canvas.height);
            }
        }
        for (let y = startGridY; y <= endGridY; y += gridSize) {
            const screenY = this.worldToScreen(worldLeft, y).y; 
            if (screenY >= 0 && screenY <= this.canvas.height) { 
                this.ctx.moveTo(0, screenY); this.ctx.lineTo(this.canvas.width, screenY);
            }
        }
        this.ctx.stroke();
        const screenOrigin = this.worldToScreen(0, 0);
        if (screenOrigin.x > 0 && screenOrigin.x < this.canvas.width && screenOrigin.y > 0 && screenOrigin.y < this.canvas.height) {
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(screenOrigin.x - 10, screenOrigin.y); this.ctx.lineTo(screenOrigin.x + 10, screenOrigin.y);
            this.ctx.moveTo(screenOrigin.x, screenOrigin.y - 10); this.ctx.lineTo(screenOrigin.x, screenOrigin.y + 10);
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; this.ctx.font = '12px monospace'; this.ctx.textAlign = 'left';
            this.ctx.fillText('(0,0)', screenOrigin.x + 15, screenOrigin.y + 5);
        }
    }
}