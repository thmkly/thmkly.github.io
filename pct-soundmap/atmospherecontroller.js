// Simplified Atmospheric Lighting System
class AtmosphereController {
  constructor() {
    this.currentConditions = null;
    this.transitionInProgress = false;
    this.atmosphereCache = new Map();
  }

  getCacheKey(timestamp, lat, lng) {
    // Round to 15-minute intervals and 0.01 degree precision for caching
    const date = new Date(timestamp);
    const roundedMinutes = Math.floor(date.getMinutes() / 15) * 15;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    
    return `${date.getTime()}-${roundedLat}-${roundedLng}`;
  }

  // Convert UTC timestamp to proper Pacific Time (handles PDT/PST automatically)
  convertToPacificTime(date) {
    let d = new Date(date);
    
    // Check if timestamp appears to be already in Pacific Time
    const isAlreadyPacific = typeof date === 'string' && 
      !date.endsWith('Z') && 
      !date.includes('+') && 
      !date.includes('GMT') &&
      !date.includes('UTC');
    
    if (isAlreadyPacific) {
      // Timestamp is already in Pacific Time, use directly
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

  // Simple time period detection based on hour of day
  getTimePeriod(hour, month, lat) {
    // Adjust day length slightly by season and latitude
    // Summer (May-Aug): longer days, sunset ~8pm
    // Winter (Nov-Feb): shorter days, sunset ~5pm
    // Spring/Fall: moderate, sunset ~7pm
    
    let sunriseHour = 6;
    let sunsetHour = 19;
    
    // Seasonal adjustments
    if (month >= 5 && month <= 8) {
      // Summer: longer days
      sunriseHour = 5.5;
      sunsetHour = 20;
    } else if (month >= 11 || month <= 2) {
      // Winter: shorter days
      sunriseHour = 6.5;
      sunsetHour = 17.5;
    }
    
    // Latitude adjustments (northern latitudes have more variation)
    if (lat > 45) {
      if (month >= 5 && month <= 8) {
        sunsetHour += 0.5; // Even longer summer days up north
      } else if (month >= 11 || month <= 2) {
        sunsetHour -= 0.5; // Even shorter winter days up north
      }
    }
    
    // Determine period based on hour
    if (hour >= 0 && hour < sunriseHour - 1) {
      return 'night';
    } else if (hour >= sunriseHour - 1 && hour < sunriseHour + 0.5) {
      return 'blueHourDawn';
    } else if (hour >= sunriseHour + 0.5 && hour < sunriseHour + 2) {
      return 'morningGoldenHour';
    } else if (hour >= sunriseHour + 2 && hour < sunsetHour - 2) {
      return 'day';
    } else if (hour >= sunsetHour - 2 && hour < sunsetHour - 0.5) {
      return 'eveningGoldenHour';
    } else if (hour >= sunsetHour - 0.5 && hour < sunsetHour + 1) {
      return 'blueHourDusk';
    } else {
      return 'night';
    }
  }

  // Simple terrain classification: desert, mountain, or forest
  classifyTerrain(lat, elevation) {
    const latNum = parseFloat(lat);
    const elevNum = parseFloat(elevation);
    
    // Desert: southern latitudes, lower elevations
    if (latNum < 37 && elevNum < 5000) {
      return 'desert';
    }
    
    // Mountain/Alpine: high elevations
    if (elevNum > 8000) {
      return 'mountain';
    }
    
    // Forest: everything else (mid-elevations, northern areas)
    return 'forest';
  }

  // Estimate elevation from mile marker if not provided
  estimateElevation(mile) {
    if (!mile || isNaN(parseFloat(mile))) return 4000;
    
    const m = parseFloat(mile);
    // Simplified PCT elevation profile
    if (m < 300) return 3500;           // Southern California
    if (m < 700) return 2000;           // Desert sections
    if (m < 900) return 7000;           // Approach to Sierra
    if (m < 1300) return 10000;         // High Sierra
    if (m < 1700) return 6000;          // Northern California
    if (m < 2100) return 5000;          // Oregon
    if (m < 2400) return 5500;          // Southern Washington
    return 4500;                        // Northern Washington
  }

  // 7 distinct color schemes for time periods
  getColorScheme(period) {
    const schemes = {
      night: {
        sky: '#0a0a1a',
        fog: 'rgba(10, 10, 26, 0.7)',
        ambient: '#1a1a2a',
        starIntensity: 0.8
      },
      blueHourDawn: {
        sky: '#4a5a7f',
        fog: 'rgba(74, 90, 127, 0.4)',
        ambient: '#5a6a8a',
        starIntensity: 0.2
      },
      morningGoldenHour: {
        sky: '#ffb366',
        fog: 'rgba(255, 179, 102, 0.25)',
        ambient: '#ffcc99',
        starIntensity: 0
      },
      day: {
        sky: '#3399ff',
        fog: 'rgba(51, 153, 255, 0.1)',
        ambient: '#66b3ff',
        starIntensity: 0
      },
      eveningGoldenHour: {
        sky: '#ff9955',
        fog: 'rgba(255, 153, 85, 0.3)',
        ambient: '#ffb380',
        starIntensity: 0
      },
      blueHourDusk: {
        sky: '#3a4a6f',
        fog: 'rgba(58, 74, 111, 0.5)',
        ambient: '#4a5a7a',
        starIntensity: 0.3
      }
    };
    
    return schemes[period] || schemes.day;
  }

  // Apply simple terrain tint to base colors
  applyTerrainTint(colors, terrain) {
    // Just return colors with slight modifications based on terrain
    if (terrain === 'desert') {
      // Warmer, more saturated
      return {
        ...colors,
        sky: this.adjustHue(colors.sky, 5), // Slightly warmer
        fog: colors.fog
      };
    } else if (terrain === 'mountain') {
      // Cooler, clearer
      return {
        ...colors,
        sky: this.adjustHue(colors.sky, -3), // Slightly cooler
        fog: colors.fog
      };
    }
    
    // Forest: neutral, maybe slight green tint for day periods
    return colors;
  }

  // Simple hue adjustment (just for visual variety)
  adjustHue(colorHex, degrees) {
    // This is a placeholder - in a real implementation you'd use a proper color library
    // For now, just return the original color
    return colorHex;
  }

  // Main method to get atmospheric conditions
  getAtmosphericConditions(track) {
    try {
      const date = new Date(track.timestamp);
      const lat = parseFloat(track.lat);
      const lng = parseFloat(track.lng);
      const elevation = parseFloat(track.elevation) || this.estimateElevation(track.mile);
      
      // Generate cache key
      const cacheKey = this.getCacheKey(track.timestamp, lat, lng);
      
      // Return cached result if available
      if (this.atmosphereCache.has(cacheKey)) {
        return this.atmosphereCache.get(cacheKey);
      }
      
      // Get time period
      const hour = date.getHours();
      const month = date.getMonth() + 1;
      const period = this.getTimePeriod(hour, month, lat);
      
      // Classify terrain
      const terrain = this.classifyTerrain(lat, elevation);
      
      // Get base colors and apply terrain tint
      const baseColors = this.getColorScheme(period);
      const colors = this.applyTerrainTint(baseColors, terrain);
      
      const conditions = {
        period,
        terrain,
        elevation,
        colors,
        fogSettings: this.getFogSettings(period, terrain),
        lightSettings: this.getLightSettings(period, hour)
      };
      
      // Cache the result (limit cache size to 50 entries)
      if (this.atmosphereCache.size > 50) {
        const firstKey = this.atmosphereCache.keys().next().value;
        this.atmosphereCache.delete(firstKey);
      }
      this.atmosphereCache.set(cacheKey, conditions);
      
      return conditions;
    } catch (error) {
      console.error('Error calculating atmospheric conditions:', error);
      // Return safe defaults
      return this.getDefaultConditions();
    }
  }

  getDefaultConditions() {
    return {
      period: 'day',
      terrain: 'forest',
      elevation: 4000,
      colors: {
        sky: '#3399ff',
        fog: 'rgba(51, 153, 255, 0.1)',
        ambient: '#66b3ff',
        starIntensity: 0
      },
      fogSettings: {
        range: [0.5, 10],
        color: 'white',
        'high-color': '#87CEEB',
        'space-color': '#000033',
        'horizon-blend': 0.1,
        'star-intensity': 0
      },
      lightSettings: {
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.5,
        position: [1.15, 210, 30]
      }
    };
  }

  getFogSettings(period, terrain) {
    // Base fog settings
    const settings = {
      range: [0.5, 10],
      color: 'white',
      'high-color': '#87CEEB',
      'space-color': '#000033',
      'horizon-blend': 0.1,
      'star-intensity': 0
    };
    
    // Adjust by period
    if (period === 'night') {
      settings['star-intensity'] = 0.8;
      settings['horizon-blend'] = 0.05;
      settings['high-color'] = '#1a1a2a';
    } else if (period === 'blueHourDawn' || period === 'blueHourDusk') {
      settings['star-intensity'] = period === 'blueHourDawn' ? 0.2 : 0.3;
      settings['horizon-blend'] = 0.12;
    } else if (period === 'morningGoldenHour' || period === 'eveningGoldenHour') {
      settings['horizon-blend'] = 0.15;
      settings.range = [0.4, 9];
    }
    
    // Terrain adjustments
    if (terrain === 'desert') {
      settings.range = [0.8, 15]; // Clearer, longer visibility
    } else if (terrain === 'mountain') {
      settings.range = [1.0, 18]; // Very clear at altitude
    }
    
    return settings;
  }

  getLightSettings(period, hour) {
    // Base light settings
    let intensity = 0.5;
    let color = '#ffffff';
    
    // Adjust by period
    if (period === 'night') {
      intensity = 0.15; // Dim but usable
      color = '#b0c4de'; // Slight blue moonlight
    } else if (period === 'blueHourDawn' || period === 'blueHourDusk') {
      intensity = 0.3;
      color = '#d0d8e8';
    } else if (period === 'morningGoldenHour') {
      intensity = 0.6;
      color = '#ffcc66';
    } else if (period === 'eveningGoldenHour') {
      intensity = 0.55;
      color = '#ff9944';
    } else if (period === 'day') {
      intensity = 0.7;
      color = '#ffffff';
    }
    
    // Simple azimuth based on hour (east to west)
    const azimuth = 90 + ((hour - 6) / 12) * 180; // Rough sun position
    const altitude = period === 'night' ? 5 : 30; // Low at night, higher during day
    
    return {
      anchor: 'viewport',
      color: color,
      intensity: intensity,
      position: [1.15, azimuth, altitude]
    };
  }

  // Apply atmosphere asynchronously
  applyAtmosphere(track) {
    requestAnimationFrame(() => {
      try {
        const conditions = this.getAtmosphericConditions(track);
        this.currentConditions = conditions;
        
        this.applyEnhancedSky(conditions);
        
        requestAnimationFrame(() => {
          this.applyEnhancedFog(conditions);
          this.applyEnhanced3DEffects(conditions);
        });
      } catch (error) {
        console.error('Error applying atmosphere:', error);
      }
    });
  }

  applyEnhancedSky(conditions) {
    if (typeof map !== 'undefined' && map.setSky && typeof map.setSky === 'function') {
      // Simple sun intensity based on period
      let sunIntensity = 15;
      if (conditions.period === 'night') {
        sunIntensity = 1;
      } else if (conditions.period.includes('blueHour')) {
        sunIntensity = 5;
      } else if (conditions.period.includes('GoldenHour')) {
        sunIntensity = 12;
      }
      
      map.setSky({
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [conditions.lightSettings.position[1], conditions.lightSettings.position[2]],
        'sky-atmosphere-sun-intensity': sunIntensity,
        'sky-atmosphere-color': conditions.colors.sky
      });
    }
  }

  applyEnhancedFog(conditions) {
    if (typeof map !== 'undefined' && map.setFog && typeof map.setFog === 'function') {
      const fogConfig = {
        ...conditions.fogSettings,
        color: conditions.colors.fog
      };
      
      map.setFog(fogConfig);
    }
  }

  applyEnhanced3DEffects(conditions) {
    if (typeof map !== 'undefined' && 
        typeof uiController !== 'undefined' && 
        uiController.is3DEnabled && 
        map.setLight && 
        typeof map.setLight === 'function') {
      map.setLight(conditions.lightSettings);
    }
  }

  applyFallbackAtmosphere(conditions) {
    // CSS-based fallback for browsers that don't support Mapbox atmosphere APIs
    // This is a simplified version - just applies basic filters
    if (typeof map === 'undefined' || 
        (typeof map.setSky === 'function' && typeof map.setFog === 'function')) {
      // Map supports modern APIs, no fallback needed
      return;
    }
  
    // Remove any existing overlay
    const existingOverlay = document.getElementById('atmosphere-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
  
    // Apply CSS filter based on time period
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
  
    const filters = {
      night: 'brightness(0.4) contrast(1.1)',
      blueHourDawn: 'brightness(0.7) contrast(1.05) saturate(0.9)',
      morningGoldenHour: 'brightness(1.05) contrast(1.05) saturate(1.15) sepia(0.05)',
      day: 'brightness(1.0) contrast(1.0)',
      eveningGoldenHour: 'brightness(1.03) contrast(1.08) saturate(1.18) sepia(0.06)',
      blueHourDusk: 'brightness(0.75) contrast(1.05) saturate(0.95)'
    };
  
    mapContainer.style.filter = filters[conditions.period] || filters.day;
    mapContainer.style.transition = 'filter 2s ease-in-out';
  }

  // Reset atmosphere to neutral default
  resetToDefault() {
    try {
      if (typeof map === 'undefined') return;
      
      // Reset sky
      if (typeof map.setSky === 'function') {
        map.setSky({
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0, 90],
          'sky-atmosphere-sun-intensity': 15
        });
      }
      
      // Reset fog
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
      
      // Reset 3D lighting
      if (typeof map.setLight === 'function') {
        map.setLight({
          'anchor': 'viewport',
          'color': 'white',
          'intensity': 0.5,
          'position': [1.15, 210, 30]
        });
      }
      
      // Clear cached conditions
      this.currentConditions = null;
      this.atmosphereCache.clear();
    } catch (error) {
      console.error('Error resetting atmosphere:', error);
    }
  }

  // Smooth transition when switching tracks
  transitionToTrack(track, duration = 2000) {
    if (this.transitionInProgress) return;
    this.transitionInProgress = true;

    this.applyAtmosphere(track);

    setTimeout(() => {
      this.transitionInProgress = false;
    }, duration);
  }
}
