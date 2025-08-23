// main.js
const audioController = new AudioController();
const atmosphereController = new AtmosphereController();

// Expose to global scope (so classes can talk to each other)
window.audioController = audioController;
window.atmosphereController = atmosphereController;
