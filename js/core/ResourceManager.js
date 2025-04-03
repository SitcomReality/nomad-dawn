export default class ResourceManager {
    constructor() {
        this.resources = {};
        this.loadPromises = {};
    }
    
    async loadAssets(assetList) {
        const promises = assetList.map(asset => this.loadAsset(asset));
        return Promise.all(promises);
    }
    
    async loadAsset(asset) {
        // Skip if already loaded or loading
        if (this.resources[asset.id] || this.loadPromises[asset.id]) {
            return this.loadPromises[asset.id] || Promise.resolve(this.resources[asset.id]);
        }
        
        let loadPromise;
        
        switch (asset.type) {
            case 'image':
            case 'texture':
                loadPromise = this.loadImage(asset.id, asset.url);
                break;
                
            case 'audio':
                loadPromise = this.loadAudio(asset.id, asset.url);
                break;
                
            case 'json':
                loadPromise = this.loadJson(asset.id, asset.url);
                break;
                
            default:
                return Promise.reject(new Error(`Unknown asset type: ${asset.type}`));
        }
        
        // Store the promise to prevent duplicate loading
        this.loadPromises[asset.id] = loadPromise;
        
        try {
            const resource = await loadPromise;
            this.resources[asset.id] = resource;
            delete this.loadPromises[asset.id];
            return resource;
        } catch (error) {
            delete this.loadPromises[asset.id];
            throw error;
        }
    }
    
    loadImage(id, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }
    
    loadAudio(id, url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
            audio.src = url;
            audio.load();
        });
    }
    
    loadJson(id, url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            });
    }
    
    // Get a resource by ID
    get(id) {
        if (!this.resources[id]) {
            console.warn(`Resource not found: ${id}`);
            return null;
        }
        return this.resources[id];
    }
    
    // Check if a resource is loaded
    isLoaded(id) {
        return !!this.resources[id];
    }
    
    // Create a placeholder texture (for development/testing)
    createPlaceholderTexture(width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width || 64;
        canvas.height = height || 64;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color || '#ff00ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add a grid pattern
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        
        // Draw grid lines
        const gridSize = 8;
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw an X across the texture
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.moveTo(canvas.width, 0);
        ctx.lineTo(0, canvas.height);
        ctx.stroke();
        
        return canvas;
    }
}

