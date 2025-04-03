export default class ResourceManager {
    constructor() {
        this.assets = {};
        this.loadPromises = [];
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.onProgress = null; // Callback for loading progress
    }
    
    // Register a progress callback
    setOnProgress(callback) {
        this.onProgress = callback;
    }
    
    // Load a list of assets
    async loadAssets(assetList) {
        this.totalAssets = assetList.length;
        this.loadedAssets = 0;
        this.loadPromises = [];
        
        // Trigger initial progress
        if (this.onProgress) {
            this.onProgress(0, this.totalAssets);
        }
        
        for (const asset of assetList) {
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
                    console.warn(`Unknown asset type: ${asset.type}`);
                    continue; // Skip unknown types
            }
            
            // Track promise and update progress on completion
            this.loadPromises.push(
                loadPromise.then(() => {
                    this.loadedAssets++;
                    if (this.onProgress) {
                        this.onProgress(this.loadedAssets, this.totalAssets);
                    }
                }).catch(error => {
                    // Handle individual asset load errors gracefully
                    console.error(`Failed to load asset ${asset.id} (${asset.url}):`, error);
                    // Optionally: Still count as "loaded" to prevent progress bar stall
                    this.loadedAssets++;
                    if (this.onProgress) {
                        this.onProgress(this.loadedAssets, this.totalAssets);
                    }
                })
            );
        }
        
        // Wait for all assets to finish loading (or fail)
        await Promise.all(this.loadPromises);
        
        // Final progress update
        if (this.onProgress) {
            this.onProgress(this.loadedAssets, this.totalAssets);
        }
    }
    
    // Load an image asset
    loadImage(id, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.assets[id] = img;
                resolve(img);
            };
            img.onerror = (error) => {
                reject(`Failed to load image: ${url} - ${error}`);
            };
            img.src = url;
        });
    }
    
    // Load an audio asset
    loadAudio(id, url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.assets[id] = audio;
                resolve(audio);
            };
            audio.onerror = (error) => {
                reject(`Failed to load audio: ${url} - ${error}`);
            };
            audio.src = url;
        });
    }
    
    // Load a JSON file
    loadJson(id, url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.assets[id] = data;
                return data;
            })
            .catch(error => {
                console.error(`Failed to load JSON: ${url}`, error);
                throw error; // Re-throw to be caught by loadAssets handler
            });
    }
    
    // Get a loaded asset by ID
    get(id) {
        const asset = this.assets[id];
        if (!asset) {
            console.warn(`Asset not found: ${id}`);
            return null;
        }
        return asset;
    }
    
    // Get all loaded assets
    getAll() {
        return this.assets;
    }
}