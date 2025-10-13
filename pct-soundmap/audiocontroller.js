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
          // Stop and clean up previous audio completely
          if (this.currentAudio) {
            // Remove event listeners first to prevent false error notifications
            if (this.currentAudio._endedHandler) {
              this.currentAudio.removeEventListener('ended', this.currentAudio._endedHandler);
            }
            if (this.currentAudio._errorHandler) {
              this.currentAudio.removeEventListener('error', this.currentAudio._errorHandler);
            }
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio.src = '';
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
          
          // Store handler references so we can remove them later
          const endedHandler = () => {
            this.playNext(audioData);
          };
          const errorHandler = () => {
            console.warn('Audio failed to load:', track.name, 'URL:', track.audioUrl);
            showNotification(`Audio failed to load: ${track.name}`, 3000);
          };
        
          audio.addEventListener('ended', endedHandler);
          audio.addEventListener('error', errorHandler);
        
          // Store handlers on the audio element for cleanup
          audio._endedHandler = endedHandler;
          audio._errorHandler = errorHandler;
        
          this.currentAudio = audio;
          
          // Attempt to play immediately since this is called from user interaction
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.log('Audio play prevented:', error.message);
              // Audio will be shown with controls in popup
            });
          }
          
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
          // Pass true flag to indicate this is from auto-play
          mapController.playAudio(nextIndex, true);
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
        
        // Pass false to indicate manual navigation
        mapController.playAudio(prevIndex, false);
      }

      stop() {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio.src = '';
          this.currentAudio = null;
        }
        this.isPlaying = false;
        this.currentIndex = -1;
      }
    }
