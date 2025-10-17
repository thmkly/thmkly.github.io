// Map Controller Class
    class MapController {
      constructor() {
        this.audioData = [];
        this.originalAudioData = []; // Keep original order for stable map references
        this.currentPopup = null;
        this.isPositioning = false;
        this.animationTimeout = null;
        this.moveTimeout = null;
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

      setupMap() {
        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
        
        window.map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/thmkly/clyup637d004201ri2tkpaywq',
          center: CONFIG.DEFAULT_CENTER,
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
          map.getSource('audio').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            
            // Get all points in the cluster to calculate bounds
            map.getSource('audio').getClusterLeaves(clusterId, 100, 0, (err, leaves) => {
              if (err) return;
              
              const bounds = new mapboxgl.LngLatBounds();
              leaves.forEach(leaf => {
                bounds.extend(leaf.geometry.coordinates);
              });
              
              // Enhanced padding to account for mini info boxes
              const padding = uiController.isMobile ? 
                { top: 100, bottom: 120, left: 80, right: 80 } :  // Mobile: extra padding for ko-fi widget bottom
                { top: 80, bottom: 80, left: this.getLeftPadding() + 50, right: 100 }; // Desktop: extra padding for mini boxes
              
              map.fitBounds(bounds, { 
                padding: padding,
                maxZoom: 14  // Prevent zooming in too far
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
            this.playAudio(currentIndex);
          }
        });

        // Throttle mini box updates during map movement
        let miniBoxUpdateScheduled = false;
        map.on('move', () => {
          if (!miniBoxUpdateScheduled && !this.isPositioning) {
            miniBoxUpdateScheduled = true;
            requestAnimationFrame(() => {
              uiController.updateMiniInfoBoxPositions();
              miniBoxUpdateScheduled = false;
            });
          }
        });

        map.on('moveend', () => {
          // Refresh mini boxes when movement is completely finished
          if (!this.isPositioning) {
            const visiblePoints = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
            
            // Only update if cluster state changed or boxes are missing
            const currentPointCount = visiblePoints.length;
            const existingBoxCount = uiController.miniInfoBoxes.length;
            
            // Check if we need to update (clustering changed or boxes don't match)
            const shouldUpdate = currentPointCount !== existingBoxCount || 
                                 (currentPointCount > 0 && currentPointCount < 50 && existingBoxCount === 0);
            
            if (shouldUpdate) {
              uiController.clearMiniInfoBoxes();
              if (currentPointCount > 0 && currentPointCount < 50) {
                uiController.showMiniInfoBoxes(null, this.audioData);
              }
            }
          }
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

      // Helper to detect if playlist is currently in chronological order
      isCurrentlyChronological() {
        if (this.audioData.length < 2) return false;
        
        // Check if first few items are in chronological order (indicating STEREO mode was used)
        for (let i = 0; i < Math.min(5, this.audioData.length - 1); i++) {
          const currentTime = new Date(this.audioData[i].timestamp);
          const nextTime = new Date(this.audioData[i + 1].timestamp);
          if (currentTime > nextTime) {
            return false; // Not chronological
          }
        }
        return true; // Appears to be chronological
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
            // Collapse mobile menu when track is clicked
            if (uiController.isMobile && uiController.mobilePlaylistExpanded) {
              uiController.collapseMobileMenu();
            }
            this.playAudio(index);
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
        const playlist = document.getElementById('playlist');
        
        // Always scroll to top since we're always playing top→down now
        if (audioController.currentIndex === -1) {
          setTimeout(() => {
            playlist.scrollTop = 0; // Always start at top
          }, 100);
        }
      }

      playAudio(index, fromAutoPlay = false) {
        console.log('playAudio called with index:', index, 'fromAutoPlay:', fromAutoPlay);
        
        const track = this.audioData[index];
        if (!track) {
          console.error('No track found at index:', index);
          return;
        }

  console.log('Playing track:', track.name);

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

        // Stop any runaway animations
        if (this.animationTimeout) {
          clearTimeout(this.animationTimeout);
        }

        // Clean up any minimized popup
        if (this.minimizedPopup) {
          this.minimizedPopup.remove();
          this.minimizedPopup = null;
        }

        // Update active track, only scroll playlist if from auto-play and track not visible
        if (fromAutoPlay) {
          // Check if track is visible in playlist
          const trackElement = document.querySelector(`.track[data-id="${index}"]`);
          const playlist = document.getElementById('playlist');
          if (trackElement && playlist) {
            const trackRect = trackElement.getBoundingClientRect();
            const playlistRect = playlist.getBoundingClientRect();
            const isVisible = trackRect.top >= playlistRect.top && trackRect.bottom <= playlistRect.bottom;
            this.updateActiveTrack(index, !isVisible); // Only scroll if not visible
          } else {
            this.updateActiveTrack(index, true); // Scroll if can't determine visibility
          }
        } else {
          this.updateActiveTrack(index, false); // Don't scroll for manual clicks
        }

        const audio = audioController.play(index, this.audioData);

        // Update badge if playlist is collapsed (regardless of minimize state)
        if (!uiController.playlistExpanded) {
          this.updateHeaderBadge(track);
        }
        
        // Clear old mini boxes before positioning
        uiController.clearMiniInfoBoxes();
        
        // Apply atmospheric lighting for this track (removed notification)
        if (typeof atmosphereController !== 'undefined' && atmosphereController.transitionToTrack) {
          // Apply without notification
          const conditions = atmosphereController.getAtmosphericConditions(track);
          atmosphereController.currentConditions = conditions;
          atmosphereController.applyEnhancedSky(conditions);
          atmosphereController.applyEnhancedFog(conditions);
          atmosphereController.applyEnhanced3DEffects(conditions);
          atmosphereController.applyFallbackAtmosphere(conditions);
        }
        
        // Don't collapse menu - removed this functionality
        
        // Add delay before positioning to prevent conflicts
        this.animationTimeout = setTimeout(() => {
          this.positionMapForTrack(track, index);
          this.showPopup([parseFloat(track.lng), parseFloat(track.lat)], track, audio, index);
          
          // Show mini boxes after map positioning is complete
          const duration = this.getMovementDuration(track);
          setTimeout(() => {
            uiController.showMiniInfoBoxes(null, this.audioData);
          }, duration + 300);
        }, 100);
      }

      showTrackPopup(index, autoPlay = true) {
        const track = this.audioData[index];
        if (!track) return;

        const coords = [parseFloat(track.lng), parseFloat(track.lat)];
        
        if (autoPlay) {
          this.playAudio(index);
        } else {
          this.positionMapForTrack(track, index);
          this.showPopup(coords, track, null, index);
        }
      }

        minimizePopup(track, index) {
          // Just remove the popup - audio lives in document.body and keeps playing
          if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
          }
          
          // Hide the audio element (it's still playing in the background)
          if (audioController.currentAudio) {
            audioController.currentAudio.style.display = 'none';
          }
          
          // Create a mini infobox for the minimized popup
          const coords = [parseFloat(track.lng), parseFloat(track.lat)];
          const pixelCoords = map.project(coords);
          
          const miniBox = document.createElement('div');
          miniBox.className = 'mini-infobox minimized-popup';
          miniBox.dataset.trackIndex = index;
          miniBox.style.position = 'absolute';
          
          const playIcon = document.createElement('div');
          playIcon.className = 'play-icon';
          playIcon.style.borderLeftColor = '#ff6b35';
          
          const title = document.createElement('span');
          title.className = 'mini-infobox-title';
          title.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');
          
            miniBox.addEventListener('click', (e) => {
              e.stopPropagation();
              miniBox.remove();
              this.minimizedPopup = null;
              
              // Restore popup with the audio from audioController
              this.showPopup(coords, track, audioController.currentAudio, index);
              
              // Update badge AFTER popup is shown
              setTimeout(() => {
                this.updateHeaderBadge(audioController.currentIndex >= 0 ? this.audioData[audioController.currentIndex] : null);
              }, 50);
            });
          
          miniBox.appendChild(playIcon);
          miniBox.appendChild(title);
          
          // Position the mini box
          miniBox.style.left = `${pixelCoords.x + 10}px`;
          miniBox.style.top = `${pixelCoords.y - 20}px`;
          
          map.getContainer().appendChild(miniBox);
          
          this.minimizedPopup = miniBox;
          
          // Update position when map moves
          const updatePosition = () => {
            const newCoords = map.project(coords);
            miniBox.style.left = `${newCoords.x + 10}px`;
            miniBox.style.top = `${newCoords.y - 20}px`;
          };
          map.on('move', updatePosition);
          
          miniBox._updatePosition = updatePosition;
            
        // Add header badge only if playlist is collapsed
          this.updateHeaderBadge(track);
        }
        
        // New helper method - add this RIGHT AFTER minimizePopup() closes
              updateHeaderBadge(track) {
        // Remove existing badge if any and clean up listeners
        const existingBadge = document.getElementById('playing-badge');
        if (existingBadge) {
          // Clean up old event listeners
          if (existingBadge._updateTimeHandler && existingBadge._audioElement) {
            existingBadge._audioElement.removeEventListener('timeupdate', existingBadge._updateTimeHandler);
            existingBadge._audioElement.removeEventListener('play', existingBadge._updateTimeHandler);
          }
          existingBadge.remove();
        }
          
          // Only show badge if playlist is collapsed AND track is provided
          if (!uiController.playlistExpanded && track) {
            const badge = document.createElement('div');
            badge.id = 'playing-badge';
            const trackName = track.name.replace(/^[^\s]+\s+-\s+/, '');
            badge.innerHTML = `<span style="display: inline-block; margin-right: 8px;">▶</span><span class="badge-title">${trackName}</span><span class="badge-time" style="margin-left: 8px; font-family: monospace; font-size: 12px; color: #666;">0:00</span>`;
            badge.style.position = 'absolute';
            badge.style.fontSize = '14px';
            badge.style.color = '#333';
            badge.style.fontWeight = '500';
            badge.style.zIndex = '1';
            badge.style.pointerEvents = 'auto';
            badge.style.cursor = 'pointer';
            badge.style.maxWidth = '300px';
            badge.style.overflow = 'hidden';
            badge.style.textOverflow = 'ellipsis';
            badge.style.whiteSpace = 'nowrap';
            
            // Position badge based on mobile/desktop
            if (uiController.isMobile) {
              badge.style.top = '20px';
              badge.style.right = '20px';
              badge.style.left = 'auto';
              badge.style.textAlign = 'right';
            } else {
              badge.style.top = '20px';
              badge.style.left = '20px';
              badge.style.right = 'auto';
            }
            
            // Click to fly to track location (keep minimized state)
            badge.addEventListener('click', () => {
              const coords = [parseFloat(track.lng), parseFloat(track.lat)];
              
              // Clear stale mini boxes before flying
              uiController.clearMiniInfoBoxes();
              
              // Just fly to the location, don't restore popup
              this.positionMapForTrack(track, audioController.currentIndex);
              
              // Ensure mini box exists after flying completes
              setTimeout(() => {
                if (this.minimizedPopup) {
                  // Update mini box position after map movement
                  const pixelCoords = map.project(coords);
                  this.minimizedPopup.style.left = `${pixelCoords.x + 10}px`;
                  this.minimizedPopup.style.top = `${pixelCoords.y - 20}px`;
                }
                
                // Redraw other mini boxes
                const visiblePoints = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
                if (visiblePoints.length > 0 && visiblePoints.length < 50) {
                  uiController.showMiniInfoBoxes(null, this.audioData);
                }
              }, this.getMovementDuration(track) + 300);
            });
            
            document.body.appendChild(badge);
            
            // Update time display
            if (audioController.currentAudio) {
              const audio = audioController.currentAudio;
              const timeSpan = badge.querySelector('.badge-time');
              
              const updateBadgeTime = () => {
                if (timeSpan && audio && !audio.paused) {
                  const current = Math.floor(audio.currentTime);
                  const mins = Math.floor(current / 60);
                  const secs = current % 60;
                  timeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                }
              };
              
              audio.addEventListener('timeupdate', updateBadgeTime);
              audio.addEventListener('play', updateBadgeTime);
              updateBadgeTime(); // Initial update
              
              // Store reference for cleanup
              badge._updateTimeHandler = updateBadgeTime;
              badge._audioElement = audio;
            }
          }
        }

        updateActiveTrack(index, shouldScrollPlaylist = false) {
          document.querySelectorAll('.track').forEach(el => el.classList.remove('active-track'));
          const activeTrack = document.querySelector(`.track[data-id="${index}"]`);
          if (activeTrack) {
            activeTrack.classList.add('active-track');
            
            // Enhanced styling for active track
            activeTrack.style.backgroundColor = 'rgba(255, 235, 220, 0.5)'; // Warm beige
            activeTrack.style.fontWeight = '600'; // Bold
            
            // Add play triangle if not already there
            const trackInfo = activeTrack.querySelector('.track-info');
            if (trackInfo && !trackInfo.textContent.startsWith('▶')) {
              trackInfo.textContent = '▶ ' + trackInfo.textContent;
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
          
          // Remove play triangle from inactive tracks and reset styling
          document.querySelectorAll('.track:not(.active-track)').forEach(el => {
            el.style.backgroundColor = '';
            el.style.fontWeight = '';
            const trackInfo = el.querySelector('.track-info');
            if (trackInfo && trackInfo.textContent.startsWith('▶')) {
              trackInfo.textContent = trackInfo.textContent.substring(2);
            }
          });
        }

      positionMapForTrack(track, index) {
        console.log('positionMapForTrack called for:', track.name);
        
        // Prevent multiple simultaneous map movements
        if (this.isPositioning) {
          console.log('Already positioning, skipping...');
          return;
        }
        this.isPositioning = true;

        const coords = [parseFloat(track.lng), parseFloat(track.lat)];
        
        const resetPositioning = () => {
          this.isPositioning = false;
        };

        // Calculate distance for duration scaling
        const currentCenter = map.getCenter();
        const distance = this.calculateDistance(
          currentCenter.lat, currentCenter.lng,
          coords[1], coords[0]
        );
        
        // Distance-based duration: longer for farther points
        const distanceKm = distance / 1000;
        let duration;
        if (distanceKm < 5) {
          duration = 2200; // Close points: normal speed
        } else if (distanceKm < 50) {
          duration = 2200 + ((distanceKm - 5) / 45) * 1800; // Medium: 2.2-4s
        } else {
          duration = Math.min(5000, 4000 + ((distanceKm - 50) / 100) * 1000); // Far: 4-5s max
        }

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

        const flyToOptions = {
          center: coords,
          zoom: targetZoom,
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

        showPopup(coords, track, audio, index) {
            
        // Remove old popup before creating new one
          if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
          }
        
          const container = document.createElement('div');
          container.style.fontFamily = 'helvetica, sans-serif';
          container.style.padding = '12px';
          container.style.position = 'relative';
          container.style.minWidth = '280px';
        
          // Add minimize button (top-right, subtle)
          const minimizeBtn = document.createElement('button');
          minimizeBtn.className = 'popup-minimize';
          minimizeBtn.innerHTML = '−';
          minimizeBtn.title = 'Minimize';
          minimizeBtn.type = 'button';
          minimizeBtn.tabIndex = -1;
          minimizeBtn.style.position = 'absolute';
          minimizeBtn.style.top = '8px';
          minimizeBtn.style.right = '8px';
          minimizeBtn.style.border = 'none';
          minimizeBtn.style.background = 'transparent';
          minimizeBtn.style.fontSize = '20px';
          minimizeBtn.style.cursor = 'pointer';
          minimizeBtn.style.color = '#999';
          minimizeBtn.style.padding = '0';
          minimizeBtn.style.width = '24px';
          minimizeBtn.style.height = '24px';
          minimizeBtn.style.lineHeight = '24px';
          minimizeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.minimizePopup(track, index);
          });
          container.appendChild(minimizeBtn);
        
          // Title
          const title = document.createElement('h3');
          title.textContent = track.name;
          title.style.margin = '0 0 8px 0';
          title.style.fontSize = '15px';
          title.style.fontWeight = '600';
          title.style.paddingRight = '30px'; // Space for minimize button
          container.appendChild(title);
        
          // Timestamp and Mile on same line
          const metaLine = document.createElement('div');
          metaLine.style.fontSize = '13px';
          metaLine.style.color = '#666';
          metaLine.style.marginBottom = '8px';
          
          let metaText = this.formatTimestamp(track.timestamp);
          if (track.mile && track.mile.toString().trim().toLowerCase() !== 'n/a') {
            const displayMile = this.getDisplayMile(track);
            if (displayMile !== null) {
              metaText += ` • mi.${displayMile}`;
            }
          }
          metaLine.textContent = metaText;
          container.appendChild(metaLine);
        
          // Notes section (collapsible)
          if (track.notes?.trim()) {
            const notesToggle = document.createElement('button');
            notesToggle.textContent = 'Show Notes';
            notesToggle.style.fontSize = '12px';
            notesToggle.style.color = '#5c3a2e';
            notesToggle.style.background = 'none';
            notesToggle.style.border = 'none';
            notesToggle.style.padding = '0';
            notesToggle.style.cursor = 'pointer';
            notesToggle.style.textDecoration = 'underline';
            notesToggle.style.marginBottom = '8px';
            
            const notesContent = document.createElement('div');
            notesContent.style.display = 'none';
            notesContent.style.fontSize = '13px';
            notesContent.style.color = '#555';
            notesContent.style.marginTop = '4px';
            notesContent.style.marginBottom = '8px';
            notesContent.textContent = track.notes;
            
            let notesExpanded = false;
            notesToggle.addEventListener('click', () => {
              notesExpanded = !notesExpanded;
              notesContent.style.display = notesExpanded ? 'block' : 'none';
              notesToggle.textContent = notesExpanded ? 'Hide Notes' : 'Show Notes';
            });
            
            container.appendChild(notesToggle);
            container.appendChild(notesContent);
          }
        
          // Player controls
          const controls = document.createElement('div');
          controls.style.display = 'flex';
          controls.style.alignItems = 'center';
          controls.style.gap = '12px';
          controls.style.marginTop = '12px';
          controls.style.paddingTop = '12px';
          controls.style.borderTop = '1px solid #eee';
          
          // Previous button
          const prevBtn = document.createElement('button');
          prevBtn.textContent = '‹ prev';
          prevBtn.style.fontSize = '13px';
          prevBtn.style.padding = '6px 10px';
          prevBtn.style.cursor = 'pointer';
          prevBtn.style.border = '1px solid #ccc';
          prevBtn.style.borderRadius = '4px';
          prevBtn.style.background = 'white';
          prevBtn.style.color = '#333';
          
          if (audioController.playMode === 'random') {
            prevBtn.disabled = audioController.playHistory.length === 0;
          } else {
            prevBtn.disabled = index === 0;
          }
          
          if (prevBtn.disabled) {
            prevBtn.style.opacity = '0.4';
            prevBtn.style.cursor = 'not-allowed';
          }
          
          prevBtn.addEventListener('click', () => {
            audioController.playPrevious(this.audioData);
          });
          
          // Play/Pause button (centered, prominent)
          if (audio) {
            const playPauseBtn = document.createElement('button');
            playPauseBtn.textContent = audio.paused ? '▶' : '⏸';
            playPauseBtn.style.fontSize = '18px';
            playPauseBtn.style.padding = '8px 14px';
            playPauseBtn.style.cursor = 'pointer';
            playPauseBtn.style.border = '1px solid #ccc';
            playPauseBtn.style.borderRadius = '4px';
            playPauseBtn.style.background = 'white';
            
            playPauseBtn.addEventListener('click', () => {
              if (audio.paused) {
                audio.play();
                playPauseBtn.textContent = '⏸';
              } else {
                audio.pause();
                playPauseBtn.textContent = '▶';
              }
            });
            
            controls.appendChild(prevBtn);
            controls.appendChild(playPauseBtn);
          }
          
          // Next button
          const nextBtn = document.createElement('button');
          nextBtn.textContent = 'next ›';
          nextBtn.style.fontSize = '13px';
          nextBtn.style.padding = '6px 10px';
          nextBtn.style.cursor = 'pointer';
          nextBtn.style.border = '1px solid #ccc';
          nextBtn.style.borderRadius = '4px';
          nextBtn.style.background = 'white';
          nextBtn.style.color = '#333';
          nextBtn.disabled = index === this.audioData.length - 1;
          
          if (nextBtn.disabled) {
            nextBtn.style.opacity = '0.4';
            nextBtn.style.cursor = 'not-allowed';
          }
          
          nextBtn.addEventListener('click', () => {
            audioController.playNext(this.audioData);
          });
          
          controls.appendChild(nextBtn);
          
          // Time display (right side)
          if (audio) {
            const timeDisplay = document.createElement('div');
            timeDisplay.style.fontSize = '12px';
            timeDisplay.style.color = '#666';
            timeDisplay.style.marginLeft = 'auto';
            timeDisplay.style.fontFamily = 'monospace';
            
            const updateTime = () => {
              const current = Math.floor(audio.currentTime);
              const duration = Math.floor(audio.duration) || 0;
              const formatTime = (secs) => {
                const mins = Math.floor(secs / 60);
                const remainingSecs = secs % 60;
                return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
              };
              timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
            };
            
            audio.addEventListener('timeupdate', updateTime);
            audio.addEventListener('loadedmetadata', updateTime);
            updateTime();
            
            controls.appendChild(timeDisplay);
          }
          
          container.appendChild(controls);
        
          const popup = new mapboxgl.Popup({ 
            offset: 25,
            closeButton: false,
            closeOnClick: false,
            closeOnMove: false,
            maxWidth: '400px'
          })
            .setLngLat(coords)
            .setDOMContent(container)
            .addTo(map);
        
          this.currentPopup = popup;
        }

      refreshPopupMileage(track) {
        if (!this.currentPopup) return;
        
        const popupContent = this.currentPopup._content;
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

        resetMap() {
          audioController.stop();
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
            if (this.minimizedPopup._updatePosition) {
              map.off('move', this.minimizedPopup._updatePosition);
            }
            this.minimizedPopup.remove();
            this.minimizedPopup = null;
          }
          
          // Reset atmosphere to default/neutral
          if (typeof atmosphereController !== 'undefined') {
            atmosphereController.resetToDefault();
          }
        
        // Disable 3D mode if it's enabled
        if (uiController.is3DEnabled) {
          uiController.is3DEnabled = false;
          const btn = document.getElementById('terrain3dBtn');
          const btnMobile = document.getElementById('terrain3dBtnMobile');
          if (btn) btn.classList.remove('active');
          if (btnMobile) btnMobile.classList.remove('active');
          
          // Disable drag rotation
          if (map.dragRotate) map.dragRotate.disable();
          
          map.setTerrain(null);
          if (map.getSource('mapbox-dem')) {
            map.removeSource('mapbox-dem');
          }
        }
        
        // Simple reset without padding adjustments - same as original
        map.flyTo({
          center: CONFIG.DEFAULT_CENTER,
          zoom: CONFIG.getDefaultZoom(),
          pitch: 0,
          bearing: 0,
          duration: 2000
        });
        
        document.querySelectorAll('.track').forEach(el => el.classList.remove('active-track'));
        
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
    }
