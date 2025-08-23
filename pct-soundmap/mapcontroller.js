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

      // Helper function to get display mile based on sort mode
      getDisplayMile(track) {
        // Don't display mile if it's a placeholder (starts with ~)
        if (track.mile && track.mile.toString().startsWith('~')) {
          return null;
        }
        
        if (audioController.sortMode === 'sobo' && track.mile && track.mile.toString().trim().toLowerCase() !== 'n/a') {
          const nobobMile = parseFloat(track.mile);
          if (!isNaN(nobobMile)) {
            const soboMile = 2655.8 - nobobMile;
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
          zoom: CONFIG.getDefaultZoom()
          // Removed projection: 'globe' to keep your original projection
        });

        map.on('load', () => {
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

        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          if (!features.length) return;
          
          const clusterId = features[0].properties.cluster_id;
          map.getSource('audio').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.getSource('audio').getClusterLeaves(clusterId, 100, 0, (_, leaves) => {
              const bounds = new mapboxgl.LngLatBounds();
              leaves.forEach(leaf => bounds.extend(leaf.geometry.coordinates));
              map.fitBounds(bounds, { 
                padding: { top: 50, bottom: 50, left: this.getLeftPadding(), right: 20 } 
              });
            });
          });
        });

        map.on('mouseenter', 'clusters', (e) => {
          // Cluster hover playlist removed - redundant with main playlist and mini info boxes
        });

        map.on('mouseleave', 'clusters', () => {
          // Cluster hover playlist removed
        });

        map.on('click', 'unclustered-point', (e) => {
          const feature = e.features[0];
          if (!feature) return;
          const originalIndex = parseInt(feature.properties.originalIndex);
          
          // Find this track in the current sorted playlist
          const currentIndex = this.audioData.findIndex(track => track.originalIndex === originalIndex);
          if (currentIndex !== -1) {
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
          btn.textContent = uiController.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
          btn.classList.toggle('active', uiController.isFullscreen);
          
          if (uiController.isFullscreen) {
            // Removed redundant fullscreen message - browsers show native notification
          }
        });
      }

      getLeftPadding() {
        return uiController.playlistExpanded ? 370 : 20;
      }

      loadAudioData() {
        const url = `${CONFIG.GOOGLE_SCRIPT_URL}?nocache=${Date.now()}`;
        console.log('Fetching data from:', url);
        
        fetch(url)
          .then(response => {
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            return response.text();
          })
          .then(text => {
            console.log('Raw response:', text);
            try {
              const data = JSON.parse(text);
              console.log('Parsed data:', data);
              console.log('Data length:', data.length);
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.length === 0) {
                throw new Error('No recordings found');
              }
              
              // Log first item to check structure
              if (data.length > 0) {
                console.log('First item structure:', data[0]);
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
              
              showNotification(`Loaded ${data.length} recordings`, 2000);
            } catch (parseError) {
              console.error('JSON Parse Error:', parseError);
              throw new Error(`Invalid JSON response: ${parseError.message}`);
            }
          })
          .catch(e => {
            console.error('Load Error:', e);
            const errorMsg = e.message || 'Unknown error occurred';
            document.getElementById('playlist').innerHTML = `<p class="loading-placeholder">Failed to load recordings: ${errorMsg}</p>`;
            showNotification(`Error: ${errorMsg}`, 5000);
          });
      }

      sortAndUpdatePlaylist() {
        // Remember currently playing track
        const currentlyPlayingTrack = audioController.currentIndex >= 0 ? 
          this.audioData[audioController.currentIndex] : null;
        
        // Always re-sort based on current mode
        if (audioController.sortMode === 'date') {
          // STEREO: Chronological order (earliest to latest)
          this.audioData = this.sortByMileAndDate([...this.originalAudioData], 'date');
        } else {
          // NOBO/SOBO: Geographic order (always same physical order)
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

        // For playlist display: reverse so Canada (high miles) appears at top
        // This gives us: Canada at top (index 0), Mexico at bottom (last index)
        tracksWithMiles.reverse();

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
            this.playAudio(index);
          });
          
          playlist.appendChild(div);
        });
        
        // Show collapse arrow now that playlist is rendered
        const toggleBtn = document.getElementById('playlistToggle');
        toggleBtn.classList.add('visible');
        
        uiController.updateScrollArrows();
        
        // Force scroll position update on initial load
        if (audioController.currentIndex === -1) {
          setTimeout(() => {
            this.setPlaylistScrollPosition();
          }, 150);
        }
      }

      setPlaylistScrollPosition() {
        const playlist = document.getElementById('playlist');
        
        // Set scroll position based on mode, but only if no track is currently playing
        if (audioController.currentIndex === -1) {
          setTimeout(() => {
            if (audioController.sortMode === 'sobo') {
              // SOBO: Scroll to top (starting at Canada/north)
              playlist.scrollTop = 0;
            } else if (audioController.sortMode === 'date') {
              // STEREO: Scroll to top (starting with earliest recordings)
              playlist.scrollTop = 0;
            } else {
              // NOBO: Scroll to bottom (starting at Mexico/south)
              playlist.scrollTop = playlist.scrollHeight;
            }
          }, 100);
        }
      }

      playAudio(index) {
        console.log('playAudio called with index:', index);
        
        const track = this.audioData[index];
        if (!track) {
          console.error('No track found at index:', index);
          return;
        }

        console.log('Playing track:', track.name);

        // Stop any runaway animations
        if (this.animationTimeout) {
          clearTimeout(this.animationTimeout);
        }

        this.updateActiveTrack(index);
        const audio = audioController.play(index, this.audioData);
        
        // Clear old mini boxes before positioning
        uiController.clearMiniInfoBoxes();
        
        // Apply atmospheric lighting for this track
        atmosphereController.transitionToTrack(track);
        
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

      updateActiveTrack(index) {
        document.querySelectorAll('.track').forEach(el => el.classList.remove('active-track'));
        const activeTrack = document.querySelector(`.track[data-id="${index}"]`);
        if (activeTrack) {
          activeTrack.classList.add('active-track');
          // Smoother, slower scroll to center the track
          activeTrack.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
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
          flyToOptions.pitch = 75;
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
        
        const options = {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        };
        
        const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
        const get = type => parts.find(p => p.type === type)?.value;
        return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} PDT`;
      }

      resetMap() {
        audioController.stop();
        uiController.clearMiniInfoBoxes();
        if (this.currentPopup) {
          this.currentPopup.remove();
          this.currentPopup = null;
        }
        
        // Disable 3D mode if it's enabled
        if (uiController.is3DEnabled) {
          uiController.is3DEnabled = false;
          const btn = document.getElementById('terrain3dBtn');
          btn.classList.remove('active');
          
          map.setTerrain(null);
          if (map.getSource('mapbox-dem')) {
            map.removeSource('mapbox-dem');
          }
        }
        
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
