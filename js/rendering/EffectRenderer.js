export default class EffectRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
        this.effects = [];
    }
    
    render(delta, currentTime) {
        if (delta <= 0) return;

        // Use filter to create a new array of active effects
        this.effects = this.effects.filter(effect => {
            if (effect && typeof effect.update === 'function') {
                return effect.update(this.ctx, currentTime, delta);
            }
            return false; // Remove invalid effects
        });
    }
    
    createEffect(type, x, y, options = {}) {
        // Create a new visual effect (needs world coordinates)
        let effect;
        const startTime = performance.now();

        switch (type) {
            case 'explosion':
                effect = this.createExplosionEffect(x, y, startTime, options);
                break;

            case 'collect':
                effect = this.createCollectEffect(x, y, startTime, options);
                break;

            case 'damage_taken':
                effect = this.createDamageEffect(x, y, startTime, options);
                break;
                
            default:
                console.warn(`Unknown effect type: ${type}`);
                return; // Unknown effect type
        }
        
        // Add effect to the list
        if (effect) {
            this.effects.push(effect);
        }
    }
    
    createExplosionEffect(x, y, startTime, options) {
        const explosionWorldSize = options.size || 30;
        return {
            type: 'explosion',
            worldX: x, worldY: y,
            worldSize: explosionWorldSize,
            duration: options.duration || 400,
            startTime: startTime,
            update: (ctx, currentTime, delta) => {
                const elapsed = currentTime - this.startTime;
                const progress = elapsed / this.duration;
                if (progress >= 1) return false;

                const screenPos = this.renderer.worldToScreen(this.worldX, this.worldY);
                const currentScreenRadius = this.worldSize * this.renderer.camera.zoom * progress;
                const alpha = 1 - progress * progress;

                ctx.save();
                ctx.globalAlpha = alpha;
                
                // Draw expanding circle
                const colorVal = Math.floor(220 * (1 - progress));
                ctx.fillStyle = `rgba(255, ${colorVal}, 0, ${alpha * 0.8})`;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, currentScreenRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Inner brighter core
                ctx.fillStyle = `rgba(255, 255, 150, ${alpha})`;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, currentScreenRadius * 0.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
                return true;
            }
        };
    }
    
    createCollectEffect(x, y, startTime, options) {
        const collectWorldSize = options.size || 8;
        const collectColor = options.color || '#ffff00';
        const effect = {
            type: 'collect',
            worldX: x, worldY: y,
            worldSize: collectWorldSize,
            color: collectColor,
            particleCount: 5 + Math.floor(Math.random() * 3),
            particles: [],
            duration: options.duration || 400,
            startTime: startTime,
            init: function() {
                for (let i = 0; i < this.particleCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = this.worldSize * (1.5 + Math.random() * 1.0);
                    this.particles.push({
                        ox: 0, oy: 0,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        alpha: 1.0,
                        size: (1 + Math.random())
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
                    p.ox += p.vx * deltaSeconds;
                    p.oy += p.vy * deltaSeconds;
                    p.alpha = 1.0 - progress;

                    if (p.alpha <= 0) continue;

                    const screenPos = this.renderer.worldToScreen(
                        effect.worldX + p.ox, 
                        effect.worldY + p.oy
                    );
                    const particleScreenSize = Math.max(1, p.size * this.renderer.camera.zoom);

                    ctx.globalAlpha = p.alpha;
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
        
        return effect;
    }
    
    createDamageEffect(x, y, startTime, options) {
        return {
            type: 'damage_taken',
            worldX: x, worldY: y,
            duration: options.duration || 200,
            startTime: startTime,
            update: (ctx, currentTime, delta) => {
                const elapsed = currentTime - this.startTime;
                const progress = elapsed / this.duration;
                if (progress >= 1) return false;

                const alpha = Math.sin(progress * Math.PI);

                ctx.save();
                ctx.globalAlpha = alpha * 0.6;
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.restore();
                return true;
            }
        };
    }
}