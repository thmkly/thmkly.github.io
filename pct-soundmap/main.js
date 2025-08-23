// main.js
const audioController = new AudioController();
const atmosphereController = new atmosphereController();
const uiController = new UIController();
const mapController = new mapController();

// Expose to global scope (so classes can talk to each other)
window.audioController = audioController;
window.atmosphereController = atmosphereController;
window.uiController = uiController;
window.mapController = mapController;
