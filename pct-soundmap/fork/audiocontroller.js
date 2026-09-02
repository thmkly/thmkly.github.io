// Audio Controller Class
// UPDATED: Now uses persistent audio element for iOS background playback support
class AudioController {
  constructor() {
    this.currentAudio = null;
    this.currentIndex = -1;
    this.isPlaying = false;
    this.playMode = 'sequential';
    this.sortMode = 'nobo';
    this.lastPlayNext = 0;
    this.playHistory = []; // Track play history for random mode
    this.isNavigatingBack = false; // ADDED: Flag to prevent history corruption during backward navigation
    this.scrollToActiveOnOpen = false; // Flag to scroll active track into view when playlist opens
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

  // Fade out current audio over given duration (ms) — desktop only
  fadeOut(duration = 1000) {
    if (this._fadeRaf) { cancelAnimationFrame(this._fadeRaf); this._fadeRaf = null; }
    return new Promise(resolve => {
      if (!this.currentAudio || this.currentAudio.paused) { resolve(); return; }
      const audio = this.currentAudio;
      const startVolume = audio.volume;
      const startTime = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const s = 3 * progress * progress - 2 * progress * progress * progress;
        audio.volume = startVolume * (1 - s);
        if (progress < 1) {
          this._fadeRaf = requestAnimationFrame(tick);
        } else {
          audio.pause();
          audio.volume = 1;
          this._fadeRaf = null;
          resolve();
        }
      };
      this._fadeRaf = requestAnimationFrame(tick);
    });
  }

  updateMediaSession(track) {
    // Register handlers and update metadata per track — timing matters for iOS session context
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || 'unknown',
      artist: 'tom kelly',
      album: 'a sound map of the pacific crest trail, 2023',
      artwork: [
        {
          src: 'https://www.thomasmkelly.com/images/soundmap-web-player-image.jpg',
          sizes: '1024x1024',
          type: 'image/jpeg'
        }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
      this.currentAudio.play();
      this.isPlaying = true;
      navigator.mediaSession.playbackState = 'playing';
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.currentAudio.pause();
      this.isPlaying = false;
      navigator.mediaSession.playbackState = 'paused';
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (window.mapController && window.mapController.audioData) {
        this.playPrevious(window.mapController.audioData);
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (window.mapController && window.mapController.audioData) {
        this.playNext(window.mapController.audioData, true);
      }
    });

    navigator.mediaSession.playbackState = 'playing';
  }

  play(index, audioData, withFade = false) {
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

    const startPlayback = () => {
      this.currentAudio.src = track.audioUrl;
      this.currentAudio.load();
      this.currentAudio.volume = 1;
      // Set metadata before play so iOS lock screen picks it up immediately
      this.updateMediaSession(track);
      const playPromise = this.currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Playback prevented (autoplay policy):', error);
        });
      }
    };

    const isMobile = window.uiController ? uiController.isMobile : window.innerWidth <= 768;
    if (withFade && !this.currentAudio.paused && !isMobile) {
      // Desktop: smooth fade out
      this.fadeOut(1000).then(startPlayback);
    } else {
      // Mobile: hard stop (iOS doesn't support programmatic volume changes)
      if (!this.currentAudio.paused) this.currentAudio.pause();
      startPlayback();
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

  playNext(audioData, fromUser = false) {
    // Circuit breaker: prevent rapid successive calls
    const now = Date.now();
    if (this.lastPlayNext && (now - this.lastPlayNext) < 1000) {
      console.warn('PlayNext called too quickly, blocking to prevent loop');
      return;
    }
    this.lastPlayNext = now;

    const { data: activeData, toFullIndex, toLocalIndex } = 
      window.mapController ? window.mapController.getActivePlaylist() : { data: audioData, toFullIndex: i => i, toLocalIndex: i => i };

    let nextFullIndex;

    if (this.playMode === 'random') {
      let randomLocal = Math.floor(Math.random() * activeData.length);
      // If more than one result, retry to avoid landing on current track
      if (activeData.length > 1) {
        let attempts = 0;
        while (toFullIndex(randomLocal) === this.currentIndex && attempts < 10) {
          randomLocal = Math.floor(Math.random() * activeData.length);
          attempts++;
        }
      }
      nextFullIndex = toFullIndex(randomLocal);
    } else {
      const localCurrent = toLocalIndex(this.currentIndex);
      const localNext = localCurrent === -1 ? 0 : localCurrent + 1;
      const wrappedLocal = localNext >= activeData.length ? 0 : localNext;
      nextFullIndex = toFullIndex(wrappedLocal);
    }

    if (nextFullIndex !== this.currentIndex && nextFullIndex >= 0) {
      if (window.mapController) {
        window.mapController.playAudio(nextFullIndex, !fromUser);
      }
    }
  }

  playPrevious(audioData) {
    const { data: activeData, toFullIndex, toLocalIndex } = 
      window.mapController ? window.mapController.getActivePlaylist() : { data: audioData, toFullIndex: i => i, toLocalIndex: i => i };

    let prevFullIndex;

    if (this.playMode === 'random') {
      if (this.playHistory.length === 0) return;
      prevFullIndex = this.playHistory.pop();
      this.isNavigatingBack = true;
    } else {
      const localCurrent = toLocalIndex(this.currentIndex);
      const localPrev = localCurrent <= 0 ? activeData.length - 1 : localCurrent - 1;
      prevFullIndex = toFullIndex(localPrev);
    }

    if (window.mapController) {
      window.mapController.playAudio(prevFullIndex, false, true);
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
