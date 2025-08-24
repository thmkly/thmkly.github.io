// Enhanced atmosphere application with simple smooth transitions
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

        // Apply atmospheric effects with your original approach but add transitions
        this.applyEnhancedSkyWithTransition(conditions);
        this.applyEnhancedFogWithTransition(conditions);
        this.applyEnhanced3DEffects(conditions);
        this.applyOriginalFallbackWithTransition(conditions);
        
        // Enhanced notification with more detail
        const timeDesc = conditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
        const terrainDesc = conditions.terrainInfo.terrain.replace(/_/g, ' ');
        const elevationDisplay = Math.round(conditions.terrainInfo.elevation / 100) * 100;
        showNotification(`${timeDesc} in ${terrainDesc} (${elevationDisplay}ft)`, 3000);
      }

      applyEnhancedSkyWithTransition(conditions) {
        if (typeof map.setSky === 'function') {
          const sunIntensity = conditions.period === 'astronomicalNight' ? 1 : 
                              conditions.period.includes('twilight') ? 5 : 15;
          
          // Set sky with transition - let Mapbox handle the smoothing
          map.setSky({
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [conditions.sunPosition.azimuth, Math.max(0, conditions.sunPosition.altitude)],
            'sky-atmosphere-sun-intensity': sunIntensity,
            'sky-atmosphere-color': conditions      // Subtle atmospheric effects that don't wash out the// Enhanced Atmospheric Lighting System
    class AtmosphereController {
      constructor() {
        this.currentConditions = null;
        this.transitionInProgress = false;
      }
      
      // Helper to get day of year
      getDayOfYear(year, month, day) {
        const date = new Date(year, month - 1, day);
        const start = new Date(year, 0, 1);
        return Math.floor((date - start) / (24 * 60 * 60 * 1000)) + 1;
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

      // Simplified but accurate solar position calculation
      calculateSunPosition(date, lat, lng) {
        const pacificTime = this.convertToPacificTime(date);
        const { year, month, day, hour, minute } = pacificTime;
        
        console.log(`Calculating sun position for: ${hour}:${minute.toString().padStart(2, '0')} PDT`);
        
        // Convert to decimal hour
        const timeDecimal = hour + minute / 60;
        
        // Simplified sunrise/sunset calculation for PCT latitude range
        // This is much more reliable than complex solar algorithms
        const dayOfYear = this.getDayOfYear(year, month, day);
        const latRad = lat * Math.PI / 180;
        
        // Solar declination (approximate)
        const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
        const declinationRad = declination * Math.PI / 180;
        
        // Hour angle for sunrise/sunset
        const hourAngleRad = Math.acos(-Math.tan(latRad) * Math.tan(declinationRad));
        const hourAngle = hourAngleRad * 180 / Math.PI / 15; // Convert to hours
        
        // Solar noon occurs around 12:00 with longitude adjustment
        // Longitude correction: 4 minutes per degree from timezone center
        // Pacific Time center is around -120°, so adjust from there
        const longitudeOffset = (lng - (-120)) / 15; // Convert degrees to hours
        const solarNoon = 12 + longitudeOffset;
        const sunrise = solarNoon - hourAngle;
        const sunset = solarNoon + hourAngle;
        
        console.log(`Solar times - Sunrise: ${sunrise.toFixed(1)}h, Sunset: ${sunset.toFixed(1)}h, Solar noon: ${solarNoon.toFixed(1)}h`);
        
        let altitude, azimuth;
        
        if (timeDecimal < sunrise || timeDecimal > sunset) {
          // Night time - sun is below horizon
          const hoursAfterSunset = timeDecimal > sunset ? timeDecimal - sunset : 24 - sunset + timeDecimal;
          const hoursBeforeSunrise = timeDecimal < sunrise ? sunrise - timeDecimal : sunrise + 24 - timeDecimal;
          
          if (Math.min(hoursAfterSunset, hoursBeforeSunrise) < 1) {
            altitude = -3; // Civil twilight
          } else if (Math.min(hoursAfterSunset, hoursBeforeSunrise) < 2) {
            altitude = -10; // Deeper twilight
          } else {
            altitude = -20; // Night
          }
          azimuth = timeDecimal < 12 ? 90 : 270; // East before noon, west after
        } else {
          // Daytime - sun is above horizon
          const dayProgress = (timeDecimal - sunrise) / (sunset - sunrise);
          
          // Maximum sun altitude at solar noon (realistic for latitude and season)
          const maxAltitude = this.getMaxSolarAltitude(month, lat);
          
          // Proper sine curve: altitude = maxAltitude * sin(π * dayProgress)
          // This peaks at dayProgress = 0.5 (solar noon) and is 0 at sunrise/sunset
          altitude = maxAltitude * Math.sin(dayProgress * Math.PI);
          
          // Azimuth from east (90°) to west (270°)
          azimuth = 90 + (dayProgress * 180);
          
          console.log(`Day progress: ${(dayProgress * 100).toFixed(1)}%, Max altitude: ${maxAltitude.toFixed(1)}°`);
        }
        
        console.log(`Final result - Sun altitude: ${altitude.toFixed(1)}°, azimuth: ${azimuth.toFixed(1)}°`);
        
        return { altitude, azimuth };
      }
      
      // Get realistic maximum solar altitude for location and season
      getMaxSolarAltitude(month, lat) {
        // Solar declination varies from +23.45° (summer solstice) to -23.45° (winter solstice)
        const dayOfYear = month * 30; // Rough approximation
        const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
        
        // Maximum altitude when sun crosses meridian: 90° - |latitude - declination|
        const maxAltitude = 90 - Math.abs(lat - declination);
        
        // Realistic bounds for PCT latitudes (32-49°N)
        return Math.min(85, Math.max(20, maxAltitude));
      }

      toRad(deg) {
        return deg * Math.PI / 180;
      }

      toDeg(rad) {
        return rad * 180 / Math.PI;
      }

      // Enhanced time period classification using both sun angle and time of day
      getTimePeriod(altitude, azimuth, season, hour) {
        if (altitude < -18) return 'astronomicalNight';
        if (altitude < -12) return 'astronomicalTwilight';
        if (altitude < -6) return 'nauticalTwilight';
        if (altitude < -0.833) return 'civilTwilight';
        
        // For daytime, use time of day as primary factor, altitude as secondary
        if (altitude > 0) {
          // Very early/late in day - sunrise/sunset regardless of altitude
          if (hour <= 6 || hour >= 19) {
            return altitude < 8 ? (hour <= 6 ? 'sunrise' : 'sunset') : 
                   (hour <= 6 ? 'morningGoldenHour' : 'eveningGoldenHour');
          }
          
          // Morning hours (6 AM - 11:30 AM)
          if (hour >= 6 && hour < 11.5) {
            if (altitude < 10) return 'morningGoldenHour';
            if (hour < 9) return 'morning';
            if (hour < 11) return 'midMorning';
            return 'lateMorning'; // 11:00-11:30 AM
          }
          
          // Solar noon period (11:30 AM - 12:30 PM)
          if (hour >= 11.5 && hour <= 12.5) {
            return altitude > 45 ? 'highNoon' : 'midday';
          }
          
          // Afternoon hours (12:30 PM - 6 PM)  
          if (hour > 12.5 && hour < 18) {
            if (hour < 14) return 'earlyAfternoon';
            if (hour < 16) return 'midAfternoon';
            if (altitude > 10) return 'lateAfternoon';
            return 'eveningGoldenHour';
          }
          
          // Evening hours (6 PM+)
          if (altitude > 8) return 'evening';
          if (altitude > 3) return 'eveningGoldenHour';
          return 'sunset';
        }
        
        // Fallback for edge cases
        return 'midday';
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
        const period = this.getTimePeriod(sunPos.altitude, sunPos.azimuth, season, this.convertToPacificTime(track.timestamp).hour);
        
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

      // Realistic but not overly bright color schemes
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
            sky: '#ff7f50',
            fog: 'rgba(255, 127, 80, 0.3)',
            ambient: '#ffaa88',
            horizon: '#ffddcc'
          },
          morningGoldenHour: {
            sky: '#ffb347',
            fog: 'rgba(255, 179, 71, 0.25)',
            ambient: '#ffcc88',
            horizon: '#ffe6cc'
          },
          morning: {
            sky: '#87ceeb',
            fog: 'rgba(135, 206, 235, 0.2)',
            ambient: '#aaccdd',
            horizon: '#ccddee'
          },
          midMorning: {
            sky: '#6db4ff',
            fog: 'rgba(109, 180, 255, 0.15)',
            ambient: '#88ccff',
            horizon: '#aaddff'
          },
          lateMorning: {
            sky: '#4a9eff',
            fog: 'rgba(74, 158, 255, 0.12)',
            ambient: '#77bbff',
            horizon: '#99ccff'
          },
          midday: {
            sky: '#3399ff',
            fog: 'rgba(51, 153, 255, 0.08)',
            ambient: '#66aaff',
            horizon: '#88bbff'
          },
          highNoon: {
            sky: '#2288ff',
            fog: 'rgba(34, 136, 255, 0.05)',
            ambient: '#5599ff',
            horizon: '#77aaff'
          },
          earlyAfternoon: {
            sky: '#4499ff',
            fog: 'rgba(68, 153, 255, 0.1)',
            ambient: '#77bbff',
            horizon: '#aaccff'
          },
          midAfternoon: {
            sky: '#5aa3ff',
            fog: 'rgba(90, 163, 255, 0.12)',
            ambient: '#88bbff',
            horizon: '#bbddff'
          },
          lateAfternoon: {
            sky: '#77b3ff',
            fog: 'rgba(119, 179, 255, 0.15)',
            ambient: '#99ccff',
            horizon: '#ccddff'
          },
          evening: {
            sky: '#88c3ff',
            fog: 'rgba(136, 195, 255, 0.18)',
            ambient: '#aaddff',
            horizon: '#ddeeff'
          },
          eveningGoldenHour: {
            sky: '#ffaa44',
            fog: 'rgba(255, 170, 68, 0.25)',
            ambient: '#ffcc88',
            horizon: '#ffe6cc'
          },
          sunset: {
            sky: '#ff6644',
            fog: 'rgba(255, 102, 68, 0.35)',
            ambient: '#ff9977',
            horizon: '#ffccaa'
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

      // Minimal atmospheric effects - keep distant visibility
      applyAtmosphere(track) {
        if (!map || !track) return;
        
        const conditions = this.getAtmosphericConditions(track);
        this.currentConditions = conditions;
        
        // Enhanced debug logging
        console.log('Applying minimal atmosphere for track:', track.name);
        console.log('Time:', this.formatPacificTime(this.convertToPacificTime(track.timestamp)));
        console.log('Sun position:', conditions.sunPosition);
        console.log('Period:', conditions.period);
        console.log('Terrain:', conditions.terrainInfo);

        // Apply very subtle atmospheric effects - preserve visibility
        this.applySubtleSky(conditions);
        this.applySubtleFog(conditions);
        this.applySubtle3DEffects(conditions);
        this.applySubtleFallback(conditions);
        
        // Enhanced notification
        const timeDesc = conditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
        const terrainDesc = conditions.terrainInfo.terrain.replace(/_/g, ' ');
        const elevationDisplay = Math.round(conditions.terrainInfo.elevation / 100) * 100;
        showNotification(`${timeDesc} in ${terrainDesc} (${elevationDisplay}ft)`, 3000);
      }

      applySubtleSky(conditions) {
        if (typeof map.setSky === 'function') {
          // Very subtle sky changes - don't overpower the map
          map.setSky({
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [conditions.sunPosition.azimuth, Math.max(0, conditions.sunPosition.altitude)],
            'sky-atmosphere-sun-intensity': 15, // Keep consistent intensity
            'sky-atmosphere-color': this.getSubtleSkyColor(conditions.period)
          });
        }
      }

      getSubtleSkyColor(period) {
        // Much more subtle color changes - closer to your original
        const subtleColors = {
          astronomicalNight: '#1a2040',
          astronomicalTwilight: '#2a3050',
          nauticalTwilight: '#3a4060',
          civilTwilight: '#4a5070',
          sunrise: '#ff8855',
          morningGoldenHour: '#ffaa66',
          morning: '#87ceeb',
          midMorning: '#7ac5ed',
          lateMorning: '#6dbced', 
          midday: '#60b3ed',
          highNoon: '#53aaed',
          earlyAfternoon: '#60b3ed',
          midAfternoon: '#6dbced',
          lateAfternoon: '#7ac5ed',
          evening: '#87ceeb',
          eveningGoldenHour: '#ff9944',
          sunset: '#ff7733'
        };
        
        return subtleColors[period] || '#87ceeb';
      }

      applySubtleFog(conditions) {
        if (typeof map.setFog === 'function') {
          // Minimal fog - preserve distant visibility  
          const subtleFog = {
            'range': [1.0, 20], // Much longer range to preserve visibility
            'color': 'rgba(255, 255, 255, 0.3)', // Very transparent
            'horizon-blend': 0.05, // Minimal horizon blending
            'high-color': this.getSubtleSkyColor(conditions.period),
            'space-color': conditions.period === 'astronomicalNight' ? '#000022' : '#000044',
            'star-intensity': conditions.period === 'astronomicalNight' ? 0.6 : 0
          };
          
          map.setFog(subtleFog);
        }
      }

      applySubtle3DEffects(conditions) {
        if (uiController.is3DEnabled && typeof map.setLight === 'function') {
          // Subtle lighting that doesn't overpower
          const subtleLight = {
            anchor: 'viewport',
            color: conditions.period.includes('golden') || conditions.period.includes('sunrise') || conditions.period.includes('sunset') ? 
                   '#ffcc88' : '#ffffff',
            intensity: 0.4, // Reduced intensity
            position: [1.15, conditions.sunPosition.azimuth, Math.max(5, conditions.sunPosition.altitude)]
          };
          
          map.setLight(subtleLight);
        }
      }

      // Very minimal CSS fallback - barely noticeable
      applySubtleFallback(conditions) {
        if (typeof map.setSky !== 'function' || typeof map.setFog !== 'function') {
          const existingOverlay = document.getElementById('atmosphere-overlay');
          if (existingOverlay) {
            existingOverlay.remove();
          }

          // Only apply overlay for extreme conditions
          if (conditions.period === 'astronomicalNight' || conditions.period.includes('golden') || 
              conditions.period.includes('sunrise') || conditions.period.includes('sunset')) {
            
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
            
            // Very subtle overlays
            const subtleGradients = {
              astronomicalNight: 'radial-gradient(ellipse at center, rgba(10, 20, 40, 0.2), rgba(10, 20, 40, 0.4))',
              sunrise: 'linear-gradient(to bottom, rgba(255, 127, 80, 0.15) 0%, transparent 60%)',
              morningGoldenHour: 'linear-gradient(to bottom, rgba(255, 170, 100, 0.1) 0%, transparent 50%)',
              eveningGoldenHour: 'linear-gradient(to bottom, rgba(255, 140, 80, 0.12) 0%, transparent 50%)',
              sunset: 'linear-gradient(to bottom, rgba(255, 100, 60, 0.18) 0%, transparent 60%)'
            };
            
            const gradient = subtleGradients[conditions.period];
            if (gradient) {
              overlay.style.background = gradient;
              document.getElementById('map').appendChild(overlay);
            }
          }
          
          // Very subtle filter effects - barely noticeable
          const mapContainer = document.getElementById('map');
          const subtleFilters = {
            astronomicalNight: 'brightness(0.85) contrast(1.05)',
            sunrise: 'brightness(1.02) saturate(1.03) sepia(0.02)',
            morningGoldenHour: 'brightness(1.03) saturate(1.05) sepia(0.01)',
            eveningGoldenHour: 'brightness(1.02) saturate(1.05) sepia(0.02)',
            sunset: 'brightness(1.0) saturate(1.08) sepia(0.03)'
          };
          
          const filter = subtleFilters[conditions.period] || 'none';
          mapContainer.style.filter = filter;
          mapContainer.style.transition = 'filter 2s ease-in-out';
        }
      }

      // Smooth atmospheric transition system
      transitionAtmosphere(oldConditions, newConditions, duration = 3000) {
        if (this.transitionInProgress) {
          // Cancel existing transition
          if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
          }
        }
        
        this.transitionInProgress = true;
        
        // If no previous conditions, apply immediately
        if (!oldConditions) {
          this.applyImmediateAtmosphere(newConditions);
          this.transitionInProgress = false;
          return;
        }
        
        // Create transition keyframes
        const steps = 20; // Number of transition steps
        const stepDuration = duration / steps;
        
        for (let i = 0; i <= steps; i++) {
          const progress = i / steps;
          const delay = i * stepDuration;
          
          setTimeout(() => {
            const interpolatedConditions = this.interpolateConditions(oldConditions, newConditions, progress);
            this.applyInterpolatedAtmosphere(interpolatedConditions);
            
            // Mark transition complete on final step
            if (i === steps) {
              this.transitionInProgress = false;
            }
          }, delay);
        }
        
        // Safety timeout to ensure transition completes
        this.transitionTimeout = setTimeout(() => {
          this.transitionInProgress = false;
        }, duration + 500);
      }

      // Interpolate between two atmospheric conditions
      interpolateConditions(oldConditions, newConditions, progress) {
        // Use easing function for smooth transitions
        const easedProgress = this.easeInOutCubic(progress);
        
        return {
          sunPosition: this.interpolateSunPosition(oldConditions.sunPosition, newConditions.sunPosition, easedProgress),
          period: easedProgress < 0.5 ? oldConditions.period : newConditions.period, // Switch halfway
          colors: this.interpolateColors(oldConditions.colors, newConditions.colors, easedProgress),
          fogSettings: this.interpolateFogSettings(oldConditions.fogSettings, newConditions.fogSettings, easedProgress),
          lightSettings: this.interpolateLightSettings(oldConditions.lightSettings, newConditions.lightSettings, easedProgress),
          terrainInfo: easedProgress < 0.5 ? oldConditions.terrainInfo : newConditions.terrainInfo
        };
      }

      // Smooth easing function
      easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      }

      // Interpolate sun position
      interpolateSunPosition(oldSun, newSun, progress) {
        return {
          altitude: oldSun.altitude + (newSun.altitude - oldSun.altitude) * progress,
          azimuth: oldSun.azimuth + (newSun.azimuth - oldSun.azimuth) * progress
        };
      }

      // Interpolate colors using proper color mixing
      interpolateColors(oldColors, newColors, progress) {
        return {
          sky: this.interpolateColor(oldColors.sky, newColors.sky, progress),
          fog: this.interpolateColor(oldColors.fog, newColors.fog, progress),
          ambient: this.interpolateColor(oldColors.ambient, newColors.ambient, progress),
          horizon: this.interpolateColor(oldColors.horizon, newColors.horizon, progress)
        };
      }

      // Interpolate individual color values (hex or rgba)
      interpolateColor(color1, color2, progress) {
        // For now, return the target color (simplified)
        // In production, you'd do proper RGB interpolation
        return progress < 0.5 ? color1 : color2;
      }

      // Interpolate fog settings
      interpolateFogSettings(oldFog, newFog, progress) {
        return {
          range: [
            oldFog.range[0] + (newFog.range[0] - oldFog.range[0]) * progress,
            oldFog.range[1] + (newFog.range[1] - oldFog.range[1]) * progress
          ],
          color: this.interpolateColor(oldFog.color, newFog.color, progress),
          'horizon-blend': oldFog['horizon-blend'] + (newFog['horizon-blend'] - oldFog['horizon-blend']) * progress,
          'high-color': newFog['high-color'], // Switch these discretely
          'space-color': newFog['space-color'],
          'star-intensity': oldFog['star-intensity'] + (newFog['star-intensity'] - oldFog['star-intensity']) * progress
        };
      }

      // Interpolate light settings
      interpolateLightSettings(oldLight, newLight, progress) {
        return {
          anchor: newLight.anchor,
          color: this.interpolateColor(oldLight.color, newLight.color, progress),
          intensity: oldLight.intensity + (newLight.intensity - oldLight.intensity) * progress,
          position: [
            oldLight.position[0] + (newLight.position[0] - oldLight.position[0]) * progress,
            oldLight.position[1] + (newLight.position[1] - oldLight.position[1]) * progress,
            oldLight.position[2] + (newLight.position[2] - oldLight.position[2]) * progress
          ]
        };
      }

      // Apply interpolated atmospheric conditions
      applyInterpolatedAtmosphere(conditions) {
        // Apply sky effects
        if (typeof map.setSky === 'function') {
          map.setSky({
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [conditions.sunPosition.azimuth, Math.max(0, conditions.sunPosition.altitude)],
            'sky-atmosphere-sun-intensity': conditions.period === 'astronomicalNight' ? 1 : 
                                            conditions.period.includes('twilight') ? 5 : 15,
            'sky-atmosphere-color': conditions.colors.sky
          });
        }

        // Apply fog effects
        if (typeof map.setFog === 'function') {
          map.setFog(conditions.fogSettings);
        }

        // Apply lighting effects
        if (uiController.is3DEnabled && typeof map.setLight === 'function') {
          map.setLight(conditions.lightSettings);
        }

        // Apply CSS fallback with transition
        this.applyTransitionedFallback(conditions);
      }

      // Apply immediate atmosphere (for first load or when no previous conditions)
      applyImmediateAtmosphere(conditions) {
        this.applyEnhancedSky(conditions);
        this.applyEnhancedFog(conditions);
        this.applyEnhanced3DEffects(conditions);
        this.applyFallbackAtmosphere(conditions);
      }

      // Enhanced CSS fallback with smooth transitions
      applyTransitionedFallback(conditions) {
        if (typeof map.setSky !== 'function' || typeof map.setFog !== 'function') {
          const existingOverlay = document.getElementById('atmosphere-overlay');
          
          if (!existingOverlay) {
            // Create overlay if it doesn't exist
            const overlay = document.createElement('div');
            overlay.id = 'atmosphere-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '1';
            overlay.style.transition = 'all 3s ease-in-out'; // Smooth CSS transitions
            
            const mapContainer = document.getElementById('map');
            mapContainer.appendChild(overlay);
          }

          const overlay = document.getElementById('atmosphere-overlay');
          
          // Enhanced gradients with smooth transitions
          const gradient = this.createEnhancedGradient(conditions);
          overlay.style.background = gradient;
          
          // Enhanced filter effects with transitions
          const filter = this.createEnhancedFilter(conditions);
          const mapContainer = document.getElementById('map');
          mapContainer.style.filter = filter;
          mapContainer.style.transition = 'filter 3s ease-in-out'; // Smooth filter transitions
        }
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

      // Smooth transition when switching tracks (simplified and reliable)
      transitionToTrack(track, duration = 2500) {
        if (this.transitionInProgress) {
          // Cancel existing transition
          if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
          }
        }
        
        this.transitionInProgress = true;

        // Apply new atmospheric conditions with CSS transition timing
        this.applyAtmosphere(track);

        this.transitionTimeout = setTimeout(() => {
          this.transitionInProgress = false;
        }, duration);
      }
    }
