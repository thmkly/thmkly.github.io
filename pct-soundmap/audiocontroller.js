// Audio Controller Class
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

      play(index, audioData) {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }

        const track = audioData[index];
        if (!track) return;

        // Add to play history (keep last 50 for memory management)
        if (this.currentIndex !== -1 && this.currentIndex !== index) {
          this.playHistory.push(this.currentIndex);
          if (this.playHistory.length > 50) {
            this.playHistory.shift();
          }
        }

        this.currentIndex = index;
        this.isPlaying = true;

        const audio = document.createElement('audio');
        audio.src = track.audioUrl;
        audio.preload = 'auto';
        audio.controlsList = 'nodownload';
        audio.oncontextmenu = () => false;
        
        audio.addEventListener('ended', () => {
          this.playNext(audioData);
        });

        audio.addEventListener('error', () => {
          console.warn('Audio failed to load:', track.name, 'URL:', track.audioUrl);
          // Don't auto-play next track on error to prevent infinite loops
          // this.playNext(audioData);
          showNotification(`Audio failed to load: ${track.name}`, 3000);
        });

        this.currentAudio = audio;
        return audio;
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
          mapController.playAudio(nextIndex);
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
        } else {
          // Always go UP the playlist (bottom→top, higher index→0)
          // This works for all modes since the playlist is now arranged correctly
          prevIndex = this.currentIndex - 1;
          if (prevIndex < 0) {
            prevIndex = audioData.length - 1; // Wrap to end
          }
        }
        
        mapController.playAudio(prevIndex);
      }

      stop() {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }
        this.isPlaying = false;
        this.currentIndex = -1;
      }
    }
