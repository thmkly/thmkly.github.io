// main.js
const audioController = new AudioController();
const atmosphereController = new AtmosphereController();
const uiController = new UIController();

// Expose to global scope (so classes can talk to each other)
window.audioController = audioController;
window.atmosphereController = atmosphereController;
window.uiController = uiController;
