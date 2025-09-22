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

        map.on('move', () => {
          // Update mini box positions in real-time during movement
          uiController.updateMiniInfoBoxPositions();
        });

        map.on('moveend', () => {
          // Refresh mini boxes when movement is completely finished
          if (!this.isPositioning) {
            const visiblePoints = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
            if (visiblePoints.length > 0 && visiblePoints.length < 50) {
              uiController.showMiniInfoBoxes(null, this.audioData);
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
        
        // Show persistent loading notification (centered, like success message)
        showNotification('loading recordings...'); // No duration = stays visible
        
        const url = `${CONFIG.GOOGLE_SCRIPT_URL}?nocache=${Date.now()}`;
        console.log('Fetching data from:', url);
        
        // Simple fetch without extra headers to avoid CORS preflight
        fetch(url)
          .then(response => {
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
          })
          .then(text => {
            console.log('Raw response:', text);
            try {
              const response = JSON.parse(text);
              console.log('Parsed response:', response);
              
              // Handle new response format with data/metadata structure
              let data;
              if (response.data && Array.isArray(response.data)) {
                // New format: {data: [...], metadata: {...}}
                data = response.data;
                console.log('Using new response format with metadata');
                console.log('Metadata:', response.metadata);
              } else if (Array.isArray(response)) {
                // Old format: [...]
                data = response;
                console.log('Using legacy response format');
              } else {
                throw new Error('Invalid response format');
              }
              
              console.log('Final data array:', data);
              console.log('Data length:', data.length);
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.length === 0) {
                throw new Error('No recordings found');
              }
              
              // Log first item to check structure (including elevation)
              if (data.length > 0) {
                console.log('First item structure:', data[0]);
                console.log('First item elevation:', data[0].elevation);
                console.log('First item audioUrl:', data[0].audioUrl);
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
                showNotification(`Connection issue, retrying... (${retryCount + 1}/3)`, 2000);
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

        // Stop any runaway animations and movements FIRST
        if (this.animationTimeout) {
          clearTimeout(this.animationTimeout);
          this.animationTimeout = null;
        }
        
        if (this.moveTimeout) {
          clearTimeout(this.moveTimeout);
          this.moveTimeout = null;
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

        // Clear old mini boxes before playing
        uiController.clearMiniInfoBoxes();

        const audio = audioController.play(index, this.audioData);
        
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
        
        // Position map and show popup without delay for better responsiveness
        this.positionMapForTrack(track, index);
        this.showPopup([parseFloat(track.lng), parseFloat(track.lat)], track, audio, index);
        
        // Show mini boxes after map movement completes
        const duration = this.getMovementDuration(track);
        this.moveTimeout = setTimeout(() => {
          uiController.showMiniInfoBoxes(null, this.audioData);
        }, duration + 300);
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
        // Remove the main popup but keep audio playing
        if (this.currentPopup) {
          this.currentPopup.remove();
          this.currentPopup = null;
        }
        
        // Audio should continue playing - don't stop it
        // The audio element is managed by audioController and should persist
        
        // Create a mini infobox for the minimized popup
        const coords = [parseFloat(track.lng), parseFloat(track.lat)];
        const pixelCoords = map.project(coords);
        
        const miniBox = document.createElement('div');
        miniBox.className = 'mini-infobox minimized-popup';
        miniBox.dataset.trackIndex = index;
        miniBox.style.position = 'absolute';
        miniBox.style.backgroundColor = 'rgba(255, 235, 220, 0.95)'; // Light orange background to indicate playing
        
        const pauseIcon = document.createElement('div');
        pauseIcon.className = 'pause-icon';
        pauseIcon.style.display = 'inline-block';
        pauseIcon.style.width = '8px';
        pauseIcon.style.height = '8px';
        pauseIcon.style.position = 'relative';
        pauseIcon.style.marginRight = '4px';
        pauseIcon.innerHTML = `
          <div style="position: absolute; left: 0; width: 3px; height: 8px; background-color: #ff6b35;"></div>
          <div style="position: absolute; right: 0; width: 3px; height: 8px; background-color: #ff6b35;"></div>
        `;
        
        const title = document.createElement('span');
        title.className = 'mini-infobox-title';
        title.textContent = track.name.replace(/^[^\s]+\s+-\s+/, '');
        
        // Click to restore the full popup
        miniBox.addEventListener('click', (e) => {
          e.stopPropagation();
          // Remove this mini box
          miniBox.remove();
          this.minimizedPopup = null;
          // Find the audio element if it exists
          const audio = audioController.currentAudio;
          // Show full popup again
          this.showPopup(coords, track, audio, index);
        });
        
        miniBox.appendChild(pauseIcon);
        miniBox.appendChild(title);
        
        // Position the mini box
        miniBox.style.left = `${pixelCoords.x + 10}px`;
        miniBox.style.top = `${pixelCoords.y - 20}px`;
        
        map.getContainer().appendChild(miniBox);
        
        // Store reference to minimized popup
        this.minimizedPopup = miniBox;
        
        // Update position when map moves
        const updatePosition = () => {
          const newCoords = map.project(coords);
          miniBox.style.left = `${newCoords.x + 10}px`;
          miniBox.style.top = `${newCoords.y - 20}px`;
        };
        map.on('move', updatePosition);
        
        // Store the update function so we can remove it later
        miniBox._updatePosition = updatePosition;
      }

      updateActiveTrack(index, shouldScrollPlaylist = false) {
        document.querySelectorAll('.track').forEach(el => el.classList.remove('active-track'));
        const activeTrack = document.querySelector(`.track[data-id="${index}"]`);
        if (activeTrack) {
          activeTrack.classList.add('active-track');
          // Only scroll if explicitly requested (for auto-play next)
          if (shouldScrollPlaylist) {
            // Safari-specific scrollIntoView fix
            if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
              // For Safari, use a more direct approach
              const playlist = document.getElementById('playlist');
              const trackRect = activeTrack.getBoundingClientRect();
              const playlistRect = playlist.getBoundingClientRect();
              const scrollTop = playlist.scrollTop + trackRect.top - playlistRect.top - (playlistRect.height / 2) + (trackRect.height / 2);
              playlist.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
              });
            } else {
              // For other browsers, use scrollIntoView
              activeTrack.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
              });
            }
          }
        }
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
        if (this.currentPopup) {
          this.currentPopup.remove();
        }

        const container = document.createElement('div');
        container.style.fontFamily = 'helvetica, sans-serif';
        container.style.padding = '2px';
        container.style.position = 'relative';
        container.style.paddingTop = '30px'; // More space for minimize button

        // Add minimize button
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'popup-minimize';
        minimizeBtn.innerHTML = '−'; // Minus sign using HTML entity
        minimizeBtn.title = 'Minimize';
        minimizeBtn.type = 'button'; // Explicitly set type
        // Prevent auto-focus
        minimizeBtn.tabIndex = -1;
        minimizeBtn.style.cssText = `
          position: absolute;
          top: 5px;
          right: 25px;
          background: transparent;
          border: 1px solid #ccc;
          border-radius: 3px;
          width: 20px;
          height: 20px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        `;
        minimizeBtn.addEventListener('mouseenter', () => {
          minimizeBtn.style.backgroundColor = '#f0f0f0';
        });
        minimizeBtn.addEventListener('mouseleave', () => {
          minimizeBtn.style.backgroundColor = 'transparent';
        });
        minimizeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.minimizePopup(track, index);
        });
        container.appendChild(minimizeBtn);

        const title = document.createElement('h3');
        title.textContent = track.name;
        title.style.margin = '0 0 4px 0';
        container.appendChild(title);

        const timestamp = document.createElement('p');
        timestamp.style.margin = '0';
        timestamp.style.fontSize = '0.9em';
        timestamp.style.color = '#555';
        timestamp.innerHTML = `<strong>${this.formatTimestamp(track.timestamp)}</strong>`;
        container.appendChild(timestamp);

        if (track.mile && track.mile.toString().trim().toLowerCase() !== 'n/a') {
          const displayMile = this.getDisplayMile(track);
          if (displayMile !== null) {
            const mile = document.createElement('p');
            mile.className = 'popup-mile';
            mile.style.margin = '0';
            mile.style.fontSize = '0.9em';
            mile.style.color = '#555';
            mile.innerHTML = `<strong>mi.${displayMile}</strong>`;
            container.appendChild(mile);
          }
        }

        if (track.notes?.trim()) {
          const notes = document.createElement('p');
          notes.style.margin = '4px 0';
          notes.style.fontSize = '0.9em';
          notes.textContent = track.notes;
          container.appendChild(notes);
        }

        const controls = document.createElement('div');
        controls.className = 'popup-controls';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-arrow';
        prevBtn.innerHTML = '&laquo;';
        prevBtn.title = 'Previous';
        
        // Disable previous button logic based on mode and history
        if (audioController.playMode === 'random') {
          prevBtn.disabled = audioController.playHistory.length === 0;
        } else {
          // In playlist order: previous is always the item above in the list
          prevBtn.disabled = index === 0;
        }
        
        prevBtn.addEventListener('click', () => {
          audioController.playPrevious(this.audioData);
        });
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-arrow';
        nextBtn.innerHTML = '&raquo;';
        nextBtn.title = 'Next';
        // In playlist order: next is always the item below in the list
        nextBtn.disabled = index === this.audioData.length - 1;
        nextBtn.addEventListener('click', () => {
          audioController.playNext(this.audioData);
        });
        
        controls.appendChild(prevBtn);
        
        if (audio) {
          const audioContainer = document.createElement('div');
          audioContainer.className = 'audio-container';
          
          // Ensure audio controls always render properly
          audio.controls = true;
          audio.autoplay = true;
          audio.style.width = '100%';
          audio.controlsList = 'nodownload';
          audio.oncontextmenu = () => false;
          
          // Force audio element to load controls
          audio.load();
          
          // Try to play with user interaction context
          // This click event has user interaction, so we can attempt play
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.log('Autoplay prevented, user can click play manually:', error.message);
              // Audio will have controls, so user can manually play
            });
          }
          
          // Fallback: if controls don't appear, try recreating
          setTimeout(() => {
            if (!audio.controls || audio.offsetHeight === 0) {
              console.warn('Audio controls not rendering, attempting fix...');
              audio.controls = true;
              audio.style.display = 'block';
              audio.style.visibility = 'visible';
            }
          }, 100);
          
          audioContainer.appendChild(audio);
          controls.appendChild(audioContainer);
        }
        
        controls.appendChild(nextBtn);
        container.appendChild(controls);

        const popup = new mapboxgl.Popup({ 
          offset: 25,
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
        
        // Clear ALL mini info boxes including minimized popups
        uiController.clearMiniInfoBoxes();
        
        // Clear any minimized popups that are styled as mini-infoboxes
        document.querySelectorAll('.mini-infobox').forEach(box => {
          if (box.parentNode) {
            box.parentNode.removeChild(box);
          }
        });
        
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
