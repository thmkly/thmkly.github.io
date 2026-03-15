// Map Controller Class
class MapController {
     constructor() {
       this.audioData = [];
       this.originalAudioData = [];
       this.currentPopup = null;
       this.minimizedPopup = null; // Store minimized orange mini box (State 2 for non-tight clusters)
       this.userPreferredPopupState = 'full'; // States: 'mini' (State 2), 'full' (State 3), 'full-with-notes' (State 4) - default State 3
       this.isPositioning = false;
       this.animationTimeout = null;
       this.moveTimeout = null;
       this.hasInitiallyLoaded = false;
       this.clusterPicker = null; // Store active cluster picker
       this.clusterPickerTracks = null; // Store track indices in current picker [index1, index2, ...]
       this.setupMap();
     }

      // Helper function to get display mile based on sort mode (UNCHANGED - your working version)
      getDisplayMile(track) {
        // Don't display mile if it's a placeholder (starts with ~)
        if (track.mile && track.mile.toString().startsWith('~')) {
          return null;
        }
        
        if (audioController.sortMode === 'sobo' && track.mile && track.mile.toString().trim().toLowerCase() !== 'n/a') {
          const nobobMile = parseFloat(track.mile);
          if (!isNaN(nobobMile)) {
            const soboMile = Math.round((2655.8 - nobobMile) * 10) / 10;
            return soboMile.toFixed(1);
          }
        }
        return track.mile;
      }

      // Helper function to get numeric mile value for sorting (handles ~ placeholders)
      getMileForSorting(track) {
        if (!track.mile || track.mile.toString().trim().toLowerCase() === 'n/a') {
          return null;
        }
        
        const mileStr = track.mile.toString();
        if (mileStr.startsWith('~')) {
          // Placeholder mile - remove ~ and parse
          return parseFloat(mileStr.substring(1));
        }
        
        return parseFloat(mileStr);
      }

      // Attaches real-time play/pause icon swapping to an icon element.
      // iconEl: the container div that holds the icon (triangle or bars)
      // audio: the HTMLAudioElement to listen to
      // isOrange: true for orange play icon color (minimized popup), false for #333
      // Returns a cleanup function to remove listeners.
      _attachPlayPauseIcon(iconEl, audio, isOrange = false) {
        const color = isOrange ? '#ff6b35' : '#333';

        const renderIcon = () => {
          // Guard: don't update if element is no longer in DOM
          if (!iconEl.isConnected) return;
          iconEl.innerHTML = '';
          if (audio.paused) {
            iconEl.style.cssText = `display:block;width:0;height:0;border-left:8px solid ${color};border-top:5px solid transparent;border-bottom:5px solid transparent;flex-shrink:0;cursor:pointer;`;
          } else {
            iconEl.style.cssText = 'display:inline-flex;align-items:center;gap:2px;flex-shrink:0;cursor:pointer;width:auto;height:auto;border:none;';
            const b1 = document.createElement('div');
            b1.style.cssText = `width:3px;height:10px;background:${color};border-radius:1px;`;
            const b2 = document.createElement('div');
            b2.style.cssText = `width:3px;height:10px;background:${color};border-radius:1px;`;
            iconEl.appendChild(b1);
            iconEl.appendChild(b2);
          }
        };

        audio.addEventListener('play', renderIcon);
        audio.addEventListener('pause', renderIcon);

        setTimeout(renderIcon, 50);

        return () => {
          audio.removeEventListener('play', renderIcon);
          audio.removeEventListener('pause', renderIcon);
        };
      }

