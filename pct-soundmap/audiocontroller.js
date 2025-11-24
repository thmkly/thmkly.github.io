// Audio Controller Class
// UPDATED: Now uses persistent audio element for iOS background playback support
class AudioController {
  constructor() {
    this.currentAudio = null;
    this.currentIndex = -1;
    this.isPlaying = false;
    this.playMode = 'sequential';
    this.sortMode = 'nobo';
    this.playQueue = [];
    this.lastPlayNext = 0;
    this.playHistory = []; // Track play history for random mode
    this.isNavigatingBack = false; // ADDED: Flag to prevent history corruption during backward navigation
    this.setupAudioElement(); // CHANGED: Setup persistent audio element first
    this.setupWakeLock();
  }

  async setupWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.log('Wake lock not supported');
      }
    }
  }

  // CHANGED: New method to setup persistent audio element
  setupAudioElement() {
    // Get the persistent audio element from HTML
    this.currentAudio = document.getElementById('persistent-audio');
    
    if (!this.currentAudio) {
      console.error('Persistent audio element not found! Creating fallback.');
      // Fallback: create one if it doesn't exist (shouldn't happen with new HTML)
      this.currentAudio = document.createElement('audio');
      this.currentAudio.id = 'persistent-audio';
      this.currentAudio.controls = true;
      this.currentAudio.preload = 'auto';
      this.currentAudio.controlsList = 'nodownload';
      this.currentAudio.oncontextmenu = () => false;
      this.currentAudio.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 1000; width: 300px; max-width: calc(100vw - 40px);';
      document.body.appendChild(this.currentAudio);
    }
    
    // Set up event listeners ONCE on the persistent element
    this.currentAudio.addEventListener('ended', () => {
      // Access audioData through mapController
      if (window.mapController && window.mapController.audioData) {
        this.playNext(window.mapController.audioData);
      }
    });
    
    this.currentAudio.addEventListener('error', () => {
      if (this.currentIndex >= 0 && window.mapController && window.mapController.audioData) {
        const track = window.mapController.audioData[this.currentIndex];
        if (track) {
          console.warn('Audio failed to load:', track.name);
          if (typeof showNotification === 'function') {
            showNotification(`Audio failed to load: ${track.name}`, 3000);
          }
        }
      }
    });
  }

  // CHANGED: Simplified play method - just changes src instead of creating new elements
  play(index, audioData) {
    const track = audioData[index];
    if (!track) return;

    // Add to play history (keep last 50 for memory management)
    // FIXED: Don't add to history if we're navigating backwards
    if (this.currentIndex !== -1 && this.currentIndex !== index && !this.isNavigatingBack) {
      this.playHistory.push(this.currentIndex);
      if (this.playHistory.length > 50) {
        this.playHistory.shift();
      }
    }

    // Reset the backward navigation flag after processing
    this.isNavigatingBack = false;

    this.currentIndex = index;
    this.isPlaying = true;

    // Just change the source - don't create new elements
    this.currentAudio.src = track.audioUrl;
    this.currentAudio.load();
    
    // Attempt to play immediately since this is called from user interaction
    const playPromise = this.currentAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Playback prevented (autoplay policy):', error);
        // This is expected on first load - user needs to interact first
      });
    }
    
    return this.currentAudio;
  }

  togglePlayPause() {
    if (!this.currentAudio) return;
    
    if (this.currentAudio.paused) {
      this.currentAudio.play();
      this.isPlaying = true;
    } else {
      this.currentAudio.pause();
      this.isPlaying = false;
    }
  }

  playNext(audioData) {
    // Circuit breaker: prevent rapid successive calls
    const now = Date.now();
    if (this.lastPlayNext && (now - this.lastPlayNext) < 1000) {
      console.warn('PlayNext called too quickly, blocking to prevent loop');
      return;
    }
    this.lastPlayNext = now;

    let nextIndex;
    
    if (this.playMode === 'random') {
      nextIndex = Math.floor(Math.random() * audioData.length);
    } else {
      // Always go DOWN the playlist (top→bottom, index 0→higher)
      // This works for all modes since the playlist is now arranged correctly:
      // - NOBO: Mexico at top→Canada at bottom (playing Mexico→Canada)
      // - SOBO: Canada at top→Mexico at bottom (playing Canada→Mexico)  
      // - STEREO: Earliest at top→Latest at bottom (playing chronologically)
      nextIndex = this.currentIndex + 1;
      if (nextIndex >= audioData.length) {
        nextIndex = 0; // Wrap to beginning
      }
    }
    
    if (nextIndex !== this.currentIndex) {
      // Pass true flag to indicate this is from auto-play
      if (window.mapController) {
        window.mapController.playAudio(nextIndex, true);
      }
    }
  }

  playPrevious(audioData) {
    let prevIndex;
    
    if (this.playMode === 'random') {
      // In random mode, only go back if there's history
      if (this.playHistory.length === 0) {
        return; // Do nothing if no history
      }
      prevIndex = this.playHistory.pop();
      // FIXED: Set flag to prevent re-adding current track to history
      this.isNavigatingBack = true;
    } else {
      // Always go UP the playlist (bottom→top, higher index→0)
      // This works for all modes since the playlist is now arranged correctly
      prevIndex = this.currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = audioData.length - 1; // Wrap to end
      }
    }
    
    // Pass false to indicate manual navigation
    if (window.mapController) {
      window.mapController.playAudio(prevIndex, false, true);
    }
  }

  // CHANGED: Simplified stop method - persistent element just pauses and resets
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Don't remove src or element - it's persistent
    }
    this.isPlaying = false;
    this.currentIndex = -1;
  }
}
