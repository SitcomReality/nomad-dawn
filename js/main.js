import Game from './core/Game.js';
import { DebugUtils } from './utils/DebugUtils.js';

// Initialize and start the game
document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    try {
        // Set up the debug utilities
        const debug = new DebugUtils();
        window.debug = debug; // Make debug available globally for console access

        // Initialize the game
        const game = new Game({
            canvas: document.getElementById('game-canvas'),
            debug: debug
        });
        window.game = game; // Make game globally accessible (for debugging/convenience)

        // Show loading screen (ensure it's visible initially)
        loadingScreen.classList.remove('hidden');
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

        // Hide loading screen and show game HUD
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
             // Use UIManager to show the HUD
             if (game.ui) {
                 game.ui.showHUD();
             } else {
                 console.error("UIManager not initialized!");
             }

            // Start the game loop
            game.start();
        }, 500); // Short delay for visual feedback
    } catch (error) {
        console.error('Game initialization error:', error);
        updateLoadingProgress(0, `Initialization Error: ${error.message || 'Unknown error'}`);
        // Keep loading screen visible with error message
        loadingScreen.classList.remove('hidden');
        const progressBar = document.querySelector('.loading-progress');
        if (progressBar) progressBar.style.backgroundColor = 'var(--ui-accent)'; // Indicate error
    }
});

// Helper function to update the loading progress bar
function updateLoadingProgress(progress, message) {
    const progressBar = document.querySelector('.loading-progress');
    const messageElement = document.querySelector('#loading-screen p');

     if (progressBar) {
        progressBar.style.width = `${progress}%`;
     }
    if (messageElement && message) {
        messageElement.textContent = message;
    }
}