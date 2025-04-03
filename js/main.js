import Game from './core/Game.js';
import { DebugUtils } from './utils/DebugUtils.js';

// Initialize and start the game
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Set up the debug utilities
        const debug = new DebugUtils();
        window.debug = debug; // Make debug available globally for console access
        
        // Initialize the game
        const game = new Game({
            canvas: document.getElementById('game-canvas'),
            debug: debug
        });
        
        // Show loading screen
        updateLoadingProgress(0, 'Initializing game systems');
        
        // Initialize network connection
        updateLoadingProgress(20, 'Connecting to server');
        await game.initializeNetwork();
        
        // Load game assets
        updateLoadingProgress(40, 'Loading game assets');
        await game.loadAssets();
        
        // Initialize game world
        updateLoadingProgress(70, 'Generating world');
        await game.initializeWorld();
        
        // Complete loading
        updateLoadingProgress(100, 'Ready!');
        
        // Hide loading screen and show game UI
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');
            
            // Start the game loop
            game.start();
        }, 500);
    } catch (error) {
        console.error('Game initialization error:', error);
        updateLoadingProgress(0, `Error: ${error.message}`);
    }
});

// Helper function to update the loading progress bar
function updateLoadingProgress(progress, message) {
    const progressBar = document.querySelector('.loading-progress');
    const messageElement = document.querySelector('#loading-screen p');
    
    progressBar.style.width = `${progress}%`;
    if (message) {
        messageElement.textContent = message;
    }
}