      setupMap() {
        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
        
        window.map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/thmkly/clyup637d004201ri2tkpaywq',
          center: uiController.isMobile ? CONFIG.DEFAULT_CENTER_MOBILE : CONFIG.DEFAULT_CENTER,
          zoom: CONFIG.getDefaultZoom(),
          // Touch controls settings
          touchZoomRotate: true,
          touchPitch: false, // Keep pitch locked on mobile
          // Initially disable drag rotate (will be enabled in 3D mode on desktop)
          dragRotate: false
        });

        // Disable drag rotation initially
        map.on('load', () => {
          map.dragRotate.disable();
          
          // Check for API availability before using
          if (typeof map.setSky === 'function') {
            map.setSky({
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0, 90],
              'sky-atmosphere-sun-intensity': 15
            });
          }
          
          if (typeof map.setFog === 'function') {
            map.setFog({
              'range': [0.5, 10],
              'color': 'white',
              'high-color': '#87CEEB',
              'space-color': '#000033',
              'horizon-blend': 0.1,
              'star-intensity': 0
            });
          }
          
            this.setupMapLayers();
            this.setupMapEvents();
            this.loadAudioData();

            });
            }


      setupMapLayers() {
        map.addSource('audio', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 45
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'audio',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#51bbd6',
            'circle-opacity': 0.7,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#197991',
            'circle-stroke-opacity': 0.75,
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18, 3, 22, 5, 26, 6, 30, 7, 34, 8, 36,
              10, 38, 15, 40, 18, 42, 22, 44, 25, 46,
              30, 48, 35, 50, 40, 52, 50, 54, 100, 56
            ]
          }
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'audio',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12
          }
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'audio',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#5c3a2e',
            'circle-radius': 6,
            'circle-opacity': 0.6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
            'circle-stroke-opacity': 0.8
          }
        });
      }

      setupMapEvents() {
        ['clusters', 'unclustered-point'].forEach(layer => {
          map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
        });

        // Revert to original cluster logic - fit all points in view
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          if (!features.length) return;
          
          const clusterId = features[0].properties.cluster_id;
          const pointCount = features[0].properties.point_count;
          
          // For any cluster, check if all points are very close together (tight cluster)
          map.getSource('audio').getClusterLeaves(clusterId, pointCount, 0, (err, leaves) => {
            if (err) return;
            
            // Check if this is a tight cluster (all points within 50m of each other)
            let isTightCluster = true;
            const firstCoords = leaves[0].geometry.coordinates;
            
            for (let i = 1; i < leaves.length; i++) {
              const coords = leaves[i].geometry.coordinates;
              const distance = this.calculateDistance(firstCoords[1], firstCoords[0], coords[1], coords[0]);
              if (distance >= 50) {
                isTightCluster = false;
                break;
              }
            }
            
            // If tight cluster, show picker instead of breaking
            if (isTightCluster) {
              this.showClusterPicker(e.point, leaves, audioController.currentIndex);
              return;
            }
            
            // Otherwise, break cluster normally
            map.getSource('audio').getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              
              const bounds = new mapboxgl.LngLatBounds();
              leaves.forEach(leaf => bounds.extend(leaf.geometry.coordinates));
              
              const padding = uiController.isMobile ? 
                { top: 100, bottom: 120, left: 80, right: 80 } :
                { top: 80, bottom: 80, left: this.getLeftPadding() + 50, right: 100 };
              
              map.fitBounds(bounds, { 
                padding: padding,
                maxZoom: 17  // Higher zoom for tight clusters
              });
            });
          });
        });

          map.on('click', 'unclustered-point', (e) => {
            const feature = e.features[0];
            if (!feature) return;
            const originalIndex = parseInt(feature.properties.originalIndex);
            
            // Find this track in the current sorted playlist
            const currentIndex = this.audioData.findIndex(track => track.originalIndex === originalIndex);
            if (currentIndex !== -1) {
              // Close mobile menu if open
              if (uiController.isMobile && uiController.mobilePlaylistExpanded) {
                uiController.collapseMobileMenu();
              }
              this.playAudio(currentIndex, false, true);
            }
          });

        // Throttle mini box updates during map movement
        
        map.on('move', () => {
          // ALWAYS update positions during map move (including during flyTo) for smooth tracking
          uiController.updateMiniInfoBoxPositions();
          
          // Update custom popup position if it exists
          if (this.currentPopup && this.currentPopup.updatePosition) {
            this.currentPopup.updatePosition();
          }
          
          // Update minimized popup position if it exists
          if (this.minimizedPopup && this.minimizedPopup._updatePosition) {
            this.minimizedPopup._updatePosition();
          }
          
          // Update cluster picker position if it exists
          if (this.clusterPicker && this.clusterPicker._updatePosition) {
            this.clusterPicker._updatePosition();
          }
          
          // Update badge visibility as map moves (popup may move off-screen)
          this.updateBadgeVisibility();
        });
        
        // Re-apply atmosphere when page becomes visible (ONLY in 3D mode)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && uiController.is3DEnabled && typeof atmosphereController !== 'undefined' && atmosphereController.currentConditions) {
            // Re-apply the current atmosphere conditions
            atmosphereController.applyEnhancedSky(atmosphereController.currentConditions);
            atmosphereController.applyEnhancedFog(atmosphereController.currentConditions);
            atmosphereController.applyEnhanced3DEffects(atmosphereController.currentConditions);
            atmosphereController.applyFallbackAtmosphere(atmosphereController.currentConditions);
          }
        });

        map.on('moveend', () => {
          // Small delay to ensure points are fully rendered after cluster breaks
          setTimeout(() => {
            if (this.isPositioning) return; // Skip during playback positioning
            
            const visiblePoints = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
            const currentPointCount = visiblePoints.length;
            
            // Close picker only if zoomed out so far that its points are now clustered
            if (this.clusterPicker && this.clusterPickerTracks) {
              const allPickerPointsHidden = this.clusterPickerTracks.every(trackIndex => {
                const track = this.audioData[trackIndex];
                if (!track) return true;
                return !visiblePoints.some(p => parseInt(p.properties.originalIndex) === track.originalIndex);
              });
              
              if (allPickerPointsHidden) {
                if (this.clusterPicker._moveHandler) {
                  map.off('move', this.clusterPicker._moveHandler);
                }
                this.clusterPicker.remove();
                this.clusterPicker = null;
                this.clusterPickerTracks = null;
              }
            }
            
            const existingBoxCount = uiController.miniInfoBoxes.length;

            // Count visible points that should have white boxes
            // (exclude playing track with popup/minimized, preview popup track, cluster picker tracks)
            const expectedBoxCount = visiblePoints.filter(p => {
              const origIdx = parseInt(p.properties.originalIndex);
              const idx = this.audioData.findIndex(t => t.originalIndex === origIdx);
              if (idx === -1) return false;
              if (this.clusterPickerTracks && this.clusterPickerTracks.includes(idx)) return false;
              if (idx === audioController.currentIndex && (this.currentPopup || this.minimizedPopup)) return false;
              if (this.currentPopup && parseInt(this.currentPopup._container?.dataset?.trackIndex) === idx) return false;
              return true;
            }).length;
            
            if (currentPointCount === 0) {
              uiController.clearMiniInfoBoxes();
            } else if (currentPointCount >= 50) {
              uiController.clearMiniInfoBoxes();
            } else if (expectedBoxCount !== existingBoxCount) {
              uiController.clearMiniInfoBoxes();
              uiController.showMiniInfoBoxes(null, this.audioData);
            } else {
              uiController.updateMiniInfoBoxPositions();
            }
          }, 150); // Increased delay for rendering
        });

        document.addEventListener('fullscreenchange', () => {
          uiController.isFullscreen = !!document.fullscreenElement;
          const btn = document.getElementById('fullscreenBtn');
          if (btn) {
            btn.textContent = uiController.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
            btn.classList.toggle('active', uiController.isFullscreen);
          }
        });
      }

      getLeftPadding() {
        return uiController.playlistExpanded ? 370 : 20;
      }

        loadAudioData(retryCount = 0) {
          // Playlist wrapper is already hidden via CSS
          const playlistWrapper = document.getElementById('playlistWrapper');
          
          // Show persistent loading notification (no duration = stays visible)
          showNotification('loading recordings...');
          
          const url = `${CONFIG.GOOGLE_SCRIPT_URL}?nocache=${Date.now()}`;
          
          // Simple fetch without extra headers to avoid CORS preflight
          fetch(url)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.text();
            })
            .then(text => {
              try {
                const response = JSON.parse(text);
                
                // Handle new response format with data/metadata structure
                let data;
                if (response.data && Array.isArray(response.data)) {
                  // New format: {data: [...], metadata: {...}}
                  data = response.data;
                } else if (Array.isArray(response)) {
                  // Old format: [...]
                  data = response;
                } else {
                  throw new Error('Invalid response format');
                }
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.length === 0) {
                  throw new Error('No recordings found');
                }
                
                // Validate data structure without logging content
                if (data.length > 0) {
                  const firstItem = data[0];
                  const hasRequiredFields = firstItem.lat && firstItem.lng && firstItem.audioUrl;
                  if (!hasRequiredFields) {
                    console.warn('Data missing required fields');
                  }
                }
                
                // Add original index to each track for stable map references
                this.originalAudioData = data.map((track, index) => ({
                  ...track,
                  originalIndex: index
                }));
                
                // Set up data in NOBO order by default (Mexico at bottom, Canada at top)
                this.audioData = this.sortByMileAndDate([...this.originalAudioData], 'nobo');
                
                this.sortAndUpdatePlaylist();
                this.updateMapData();
                
                // Show playlist wrapper again with flex display
                playlistWrapper.style.display = 'flex';
                
                // Hide loading notification and show success message
                hideNotification();
                setTimeout(() => {
                  showNotification(`${data.length} recordings loaded`, 3000);
                }, 100);
                
              } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                throw new Error(`Invalid JSON response: ${parseError.message}`);
              }
            })
            .catch(e => {
              console.error('Load Error:', e);
              const errorMsg = e.message || 'Unknown error occurred';
              
              // Retry logic for intermittent failures
              if (retryCount < 3) {
                console.log(`Retrying... attempt ${retryCount + 1} of 3`);
                hideNotification();
                setTimeout(() => {
                  showNotification(`Connection issue, retrying... (${retryCount + 1}/3)`);
                  setTimeout(() => {
                    this.loadAudioData(retryCount + 1);
                  }, 2000);
                }, 100);
              } else {
                // Hide loading notification and show error after max retries
                hideNotification();
                setTimeout(() => {
                  this.showLoadingError(`Failed to load recordings after 3 attempts: ${errorMsg}`);
                  showNotification(`Error: ${errorMsg}`, 5000);
                }, 100);
              }
            });
        }

      showLoadingError(message) {
        const playlist = document.getElementById('playlist');
        playlist.innerHTML = `
          <div class="loading-placeholder">
            <div style="color: #cc0000; margin-bottom: 10px;">${message}</div>
            <button onclick="location.reload()" style="
              padding: 8px 16px;
              background: #5c3a2e;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Reload Page</button>
          </div>
        `;
        // Also make sure playlist wrapper is visible in case of error
        const playlistWrapper = document.getElementById('playlistWrapper');
        playlistWrapper.style.display = 'flex';
      }

      sortAndUpdatePlaylist() {
        // Remember currently playing track
        const currentlyPlayingTrack = audioController.currentIndex >= 0 ? 
          this.audioData[audioController.currentIndex] : null;
        
        // Always re-sort based on current mode to ensure correct ordering
        if (audioController.sortMode === 'date') {
          // STEREO: Chronological order (earliest to latest)
          this.audioData = this.sortByMileAndDate([...this.originalAudioData], 'date');
        } else if (audioController.sortMode === 'sobo') {
          // SOBO: Canada to Mexico order
          this.audioData = this.sortByMileAndDate([...this.originalAudioData], 'sobo');
        } else {
          // NOBO: Mexico to Canada order  
          this.audioData = this.sortByMileAndDate([...this.originalAudioData], 'nobo');
        }
        
        // Update current index to match new order
        if (currentlyPlayingTrack) {
          audioController.currentIndex = this.audioData.findIndex(track => 
            track.originalIndex === currentlyPlayingTrack.originalIndex
          );
        }
        
        // Update playlist display
        this.updatePlaylistOnly();
        
        // Restore the active track highlighting after playlist update
        if (currentlyPlayingTrack) {
          this.updateActiveTrack(audioController.currentIndex);
        }
        
        // Set scroll position based on sort mode
        this.setPlaylistScrollPosition();
        
        // Update popup if one is open to show correct mileage
        if (this.currentPopup && currentlyPlayingTrack) {
          this.refreshPopupMileage(currentlyPlayingTrack);
        }
      }

      sortByMileAndDate(data, mode = 'nobo') {
        if (mode === 'date') {
          // STEREO mode: sort everything by timestamp (earliest to latest)
          return [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
        
        // For NOBO/SOBO: purely spatial sorting by mile
        const tracksWithMiles = data.filter(track => {
          const mile = this.getMileForSorting(track);
          return mile !== null && !isNaN(mile);
        });
        
        const tracksWithoutMiles = data.filter(track => {
          const mile = this.getMileForSorting(track);
          return mile === null || isNaN(mile);
        });

        // Sort tracks with miles by mile number (ascending: 0 → 2655.8)
        tracksWithMiles.sort((a, b) => {
          const mileA = this.getMileForSorting(a);
          const mileB = this.getMileForSorting(b);
          if (Math.abs(mileA - mileB) < 0.01) { // Same mile (accounting for decimals)
            // If same mile, sort by timestamp
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return mileA - mileB; // Always ascending by mile
        });

        // Apply different ordering for playlist display based on mode
        if (mode === 'sobo') {
          // SOBO: reverse so Canada (high miles) appears at top
          // This gives us: Canada at top (index 0), Mexico at bottom (last index)
          tracksWithMiles.reverse();
        }
        // NOBO: keep natural order so Mexico (low miles) appears at top
        // This gives us: Mexico at top (index 0), Canada at bottom (last index)

        // Sort tracks without miles by timestamp
        tracksWithoutMiles.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Combine: mile-sorted tracks first, then timestamp-sorted tracks without miles
        return [...tracksWithMiles, ...tracksWithoutMiles];
      }

      updateMapData() {
        const source = map.getSource('audio');
        if (!source) return;
        
        // Use original data for map - points stay static regardless of sort order
        const geojson = {
          type: 'FeatureCollection',
          features: this.originalAudioData.map((track, index) => ({
            type: 'Feature',
            geometry: { 
              type: 'Point', 
              coordinates: [parseFloat(track.lng), parseFloat(track.lat)] 
            },
            properties: { 
              ...track, 
              originalIndex: index, // Use original index for stable reference
              mile: track.mile || 'N/A'
            }
          }))
        };
        
        source.setData(geojson);
      }

      updatePlaylistOnly() {
        const playlist = document.getElementById('playlist');
        playlist.innerHTML = '';
        
        this.audioData.forEach((track, index) => {
          const div = document.createElement('div');
          div.className = 'track';
          div.dataset.id = index;
          
          const trackInfo = document.createElement('div');
          trackInfo.className = 'track-info';
          trackInfo.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');
          
          const trackMile = document.createElement('div');
          trackMile.className = 'track-mile';
          const displayMile = this.getDisplayMile(track);
          const mile = displayMile !== null && displayMile.toString().trim().toLowerCase() !== 'n/a' ? `mi.${displayMile}` : '';
          trackMile.textContent = mile;
          
          div.appendChild(trackInfo);
          div.appendChild(trackMile);
          
          div.addEventListener('click', (e) => {
            // If clicking the currently playing track, toggle pause/play
            if (index === audioController.currentIndex && audioController.currentAudio) {
              if (audioController.currentAudio.paused) {
                audioController.currentAudio.play();
              } else {
                audioController.currentAudio.pause();
              }
              return; // Don't restart the track
            }
            
            // Collapse mobile menu when track is clicked
            if (uiController.isMobile && uiController.mobilePlaylistExpanded) {
              uiController.collapseMobileMenu();
            }
            this.playAudio(index, false, false);
          });
          
          playlist.appendChild(div);
        });
        
        // Show collapse arrow now that playlist is rendered
        const toggleBtn = document.getElementById('playlistToggle');
        if (toggleBtn) {
          toggleBtn.classList.add('visible');
          // Ensure correct arrow direction
          if (uiController && uiController.playlistExpanded) {
            toggleBtn.textContent = '◀';
          } else {
            toggleBtn.textContent = '▶';
          }
        }
        
        // Update scroll arrows after playlist is populated
        if (uiController) {
          setTimeout(() => uiController.updateScrollArrows(), 100);
        }
        
        // Force scroll position update on initial load
        if (audioController.currentIndex === -1) {
          setTimeout(() => {
            this.setPlaylistScrollPosition();
          }, 150);
        }
      }

        setPlaylistScrollPosition() {
          // Only scroll to top on initial load, not when resetting
          // This method is called from sortAndUpdatePlaylist which happens during initial load
          const playlist = document.getElementById('playlist');
          
          if (audioController.currentIndex === -1 && this.audioData.length > 0 && !this.hasInitiallyLoaded) {
            setTimeout(() => {
              playlist.scrollTop = 0; // Start at top on first load only
              this.hasInitiallyLoaded = true;
            }, 100);
          }
        }

     playAudio(index, fromAutoPlay = false, fromMap = false) {
       const track = this.audioData[index];
       if (!track) {
         console.error('No track found at index:', index);
         return;
       }

      // FORCE CANCEL ALL IN-PROGRESS OPERATIONS
      // Clear any pending timeouts
      if (this.animationTimeout) {
        clearTimeout(this.animationTimeout);
        this.animationTimeout = null;
      }
      if (this.moveTimeout) {
        clearTimeout(this.moveTimeout);
        this.moveTimeout = null;
      }
      
      // Force reset positioning flag to allow new movement
      this.isPositioning = false;
      
      // Stop any in-progress map animation
      map.stop();

        // Use user's preferred popup state (defaults to 'full' on first play)
        const shouldMinimize = this.userPreferredPopupState === 'mini';

        // Clean up any minimized popup
        if (this.minimizedPopup) {
          if (this.minimizedPopup._cleanupIcon) this.minimizedPopup._cleanupIcon();
          if (this.minimizedPopup._updatePosition) map.off('move', this.minimizedPopup._updatePosition);
          this.minimizedPopup.remove();
          this.minimizedPopup = null;
        }

       // Add small delay to let DOM settle before checking visibility
        setTimeout(() => {
          // Update active track, only scroll playlist if from auto-play and track not visible
          if (fromAutoPlay) {
            // Check if track is visible in playlist
            const trackElement = document.querySelector(`.track[data-id="${index}"]`);
            const playlist = document.getElementById('playlist');
            if (trackElement && playlist) {
              const trackRect = trackElement.getBoundingClientRect();
              const playlistRect = playlist.getBoundingClientRect();
              const isVisible = trackRect.top >= playlistRect.top && trackRect.bottom <= playlistRect.bottom;
              this.updateActiveTrack(index, !isVisible, audio); // Only scroll if not visible
            } else {
              this.updateActiveTrack(index, true, audio); // Scroll if can't determine visibility
            }
          } else {
            // For manual clicks: scroll if from map click AND track not visible
            let shouldScroll = false;
            if (fromMap) {
              const trackElement = document.querySelector(`.track[data-id="${index}"]`);
              const playlist = document.getElementById('playlist');
              if (trackElement && playlist) {
                const trackRect = trackElement.getBoundingClientRect();
                const playlistRect = playlist.getBoundingClientRect();
                const isVisible = trackRect.top >= playlistRect.top && trackRect.bottom <= playlistRect.bottom;
                shouldScroll = !isVisible;
              } else {
                shouldScroll = true;
              }
            }
            this.updateActiveTrack(index, shouldScroll, audio);
          }
        }, 50);  // 50ms delay - just enough for DOM to settle

        // Save old track index BEFORE audioController.play changes it
        const oldTrackIndex = audioController.currentIndex;

        const audio = audioController.play(index, this.audioData);

          // Always update badge when audio plays (visibility is controlled inside updateHeaderBadge)
          this.updateHeaderBadge(track, audio);
        
        // If currently in State 3/4 (popup showing), collapse to State 1 (mini box) before flyTo
        // This gives clean visual transition without clearing OTHER mini boxes
        if (this.currentPopup && oldTrackIndex >= 0) {
          const currentTrack = this.audioData[oldTrackIndex];
          if (currentTrack) {
            // Collapse current popup to mini box
            this.currentPopup.remove();
            this.currentPopup = null;
            
            // Create mini box for the track we're leaving (OLD track) using shared structure
            const coords = [parseFloat(currentTrack.lng), parseFloat(currentTrack.lat)];
            const pixelCoords = map.project(coords);
            const mapRect = map.getContainer().getBoundingClientRect();

            const miniBox = uiController._createMiniInfoBox(currentTrack, oldTrackIndex, {
              onPillClick: () => mapController.playAudio(oldTrackIndex, false, true),
              onBodyClick: () => {
                if (miniBox.parentNode) miniBox.parentNode.removeChild(miniBox);
                uiController.miniInfoBoxes = uiController.miniInfoBoxes.filter(b => b !== miniBox);
                const trackCoords = [parseFloat(currentTrack.lng), parseFloat(currentTrack.lat)];
                mapController.showPopup(trackCoords, currentTrack, audioController.currentAudio, oldTrackIndex, false, true);
              },
              isPlaying: false,
              audio: null
            });

            miniBox.style.position = 'absolute';
            miniBox.style.left = `${pixelCoords.x + 10}px`;
            miniBox.style.top  = `${pixelCoords.y - 20}px`;

            document.body.appendChild(miniBox);

            // Remove any existing mini box for this track before adding new one
            const stale = uiController.miniInfoBoxes.find(b => parseInt(b.dataset.trackIndex) === oldTrackIndex);
            if (stale) {
              stale.remove();
              uiController.miniInfoBoxes = uiController.miniInfoBoxes.filter(b => b !== stale);
            }

            // Add to mini boxes array so it gets updated during map movement
            uiController.miniInfoBoxes.push(miniBox);
          }
        }
        
        // Clean up picker if it exists
        if (this.clusterPicker) {
          if (this.clusterPicker._moveHandler) {
            map.off('move', this.clusterPicker._moveHandler);
          }
          this.clusterPicker.remove();
          this.clusterPicker = null;
          this.clusterPickerTracks = null;
        }
        
          // Add delay before positioning to prevent conflicts
        this.animationTimeout = setTimeout(() => {
          this.positionMapForTrack(track, index, fromAutoPlay);
          
          // Get the flyto duration and delay popup creation until after it completes
          const duration = this.getMovementDuration(track);
          
          // Apply atmospheric lighting DURING flyTo (ONLY in 3D mode)
          // Start halfway through flyTo for smooth, gradual transition
          setTimeout(() => {
            if (uiController.is3DEnabled && typeof atmosphereController !== 'undefined') {
              const conditions = atmosphereController.getAtmosphericConditions(track);
              atmosphereController.currentConditions = conditions;
              
              // Apply sky and fog changes gradually
              atmosphereController.applyEnhancedSky(conditions);
              atmosphereController.applyEnhancedFog(conditions);
              atmosphereController.applyEnhanced3DEffects(conditions);
              atmosphereController.applyFallbackAtmosphere(conditions);
            }
          }, duration / 2); // Start halfway through flyTo
          
          // Show popup and mini boxes after flyto completes
          setTimeout(() => {
            const coords = [parseFloat(track.lng), parseFloat(track.lat)];
            
            // Check if track is in existing picker
            const isInPicker = this.clusterPickerTracks && this.clusterPickerTracks.includes(index);
            
            if (isInPicker) {
              // Track is in picker - just update highlight, don't create new UI
              this.updateClusterPickerHighlight(index);
              // Don't clear mini boxes - they should stay visible
              this.updateBadgeVisibility();
            } else {
              // Remove the mini box for THIS track before creating popup (prevents duplicates)
              const existingMiniBox = uiController.miniInfoBoxes.find(box => 
                parseInt(box.dataset.trackIndex) === index
              );
              if (existingMiniBox) {
                existingMiniBox.remove();
                uiController.miniInfoBoxes = uiController.miniInfoBoxes.filter(box => box !== existingMiniBox);
              }
              
              // Check if in tight cluster (any size)
              const nearbyTrackIndices = this.getTracksInTightCluster(index);
              
              if (nearbyTrackIndices.length > 0 && shouldMinimize) {
                // State 2: Show picker with all tracks in tight cluster
                const leaves = [
                  { 
                    geometry: { coordinates: coords },
                    properties: { originalIndex: track.originalIndex }
                  },
                  ...nearbyTrackIndices.map(nearbyIndex => {
                    const nearbyTrack = this.audioData[nearbyIndex];
                    return {
                      geometry: { coordinates: [parseFloat(nearbyTrack.lng), parseFloat(nearbyTrack.lat)] },
                      properties: { originalIndex: nearbyTrack.originalIndex }
                    };
                  })
                ];
                this.showClusterPicker({ x: 0, y: 0 }, leaves, index);
                uiController.showMiniInfoBoxes(null, this.audioData);
                this.updateBadgeVisibility();
              } else {
                // State 3/4 or no tight cluster: Show normal popup
                this.showPopup(coords, track, audio, index, shouldMinimize);
                uiController.showMiniInfoBoxes(null, this.audioData);
                this.updateBadgeVisibility();
              }
            }
          }, duration + 200); // 200ms additional delay after flyto completes
        }, 100);
      }

        minimizePopup(track, index) {
          // User explicitly minimized - save this preference
          this.userPreferredPopupState = 'mini';

          const wasPreview = this.currentPopup?._preview === true;

          // Remove the popup
          if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
          }

          // Hide the audio element
          if (audioController.currentAudio) {
            audioController.currentAudio.style.display = 'none';
          }

          // Preview popup: just redraw mini boxes naturally, no minimized state needed
          if (wasPreview) {
            uiController.showMiniInfoBoxes(null, this.audioData);
            return;
          }
          
          const coords = [parseFloat(track.lng), parseFloat(track.lat)];
          
          // Check if in tight cluster - if so, show picker instead of mini box
          const nearbyTrackIndices = this.getTracksInTightCluster(index);
          
          if (nearbyTrackIndices.length > 0) {
            // Show picker for tight cluster with all nearby tracks
            const leaves = [
              { 
                geometry: { coordinates: coords },
                properties: { originalIndex: track.originalIndex }
              },
              ...nearbyTrackIndices.map(nearbyIndex => {
                const nearbyTrack = this.audioData[nearbyIndex];
                return {
                  geometry: { coordinates: [parseFloat(nearbyTrack.lng), parseFloat(nearbyTrack.lat)] },
                  properties: { originalIndex: nearbyTrack.originalIndex }
                };
              })
            ];
            this.showClusterPicker({ x: 0, y: 0 }, leaves, index);
            uiController.showMiniInfoBoxes(null, this.audioData);
            return; // Don't create regular mini box
          }
          
          // Not in tight cluster - use _createMiniInfoBox for consistent structure
          const pixelCoords = map.project(coords);
          const audio = audioController.currentAudio;
          const isActiveTrack = audioController.currentIndex === index;

          const miniBox = uiController._createMiniInfoBox(track, index, {
            onPillClick: () => {
              if (audio) audio.paused ? audio.play() : audio.pause();
            },
            onBodyClick: () => {
              if (miniBox._cleanupIcon) miniBox._cleanupIcon();
              if (miniBox._updatePosition) map.off('move', miniBox._updatePosition);
              miniBox.remove();
              this.minimizedPopup = null;
              this.userPreferredPopupState = 'full';
              this.showPopup(coords, track, audioController.currentAudio, index);
              setTimeout(() => {
                this.updateHeaderBadge(audioController.currentIndex >= 0 ? this.audioData[audioController.currentIndex] : null);
              }, 50);
            },
            isPlaying: isActiveTrack,
            audio: isActiveTrack ? audio : null
          });

          // Only apply orange state if this is the active track
          if (isActiveTrack) {
            miniBox.classList.add('minimized-popup');
          }

          miniBox.style.position = 'absolute';
          miniBox.style.left = `${pixelCoords.x + 10}px`;
          miniBox.style.top  = `${pixelCoords.y - 20}px`;

          document.body.appendChild(miniBox);
          this.minimizedPopup = miniBox;

          // Update position when map moves
          const updatePosition = () => {
            const newPx = map.project(coords);
            miniBox.style.left = `${newPx.x + 10}px`;
            miniBox.style.top  = `${newPx.y - 20}px`;
          };
          map.on('move', updatePosition);
          miniBox._updatePosition = updatePosition;

        // Add header badge only if playlist is collapsed
          this.updateHeaderBadge(track);
        }
        
        // New helper method - add this RIGHT AFTER minimizePopup() closes
              updateHeaderBadge(track, audio = null) {
        // Remove existing badge and clean up listeners
        const existingBadge = document.getElementById('playing-badge');
        if (existingBadge) {
          if (existingBadge._cleanupBadgeIcon) existingBadge._cleanupBadgeIcon();
          if (existingBadge._updateTimeHandler && existingBadge._audioElement) {
            existingBadge._audioElement.removeEventListener('timeupdate', existingBadge._updateTimeHandler);
            existingBadge._audioElement.removeEventListener('play', existingBadge._updateTimeHandler);
          }
          existingBadge.remove();
        }
          
        if (track) {
          const badge = document.createElement('div');
          badge.id = 'playing-badge';
          badge.title = 'Return to sound';

          // Pill — play/pause
          const pill = document.createElement('div');
          pill.className = 'badge-pill';

          const triangle = document.createElement('span');
          triangle.className = 'badge-triangle';
          pill.appendChild(triangle);

          const audioEl = audio || audioController.currentAudio;
          if (audioEl) {
            const cleanupBadgeIcon = this._attachPlayPauseIcon(triangle, audioEl, false);
            badge._cleanupBadgeIcon = cleanupBadgeIcon;
          }

          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const a = audioController.currentAudio;
            if (a) a.paused ? a.play() : a.pause();
          });

          // Body — title + time, click flies to track
          const body = document.createElement('div');
          body.className = 'badge-body';

          const titleSpan = document.createElement('span');
          titleSpan.className = 'badge-title';
          titleSpan.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');

          const timeSpan = document.createElement('span');
          timeSpan.className = 'badge-time';
          timeSpan.textContent = '0:00';

          body.appendChild(titleSpan);
          body.appendChild(timeSpan);

          body.addEventListener('click', () => {
            const coords = [parseFloat(track.lng), parseFloat(track.lat)];
            const trackIndex = audioController.currentIndex;
            uiController.clearMiniInfoBoxes();
            this.positionMapForTrack(track, trackIndex);
            const movementDuration = this.getMovementDuration(track);
            setTimeout(() => {
              const a = audioController.currentAudio;
              const shouldMinimize = this.userPreferredPopupState === 'mini';
              const nearbyTrackIndices = this.getTracksInTightCluster(trackIndex);
              if (nearbyTrackIndices.length > 0 && shouldMinimize) {
                const leaves = [
                  { geometry: { coordinates: coords }, properties: { originalIndex: track.originalIndex } },
                  ...nearbyTrackIndices.map(nearbyIndex => {
                    const t = this.audioData[nearbyIndex];
                    return { geometry: { coordinates: [parseFloat(t.lng), parseFloat(t.lat)] }, properties: { originalIndex: t.originalIndex } };
                  })
                ];
                this.showClusterPicker({ x: 0, y: 0 }, leaves, trackIndex);
              } else {
                this.showPopup(coords, track, a, trackIndex, shouldMinimize);
              }
              const visiblePoints = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
              if (visiblePoints.length > 0 && visiblePoints.length < 50) {
                uiController.showMiniInfoBoxes(null, this.audioData);
              }
            }, movementDuration + 100);
          });

          badge.appendChild(pill);
          badge.appendChild(body);

          document.body.appendChild(badge);

          const audioForTime = audio || audioController.currentAudio;
          if (audioForTime) {
            const updateBadgeTime = () => {
              const cur = Math.floor(audioForTime.currentTime);
              const dur = Math.floor(audioForTime.duration) || 0;
              const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
              timeSpan.textContent = `${fmt(cur)} / ${fmt(dur)}`;
            };
            audioForTime.addEventListener('timeupdate', updateBadgeTime);
            audioForTime.addEventListener('play', updateBadgeTime);
            audioForTime.addEventListener('loadedmetadata', updateBadgeTime);
            updateBadgeTime();
            badge._updateTimeHandler = updateBadgeTime;
            badge._audioElement = audioForTime;
          }
            
          this.updateBadgeVisibility();
        }
      }

      updateActiveTrack(index, shouldScrollPlaylist = false, audio = null) {
          document.querySelectorAll('.track').forEach(el => el.classList.remove('active-track'));
          const activeTrack = document.querySelector(`.track[data-id="${index}"]`);
          if (activeTrack) {
            activeTrack.classList.add('active-track');
            
            // Enhanced styling for active track
            activeTrack.style.backgroundColor = 'rgba(255, 235, 220, 0.5)'; // Warm beige
            activeTrack.style.fontWeight = '600'; // Bold
            
          // Add play/pause indicator if not already there
          const trackInfo = activeTrack.querySelector('.track-info');
          if (trackInfo && !trackInfo.querySelector('.play-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'play-indicator';
            indicator.style.cssText = 'display:inline-flex;align-items:center;margin-right:6px;flex-shrink:0;';

            // Inner element for the icon — _attachPlayPauseIcon sets cssText on this
            // so the container's margin-right is never overwritten
            const iconEl = document.createElement('span');
            indicator.appendChild(iconEl);
            trackInfo.insertBefore(indicator, trackInfo.firstChild);

            // Wire real-time play/pause
            const audioEl = audio || audioController.currentAudio;
            if (audioEl) {
              const cleanup = this._attachPlayPauseIcon(iconEl, audioEl, false);
              indicator._cleanupIcon = cleanup;
            }
          }
            
            // Only scroll if explicitly requested (for auto-play next)
            if (shouldScrollPlaylist) {
              // Safari-specific scrollIntoView fix
              if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
                const playlist = document.getElementById('playlist');
                const trackRect = activeTrack.getBoundingClientRect();
                const playlistRect = playlist.getBoundingClientRect();
                const scrollTop = playlist.scrollTop + trackRect.top - playlistRect.top - (playlistRect.height / 2) + (trackRect.height / 2);
                playlist.scrollTo({
                  top: scrollTop,
                  behavior: 'smooth'
                });
              } else {
                activeTrack.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center',
                  inline: 'nearest'
                });
              }
            }
          }
          
          document.querySelectorAll('.track:not(.active-track)').forEach(el => {
            el.style.backgroundColor = '';
            el.style.fontWeight = '';
            const trackInfo = el.querySelector('.track-info');
            const indicator = trackInfo?.querySelector('.play-indicator');
            if (indicator) {
              if (indicator._cleanupIcon) indicator._cleanupIcon();
              indicator.remove();
            }
          });
         }

      positionMapForTrack(track, index, fromAutoPlay = false) {
        if (this.isPositioning) return;
        this.isPositioning = true;

        const coords = [parseFloat(track.lng), parseFloat(track.lat)];
        
        const resetPositioning = () => {
          this.isPositioning = false;
        };

        const duration = this.getMovementDuration(track);

        // Smooth easing with pronounced landing deceleration
        const smoothLandingEasing = (t) => {
          if (t < 0.3) {
            // Gentle acceleration (30% of time)
            return 2 * t * t;
          } else if (t < 0.7) {
            // Steady cruise (40% of time)
            const localT = (t - 0.3) / 0.4;
            return 0.18 + 0.64 * localT; // Linear middle section
          } else {
            // Slow landing approach (30% of time)
            const localT = (t - 0.7) / 0.3;
            return 0.82 + 0.18 * (1 - Math.pow(1 - localT, 3));
          }
        };

        // Check if we're in 3D mode
        const is3D = uiController.is3DEnabled;
        const targetZoom = is3D ? CONFIG.ZOOM_3D : CONFIG.ZOOM_2D;
        const currentZoom = map.getZoom();
        
        // Zoom logic:
        // - For autoplay: Use at least zoom 15 to ensure clusters break (clusterMaxZoom is 14)
        // - For manual clicks: Only zoom if currently zoomed out (don't zoom out if already close)
        let useZoom;
        if (fromAutoPlay) {
          useZoom = Math.max(targetZoom, 15); // Ensure clusters break
        } else {
          useZoom = currentZoom < targetZoom ? targetZoom : currentZoom;
        }

        const flyToOptions = {
          center: coords,
          zoom: useZoom,
          duration,
          easing: smoothLandingEasing
        };
        
        // Add 3D properties for smoother rainbow arc
        if (is3D) {
          flyToOptions.pitch = 82; // More immersive angle
          flyToOptions.bearing = map.getBearing();
          // Higher curve for ultra-smooth rainbow effect in 3D
          flyToOptions.curve = 2.5; // Even higher curve = smoother, more elevated arc
        }
        
        map.flyTo(flyToOptions);
        setTimeout(resetPositioning, duration + 200);
      }

      calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3;
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
      }
      
      // Check if track is in a tight cluster - returns array of nearby track indices (or empty array)
      getTracksInTightCluster(trackIndex) {
        const track = this.audioData[trackIndex];
        if (!track) return [];
        
        const trackLat = parseFloat(track.lat);
        const trackLng = parseFloat(track.lng);
        
        // Find all tracks within 50m
        const nearbyTracks = [];
        
        this.audioData.forEach((otherTrack, otherIndex) => {
          if (otherIndex === trackIndex) return;
          
          const otherLat = parseFloat(otherTrack.lat);
          const otherLng = parseFloat(otherTrack.lng);
          const distance = this.calculateDistance(trackLat, trackLng, otherLat, otherLng);
          
          if (distance < 50) {
            nearbyTracks.push(otherIndex);
          }
        });
        
        return nearbyTracks;
      }

      updateClusterPickerHighlight(playingIndex) {
        if (!this.clusterPicker) return;
        this.clusterPicker.querySelectorAll('[data-track-index]').forEach(box => {
          const isPlaying = parseInt(box.dataset.trackIndex) === playingIndex;
          box.dataset.isPlaying = isPlaying ? 'true' : 'false';
          box.classList.toggle('playing', isPlaying);
        });
      }

      showClusterPicker(clickPoint, leaves, playingTrackIndex = null) {
        if (this.clusterPicker) {
          if (this.clusterPicker._moveHandler) map.off('move', this.clusterPicker._moveHandler);
          this.clusterPicker.remove();
          this.clusterPicker = null;
        }
        
        const coords = leaves[0].geometry.coordinates;
        
        this.clusterPickerTracks = leaves.map(leaf => {
          const originalIndex = parseInt(leaf.properties.originalIndex);
          return this.audioData.findIndex(t => t.originalIndex === originalIndex);
        });
        
        const picker = document.createElement('div');
        picker.id = 'cluster-picker';
        picker.style.cssText = 'position:absolute;z-index:1000;display:flex;flex-direction:column;';
        
        const updatePickerPosition = () => {
          const px = map.project(coords);
          picker.style.left = `${px.x + 10}px`;
          picker.style.top  = `${px.y - 20}px`;
        };
        updatePickerPosition();
        picker._updatePosition = updatePickerPosition;
        picker._coords = coords;
        
        // Sort leaves numerically by trailing number in track name
        const sortedLeaves = [...leaves].sort((a, b) => {
          const getNum = (leaf) => {
            const t = this.audioData.find(t => t.originalIndex === parseInt(leaf.properties.originalIndex));
            const m = t?.name.match(/(\d+)$/);
            return m ? parseInt(m[1]) : 0;
          };
          return getNum(a) - getNum(b);
        });
        
        sortedLeaves.forEach((leaf) => {
          const originalIndex = parseInt(leaf.properties.originalIndex);
          const track = this.audioData.find(t => t.originalIndex === originalIndex);
          if (!track) return;
          
          const currentIndex = this.audioData.findIndex(t => t.originalIndex === originalIndex);
          const isPlaying = playingTrackIndex !== null && currentIndex === playingTrackIndex;
          
          const box = document.createElement('div');
          box.className = 'cluster-box' + (isPlaying ? ' playing' : '');
          box.dataset.trackIndex = currentIndex;
          box.dataset.isPlaying = isPlaying ? 'true' : 'false';

          const playIcon = document.createElement('div');
          playIcon.className = 'cluster-play-icon';
          box.appendChild(playIcon);
          
          const trackName = document.createElement('span');
          trackName.className = 'cluster-box-name';
          trackName.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');
          box.appendChild(trackName);
          
          box.addEventListener('click', () => {
            if (currentIndex < 0) return;
            if (box.dataset.isPlaying === 'true') {
              if (this.clusterPicker._moveHandler) map.off('move', this.clusterPicker._moveHandler);
              this.clusterPicker.remove();
              this.clusterPicker = null;
              this.clusterPickerTracks = null;
              const trackCoords = [parseFloat(track.lng), parseFloat(track.lat)];
              this.showPopup(trackCoords, track, audioController.currentAudio, currentIndex, false);
              if (this.userPreferredPopupState === 'mini') this.userPreferredPopupState = 'full';
              this.updateBadgeVisibility();
            } else {
              this.playAudio(currentIndex, false, true);
            }
          });
          
          picker.appendChild(box);
        });
        
        const moveHandler = () => { if (picker.parentNode) updatePickerPosition(); };
        map.on('move', moveHandler);
        picker._moveHandler = moveHandler;
        
        this.clusterPicker = picker;
        document.body.appendChild(picker);
        this.updateBadgeVisibility();
      }

          showPopup(coords, track, audio, index, shouldMinimize = false, preview = false) {
            // Block if no audio playing, UNLESS it's a preview (chevron click on white box)
            if (audioController.currentIndex === -1 && !preview) return;
              
            if (this.currentPopup) {
              this.currentPopup.remove();
              this.currentPopup = null;
            }

            // Clean up any existing mini box for this track
            const existingBox = uiController.miniInfoBoxes.find(b => parseInt(b.dataset.trackIndex) === index);
            if (existingBox) {
              if (existingBox._chevron && existingBox._chevron.parentNode) existingBox._chevron.parentNode.removeChild(existingBox._chevron);
              if (existingBox.parentNode) existingBox.parentNode.removeChild(existingBox);
              uiController.miniInfoBoxes = uiController.miniInfoBoxes.filter(b => b !== existingBox);
            }
        
            const container = document.createElement('div');
            container.className = 'custom-popup';
            container.style.position = 'absolute';
            container.style.width = '320px';
            container.style.zIndex = '10';
            container._coords = coords;
            container.dataset.trackIndex = index;
        
            // Minimize button — styled via .popup-minimize CSS class
            const minimizeBtn = document.createElement('button');
            minimizeBtn.className = 'popup-minimize';
            minimizeBtn.innerHTML = '−';
            minimizeBtn.title = 'Minimize';
            minimizeBtn.type = 'button';
            minimizeBtn.tabIndex = -1;
            minimizeBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.minimizePopup(track, index);
            });
            container.appendChild(minimizeBtn);
        
            // Title
            const title = document.createElement('h3');
            title.className = 'popup-title';
            title.textContent = track.name;
            container.appendChild(title);
        
            // Meta line: timestamp · mile · elevation · section
            const metaLine = document.createElement('div');
            metaLine.className = 'popup-meta';
            let metaText = this.formatTimestamp(track.timestamp);
            if (track.mile && track.mile.toString().trim().toLowerCase() !== 'n/a') {
              const displayMile = this.getDisplayMile(track);
              if (displayMile !== null) metaText += ` • mi.${displayMile}`;
            }
            if (track.elevation) metaText += ` • ${track.elevation} ft`;
            if (track.section)   metaText += ` • ${track.section}`;
            metaLine.textContent = metaText;
            container.appendChild(metaLine);
        
            // Notes (collapsible)
            if (track.notes?.trim()) {
              const notesContent = document.createElement('div');
              notesContent.className = 'popup-notes-content';
              notesContent.textContent = track.notes;

              const notesToggle = document.createElement('button');
              notesToggle.className = 'popup-notes-toggle';

              let notesExpanded = this.userPreferredPopupState === 'full-with-notes';
              if (notesExpanded) {
                notesContent.classList.add('expanded');
                notesToggle.textContent = 'Collapse field notes';
              } else {
                notesToggle.textContent = 'Field notes';
              }
            
              notesToggle.addEventListener('click', () => {
                notesExpanded = !notesExpanded;
                this.userPreferredPopupState = notesExpanded ? 'full-with-notes' : 'full';
                const currentBottom = parseInt(container.style.top) + container.offsetHeight;
                notesContent.classList.toggle('expanded', notesExpanded);
                notesToggle.textContent = notesExpanded ? 'Collapse field notes' : 'Field notes';
                setTimeout(() => {
                  container.style.top = `${currentBottom - container.offsetHeight}px`;
                }, 0);
              });
            
              container.appendChild(notesContent);
              container.appendChild(notesToggle);
            }
        
            // Controls row
            const controls = document.createElement('div');
            controls.className = 'popup-controls';
        
            // Prev button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'popup-nav-btn';
            prevBtn.textContent = '‹ prev';
            prevBtn.disabled = audioController.playMode === 'random'
              ? audioController.playHistory.length === 0
              : index === 0;
            prevBtn.addEventListener('click', () => audioController.playPrevious(this.audioData));
            controls.appendChild(prevBtn);
        
            // Play/Pause button
            const audioForControls = audio || audioController.currentAudio;
            if (audioForControls) {
              const playPauseBtn = document.createElement('button');
              playPauseBtn.className = 'popup-playpause-btn';

              if (preview) {
                // Preview mode: button always shows play, clicking starts this track
                const t = document.createElement('div');
                t.className = 'play-triangle-lg';
                playPauseBtn.appendChild(t);
                playPauseBtn.addEventListener('click', () => {
                  this.playAudio(index, false, true);
                });
              } else {
                // Normal mode: toggle current audio
                const updateButton = () => {
                  playPauseBtn.innerHTML = '';
                  if (audioForControls.paused) {
                    const t = document.createElement('div');
                    t.className = 'play-triangle-lg';
                    playPauseBtn.appendChild(t);
                  } else {
                    const b1 = document.createElement('div');
                    b1.className = 'pause-bar';
                    const b2 = document.createElement('div');
                    b2.className = 'pause-bar';
                    playPauseBtn.appendChild(b1);
                    playPauseBtn.appendChild(b2);
                  }
                };
                updateButton();
                audioForControls.addEventListener('play', updateButton);
                audioForControls.addEventListener('pause', updateButton);
                playPauseBtn.addEventListener('click', () => {
                  audioForControls.paused ? audioForControls.play() : audioForControls.pause();
                });
              }
              controls.appendChild(playPauseBtn);
            }
        
            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'popup-nav-btn';
            nextBtn.textContent = 'next ›';
            nextBtn.disabled = index === this.audioData.length - 1;
            nextBtn.addEventListener('click', () => audioController.playNext(this.audioData));
            controls.appendChild(nextBtn);
        
            // Time display
            const audioForDisplay = audio || audioController.currentAudio;
            if (audioForDisplay && !preview) {
              // Normal mode — wire to current audio element
              const timeDisplay = document.createElement('div');
              timeDisplay.className = 'popup-time-display';
              const formatTime = (secs) => {
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                return `${m}:${String(s).padStart(2, '0')}`;
              };
              const updateTime = () => {
                const cur = Math.floor(audioForDisplay.currentTime);
                const dur = isFinite(audioForDisplay.duration) ? Math.floor(audioForDisplay.duration) : 0;
                if (dur > 0 && !track._cachedDuration) track._cachedDuration = dur;
                timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
              };
              audioForDisplay.addEventListener('timeupdate', updateTime);
              audioForDisplay.addEventListener('loadedmetadata', updateTime);
              audioForDisplay.addEventListener('durationchange', updateTime);
              updateTime();
              setTimeout(updateTime, 200);
              controls.appendChild(timeDisplay);
            } else if (preview && track.audioUrl) {
              // Preview mode — use cached duration if available, else fetch metadata only
              const timeDisplay = document.createElement('div');
              timeDisplay.className = 'popup-time-display';
              const formatTime = (secs) => {
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                return `${m}:${String(s).padStart(2, '0')}`;
              };
              if (track._cachedDuration) {
                timeDisplay.textContent = `0:00 / ${formatTime(track._cachedDuration)}`;
              } else {
                timeDisplay.textContent = '0:00 / --:--';
                const tempAudio = new Audio();
                tempAudio.preload = 'metadata';
                tempAudio.addEventListener('loadedmetadata', () => {
                  if (isFinite(tempAudio.duration)) {
                    track._cachedDuration = Math.floor(tempAudio.duration);
                    timeDisplay.textContent = `0:00 / ${formatTime(track._cachedDuration)}`;
                  }
                  tempAudio.src = '';
                });
                tempAudio.src = track.audioUrl;
              }
              controls.appendChild(timeDisplay);
            }
        
            container.appendChild(controls);
        
            // Append and position
            document.body.appendChild(container);
            const pixelCoords = map.project(coords);
            const popupWidth = container.offsetWidth || 320;
            container.style.left = `${pixelCoords.x - (popupWidth / 2)}px`;
            container.style.top  = `${pixelCoords.y - container.offsetHeight - 20}px`;
        
            this.currentPopup = {
              _container: container,
              _coords: coords,
              _preview: preview,
              remove: () => { if (container.parentNode) container.parentNode.removeChild(container); },
              updatePosition: () => {
                const px = map.project(coords);
                const w = container.offsetWidth || 320;
                container.style.left = `${px.x - (w / 2)}px`;
                container.style.top  = `${px.y - container.offsetHeight - 20}px`;
              }
            };
        
            setTimeout(() => this.currentPopup.updatePosition(), 10);
        
          if (shouldMinimize && !preview) {
            this.minimizePopup(track, index);
          }
          
          // Update badge visibility after popup is shown
          this.updateBadgeVisibility();
        }

      refreshPopupMileage(track) {
        if (!this.currentPopup) return;
        
        const popupContent = this.currentPopup._container; // Use _container instead of _content
        const mileElement = popupContent.querySelector('.popup-mile');
        if (mileElement && track.mile && track.mile.toString().trim().toLowerCase() !== 'n/a') {
          const displayMile = this.getDisplayMile(track);
          mileElement.innerHTML = `<strong>mi.${displayMile}</strong>`;
        }
      }

      formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date)) return timestamp;
        
        // Use the enhanced atmosphere controller's Pacific Time formatting
        const pacificTime = atmosphereController.convertToPacificTime(timestamp);
        return atmosphereController.formatPacificTime(pacificTime);
      }

      enable3D() {
        if (!uiController.isMobile) {
          map.dragRotate.enable();
          map.keyboard.enable();
        }

        if (!map.getSource('mapbox-dem')) {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14
          });
        }

        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        if (typeof map.setLight === 'function') {
          map.setLight({ anchor: 'viewport', color: 'white', intensity: 0.5, position: [1.15, 210, 30] });
        }

        setTimeout(() => {
          const currentTrack = audioController.currentIndex >= 0
            ? this.audioData[audioController.currentIndex]
            : null;

          if (currentTrack) {
            map.flyTo({
              center: [parseFloat(currentTrack.lng), parseFloat(currentTrack.lat)],
              zoom: CONFIG.ZOOM_3D,
              pitch: 82,
              bearing: 0,
              duration: 2500,
              easing: t => 1 - Math.pow(1 - t, 3)
            });
            atmosphereController.applyAtmosphere(currentTrack);
          } else {
            map.flyTo({ pitch: 82, zoom: Math.max(map.getZoom(), CONFIG.ZOOM_3D), duration: 2000 });
          }
        }, 300);
      }

      disable3D() {
        if (!uiController.isMobile) map.dragRotate.disable();

        atmosphereController.currentConditions = null;
        if (atmosphereController.atmosphereCache) atmosphereController.atmosphereCache.clear();
        atmosphereController.resetToDefault();

        map.setTerrain(null);
        if (typeof map.setLight === 'function') map.setLight(null);
        map.flyTo({ pitch: 0, bearing: 0, duration: 1500 });

        setTimeout(() => {
          if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem');
        }, 1600);
      }

          resetMap() {
            audioController.stop();
            
            // Clear ALL pending animation timeouts
            if (this.animationTimeout) {
              clearTimeout(this.animationTimeout);
              this.animationTimeout = null;
            }
            if (this.moveTimeout) {
              clearTimeout(this.moveTimeout);
              this.moveTimeout = null;
            }
            
            // Force remove ALL popups from the DOM (not just tracked ones)
            document.querySelectorAll('.mapboxgl-popup').forEach(popup => {
              popup.remove();
            });
            
            uiController.clearMiniInfoBoxes();
          
          // Remove header badge on reset
          const existingBadge = document.getElementById('playing-badge');
          if (existingBadge) {
            existingBadge.remove();
          }
          
          if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
          }
          
          // Clean up minimized popup if it exists
          if (this.minimizedPopup) {
            if (this.minimizedPopup._cleanupIcon) this.minimizedPopup._cleanupIcon();
            if (this.minimizedPopup._updatePosition) map.off('move', this.minimizedPopup._updatePosition);
            this.minimizedPopup.remove();
            this.minimizedPopup = null;
          }
        
        // Disable 3D mode if enabled
        if (uiController.is3DEnabled) {
          uiController.is3DEnabled = false;
          const btn = document.getElementById('terrain3dBtn');
          const btnMobile = document.getElementById('terrain3dBtnMobile');
          if (btn) btn.classList.remove('active');
          if (btnMobile) btnMobile.classList.remove('active');
          this.disable3D();
        } else {
          // Always reset atmosphere even if not in 3D
          atmosphereController.currentConditions = null;
          if (atmosphereController.atmosphereCache) atmosphereController.atmosphereCache.clear();
          atmosphereController.resetToDefault();
        }
        
        // Reset to default position - use flyTo like 3D mode does
        map.flyTo({
          center: uiController.isMobile ? CONFIG.DEFAULT_CENTER_MOBILE : CONFIG.DEFAULT_CENTER,
          zoom: CONFIG.getDefaultZoom(),
          pitch: 0,
          bearing: 0,
          duration: 2000
        });
        
          // Clear active track highlighting and reset styling
          document.querySelectorAll('.track').forEach(el => {
            el.classList.remove('active-track');
            el.style.backgroundColor = '';
            el.style.fontWeight = '';
            const indicator = el.querySelector('.play-indicator');
            if (indicator) {
              indicator.remove();
            }
          });
        
        showNotification('Map reset to default view', 2000);
        }

      getMovementDuration(track) {
        // Calculate the same duration logic used in positionMapForTrack
        const coords = [parseFloat(track.lng), parseFloat(track.lat)];
        const currentCenter = map.getCenter();
        const distance = this.calculateDistance(
          currentCenter.lat, currentCenter.lng,
          coords[1], coords[0]
        );
        
        const distanceKm = distance / 1000;
        let duration;
        if (distanceKm < 5) {
          duration = 2200;
        } else if (distanceKm < 50) {
          duration = 2200 + ((distanceKm - 5) / 45) * 1800;
        } else {
          duration = Math.min(5000, 4000 + ((distanceKm - 50) / 100) * 1000);
        }
        return duration;
      }

      // Check if popup/picker is actually visible in browser viewport (ignores map padding)
      isCurrentPointVisible() {
        if (audioController.currentIndex === -1) return false;
        
        // Check if popup DOM element is actually visible in viewport
        if (this.currentPopup && this.currentPopup._container) {
          const rect = this.currentPopup._container.getBoundingClientRect();
          // Check if any part of popup is visible in viewport
          const isVisible = rect.top < window.innerHeight && 
                           rect.bottom > 0 &&
                           rect.left < window.innerWidth && 
                           rect.right > 0;
          return isVisible;
        }
        
        // Check if minimized popup is visible
        if (this.minimizedPopup) {
          const rect = this.minimizedPopup.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight && 
                           rect.bottom > 0 &&
                           rect.left < window.innerWidth && 
                           rect.right > 0;
          return isVisible;
        }
        
        // Check if cluster picker is visible
        if (this.clusterPicker) {
          const rect = this.clusterPicker.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight && 
                           rect.bottom > 0 &&
                           rect.left < window.innerWidth && 
                           rect.right > 0;
          return isVisible;
        }
        
        // No UI elements exist - badge should show (point is off-screen)
        return false;
      }

      // Update badge visibility based on playlist state and point visibility  
      updateBadgeVisibility() {
        const badge = document.getElementById('playing-badge');
        if (!badge) return;
        
        const playlistCollapsed = uiController.isMobile ? 
          !uiController.mobilePlaylistExpanded : 
          !uiController.playlistExpanded;
        const pointVisible = this.isCurrentPointVisible();
        
        if (playlistCollapsed && !pointVisible && audioController.currentIndex >= 0) {
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }
