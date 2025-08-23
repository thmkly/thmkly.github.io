    // Atmospheric Lighting System
    class AtmosphereController {
      constructor() {
        this.currentConditions = null;
        this.transitionInProgress = false;
      }

      // Calculate sun position using solar position algorithm
      calculateSunPosition(date, lat, lng) {
        // Parse the date - timestamps come in as UTC but represent PDT times
        let d = new Date(date);
        
        let hours, minutes, month, day;
        
        if (typeof date === 'string' && date.endsWith('Z')) {
          // The timestamp is in UTC format but we need to convert back to Pacific Time
          // Since the recordings were made in PDT, we need to subtract 7 hours from UTC
          month = d.getUTCMonth() + 1;
          day = d.getUTCDate();
          
          // Determine if PDT (March-November) or PST
          const isDST = month >= 3 && month <= 11;
          const hoursOffset = isDST ? 7 : 8;
          
          // Convert UTC hours back to Pacific Time
          hours = d.getUTCHours() - hoursOffset;
          if (hours < 0) {
            hours += 24; // Handle day boundary
            day -= 1;
          }
          minutes = d.getUTCMinutes();
          
          console.log(`UTC timestamp ${date} converted to Pacific Time: ${hours}:${minutes.toString().padStart(2, '0')} ${isDST ? 'PDT' : 'PST'}`);
        } else {
          // Use as-is
          hours = d.getHours();
          minutes = d.getMinutes();
          month = d.getMonth() + 1;
          day = d.getDate();
        }
        
        // Simple sun position based on time of day
        const timeDecimal = hours + minutes / 60;
        
        // Approximate sun path based on season and latitude
        const dayLength = this.getDayLength(month, lat);
        const sunrise = 12 - dayLength / 2;
        const sunset = 12 + dayLength / 2;
        
        let altitude, azimuth;
        
        if (timeDecimal < sunrise || timeDecimal > sunset) {
          // Night time - sun below horizon
          const hoursAfterSunset = timeDecimal - sunset;
          const hoursBeforeSunrise = sunrise - timeDecimal;
          
          if (hoursAfterSunset > 0 && hoursAfterSunset < 1) {
            // Just after sunset - civil twilight
            altitude = -6;
          } else if (hoursBeforeSunrise > 0 && hoursBeforeSunrise < 1) {
            // Just before sunrise - civil twilight
            altitude = -6;
          } else {
            // Deep night
            altitude = -20;
          }
          azimuth = 0;
        } else {
          // Daytime - calculate sun position
          const dayProgress = (timeDecimal - sunrise) / dayLength;
          
          // Altitude: peaks at solar noon (around 12pm)
          // Maximum altitude varies by season and latitude
          const maxAltitude = this.getMaxSolarAltitude(month, lat);
          altitude = maxAltitude * Math.sin(dayProgress * Math.PI);
          
          // Azimuth: East (90) at sunrise, South (180) at noon, West (270) at sunset
          azimuth = 90 + (dayProgress * 180);
        }
        
        console.log(`Pacific Time: ${hours}:${minutes.toString().padStart(2, '0')}, Sunrise: ${sunrise.toFixed(1)}h, Sunset: ${sunset.toFixed(1)}h, Sun altitude: ${altitude.toFixed(1)}°`);
        
        return { altitude, azimuth };
      }
      
      // Get maximum solar altitude based on season and latitude
      getMaxSolarAltitude(month, lat) {
        // Solar declination angle (approximation)
        const dayOfYear = month * 30; // Rough approximation
        const declination = 23.45 * Math.sin(this.toRad((360 * (284 + dayOfYear)) / 365));
        
        // Maximum altitude when sun crosses meridian
        const maxAltitude = 90 - Math.abs(lat - declination);
        
        return Math.min(90, Math.max(20, maxAltitude));
      }
      
      // Get approximate day length based on month and latitude
      getDayLength(month, lat) {
        // Base day length (hours)
        let baseLength = 12;
        
        // Seasonal adjustment
        const seasonalFactor = Math.sin((month - 3) * Math.PI / 6); // Peak in June, minimum in December
        
        // Latitude adjustment (longer days in summer at higher latitudes)
        const latitudeFactor = Math.abs(lat - 23.5) / 66.5; // 0 at tropic, 1 at arctic
        
        // Summer months (May-August)
        if (month >= 5 && month <= 8) {
          baseLength = 12 + (4 * latitudeFactor * seasonalFactor); // Up to 16 hours in summer
        }
        // Winter months (November-February)
        else if (month >= 11 || month <= 2) {
          baseLength = 12 - (3 * latitudeFactor * Math.abs(seasonalFactor)); // Down to 9 hours in winter
        }
        // Spring/Fall
        else {
          baseLength = 12 + (2 * latitudeFactor * seasonalFactor);
        }
        
        return Math.max(9, Math.min(16, baseLength));
      }

      getJulianDate(date) {
        return date.getTime() / 86400000 + 2440587.5;
      }

      getTimezoneOffset(date) {
        // PCT is in Pacific timezone, accounting for DST
        const month = date.getMonth() + 1;
        const isDST = month >= 3 && month <= 11; // Simplified DST check
        return isDST ? 7 : 8; // PDT = UTC-7, PST = UTC-8
      }

      toRad(deg) {
        return deg * Math.PI / 180;
      }

      toDeg(rad) {
        return rad * 180 / Math.PI;
      }

      // Get atmospheric conditions based on sun position, elevation, and weather
      getAtmosphericConditions(track) {
        const date = new Date(track.timestamp);
        const lat = parseFloat(track.lat);
        const lng = parseFloat(track.lng);
        
        console.log('Processing track:', track.name, 'Timestamp:', track.timestamp);
        
        // Calculate sun position
        const sunPos = this.calculateSunPosition(date, lat, lng);
        
        // Estimate elevation effect (if mile marker available, use PCT elevation profile)
        const elevationEffect = this.getElevationEffect(track.mile);
        
        // Determine time period based on sun altitude
        const period = this.getTimePeriod(sunPos.altitude);
        
        // Get season
        const season = this.getSeason(date, lat);
        
        // Calculate colors and intensity
        const colors = this.calculateColors(sunPos, period, season, elevationEffect);
        
        console.log('Determined period:', period, 'for altitude:', sunPos.altitude);
        
        return {
          sunPosition: sunPos,
          period,
          season,
          elevationEffect,
          colors,
          fogSettings: this.calculateFog(sunPos, period, elevationEffect),
          lightSettings: this.calculateLight(sunPos, period, season)
        };
      }

      getElevationEffect(mile) {
        // PCT elevation profile approximation (in feet)
        // This is simplified - you could add detailed elevation data
        let elevation = 2500; // Default
        
        if (mile && !isNaN(parseFloat(mile))) {
          const m = parseFloat(mile);
          // Rough PCT elevation profile
          if (m < 100) elevation = 2500;           // Campo area
          else if (m < 700) elevation = 5500;      // Desert/San Bernardino
          else if (m < 1100) elevation = 8000;     // Sierra Nevada
          else if (m < 1700) elevation = 6500;     // Northern California
          else if (m < 2100) elevation = 5000;     // Oregon Cascades
          else if (m < 2650) elevation = 4500;     // Washington Cascades
          else elevation = 3800;                   // Canadian border
        }
        
        // Higher elevation = clearer atmosphere, more intense colors
        const effect = 1 + (elevation - 2500) / 10000;
        return Math.min(Math.max(effect, 0.8), 1.5);
      }

      getTimePeriod(altitude) {
        if (altitude < -18) return 'night';
        if (altitude < -12) return 'astronomicalTwilight';
        if (altitude < -6) return 'nauticalTwilight';  
        if (altitude < -0.5) return 'civilTwilight';
        if (altitude < 6) return 'sunrise';
        if (altitude < 15) return 'goldenHour';
        if (altitude < 30) return 'morning';
        if (altitude < 60) return 'midday';
        return 'noon';
      }

      getSeason(date, lat) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // Approximate seasons for Northern Hemisphere
        if (month === 12 && day >= 21 || month <= 2 || month === 3 && day < 20) return 'winter';
        if (month === 3 && day >= 20 || month <= 5 || month === 6 && day < 21) return 'spring';
        if (month === 6 && day >= 21 || month <= 8 || month === 9 && day < 23) return 'summer';
        return 'autumn';
      }

      calculateColors(sunPos, period, season, elevationEffect) {
        const colors = {
          sky: '#87CEEB',
          fog: 'rgba(255, 255, 255, 0.4)',
          ambient: '#ffffff',
          horizon: '#E0F6FF'
        };

        // Period-based colors
        const periodColors = {
          night: {
            sky: '#0a1929',
            fog: 'rgba(15, 25, 45, 0.7)',
            ambient: '#1a2a3a',
            horizon: '#1c2e4a'
          },
          astronomicalTwilight: {
            sky: '#1a2a3f',
            fog: 'rgba(30, 40, 60, 0.6)',
            ambient: '#2a3a4a',
            horizon: '#2c3e5a'
          },
          nauticalTwilight: {
            sky: '#2a3a5f',
            fog: 'rgba(50, 60, 80, 0.5)',
            ambient: '#3a4a5a',
            horizon: '#3c4e6a'
          },
          civilTwilight: {
            sky: '#4a5a7f',
            fog: 'rgba(100, 110, 130, 0.4)',
            ambient: '#5a6a7a',
            horizon: '#5c6e8a'
          },
          sunrise: {
            sky: '#ff6b35',
            fog: 'rgba(255, 150, 100, 0.3)',
            ambient: '#ffb88c',
            horizon: '#ffd4b8'
          },
          goldenHour: {
            sky: '#ffd700',
            fog: 'rgba(255, 215, 150, 0.25)',
            ambient: '#ffe14d',
            horizon: '#fff0c8'
          },
          morning: {
            sky: '#87ceeb',
            fog: 'rgba(200, 220, 255, 0.2)',
            ambient: '#b8e6ff',
            horizon: '#d8f0ff'
          },
          midday: {
            sky: '#4da6ff',
            fog: 'rgba(180, 210, 255, 0.15)',
            ambient: '#99ccff',
            horizon: '#c8e6ff'
          },
          noon: {
            sky: '#1e90ff',
            fog: 'rgba(160, 200, 255, 0.1)',
            ambient: '#6bb6ff',
            horizon: '#a8d8ff'
          }
        };

        // Apply period colors
        Object.assign(colors, periodColors[period] || periodColors.midday);

        // Seasonal adjustments
        const seasonalAdjustments = {
          winter: { saturation: 0.8, brightness: 0.9 },
          spring: { saturation: 1.1, brightness: 1.05 },
          summer: { saturation: 1.2, brightness: 1.1 },
          autumn: { saturation: 1.15, brightness: 0.95, warmth: 1.2 }
        };

        const adjustment = seasonalAdjustments[season];
        if (adjustment && period !== 'night') {
          // Apply seasonal color temperature adjustments
          colors.sky = this.adjustColor(colors.sky, adjustment);
          colors.ambient = this.adjustColor(colors.ambient, adjustment);
        }

        // Apply elevation effect (higher = clearer, more saturated)
        if (elevationEffect > 1) {
          colors.sky = this.adjustColor(colors.sky, { saturation: elevationEffect, brightness: elevationEffect * 0.5 });
        }

        return colors;
      }

      adjustColor(color, adjustment) {
        // Simple color adjustment (would be more complex in production)
        // This is a placeholder - you might want to use a proper color library
        return color;
      }

      calculateFog(sunPos, period, elevationEffect) {
        const baseFog = {
          range: [0.5, 10],
          color: 'white',
          'horizon-blend': 0.1,
          'high-color': '#87CEEB',
          'space-color': '#000000',
          'star-intensity': 0
        };

        // Adjust fog based on time of day
        const fogProfiles = {
          night: { range: [0.5, 12], 'horizon-blend': 0.05, 'star-intensity': 0.8 },
          sunrise: { range: [0.3, 8], 'horizon-blend': 0.15, 'star-intensity': 0.2 },
          goldenHour: { range: [0.4, 9], 'horizon-blend': 0.12, 'star-intensity': 0 },
          morning: { range: [0.5, 10], 'horizon-blend': 0.1, 'star-intensity': 0 },
          midday: { range: [0.8, 12], 'horizon-blend': 0.08, 'star-intensity': 0 },
          noon: { range: [1, 15], 'horizon-blend': 0.05, 'star-intensity': 0 }
        };

        Object.assign(baseFog, fogProfiles[period] || fogProfiles.midday);
        
        // Adjust for elevation (less fog at higher elevations)
        baseFog.range[0] *= elevationEffect;
        baseFog.range[1] *= elevationEffect;

        return baseFog;
      }

      calculateLight(sunPos, period, season) {
        // Light intensity based on sun altitude
        let intensity = Math.max(0, Math.min(1, (sunPos.altitude + 10) / 70));
        
        // Seasonal intensity adjustments
        const seasonIntensity = {
          winter: 0.8,
          spring: 0.95,
          summer: 1.1,
          autumn: 0.9
        };
        
        intensity *= seasonIntensity[season] || 1;

        return {
          anchor: 'viewport',
          color: period === 'goldenHour' || period === 'sunrise' ? '#ffcc66' : '#ffffff',
          intensity: intensity,
          position: [1.15, sunPos.azimuth, sunPos.altitude]
        };
      }

      applyAtmosphere(track) {
        if (!map || !track) return;
        
        const conditions = this.getAtmosphericConditions(track);
        this.currentConditions = conditions;
        
        // Debug logging
        console.log('Applying atmosphere for track:', track.name);
        console.log('Time:', track.timestamp);
        console.log('Sun position:', conditions.sunPosition);
        console.log('Period:', conditions.period);

        // Check if Sky API is available
        if (typeof map.setSky === 'function') {
          map.setSky({
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [conditions.sunPosition.azimuth, Math.max(0, conditions.sunPosition.altitude)],
            'sky-atmosphere-sun-intensity': conditions.period === 'night' ? 2 : 15,
            'sky-atmosphere-color': conditions.colors.sky,
            'sky-gradient': [
              'interpolate',
              ['linear'],
              ['sky-radial-progress'],
              0.8,
              conditions.colors.horizon,
              1,
              conditions.colors.sky
            ]
          });
        }

        // Check if Fog API is available
        if (typeof map.setFog === 'function') {
          const fogConfig = {
            ...conditions.fogSettings,
            color: conditions.colors.fog
          };
          
          // Add v3 features if available
          if (map.version && map.version >= '3.0.0') {
            fogConfig['high-color'] = conditions.colors.sky;
            fogConfig['space-color'] = conditions.period === 'night' ? '#000011' : '#000066';
            fogConfig['star-intensity'] = conditions.period === 'night' ? 0.8 : 
                                         conditions.period.includes('twilight') ? 0.4 : 0;
          }
          
          map.setFog(fogConfig);
        }

        // Apply light if 3D is enabled and API is available
        if (uiController.is3DEnabled && typeof map.setLight === 'function') {
          map.setLight({
            ...conditions.lightSettings,
            anchor: 'viewport',
            color: conditions.period === 'goldenHour' || conditions.period === 'sunrise' ? 
                   'rgba(255, 200, 100, 1)' : 'white',
            position: [1.5, conditions.sunPosition.azimuth, Math.max(5, conditions.sunPosition.altitude)]
          });
        }

        // If Sky/Fog APIs aren't available, use CSS fallback
        if (typeof map.setSky !== 'function' || typeof map.setFog !== 'function') {
          this.applyFallbackAtmosphere(conditions);
        }
        
        // Show notification about current conditions
        const timeDesc = conditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
        showNotification(`Atmosphere: ${timeDesc}`, 2500);
      }

      // CSS fallback for atmospheric effects when APIs aren't available
      applyFallbackAtmosphere(conditions) {
        // Remove existing overlay if present
        const existingOverlay = document.getElementById('atmosphere-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Create atmospheric overlay
        const overlay = document.createElement('div');
        overlay.id = 'atmosphere-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1';
        overlay.style.transition = 'all 2s ease-in-out';
        
        // Apply atmospheric gradient based on time period
        const overlayEffects = {
          night: 'radial-gradient(ellipse at center, rgba(10, 25, 41, 0.3), rgba(10, 25, 41, 0.6))',
          astronomicalTwilight: 'radial-gradient(ellipse at center, rgba(26, 42, 63, 0.2), rgba(26, 42, 63, 0.5))',
          nauticalTwilight: 'radial-gradient(ellipse at center, rgba(42, 58, 95, 0.2), rgba(42, 58, 95, 0.4))',
          civilTwilight: 'radial-gradient(ellipse at center, rgba(74, 90, 127, 0.15), rgba(74, 90, 127, 0.35))',
          sunrise: 'linear-gradient(to bottom, rgba(255, 107, 53, 0.25) 0%, rgba(255, 184, 140, 0.15) 50%, transparent 100%)',
          goldenHour: 'linear-gradient(to bottom, rgba(255, 215, 0, 0.2) 0%, rgba(255, 225, 77, 0.1) 50%, transparent 100%)',
          morning: 'radial-gradient(ellipse at center, transparent, rgba(135, 206, 235, 0.05))',
          midday: 'radial-gradient(ellipse at center, transparent, transparent)',
          noon: 'radial-gradient(ellipse at center, transparent, transparent)'
        };

        const gradient = overlayEffects[conditions.period] || overlayEffects.midday;
        overlay.style.background = gradient;
        
        // Add filter effects for time of day
        const filterEffects = {
          night: 'brightness(0.6) contrast(1.1) saturate(0.8)',
          astronomicalTwilight: 'brightness(0.7) contrast(1.05) saturate(0.9)',
          nauticalTwilight: 'brightness(0.8) contrast(1.05)',
          civilTwilight: 'brightness(0.9) contrast(1.02)',
          sunrise: 'brightness(1.05) contrast(1.1) saturate(1.2) sepia(0.1)',
          goldenHour: 'brightness(1.1) contrast(1.05) saturate(1.15) sepia(0.05)',
          morning: 'brightness(1.05) saturate(1.05)',
          midday: 'brightness(1) contrast(1)',
          noon: 'brightness(1.05) contrast(1.02) saturate(1.05)'
        };

        const mapContainer = document.getElementById('map');
        mapContainer.style.filter = filterEffects[conditions.period] || filterEffects.midday;
        mapContainer.style.transition = 'filter 2s ease-in-out';
        
        mapContainer.appendChild(overlay);
      }

      // Simplified style adjustments that work with any Mapbox version
      adjustMapStyleV3(conditions) {
        // Only try to adjust water layer if it exists
        try {
          if (map.getLayer('water')) {
            const waterColor = conditions.period === 'night' ? '#001133' :
                              conditions.period === 'sunrise' ? '#4488aa' :
                              conditions.period === 'goldenHour' ? '#6699bb' :
                              '#4da6ff';
            map.setPaintProperty('water', 'fill-color', waterColor);
          }
        } catch (e) {
          // Layer might not exist in this style
        }

        // Adjust terrain if 3D is enabled
        if (uiController.is3DEnabled && map.getTerrain) {
          try {
            const exaggeration = conditions.period === 'goldenHour' || conditions.period === 'sunrise' ? 2 : 1.5;
            map.setTerrain({ 
              'source': 'mapbox-dem', 
              'exaggeration': exaggeration 
            });
          } catch (e) {
            // Terrain might not be available
          }
        }
      }

      adjustMapStyle(conditions) {
        // Adjust layer colors based on atmospheric conditions
        const layers = map.getStyle().layers;
        
        // Brightness factor based on sun altitude
        const brightnessFactor = conditions.period === 'night' ? 0.4 : 
                                 conditions.period === 'sunrise' || conditions.period === 'goldenHour' ? 0.8 :
                                 1;

        // This would adjust specific layer properties
        // Note: This is simplified - you'd want to be more selective about which layers to modify
        if (conditions.period === 'night' || conditions.sunPosition.altitude < 0) {
          // Darken the map for night time
          if (map.getLayer('background')) {
            map.setPaintProperty('background', 'background-color', '#0a1929');
          }
        }
      }

      // Smooth transition when switching tracks
      transitionToTrack(track, duration = 2000) {
        if (this.transitionInProgress) return;
        this.transitionInProgress = true;

        // Apply new atmospheric conditions
        this.applyAtmosphere(track);

        setTimeout(() => {
          this.transitionInProgress = false;
        }, duration);
      }
    }
