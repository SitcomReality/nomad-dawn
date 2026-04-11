import Game from './core/Game.js';
import { DebugUtils } from './utils/DebugUtils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    try {
        // Set up the debug utilities
        const debug = new DebugUtils();
        window.debug = debug;

        // Initialize the game
        const game = new Game({
            canvas: document.getElementById('game-canvas'),
            debug: debug
        });
        window.game = game;

        // Show loading screen
        loadingScreen.classList.remove('hidden');
        updateLoadingProgress(0, 'Initializing game systems');

        // Initialize single-player session
        updateLoadingProgress(20, 'Setting up session');
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
            if (game.ui) {
                game.ui.showHUD();
            } else {
                console.error("UIManager not initialized!");
            }
            game.start();
        }, 500);
    } catch (error) {
        console.error('Game initialization error:', error);
        updateLoadingProgress(0, `Initialization Error: ${error.message || 'Unknown error'}`);
        loadingScreen.classList.remove('hidden');
        const progressBar = document.querySelector('.loading-progress');
        if (progressBar) progressBar.style.backgroundColor = 'var(--ui-accent)';
    }
});

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