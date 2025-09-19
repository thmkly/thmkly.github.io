// UI Controller Class
    class UIController {
      constructor() {
        this.playlistExpanded = true;
        this.isFullscreen = false;
        this.is3DEnabled = false;
        this.miniInfoBoxes = [];
        this.clusterPlaylist = null;
        this.isMobile = window.innerWidth <= 768;
        this.mobilePlaylistExpanded = false;
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

        // Scroll arrows
        const playlist = document.getElementById('playlist');
        const scrollUp = document.getElementById('scrollUp');
        const scrollDown = document.getElementById('scrollDown');

        playlist.addEventListener('scroll', () => this.updateScrollArrows());
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
        } else {
          wrapper.classList.add('collapsed');
          toggle.textContent = '▶';
          toggle.title = 'Expand playlist';
        }
      }

      toggleMobileMenu() {
        if (!this.isMobile) return;
        
        const wrapper = document.getElementById('playlistWrapper');
        this.mobilePlaylistExpanded = !this.mobilePlaylistExpanded;
        
        if (this.mobilePlaylistExpanded) {
          wrapper.classList.add('mobile-expanded');
          document.body.classList.add('mobile-menu-open');
        } else {
          wrapper.classList.remove('mobile-expanded');
          document.body.classList.remove('mobile-menu-open');
        }
      }

      collapseMobileMenu() {
        if (!this.isMobile) return;
        
        const wrapper = document.getElementById('playlistWrapper');
        this.mobilePlaylistExpanded = false;
        wrapper.classList.remove('mobile-expanded');
        document.body.classList.remove('mobile-menu-open');
      }

      setupResizeListener() {
        window.addEventListener('resize', () => {
          const wasMobile = this.isMobile;
          this.isMobile = window.innerWidth <= 768;
          
          // Only handle if we're actually switching between mobile/desktop
          if (wasMobile !== this.isMobile) {
            const wrapper = document.getElementById('playlistWrapper');
            const hamburger = document.getElementById('hamburgerMenu');
            
            if (this.isMobile) {
              // Switching from desktop to mobile
              const wasExpanded = this.playlistExpanded;
              
              // Clear desktop state
              wrapper.classList.remove('collapsed');
              
              // Apply mobile state based on previous desktop state
              if (wasExpanded) {
                wrapper.classList.add('mobile-expanded');
                document.body.classList.add('mobile-menu-open');
                this.mobilePlaylistExpanded = true;
              } else {
              wrapper.classList.remove('mobile-expanded');
                document.body.classList.remove('mobile-menu-open');
                this.mobilePlaylistExpanded = false;
              }
              
            } else {
              // Switching from mobile to desktop
              // Save mobile state
              const wasMobileExpanded = wrapper.classList.contains('mobile-expanded');
              
              // Clear mobile classes
              wrapper.classList.remove('mobile-expanded');
              document.body.classList.remove('mobile-menu-open');
              
              // Apply desktop state based on previous mobile state
              if (wasMobileExpanded) {
                wrapper.classList.remove('collapsed');
                this.playlistExpanded = true;
              } else {
                wrapper.classList.add('collapsed');
                this.playlistExpanded = false;
              }
            }
            
            // Always ensure wrapper is visible
            wrapper.style.display = 'flex';
            
            // Update scroll arrows after resize
            setTimeout(() => this.updateScrollArrows(), 100);
          }
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
        
        // Update both buttons
        if (btn) btn.classList.toggle('active', this.is3DEnabled);
        if (btnMobile) btnMobile.classList.toggle('active', this.is3DEnabled);

        if (this.is3DEnabled) {
          // Enable drag rotation for desktop only
          if (!this.isMobile) {
            map.dragRotate.enable();
            map.keyboard.enable();
          }
          
          // Add 3D terrain source (enhanced for v3)
          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
              'type': 'raster-dem',
              'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
              'tileSize': 512,
              'maxzoom': 14
            });
          }
          
          // Set terrain with v3 optimizations
          map.setTerrain({ 
            'source': 'mapbox-dem', 
            'exaggeration': 1.5 
          });
          
          // Enhanced lighting for 3D in v3
          if (typeof map.setLight === 'function') {
            map.setLight({
              'anchor': 'viewport',
              'color': 'white',
              'intensity': 0.5,
              'position': [1.15, 210, 30]
            });
          }
          
          // Wait for terrain to be ready, then apply 3D positioning
          const apply3DView = () => {
            if (audioController.currentIndex >= 0) {
              const currentTrack = mapController.audioData[audioController.currentIndex];
              if (currentTrack) {
                // Position for 3D view of current track
                const coords = [parseFloat(currentTrack.lng), parseFloat(currentTrack.lat)];
                map.flyTo({
                  center: coords,
                  zoom: CONFIG.ZOOM_3D,
                  pitch: 82, // More immersive angle
                  bearing: 0,
                  duration: 2500,
                  easing: t => 1 - Math.pow(1 - t, 3)
                });
                
                // Apply atmospheric lighting for current track
                atmosphereController.applyAtmosphere(currentTrack);
              } else {
                // No valid track, just enable 3D at current location
                map.flyTo({
                  pitch: 82, // More immersive angle
                  zoom: Math.max(map.getZoom(), CONFIG.ZOOM_3D),
                  duration: 2000
                });
              }
            } else {
              // No active track, just enable 3D at current location
              map.flyTo({
                pitch: 82, // More immersive angle
                zoom: Math.max(map.getZoom(), CONFIG.ZOOM_3D),
                duration: 2000
              });
            }
            // Removed notification
          };
          
          // Wait a moment for terrain to initialize, then apply 3D view
          setTimeout(apply3DView, 300);
          
        } else {
          // Disable 3D
          // Disable drag rotation for desktop
          if (!this.isMobile) {
            map.dragRotate.disable();
          }
          
          map.setTerrain(null);
          if (typeof map.setLight === 'function') {
            map.setLight(null); // Reset lighting
          }
          map.flyTo({
            pitch: 0,
            bearing: 0, // Reset bearing when disabling 3D
            duration: 1500
          });
          
          // Clean up terrain source
          setTimeout(() => {
            if (map.getSource('mapbox-dem')) {
              map.removeSource('mapbox-dem');
            }
          }, 1600);
          
          // Removed notification
        }
      }

      updateScrollArrows() {
        const playlist = document.getElementById('playlist');
        const scrollUp = document.getElementById('scrollUp');
        const scrollDown = document.getElementById('scrollDown');
        
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

      showMiniInfoBoxes(currentTrack, audioData) {
        this.clearMiniInfoBoxes();

        const visiblePoints = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
        
        visiblePoints.forEach(point => {
          const originalIndex = parseInt(point.properties.originalIndex);
          
          // Find this track in current sorted data
          const currentIndex = audioData.findIndex(track => track.originalIndex === originalIndex);
          if (currentIndex === -1) return;
          
          // Skip the currently playing track - it has the main popup
          if (currentIndex === audioController.currentIndex) return;
          
          const track = audioData[currentIndex];
          if (!track) return;

          const coords = point.geometry.coordinates;
          const pixelCoords = map.project(coords);
          
          const infoBox = document.createElement('div');
          infoBox.className = 'mini-infobox';
          infoBox.dataset.trackIndex = currentIndex; // Store current playlist index
          
          const playIcon = document.createElement('div');
          playIcon.className = 'play-icon';
          
          const title = document.createElement('span');
          title.className = 'mini-infobox-title';
          title.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');
          
          // Make entire mini box clickable to play audio and show popup
          infoBox.addEventListener('click', (e) => {
            e.stopPropagation();
            mapController.playAudio(currentIndex);
          });
          
          infoBox.appendChild(playIcon);
          infoBox.appendChild(title);
          
          // Auto-size based on content
          document.body.appendChild(infoBox);
          const textWidth = title.scrollWidth;
          infoBox.style.maxWidth = Math.min(Math.max(textWidth + 50, 120), 250) + 'px';
          document.body.removeChild(infoBox);
          
          infoBox.style.left = `${pixelCoords.x + 10}px`;
          infoBox.style.top = `${pixelCoords.y - 20}px`;
          
          map.getContainer().appendChild(infoBox);
          this.miniInfoBoxes.push(infoBox);
        });
      }

      updateMiniInfoBoxPositions() {
        // Update positions of existing mini info boxes to follow their geographic points
        this.miniInfoBoxes.forEach(infoBox => {
          const trackIndex = parseInt(infoBox.dataset.trackIndex);
          const track = mapController.audioData[trackIndex];
          if (track) {
            const coords = [parseFloat(track.lng), parseFloat(track.lat)];
            const pixelCoords = map.project(coords);
            infoBox.style.left = `${pixelCoords.x + 10}px`;
            infoBox.style.top = `${pixelCoords.y - 20}px`;
          }
        });
      }

      clearMiniInfoBoxes() {
        this.miniInfoBoxes.forEach(box => {
          if (box.parentNode) {
            box.parentNode.removeChild(box);
          }
        });
        this.miniInfoBoxes = [];
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
