// UI Controller Class
class UIController {
    constructor() {
      this.playlistExpanded = true;
      this.isFullscreen = false;
      this.is3DEnabled = false;
      this.miniInfoBoxes = [];
      this.clusterPlaylist = null;
      this.isMobile = this._detectMobile();
      document.body.classList.toggle('is-mobile', this.isMobile);
      
      // Cache DOM references
      this.playlist = document.getElementById('playlist');
      this.playlistWrapper = document.getElementById('playlistWrapper');
      this.playlistToggle = document.getElementById('playlistToggle');
      this.scrollUp = document.getElementById('scrollUp');
      this.scrollDown = document.getElementById('scrollDown');
      
      this.setupEventListeners();
      this.setupResizeListener();
    }

      setupEventListeners() {
        // Playlist toggle (desktop)
        document.getElementById('playlistToggle').addEventListener('click', () => {
          this.togglePlaylist();
        });

        // Hamburger menu for mobile
        const hamburgerMenu = document.getElementById('hamburgerMenu');
        if (hamburgerMenu) {
          hamburgerMenu.addEventListener('click', () => {
            this.toggleMobileMenu();
          });
        }

        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            this.handleSortChange(e.target.id);
          });
        });

        // Random toggle
        document.getElementById('randomToggle').addEventListener('click', () => {
          audioController.playMode = audioController.playMode === 'random' ? 'sequential' : 'random';
          this.updateRandomToggle();
        });

        document.getElementById('resetMapBtn').addEventListener('click', () => {
          mapController.resetMap();
        });

        document.getElementById('fullscreenBtn').addEventListener('click', () => {
          this.toggleFullscreen();
        });

        document.getElementById('terrain3dBtn').addEventListener('click', () => {
          this.toggle3D();
        });

        // Global spacebar handler - prevent focus on audio elements
        document.addEventListener('keydown', (e) => {
          if (e.code === 'Space' && audioController.currentAudio) {
            e.preventDefault();
            audioController.togglePlayPause();
            // Blur any focused audio elements
            if (document.activeElement.tagName === 'AUDIO') {
              document.activeElement.blur();
            }
          }
        });
          
        // Scroll arrows (use cached references)
        const playlist = this.playlist;
        const scrollUp = this.scrollUp;
        const scrollDown = this.scrollDown;

        playlist.addEventListener('scroll', () => this.updateScrollArrows());

        // Prevent scroll chaining — stop wheel events from reaching the page
        // when the playlist is at its scroll limits
        playlist.addEventListener('wheel', (e) => {
          const atTop = playlist.scrollTop === 0;
          const atBottom = (playlist.scrollTop + playlist.clientHeight) >= playlist.scrollHeight - 1;
          const scrollingUp = e.deltaY < 0;
          const scrollingDown = e.deltaY > 0;
          if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
            e.preventDefault();
          }
        }, { passive: false });
        scrollUp.addEventListener('click', () => {
          if (!scrollUp.classList.contains('disabled')) {
            playlist.scrollBy({ top: -100, behavior: 'smooth' });
          }
        });
        scrollDown.addEventListener('click', () => {
          if (!scrollDown.classList.contains('disabled')) {
            playlist.scrollBy({ top: 100, behavior: 'smooth' });
          }
        });

        // Initialize scroll arrows state on load
        setTimeout(() => this.updateScrollArrows(), 100);

        this.setupPlaylistDrag();
      }

         togglePlaylist() {
          const wrapper = document.getElementById('playlistWrapper');
          const toggle = document.getElementById('playlistToggle');
          
          this.playlistExpanded = !this.playlistExpanded;
          
          if (this.playlistExpanded) {
            wrapper.classList.remove('collapsed');
            toggle.textContent = '◀';
            toggle.title = 'Collapse playlist';
            
            // Remove header badge when playlist is expanded
            const existingBadge = document.getElementById('playing-badge');
            if (existingBadge) {
              existingBadge.remove();
            }
          } else {
            wrapper.classList.add('collapsed');
            toggle.textContent = '▶';
            toggle.title = 'Expand playlist';
            
            // Show header badge when playlist is collapsed (if something is playing)
            if (audioController.currentIndex >= 0) {
              const currentTrack = mapController.audioData[audioController.currentIndex];
              if (currentTrack) {
                mapController.updateHeaderBadge(currentTrack);
              }
            }
          }
        }

        toggleMobileMenu() {
          if (!this.isMobile) return;
          
          const wrapper = document.getElementById('playlistWrapper');
          const hamburger = document.querySelector('.hamburger-menu');
          this.mobilePlaylistExpanded = !this.mobilePlaylistExpanded;
          
          if (this.mobilePlaylistExpanded) {
            wrapper.classList.add('mobile-expanded');
            document.body.classList.add('mobile-menu-open');
            if (hamburger) hamburger.classList.add('open');
          } else {
            wrapper.classList.remove('mobile-expanded');
            document.body.classList.remove('mobile-menu-open');
            if (hamburger) hamburger.classList.remove('open');
          }
        }

        collapseMobileMenu() {
          if (!this.isMobile) return;
          
          const wrapper = document.getElementById('playlistWrapper');
          const hamburger = document.querySelector('.hamburger-menu');
          this.mobilePlaylistExpanded = false;
          wrapper.classList.remove('mobile-expanded');
          document.body.classList.remove('mobile-menu-open');
          if (hamburger) hamburger.classList.remove('open');
        }

      _detectMobile() {
        return /iphone|ipad|ipod|android|mobile|blackberry|iemobile|wpdesktop/i.test(navigator.userAgent);
      }

      setupResizeListener() {
        // isMobile is device-based, not window-width-based — no layout switching on resize.
        // Only update scroll arrows if needed.
        window.addEventListener('resize', () => {
          setTimeout(() => this.updateScrollArrows(), 100);
        });
      }

      handleSortChange(sortId) {
        document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(sortId).classList.add('active');

        const sortMap = {
          'sortNobo': 'nobo',
          'sortSobo': 'sobo',
          'sortDate': 'date'
        };
        
        audioController.sortMode = sortMap[sortId];
        mapController.sortAndUpdatePlaylist();
      }

      updateRandomToggle() {
        const toggle = document.getElementById('randomToggle');
        toggle.classList.toggle('active', audioController.playMode === 'random');
      }

      toggleFullscreen() {
        const body = document.body;
        
        if (!this.isFullscreen) {
          if (body.requestFullscreen) {
            body.requestFullscreen();
          } else if (body.webkitRequestFullscreen) {
            body.webkitRequestFullscreen();
          } else if (body.msRequestFullscreen) {
            body.msRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
      }

      toggle3D() {
        this.is3DEnabled = !this.is3DEnabled;
        const btn = document.getElementById('terrain3dBtn');
        const btnMobile = document.getElementById('terrain3dBtnMobile');
        if (btn) btn.classList.toggle('active', this.is3DEnabled);
        if (btnMobile) btnMobile.classList.toggle('active', this.is3DEnabled);

        if (this.is3DEnabled) {
          // Close picker when entering 3D — picker is a 2D-only UI element
          if (mapController.clusterPicker) {
            if (mapController.clusterPicker._moveHandler) map.off('move', mapController.clusterPicker._moveHandler);
            mapController.clusterPicker.remove();
            mapController.clusterPicker = null;
            mapController.clusterPickerTracks = null;
          }
          mapController.enable3D();
        } else {
          mapController.disable3D();
        }
      }

        updateScrollArrows() {
          const playlist = this.playlist;
          const scrollUp = this.scrollUp;
          const scrollDown = this.scrollDown;
        
        // Always show arrows, but disable when can't scroll
        const canScrollUp = playlist.scrollTop > 0;
        const canScrollDown = (playlist.scrollTop + playlist.clientHeight) < playlist.scrollHeight - 1; // -1 for rounding
        
        if (canScrollUp) {
          scrollUp.classList.remove('disabled');
        } else {
          scrollUp.classList.add('disabled');
        }
        
        if (canScrollDown) {
          scrollDown.classList.remove('disabled');
        } else {
          scrollDown.classList.add('disabled');
        }
      }

      setupPlaylistDrag() {
        const playlist = document.getElementById('playlist');
        let dragging = false, startY, scrollStart, vel = 0, lastY = 0, lastTime = 0, raf;
        let dragStarted = false, preventClick = false;

        playlist.addEventListener('mousedown', e => {
          dragging = true;
          dragStarted = false;
          playlist.classList.add('dragging');
          startY = e.pageY;
          scrollStart = playlist.scrollTop;
          vel = 0;
          lastY = e.pageY;
          lastTime = Date.now();
          if (raf) cancelAnimationFrame(raf);
        });

        playlist.addEventListener('mousemove', e => {
          if (!dragging) return;
          e.preventDefault();
          const now = Date.now();
          const dy = e.pageY - lastY;
          const dt = now - lastTime;
          if (dt > 0) vel = dy / dt * 16;
          playlist.scrollTop = scrollStart - (e.pageY - startY);
          lastY = e.pageY;
          lastTime = now;
          this.updateScrollArrows();

          if (!dragStarted && Math.abs(e.pageY - startY) > 5) {
            dragStarted = true;
            preventClick = true;
          }
        });

        ['mouseup', 'mouseleave'].forEach(ev => {
          playlist.addEventListener(ev, () => {
            if (!dragging) return;
            dragging = false;
            playlist.classList.remove('dragging');
            
            const momentum = () => {
              if (Math.abs(vel) < 0.5) return;
              playlist.scrollTop -= vel;
              vel *= 0.95;
              raf = requestAnimationFrame(momentum);
              this.updateScrollArrows();
            };
            momentum();

            if (preventClick) {
              setTimeout(() => { preventClick = false; }, 100);
            }
          });
        });

        playlist.addEventListener('click', e => {
          if (preventClick) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      }

      showMiniInfoBoxes(currentTrack, audioData, precomputedPoints = null) {
        this.clearMiniInfoBoxes();

        const visiblePoints = precomputedPoints || (() => {
          const raw = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
          const seen = new Set();
          return raw.filter(p => {
            const origIdx = parseInt(p.properties.originalIndex);
            if (seen.has(origIdx)) return false;
            seen.add(origIdx);
            return true;
          });
        })();

        visiblePoints.forEach(point => {
          const originalIndex = parseInt(point.properties.originalIndex);
          
          const currentIndex = audioData.findIndex(track => track.originalIndex === originalIndex);
          if (currentIndex === -1) return;
          
          if (mapController.clusterPickerTracks && mapController.clusterPickerTracks.includes(currentIndex)) return;

          // Skip the active track entirely — its state is managed by minimizePopup/showPopup
          if (currentIndex === audioController.currentIndex) return;

          // Skip if this track has a popup open (preview)
          const hasPopup = mapController.currentPopup && 
            mapController.currentPopup._container &&
            parseInt(mapController.currentPopup._container.dataset?.trackIndex) === currentIndex;
          if (hasPopup) return;

          // Skip if this track is currently in the minimized popup
          if (mapController.minimizedPopup && 
              parseInt(mapController.minimizedPopup.dataset?.trackIndex) === currentIndex) return;
          
          // Skip if a mini box already exists for this track
          const alreadyHasBox = this.miniInfoBoxes.some(b => parseInt(b.dataset.trackIndex) === currentIndex);
          if (alreadyHasBox) return;

          const track = audioData[currentIndex];
          if (!track) return;

          const coords = point.geometry.coordinates;
          const pixelCoords = map.project(coords);

          const infoBox = this._createMiniInfoBox(track, currentIndex, {
            onPillClick: () => mapController.playAudio(currentIndex, false, true, true),
            onBodyClick: () => {
              if (infoBox.parentNode) infoBox.parentNode.removeChild(infoBox);
              this.miniInfoBoxes = this.miniInfoBoxes.filter(b => b !== infoBox);
              const trackCoords = [parseFloat(track.lng), parseFloat(track.lat)];
              mapController.showPopup(trackCoords, track, audioController.currentAudio, currentIndex, false, true);
            },
            isPlaying: false,
            audio: null
          });

          infoBox.style.position = 'absolute';
          infoBox.style.left = `${pixelCoords.x + 10}px`;
          infoBox.style.top  = `${pixelCoords.y - 20}px`;

          document.body.appendChild(infoBox);

          // Stack boxes at identical pixel coordinates vertically
          const boxHeight = infoBox.offsetHeight || 32;
          const stackOffset = this.miniInfoBoxes.filter(b => {
            const bLeft = parseFloat(b.style.left);
            const track2Index = parseInt(b.dataset.trackIndex);
            const track2 = mapController.audioData[track2Index];
            if (!track2) return false;
            const bPx = map.project([parseFloat(track2.lng), parseFloat(track2.lat)]);
            return Math.abs(bLeft - (pixelCoords.x + 10)) < 5 &&
                   Math.abs(bPx.y - pixelCoords.y) < 5;
          }).length;
          infoBox.style.top = `${pixelCoords.y - (boxHeight / 2) + (stackOffset * (boxHeight + 3))}px`;
          this.miniInfoBoxes.push(infoBox);
        });
      }

      // Builds a mini infobox with main+chevron structure
      // opts: { onPillClick, onBodyClick, isPlaying, audio }
      _createMiniInfoBox(track, trackIndex, opts) {
        const infoBox = document.createElement('div');
        infoBox.className = 'mini-infobox';
        infoBox.dataset.trackIndex = trackIndex;

        // Main zone — play/pause icon + title, tap to play/pause
        const pill = document.createElement('div');
        pill.className = 'mini-infobox-pill';
        pill.title = 'Play sound';

        const pillIcon = document.createElement('div');
        pillIcon.className = 'play-icon';
        pill.appendChild(pillIcon);

        const title = document.createElement('span');
        title.className = 'mini-infobox-title';
        title.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');
        pill.appendChild(title);

        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onPillClick();
        });

        // Chevron — standalone expand tap target
        const chevron = document.createElement('div');
        chevron.className = 'mini-infobox-chevron';
        chevron.textContent = '···';
        chevron.title = 'Expand player';

        chevron.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onBodyClick();
        });

        infoBox.appendChild(pill);
        infoBox.appendChild(chevron);

        // Wire play/pause icon to audio if provided (orange/playing state)
        if (opts.audio) {
          pillIcon.innerHTML = '';
          pillIcon.style.cssText = '';
          const cleanup = mapController._attachPlayPauseIcon(pillIcon, opts.audio, false);
          infoBox._cleanupIcon = cleanup;
        }

        return infoBox;
      }


      updateMiniInfoBoxPositions() {
        // Track stack counts per x position to maintain vertical offsets
        const stackCounts = {};
        this.miniInfoBoxes.forEach(infoBox => {
          const trackIndex = parseInt(infoBox.dataset.trackIndex);
          const track = mapController.audioData[trackIndex];
          if (track) {
            const coords = [parseFloat(track.lng), parseFloat(track.lat)];
            const px = map.project(coords);
            const leftKey = Math.round(px.x + 10);
            stackCounts[leftKey] = (stackCounts[leftKey] || 0);
            const boxHeight = infoBox.offsetHeight || 32;
            const stackOffset = stackCounts[leftKey];
            infoBox.style.left = `${px.x + 10}px`;
            infoBox.style.top  = `${px.y - (boxHeight / 2) + (stackOffset * (boxHeight + 3))}px`;
            stackCounts[leftKey]++;
          }
        });
      }

      // Clear _manuallyCreated flag after one updateMapUI cycle so boxes get managed normally
      releaseManualBoxes() {
        this.miniInfoBoxes.forEach(box => {
          if (box._manuallyCreated) box._manuallyCreated = false;
        });
      }

      clearMiniInfoBoxes() {
        this.miniInfoBoxes = this.miniInfoBoxes.filter(box => {
          if (box._manuallyCreated) return true; // Preserve manually-created boxes
          if (box._cleanupIcon) box._cleanupIcon();
          if (box.parentNode) box.parentNode.removeChild(box);
          return false;
        });
      }

      showClusterPlaylist(e, leaves) {
        this.hideClusterPlaylist();

        const playlist = document.createElement('div');
        playlist.className = 'cluster-playlist';
        
        leaves.forEach(leaf => {
          const item = document.createElement('div');
          item.className = 'cluster-item';
          
          const playIcon = document.createElement('div');
          playIcon.className = 'play-icon';
          
          const title = document.createElement('span');
          title.className = 'cluster-item-title';
          title.textContent = leaf.properties.name.replace(/^[^\s]+\s+-\s+/, '');
          
          item.appendChild(playIcon);
          item.appendChild(title);
          
          item.addEventListener('click', () => {
            mapController.playAudio(parseInt(leaf.properties.id));
            this.hideClusterPlaylist();
          });
          
          item.addEventListener('mouseleave', () => {
            // Small delay to allow moving between items
            setTimeout(() => {
              if (!playlist.matches(':hover')) {
                this.hideClusterPlaylist();
              }
            }, 100);
          });
          
          playlist.appendChild(item);
        });

        // Position the playlist
        playlist.style.left = `${e.point.x + 10}px`;
        playlist.style.top = `${e.point.y - 10}px`;
        
        // Handle playlist mouse leave
        playlist.addEventListener('mouseleave', () => {
          this.hideClusterPlaylist();
        });
        
        map.getContainer().appendChild(playlist);
        this.clusterPlaylist = playlist;
      }

      hideClusterPlaylist() {
        if (this.clusterPlaylist) {
          this.clusterPlaylist.remove();
          this.clusterPlaylist = null;
        }
      }
    }
