// Enhanced Atmospheric Lighting System
    class AtmosphereController {
      constructor() {
        this.currentConditions = null;
        this.transitionInProgress = false;
      }

      // Proper solar position algorithm using SPA (Solar Position Algorithm)
      calculateSunPosition(date, lat, lng) {
        // Convert date to proper Pacific Time
        const pacificTime = this.convertToPacificTime(date);
        
        // Get Julian day number
        const jd = this.getJulianDayNumber(pacificTime);
        
        // Calculate sun position using simplified SPA algorithm
        const sunPos = this.calculateSolarPosition(jd, lat, lng, pacificTime);
        
        console.log(`Time: ${this.formatPacificTime(pacificTime)}, Sun altitude: ${sunPos.altitude.toFixed(1)}°, azimuth: ${sunPos.azimuth.toFixed(1)}°`);
        
        return sunPos;
      }

      // Convert UTC timestamp to proper Pacific Time (handles PDT/PST automatically)
      convertToPacificTime(date) {
        let d = new Date(date);
        
        // Check if timestamp appears to be already in Pacific Time
        // If the original string doesn't end in 'Z' and doesn't have timezone info,
        // it's likely already in local/Pacific time
        const isAlreadyPacific = typeof date === 'string' && 
          !date.endsWith('Z') && 
          !date.includes('+') && 
          !date.includes('GMT') &&
          !date.includes('UTC');
        
        if (isAlreadyPacific) {
          // Timestamp is already in Pacific Time, use directly
          console.log('Timestamp appears to be already in Pacific Time:', date);
          return {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            day: d.getDate(),
            hour: d.getHours(),
            minute: d.getMinutes(),
            second: d.getSeconds(),
            originalDate: d
          };
        }
        
        // If it's a UTC timestamp (ends with Z), convert to Pacific
        if (typeof date === 'string' && date.endsWith('Z')) {
          d = new Date(date);
        }
        
        // Convert to Pacific timezone using proper timezone handling
        const pacificTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).formatToParts(d);

        const year = parseInt(pacificTime.find(p => p.type === 'year').value);
        const month = parseInt(pacificTime.find(p => p.type === 'month').value);
        const day = parseInt(pacificTime.find(p => p.type === 'day').value);
        const hour = parseInt(pacificTime.find(p => p.type === 'hour').value);
        const minute = parseInt(pacificTime.find(p => p.type === 'minute').value);
        const second = parseInt(pacificTime.find(p => p.type === 'second').value);

        return { year, month, day, hour, minute, second, originalDate: d };
      }

      // Format Pacific time with correct PDT/PST designation
      formatPacificTime(pacificTime) {
        const { year, month, day, hour, minute, originalDate } = pacificTime;
        const isDST = this.isDaylightSavingTime(originalDate);
        const tz = isDST ? 'PDT' : 'PST';
        
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${tz}`;
      }

      // Check if date is during Daylight Saving Time
      isDaylightSavingTime(date) {
        // DST in US: Second Sunday in March to First Sunday in November
        const year = date.getFullYear();
        
        // Second Sunday in March
        const march = new Date(year, 2, 1); // March 1st
        const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
        
        // First Sunday in November  
        const november = new Date(year, 10, 1); // November 1st
        const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
        
        return date >= dstStart && date < dstEnd;
      }

      // Calculate Julian Day Number
      getJulianDayNumber(pacificTime) {
        const { year, month, day, hour, minute, second } = pacificTime;
        
        let y = year, m = month;
        if (month <= 2) {
          y -= 1;
          m += 12;
        }
        
        const a = Math.floor(y / 100);
        const b = 2 - a + Math.floor(a / 4);
        
        const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
        const dayFraction = (hour + minute/60 + second/3600) / 24;
        
        return jd + dayFraction;
      }

      // Simplified Solar Position Algorithm
      calculateSolarPosition(jd, lat, lng, pacificTime) {
        // Calculate centuries since J2000.0
        const n = jd - 2451545.0;
        const T = n / 36525.0;
        
        // Mean longitude of the sun (degrees)
        let L = (280.460 + 36000.771 * T) % 360;
        
        // Mean anomaly of the sun (degrees) 
        const g = this.toRad((357.528 + 35999.050 * T) % 360);
        
        // Ecliptic longitude of the sun (degrees)
        const lambda = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
        
        // Obliquity of the ecliptic (degrees)
        const epsilon = 23.439 - 0.013 * T;
        
        // Right ascension and declination
        const alpha = this.toDeg(Math.atan2(Math.cos(this.toRad(epsilon)) * Math.sin(this.toRad(lambda)), Math.cos(this.toRad(lambda))));
        const delta = this.toDeg(Math.asin(Math.sin(this.toRad(epsilon)) * Math.sin(this.toRad(lambda))));
        
        // Hour angle
        const { hour, minute } = pacificTime;
        const timeDecimal = hour + minute / 60;
        const H = 15 * (timeDecimal - 12) - lng + alpha;
        
        // Convert to altitude and azimuth
        const latRad = this.toRad(lat);
        const deltaRad = this.toRad(delta);
        const HRad = this.toRad(H);
        
        const altitude = this.toDeg(Math.asin(
          Math.sin(latRad) * Math.sin(deltaRad) + 
          Math.cos(latRad) * Math.cos(deltaRad) * Math.cos(HRad)
        ));
        
        const azimuth = this.toDeg(Math.atan2(
          -Math.sin(HRad),
          Math.tan(deltaRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(HRad)
        ));
        
        // Normalize azimuth to 0-360
        const normalizedAzimuth = (azimuth + 360) % 360;
        
        return { altitude, azimuth: normalizedAzimuth };
      }

      toRad(deg) {
        return deg * Math.PI / 180;
      }

      toDeg(rad) {
        return rad * 180 / Math.PI;
      }

      // Enhanced time period classification with more granular periods
      getTimePeriod(altitude, azimuth, season) {
        if (altitude < -18) return 'astronomicalNight';
        if (altitude < -12) return 'astronomicalTwilight';
        if (altitude < -6) return 'nauticalTwilight';
        if (altitude < -0.833) return 'civilTwilight'; // Actual sunrise/sunset
        if (altitude < 6) {
          // Determine if sunrise or sunset based on time and azimuth
          return azimuth < 180 ? 'sunrise' : 'sunset';
        }
        if (altitude < 15) {
          return azimuth < 180 ? 'morningGoldenHour' : 'eveningGoldenHour';
        }
        if (altitude < 25) return 'morning';
        if (altitude < 45) return 'midMorning';
        if (altitude < 60) return 'midday';
        return 'highNoon';
      }

      // Enhanced terrain classification based on lat/lng and elevation
      classifyTerrain(lat, lng, elevation, mile) {
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        const elevNum = parseFloat(elevation) || this.estimateElevation(mile);
        
        // PCT regional boundaries (approximate)
        const regions = {
          desert: { latMin: 32.5, latMax: 35.5, elevMax: 4000 },
          sierra: { latMin: 35.5, latMax: 40.0, elevMin: 3000, elevMax: 12000 },
          cascades: { latMin: 40.0, latMax: 49.0, elevMin: 2000, elevMax: 10000 }
        };
        
        let terrain = 'unknown';
        let biome = 'temperate';
        let exposure = 'moderate';
        
        // Determine base region
        if (latNum >= regions.desert.latMin && latNum <= regions.desert.latMax) {
          if (elevNum < regions.desert.elevMax) {
            terrain = elevNum < 2000 ? 'desert_floor' : 'desert_hills';
            biome = 'arid';
          } else {
            terrain = elevNum < 6000 ? 'chaparral' : 'montane_forest';
            biome = 'mediterranean';
          }
        } else if (latNum >= regions.sierra.latMin && latNum <= regions.sierra.latMax) {
          if (elevNum < 4000) {
            terrain = 'foothills';
            biome = 'mediterranean';
          } else if (elevNum < 8000) {
            terrain = 'montane_forest';
            biome = 'montane';
          } else if (elevNum < 10000) {
            terrain = 'subalpine';
            biome = 'subalpine';
          } else {
            terrain = 'alpine';
            biome = 'alpine';
            exposure = 'extreme';
          }
        } else if (latNum >= regions.cascades.latMin && latNum <= regions.cascades.latMax) {
          if (elevNum < 3000) {
            terrain = 'temperate_forest';
            biome = 'temperate';
          } else if (elevNum < 6000) {
            terrain = 'montane_forest';
            biome = 'montane';
          } else if (elevNum < 8000) {
            terrain = 'subalpine';
            biome = 'subalpine';
          } else {
            terrain = 'alpine';
            biome = 'alpine';
            exposure = 'extreme';
          }
        }
        
        // Determine exposure based on elevation and terrain
        if (elevNum > 9000) exposure = 'extreme';
        else if (elevNum > 6000) exposure = 'high';
        else if (terrain.includes('desert')) exposure = 'high';
        
        return { terrain, biome, exposure, elevation: elevNum };
      }

      // Estimate elevation from mile marker (fallback)
      estimateElevation(mile) {
        if (!mile || isNaN(parseFloat(mile))) return 3000;
        
        const m = parseFloat(mile);
        // Refined PCT elevation profile
        if (m < 100) return 2500;           // Campo area
        if (m < 300) return 4500;           // Laguna Mountains
        if (m < 500) return 1500;           // Desert floor
        if (m < 650) return 3500;           // San Bernardino approach
        if (m < 750) return 8000;           // San Bernardino Mountains
        if (m < 900) return 6500;           // Mojave/Tehachapi
        if (m < 1100) return 9000;          // Southern Sierra
        if (m < 1300) return 10500;         // High Sierra
        if (m < 1700) return 7000;          // Northern California
        if (m < 1900) return 5500;          // Oregon approach
        if (m < 2100) return 4500;          // Oregon Cascades
        if (m < 2400) return 5500;          // Washington approach  
        if (m < 2650) return 4000;          // North Cascades
        return 3200;                        // Canadian border
      }

      // Enhanced atmospheric conditions with terrain and weather
      getAtmosphericConditions(track) {
        const date = new Date(track.timestamp);
        const lat = parseFloat(track.lat);
        const lng = parseFloat(track.lng);
        const elevation = parseFloat(track.elevation) || this.estimateElevation(track.mile);
        
        console.log('Processing track:', track.name, 'Timestamp:', track.timestamp);
        
        // Calculate sun position
        const sunPos = this.calculateSunPosition(date, lat, lng);
        
        // Classify terrain
        const terrainInfo = this.classifyTerrain(lat, lng, elevation, track.mile);
        
        // Get season and weather effects
        const season = this.getSeason(date, lat);
        const weatherEffects = this.getWeatherEffects(track.weather || {});
        
        // Determine time period
        const period = this.getTimePeriod(sunPos.altitude, sunPos.azimuth, season);
        
        // Calculate enhanced colors and atmospheric effects
        const colors = this.calculateEnhancedColors(sunPos, period, season, terrainInfo, weatherEffects);
        
        console.log('Period:', period, 'Terrain:', terrainInfo.terrain, 'Biome:', terrainInfo.biome);
        
        return {
          sunPosition: sunPos,
          period,
          season,
          terrainInfo,
          weatherEffects,
          colors,
          fogSettings: this.calculateEnhancedFog(sunPos, period, terrainInfo, weatherEffects),
          lightSettings: this.calculateEnhancedLight(sunPos, period, season, terrainInfo)
        };
      }

      // Enhanced color calculation with terrain and weather
      calculateEnhancedColors(sunPos, period, season, terrainInfo, weatherEffects) {
        const baseColors = this.getBasePeriodColors(period);
        
        // Apply terrain modifications
        const terrainColors = this.applyTerrainColors(baseColors, terrainInfo);
        
        // Apply seasonal modifications
        const seasonalColors = this.applySeasonalColors(terrainColors, season, terrainInfo);
        
        // Apply weather effects
        const weatherColors = this.applyWeatherEffects(seasonalColors, weatherEffects);
        
        // Apply elevation effects (clearer at higher elevations)
        const elevationEffect = 1 + (terrainInfo.elevation - 3000) / 12000;
        if (elevationEffect > 1 && period !== 'astronomicalNight') {
          weatherColors.sky = this.adjustColorSaturation(weatherColors.sky, elevationEffect * 0.3);
        }
        
        return weatherColors;
      }

      // Base colors for each time period
      getBasePeriodColors(period) {
        const periodColors = {
          astronomicalNight: {
            sky: '#0a0a1a',
            fog: 'rgba(10, 10, 26, 0.8)',
            ambient: '#1a1a2a',
            horizon: '#1a1a2a'
          },
          astronomicalTwilight: {
            sky: '#1a1a3f',
            fog: 'rgba(26, 26, 63, 0.7)',
            ambient: '#2a2a4a',
            horizon: '#2a2a4a'
          },
          nauticalTwilight: {
            sky: '#2a2a5f',
            fog: 'rgba(42, 42, 95, 0.6)',
            ambient: '#3a3a5a',
            horizon: '#3a3a5a'
          },
          civilTwilight: {
            sky: '#4a4a7f',
            fog: 'rgba(74, 74, 127, 0.5)',
            ambient: '#5a5a7a',
            horizon: '#5a5a7a'
          },
          sunrise: {
            sky: '#ff8c42',
            fog: 'rgba(255, 140, 66, 0.4)',
            ambient: '#ffb88c',
            horizon: '#ffd4b8'
          },
          morningGoldenHour: {
            sky: '#ffd700',
            fog: 'rgba(255, 215, 0, 0.3)',
            ambient: '#ffe14d',
            horizon: '#fff0c8'
          },
          morning: {
            sky: '#87ceeb',
            fog: 'rgba(135, 206, 235, 0.25)',
            ambient: '#b8e6ff',
            horizon: '#d8f0ff'
          },
          midMorning: {
            sky: '#4da6ff',
            fog: 'rgba(77, 166, 255, 0.2)',
            ambient: '#99ccff',
            horizon: '#c8e6ff'
          },
          midday: {
            sky: '#1e90ff',
            fog: 'rgba(30, 144, 255, 0.15)',
            ambient: '#6bb6ff',
            horizon: '#a8d8ff'
          },
          highNoon: {
            sky: '#0080ff',
            fog: 'rgba(0, 128, 255, 0.1)',
            ambient: '#4da6ff',
            horizon: '#87ceeb'
          },
          eveningGoldenHour: {
            sky: '#ff7f00',
            fog: 'rgba(255, 127, 0, 0.3)',
            ambient: '#ffb366',
            horizon: '#ffe0cc'
          },
          sunset: {
            sky: '#ff4500',
            fog: 'rgba(255, 69, 0, 0.4)',
            ambient: '#ff8c66',
            horizon: '#ffccb8'
          }
        };
        
        return periodColors[period] || periodColors.midday;
      }

      // Apply terrain-specific color modifications
      applyTerrainColors(colors, terrainInfo) {
        const modifications = {
          desert_floor: { warmth: 1.3, saturation: 1.1 },
          desert_hills: { warmth: 1.2, saturation: 1.05 },
          chaparral: { warmth: 1.1, saturation: 1.0 },
          foothills: { warmth: 1.0, saturation: 1.0 },
          montane_forest: { warmth: 0.95, saturation: 0.98, greenTint: 0.1 },
          temperate_forest: { warmth: 0.9, saturation: 0.95, greenTint: 0.15 },
          subalpine: { warmth: 0.85, saturation: 1.1, blueTint: 0.1 },
          alpine: { warmth: 0.8, saturation: 1.2, blueTint: 0.2 }
        };
        
        const mod = modifications[terrainInfo.terrain] || modifications.foothills;
        
        return {
          sky: this.applyColorModification(colors.sky, mod),
          fog: colors.fog, // Will modify separately
          ambient: this.applyColorModification(colors.ambient, mod),
          horizon: this.applyColorModification(colors.horizon, mod)
        };
      }

      // Apply seasonal color modifications
      applySeasonalColors(colors, season, terrainInfo) {
        const seasonalMods = {
          winter: { warmth: 0.9, saturation: 0.9, brightness: 0.95 },
          spring: { warmth: 1.0, saturation: 1.05, brightness: 1.02 },
          summer: { warmth: 1.1, saturation: 1.1, brightness: 1.05 },
          autumn: { warmth: 1.15, saturation: 1.05, brightness: 0.98 }
        };
        
        const mod = seasonalMods[season];
        
        return {
          sky: this.applyColorModification(colors.sky, mod),
          fog: colors.fog,
          ambient: this.applyColorModification(colors.ambient, mod),
          horizon: this.applyColorModification(colors.horizon, mod)
        };
      }

      // Placeholder for weather effects (will be enhanced when weather data is added)
      getWeatherEffects(weather) {
        return {
          cloudCover: weather.cloudCover || 0,
          visibility: weather.visibility || 10,
          temperature: weather.temperature || 70,
          humidity: weather.humidity || 50,
          conditions: weather.conditions || 'clear'
        };
      }

      applyWeatherEffects(colors, weatherEffects) {
        // For now, return colors unchanged
        // Will enhance this when weather data is integrated
        return colors;
      }

      // Helper functions for color manipulation
      applyColorModification(color, mod) {
        // This is a simplified version - in production you'd use a proper color library
        return color;
      }

      adjustColorSaturation(color, factor) {
        // Simplified version
        return color;
      }

      // Enhanced fog calculation
      calculateEnhancedFog(sunPos, period, terrainInfo, weatherEffects) {
        const baseFog = {
          range: [0.5, 10],
          color: 'white',
          'horizon-blend': 0.1,
          'high-color': '#87CEEB',
          'space-color': '#000033',
          'star-intensity': 0
        };

        // Terrain-based fog modifications
        const terrainFogMods = {
          desert_floor: { range: [0.8, 15], intensity: 0.6 },
          alpine: { range: [1.2, 20], intensity: 1.2 },
          temperate_forest: { range: [0.3, 8], intensity: 1.1 }
        };

        const mod = terrainFogMods[terrainInfo.terrain] || { range: [0.5, 10], intensity: 1.0 };
        
        // Apply terrain modifications
        baseFog.range = mod.range;
        
        // Time-based modifications
        const timeFogMods = {
          astronomicalNight: { 'horizon-blend': 0.02, 'star-intensity': 0.9 },
          sunrise: { 'horizon-blend': 0.15, range: [0.3, 8] },
          morningGoldenHour: { 'horizon-blend': 0.12, range: [0.4, 9] },
          eveningGoldenHour: { 'horizon-blend': 0.12, range: [0.4, 9] },
          highNoon: { 'horizon-blend': 0.05, range: [1.0, 15] }
        };

        const timeMod = timeFogMods[period] || {};
        Object.assign(baseFog, timeMod);

        return baseFog;
      }

      // Enhanced lighting calculation
      calculateEnhancedLight(sunPos, period, season, terrainInfo) {
        let intensity = Math.max(0, Math.min(1, (sunPos.altitude + 10) / 70));
        
        // Terrain-based intensity modifications
        const terrainMods = {
          alpine: 1.3,
          desert_floor: 1.2,
          temperate_forest: 0.8
        };
        
        intensity *= terrainMods[terrainInfo.terrain] || 1.0;
        
        // Seasonal adjustments
        const seasonalIntensity = {
          winter: 0.85,
          spring: 0.95,
          summer: 1.1,
          autumn: 0.9
        };
        
        intensity *= seasonalIntensity[season] || 1;

        // Color based on time and terrain
        let color = '#ffffff';
        if (period === 'morningGoldenHour' || period === 'eveningGoldenHour') {
          color = '#ffcc66';
        } else if (period === 'sunrise' || period === 'sunset') {
          color = '#ff8844';
        }

        return {
          anchor: 'viewport',
          color: color,
          intensity: Math.max(0.1, intensity),
          position: [1.15, sunPos.azimuth, Math.max(5, sunPos.altitude)]
        };
      }

      getSeason(date, lat) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // Seasons for Northern Hemisphere
        if (month === 12 && day >= 21 || month <= 2 || month === 3 && day < 20) return 'winter';
        if (month === 3 && day >= 20 || month <= 5 || month === 6 && day < 21) return 'spring';
        if (month === 6 && day >= 21 || month <= 8 || month === 9 && day < 23) return 'summer';
        return 'autumn';
      }

      // Enhanced atmosphere application
      applyAtmosphere(track) {
        if (!map || !track) return;
        
        const conditions = this.getAtmosphericConditions(track);
        this.currentConditions = conditions;
        
        // Enhanced debug logging
        console.log('Applying enhanced atmosphere for track:', track.name);
        console.log('Time:', this.formatPacificTime(this.convertToPacificTime(track.timestamp)));
        console.log('Sun position:', conditions.sunPosition);
        console.log('Period:', conditions.period);
        console.log('Terrain:', conditions.terrainInfo);

        // Apply enhanced atmospheric effects
        this.applyEnhancedSky(conditions);
        this.applyEnhancedFog(conditions);
        this.applyEnhanced3DEffects(conditions);
        this.applyFallbackAtmosphere(conditions);
        
        // Enhanced notification with more detail
        const timeDesc = conditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
        const terrainDesc = conditions.terrainInfo.terrain.replace(/_/g, ' ');
        showNotification(`${timeDesc} in ${terrainDesc} (${conditions.terrainInfo.elevation}ft)`, 3000);
      }

      applyEnhancedSky(conditions) {
        if (typeof map.setSky === 'function') {
          const sunIntensity = conditions.period === 'astronomicalNight' ? 1 : 
                              conditions.period.includes('twilight') ? 5 : 15;
          
          map.setSky({
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [conditions.sunPosition.azimuth, Math.max(0, conditions.sunPosition.altitude)],
            'sky-atmosphere-sun-intensity': sunIntensity,
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
      }

      applyEnhancedFog(conditions) {
        if (typeof map.setFog === 'function') {
          const fogConfig = {
            ...conditions.fogSettings,
            color: conditions.colors.fog
          };
          
          // Enhanced v3 features
          if (map.version && map.version >= '3.0.0') {
            fogConfig['high-color'] = conditions.colors.sky;
            fogConfig['space-color'] = conditions.period === 'astronomicalNight' ? '#000011' : '#000066';
          }
          
          map.setFog(fogConfig);
        }
      }

      applyEnhanced3DEffects(conditions) {
        if (uiController.is3DEnabled && typeof map.setLight === 'function') {
          map.setLight(conditions.lightSettings);
        }
      }

      // Enhanced CSS fallback with terrain-aware effects
      applyFallbackAtmosphere(conditions) {
        if (typeof map.setSky !== 'function' || typeof map.setFog !== 'function') {
          const existingOverlay = document.getElementById('atmosphere-overlay');
          if (existingOverlay) {
            existingOverlay.remove();
          }

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
          
          // Enhanced gradients based on terrain and conditions
          const gradient = this.createEnhancedGradient(conditions);
          overlay.style.background = gradient;
          
          // Enhanced filter effects
          const filter = this.createEnhancedFilter(conditions);
          const mapContainer = document.getElementById('map');
          mapContainer.style.filter = filter;
          mapContainer.style.transition = 'filter 2s ease-in-out';
          
          mapContainer.appendChild(overlay);
        }
      }

      createEnhancedGradient(conditions) {
        const { period, terrainInfo } = conditions;
        
        // Base gradients enhanced with terrain considerations
        const gradients = {
          astronomicalNight: 'radial-gradient(ellipse at center, rgba(10, 10, 26, 0.4), rgba(10, 10, 26, 0.7))',
          sunrise: terrainInfo.terrain.includes('desert') ? 
                  'linear-gradient(to bottom, rgba(255, 140, 66, 0.3) 0%, rgba(255, 184, 140, 0.2) 50%, transparent 100%)' :
                  'linear-gradient(to bottom, rgba(255, 107, 53, 0.25) 0%, rgba(255, 184, 140, 0.15) 50%, transparent 100%)',
          morningGoldenHour: 'linear-gradient(to bottom, rgba(255, 215, 0, 0.25) 0%, rgba(255, 225, 77, 0.12) 50%, transparent 100%)',
          alpine: 'radial-gradient(ellipse at center, rgba(135, 206, 235, 0.1), rgba(200, 220, 255, 0.05))'
        };
        
        return gradients[period] || (terrainInfo.elevation > 8000 ? 
                gradients.alpine : 'radial-gradient(ellipse at center, transparent, rgba(135, 206, 235, 0.03))');
      }

      createEnhancedFilter(conditions) {
        const { period, terrainInfo, weatherEffects } = conditions;
        
        const filters = {
          astronomicalNight: 'brightness(0.5) contrast(1.2) saturate(0.8)',
          astronomicalTwilight: 'brightness(0.6) contrast(1.15) saturate(0.85)',
          nauticalTwilight: 'brightness(0.7) contrast(1.1) saturate(0.9)',
          civilTwilight: 'brightness(0.8) contrast(1.05) saturate(0.95)',
          sunrise: 'brightness(1.05) contrast(1.1) saturate(1.2) sepia(0.08)',
          morningGoldenHour: 'brightness(1.1) contrast(1.05) saturate(1.15) sepia(0.05)',
          eveningGoldenHour: 'brightness(1.08) contrast(1.08) saturate(1.18) sepia(0.06)',
          sunset: 'brightness(1.03) contrast(1.12) saturate(1.25) sepia(0.1)',
          morning: 'brightness(1.02) saturate(1.05)',
          midMorning: 'brightness(1.0) contrast(1.0) saturate(1.02)',
          midday: 'brightness(1.0) contrast(1.0)',
          highNoon: 'brightness(1.05) contrast(1.02) saturate(1.05)'
        };
        
        let filter = filters[period] || filters.midday;
        
        // Terrain-based filter adjustments
        if (terrainInfo.terrain.includes('desert')) {
          filter += ' hue-rotate(5deg)'; // Slightly warmer
        } else if (terrainInfo.terrain.includes('alpine')) {
          filter += ' hue-rotate(-3deg)'; // Slightly cooler
        }
        
        return filter;
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
