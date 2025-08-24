// UI Controller Class
    class UIController {
      constructor() {
        this.playlistExpanded = true;
        this.isFullscreen = false;
        this.is3DEnabled = false;
        this.isEnhancedLightingEnabled = false; // New enhanced lighting toggle
        this.miniInfoBoxes = [];
        this.clusterPlaylist = null;
        this.setupEventListeners();
      }

      setupEventListeners() {
        // Playlist toggle
        document.getElementById('playlistToggle').addEventListener('click', () => {
          this.togglePlaylist();
        });

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

        // New enhanced lighting toggle
        document.getElementById('enhancedLightingBtn').addEventListener('click', () => {
          this.toggleEnhancedLighting();
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
        scrollUp.addEventListener('click', () => playlist.scrollBy({ top: -100, behavior: 'smooth' }));
        scrollDown.addEventListener('click', () => playlist.scrollBy({ top: 100, behavior: 'smooth' }));

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
        btn.classList.toggle('active', this.is3DEnabled);

        if (this.is3DEnabled) {
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
          
          // Basic lighting for 3D
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
                const coords = [parseFloat(currentTrack.lng), parseFloat(currentTrack.lat)];
                map.flyTo({
                  center: coords,
                  zoom: CONFIG.ZOOM_3D,
                  pitch: 75,
                  bearing: 0,
                  duration: 2500,
                  easing: t => 1 - Math.pow(1 - t, 3)
                });
                
                // Apply atmospheric lighting if enhanced lighting is enabled
                if (this.isEnhancedLightingEnabled) {
                  atmosphereController.applyEnhancedLighting(currentTrack);
                }
              } else {
                map.flyTo({
                  pitch: 75,
                  zoom: Math.max(map.getZoom(), CONFIG.ZOOM_3D),
                  duration: 2000
                });
              }
            } else {
              map.flyTo({
                pitch: 75,
                zoom: Math.max(map.getZoom(), CONFIG.ZOOM_3D),
                duration: 2000
              });
            }
            showNotification('3D view enabled - Hold Ctrl + drag to rotate', 4000);
          };
          
          setTimeout(apply3DView, 300);
          
        } else {
          // Disable 3D
          map.setTerrain(null);
          if (typeof map.setLight === 'function') {
            map.setLight(null);
          }
          map.flyTo({
            pitch: 0,
            duration: 1500
          });
          
          // Clean up terrain source
          setTimeout(() => {
            if (map.getSource('mapbox-dem')) {
              map.removeSource('mapbox-dem');
            }
          }, 1600);
          
          showNotification('3D view disabled', 2000);
        }
      }

      // New enhanced lighting toggle
      toggleEnhancedLighting() {
        this.isEnhancedLightingEnabled = !this.isEnhancedLightingEnabled;
        const btn = document.getElementById('enhancedLightingBtn');
        btn.classList.toggle('active', this.isEnhancedLightingEnabled);

        if (this.isEnhancedLightingEnabled) {
          // Check device capabilities first
          if (!this.checkDeviceCapabilities()) {
            // Warn about potential performance impact
            const proceed = confirm('Enhanced Lighting uses advanced 3D effects that may impact performance on older devices. Continue?');
            if (!proceed) {
              this.isEnhancedLightingEnabled = false;
              btn.classList.remove('active');
              return;
            }
          }

          // Enable enhanced lighting
          if (this.is3DEnabled && audioController.currentIndex >= 0) {
            const currentTrack = mapController.audioData[audioController.currentIndex];
            if (currentTrack) {
              atmosphereController.applyEnhancedLighting(currentTrack);
            }
          }
          
          showNotification('Enhanced lighting enabled - Best experienced in 3D mode', 4000);
        } else {
          // Disable enhanced lighting - revert to basic
          if (this.is3DEnabled && typeof map.setLight === 'function') {
            map.setLight({
              'anchor': 'viewport',
              'color': 'white',
              'intensity': 0.5,
              'position': [1.15, 210, 30]
            });
          }
          
          showNotification('Enhanced lighting disabled', 2000);
        }
      }

      // Simple device capability check
      checkDeviceCapabilities() {
        // Basic heuristics for device performance
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) return false; // No WebGL support
        
        // Check for decent GPU
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          // Very basic check - this could be more sophisticated
          const isIntegratedGPU = renderer && (
            renderer.includes('Intel') || 
            renderer.includes('integrated') ||
            renderer.includes('Mobile')
          );
          
          // Assume non-integrated GPUs can handle enhanced lighting
          return !isIntegratedGPU;
        }
        
        // If we can't detect, assume it can handle it
        return true;
      }

      updateScrollArrows() {
        const playlist = document.getElementById('playlist');
        const scrollUp = document.getElementById('scrollUp');
        const scrollDown = document.getElementById('scrollDown');
        
        scrollUp.style.display = playlist.scrollTop > 0 ? 'block' : 'none';
        scrollDown.style.display = (playlist.scrollTop + playlist.clientHeight) < playlist.scrollHeight ? 'block' : 'none';
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
