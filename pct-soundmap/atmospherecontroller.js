// Atmospheric Lighting System - Your Original System with Fixed Time Calculations
class AtmosphereController {
  constructor() {
    this.currentConditions = null;
    this.transitionInProgress = false;
  }

  // Fixed solar position calculation
  calculateSunPosition(date, lat, lng) {
    const pacificTime = this.convertToPacificTime(date);
    const { year, month, day, hour, minute } = pacificTime;
    
    const timeDecimal = hour + minute / 60;
    const dayOfYear = this.getDayOfYear(year, month, day);
    const latRad = lat * Math.PI / 180;
    
    // Solar declination
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
    const declinationRad = declination * Math.PI / 180;
    
    // Hour angle for sunrise/sunset
    const hourAngleRad = Math.acos(-Math.tan(latRad) * Math.tan(declinationRad));
    const hourAngle = hourAngleRad * 180 / Math.PI / 15;
    
    // Solar noon with longitude correction
    const longitudeOffset = (lng - (-120)) / 15;
    const solarNoon = 12 + longitudeOffset;
    const sunrise = solarNoon - hourAngle;
    const sunset = solarNoon + hourAngle;
    
    let altitude, azimuth;
    
    if (timeDecimal < sunrise || timeDecimal > sunset) {
      // Night time
      const hoursAfterSunset = timeDecimal > sunset ? timeDecimal - sunset : 24 - sunset + timeDecimal;
      const hoursBeforeSunrise = timeDecimal < sunrise ? sunrise - timeDecimal : sunrise + 24 - timeDecimal;
      
      if (Math.min(hoursAfterSunset, hoursBeforeSunrise) < 1) {
        altitude = -6;
      } else if (Math.min(hoursAfterSunset, hoursBeforeSunrise) < 2) {
        altitude = -12;
      } else {
        altitude = -20;
      }
      azimuth = 0;
    } else {
      // Daytime
      const dayProgress = (timeDecimal - sunrise) / (sunset - sunrise);
      const maxAltitude = this.getMaxSolarAltitude(month, lat);
      altitude = maxAltitude * Math.sin(dayProgress * Math.PI);
      azimuth = 90 + (dayProgress * 180);
    }
    
    console.log(`Pacific Time: ${hour}:${minute.toString().padStart(2, '0')}, Sunrise: ${sunrise.toFixed(1)}h, Sunset: ${sunset.toFixed(1)}h, Sun altitude: ${altitude.toFixed(1)}°`);
    
    return { altitude, azimuth };
  }

  // Get maximum solar altitude based on season and latitude
  getMaxSolarAltitude(month, lat) {
    const dayOfYear = month * 30;
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
    const maxAltitude = 90 - Math.abs(lat - declination);
    return Math.min(90, Math.max(20, maxAltitude));
  }

  // Get approximate day length based on month and latitude
  getDayLength(month, lat) {
    let baseLength = 12;
    const seasonalFactor = Math.sin((month - 3) * Math.PI / 6);
    const latitudeFactor = Math.abs(lat - 23.5) / 66.5;
    
    if (month >= 5 && month <= 8) {
      baseLength = 12 + (4 * latitudeFactor * seasonalFactor);
    } else if (month >= 11 || month <= 2) {
      baseLength = 12 - (3 * latitudeFactor * Math.abs(seasonalFactor));
    } else {
      baseLength = 12 + (2 * latitudeFactor * seasonalFactor);
    }
    
    return Math.max(9, Math.min(16, baseLength));
  }

  // Time conversion functions
  convertToPacificTime(date) {
    let d = new Date(date);
    
    const isAlreadyPacific = typeof date === 'string' && 
      !date.endsWith('Z') && 
      !date.includes('+') && 
      !date.includes('GMT') &&
      !date.includes('UTC');
    
    if (isAlreadyPacific) {
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

    return {
      year: parseInt(pacificTime.find(p => p.type === 'year').value),
      month: parseInt(pacificTime.find(p => p.type === 'month').value),
      day: parseInt(pacificTime.find(p => p.type === 'day').value),
      hour: parseInt(pacificTime.find(p => p.type === 'hour').value),
      minute: parseInt(pacificTime.find(p => p.type === 'minute').value),
      second: parseInt(pacificTime.find(p => p.type === 'second').value),
      originalDate: d
    };
  }

  formatPacificTime(pacificTime) {
    const { year, month, day, hour, minute, originalDate } = pacificTime;
    const isDST = this.isDaylightSavingTime(originalDate);
    const tz = isDST ? 'PDT' : 'PST';
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${tz}`;
  }

  isDaylightSavingTime(date) {
    const year = date.getFullYear();
    const march = new Date(year, 2, 1);
    const dstStart = new Date(year, 2, (14 - march.getDay()) % 7 + 8);
    const november = new Date(year, 10, 1);
    const dstEnd = new Date(year, 10, (7 - november.getDay()) % 7 + 1);
    return date >= dstStart && date < dstEnd;
  }

  getDayOfYear(year, month, day) {
    const date = new Date(year, month - 1, day);
    const start = new Date(year, 0, 1);
    return Math.floor((date - start) / (24 * 60 * 60 * 1000)) + 1;
  }

  // Enhanced time period classification using both sun angle and time of day
  getTimePeriod(altitude, azimuth, season, hour) {
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
    let elevation = 2500;
    
    if (mile && !isNaN(parseFloat(mile))) {
      const m = parseFloat(mile);
      if (m < 100) elevation = 2500;
      else if (m < 700) elevation = 5500;
      else if (m < 1100) elevation = 8000;
      else if (m < 1700) elevation = 6500;
      else if (m < 2100) elevation = 5000;
      else if (m < 2650) elevation = 4500;
      else elevation = 3800;
    }
    
    const effect = 1 + (elevation - 2500) / 10000;
    return Math.min(Math.max(effect, 0.8), 1.5);
  }

  getSeason(date, lat) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
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

    // Period-based colors (your original approach)
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

    return colors;
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

    // Adjust fog based on time of day (your original approach)
    const fogProfiles = {
      night: { range: [0.5, 12], 'horizon-blend': 0.05, 'star-intensity': 0.8 },
      sunrise: { range: [0.3, 8], 'horizon-blend': 0.15, 'star-intensity': 0.2 },
      goldenHour: { range: [0.4, 9], 'horizon-blend': 0.12, 'star-intensity': 0 },
      morning: { range: [0.5, 10], 'horizon-blend': 0.1, 'star-intensity': 0 },
      midday: { range: [0.8, 12], 'horizon-blend': 0.08, 'star-intensity': 0 },
      noon: { range: [1, 15], 'horizon-blend': 0.05, 'star-intensity': 0 }
    };

    Object.assign(baseFog, fogProfiles[period] || fogProfiles.midday);
    
    // Adjust for elevation
    baseFog.range[0] *= elevationEffect;
    baseFog.range[1] *= elevationEffect;

    return baseFog;
  }

  calculateLight(sunPos, period, season) {
    let intensity = Math.max(0, Math.min(1, (sunPos.altitude + 10) / 70));
    
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

  // Enhanced atmospheric application with proper state clearing
  applyAtmosphere(track) {
    if (!map || !track) return;
    
    const newConditions = this.getAtmosphericConditions(track);
    
    console.log('Applying atmosphere for track:', track.name);
    console.log('Time:', track.timestamp);
    console.log('Sun position:', newConditions.sunPosition);
    console.log('Period:', newConditions.period);

    // Cancel any existing transition
    if (this.transitionInProgress && this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionInProgress = false;
    }

    // Clear any existing CSS overlays that might be stuck
    this.clearAtmosphericOverlays();

    // If no previous conditions, apply immediately
    if (!this.currentConditions) {
      this.applyImmediateAtmosphere(newConditions);
      this.currentConditions = newConditions;
      const timeDesc = newConditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
      showNotification(`Atmosphere: ${timeDesc}`, 2500);
      return;
    }

    // Apply new atmosphere with smooth transition
    this.transitionAtmosphereSmooth(this.currentConditions, newConditions);
    this.currentConditions = newConditions;
    
    const timeDesc = newConditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
    showNotification(`Atmosphere: ${timeDesc}`, 2500);
  }

  // Clear any stuck atmospheric overlays
  clearAtmosphericOverlays() {
    const existingOverlay = document.getElementById('atmosphere-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Reset map container filter
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.filter = 'none';
    }
  }

  // Smooth atmospheric transition with guaranteed completion
  transitionAtmosphereSmooth(oldConditions, newConditions, duration = 2500) {
    this.transitionInProgress = true;
    
    const steps = 12; // Fewer steps for more reliable transitions
    const stepDuration = duration / steps;
    
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const progress = i / steps;
        const easedProgress = this.easeInOutQuad(progress);
        
        // Interpolate between states
        const interpolatedConditions = this.interpolateConditions(oldConditions, newConditions, easedProgress);
        
        // Apply interpolated state
        this.applyInterpolatedState(interpolatedConditions);
        
        // On final step, ensure we apply the exact target state
        if (i === steps) {
          // Force apply final state to ensure completion
          setTimeout(() => {
            this.applyImmediateAtmosphere(newConditions);
            this.transitionInProgress = false;
          }, 100);
        }
      }, i * stepDuration);
    }
    
    // Backup safety timeout
    this.transitionTimeout = setTimeout(() => {
      console.log('Transition safety timeout - forcing final state');
      this.applyImmediateAtmosphere(newConditions);
      this.transitionInProgress = false;
    }, duration + 1000);
  }

  // Apply immediate atmosphere (no transition)
  applyImmediateAtmosphere(conditions) {
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

    if (typeof map.setFog === 'function') {
      const fogConfig = {
        ...conditions.fogSettings,
        color: conditions.colors.fog
      };
      
      if (map.version && map.version >= '3.0.0') {
        fogConfig['high-color'] = conditions.colors.sky;
        fogConfig['space-color'] = conditions.period === 'night' ? '#000011' : '#000066';
        fogConfig['star-intensity'] = conditions.period === 'night' ? 0.8 : 
                                     conditions.period.includes('twilight') ? 0.4 : 0;
      }
      
      map.setFog(fogConfig);
    }

    if (uiController.is3DEnabled && typeof map.setLight === 'function') {
      map.setLight({
        ...conditions.lightSettings,
        anchor: 'viewport',
        color: conditions.period === 'goldenHour' || conditions.period === 'sunrise' ? 
               'rgba(255, 200, 100, 1)' : 'white',
        position: [1.5, conditions.sunPosition.azimuth, Math.max(5, conditions.sunPosition.altitude)]
      });
    }

    if (typeof map.setSky !== 'function' || typeof map.setFog !== 'function') {
      this.applyFallbackAtmosphere(conditions);
    }
  }

  // Smooth atmospheric transition with multiple intermediate steps
  transitionAtmosphereSmooth(oldConditions, newConditions, duration = 3000) {
    if (this.transitionInProgress) {
      if (this.transitionTimeout) {
        clearTimeout(this.transitionTimeout);
      }
    }
    
    this.transitionInProgress = true;
    
    const steps = 15; // Number of transition steps
    const stepDuration = duration / steps;
    
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const progress = i / steps;
        const easedProgress = this.easeInOutQuad(progress);
        
        // Interpolate between old and new conditions
        const interpolatedConditions = this.interpolateConditions(oldConditions, newConditions, easedProgress);
        
        // Apply the interpolated state
        this.applyInterpolatedState(interpolatedConditions);
        
        // Mark complete on final step
        if (i === steps) {
          this.transitionInProgress = false;
        }
      }, i * stepDuration);
    }
    
    // Safety cleanup
    this.transitionTimeout = setTimeout(() => {
      this.transitionInProgress = false;
    }, duration + 500);
  }

  // Smooth easing function
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Interpolate between two atmospheric states
  interpolateConditions(oldConditions, newConditions, progress) {
    return {
      sunPosition: {
        altitude: oldConditions.sunPosition.altitude + (newConditions.sunPosition.altitude - oldConditions.sunPosition.altitude) * progress,
        azimuth: oldConditions.sunPosition.azimuth + (newConditions.sunPosition.azimuth - oldConditions.sunPosition.azimuth) * progress
      },
      period: progress < 0.5 ? oldConditions.period : newConditions.period,
      colors: this.interpolateColors(oldConditions.colors, newConditions.colors, progress),
      fogSettings: this.interpolateFogSettings(oldConditions.fogSettings, newConditions.fogSettings, progress),
      lightSettings: this.interpolateLightSettings(oldConditions.lightSettings, newConditions.lightSettings, progress)
    };
  }

  // Simple color interpolation (blend between hex colors)
  interpolateColors(oldColors, newColors, progress) {
    return {
      sky: this.blendColors(oldColors.sky, newColors.sky, progress),
      fog: oldColors.fog, // Keep fog color simple for now
      ambient: this.blendColors(oldColors.ambient, newColors.ambient, progress),
      horizon: this.blendColors(oldColors.horizon, newColors.horizon, progress)
    };
  }

  // Simple hex color blending
  blendColors(color1, color2, progress) {
    // For now, return the dominant color based on progress
    return progress < 0.5 ? color1 : color2;
  }

  // Interpolate fog settings
  interpolateFogSettings(oldFog, newFog, progress) {
    return {
      range: [
        oldFog.range[0] + (newFog.range[0] - oldFog.range[0]) * progress,
        oldFog.range[1] + (newFog.range[1] - oldFog.range[1]) * progress
      ],
      color: progress < 0.5 ? oldFog.color : newFog.color,
      'horizon-blend': oldFog['horizon-blend'] + (newFog['horizon-blend'] - oldFog['horizon-blend']) * progress,
      'high-color': progress < 0.5 ? oldFog['high-color'] : newFog['high-color'],
      'space-color': progress < 0.5 ? oldFog['space-color'] : newFog['space-color'],
      'star-intensity': oldFog['star-intensity'] + (newFog['star-intensity'] - oldFog['star-intensity']) * progress
    };
  }

  // Interpolate light settings
  interpolateLightSettings(oldLight, newLight, progress) {
    return {
      anchor: newLight.anchor,
      color: progress < 0.5 ? oldLight.color : newLight.color,
      intensity: oldLight.intensity + (newLight.intensity - oldLight.intensity) * progress,
      position: [
        oldLight.position[0] + (newLight.position[0] - oldLight.position[0]) * progress,
        oldLight.position[1] + (newLight.position[1] - oldLight.position[1]) * progress,
        oldLight.position[2] + (newLight.position[2] - oldLight.position[2]) * progress
      ]
    };
  }

  // Apply interpolated atmospheric state
  applyInterpolatedState(conditions) {
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

    if (typeof map.setFog === 'function') {
      const fogConfig = {
        ...conditions.fogSettings,
        color: conditions.colors.fog
      };
      
      if (map.version && map.version >= '3.0.0') {
        fogConfig['high-color'] = conditions.colors.sky;
        fogConfig['space-color'] = conditions.period === 'night' ? '#000011' : '#000066';
      }
      
      map.setFog(fogConfig);
    }

    if (uiController.is3DEnabled && typeof map.setLight === 'function') {
      map.setLight(conditions.lightSettings);
    }
  }

  // CSS fallback (your original approach)
  applyFallbackAtmosphere(conditions) {
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

  // Enhanced lighting system for dramatic 3D effects
  applyEnhancedLighting(track) {
    if (!map || !track || !uiController.is3DEnabled || !uiController.isEnhancedLightingEnabled) return;
    
    const conditions = this.getAtmosphericConditions(track);
    console.log('Applying enhanced lighting for:', conditions.period);
    
    // Get terrain info for lighting calculations
    const elevation = parseFloat(track.elevation) || this.getElevationEffect(track.mile) * 2500;
    const terrainType = this.classifyBasicTerrain(parseFloat(track.lat), elevation);
    
    // Calculate multiple light sources for realistic lighting
    const lightSources = this.calculateEnhancedLightSources(conditions, terrainType);
    
    // Apply enhanced terrain exaggeration based on lighting conditions
    this.applyDynamicTerrainExaggeration(conditions);
    
    // Apply the lighting setup
    this.applyMultipleLightSources(lightSources);
    
    // Enhanced fog for volumetric effects
    this.applyVolumetricFog(conditions, elevation);
    
    showNotification(`Enhanced lighting: ${conditions.period}`, 3000);
  }

  // Calculate multiple light sources for realistic 3D lighting
  calculateEnhancedLightSources(conditions, terrainType) {
    const { sunPosition, period } = conditions;
    
    // Primary light source (sun)
    const primaryLight = {
      anchor: 'viewport',
      color: this.getSunColor(period),
      intensity: this.getSunIntensity(period, terrainType),
      position: [1.2, sunPosition.azimuth, Math.max(5, sunPosition.altitude)]
    };
    
    // Secondary light sources for fill lighting
    const secondaryLights = [];
    
    // Sky ambient light (opposite direction from sun for fill)
    if (period !== 'night' && period !== 'astronomicalTwilight') {
      secondaryLights.push({
        anchor: 'viewport',
        color: this.getSkyFillColor(period),
        intensity: this.getFillIntensity(period) * 0.3,
        position: [0.8, (sunPosition.azimuth + 180) % 360, 20] // Opposite sun direction
      });
    }
    
    // Terrain bounce light (for alpine/snow environments)
    if (terrainType === 'alpine' && (period === 'goldenHour' || period === 'sunrise')) {
      secondaryLights.push({
        anchor: 'viewport', 
        color: '#ffffff',
        intensity: 0.2,
        position: [1.0, sunPosition.azimuth, -10] // Low angle bounce light
      });
    }
    
    return { primary: primaryLight, secondary: secondaryLights };
  }

  // Dynamic sun colors based on time of day
  getSunColor(period) {
    const sunColors = {
      night: '#ffffff',
      astronomicalTwilight: '#4466aa',
      nauticalTwilight: '#6688bb', 
      civilTwilight: '#88aacc',
      sunrise: '#ff9944',
      goldenHour: '#ffaa33',
      morning: '#ffeeaa',
      midday: '#ffffff',
      noon: '#ffffff'
    };
    
    return sunColors[period] || '#ffffff';
  }

  // Dynamic sun intensity based on conditions
  getSunIntensity(period, terrainType) {
    let baseIntensity = {
      night: 0.1,
      astronomicalTwilight: 0.2,
      nauticalTwilight: 0.3,
      civilTwilight: 0.4,
      sunrise: 0.8,
      goldenHour: 0.9,
      morning: 0.7,
      midday: 0.6,
      noon: 0.6
    }[period] || 0.6;
    
    // Terrain modifiers
    const terrainModifiers = {
      alpine: 1.3,      // Higher = clearer air, more intense
      desert: 1.2,      // Clear dry air
      forest: 0.8       // Filtered through canopy
    };
    
    return baseIntensity * (terrainModifiers[terrainType] || 1.0);
  }

  // Sky fill light color
  getSkyFillColor(period) {
    const fillColors = {
      sunrise: '#cceeff',
      goldenHour: '#ffffcc', 
      morning: '#eeffff',
      midday: '#ffffff',
      noon: '#ffffff'
    };
    
    return fillColors[period] || '#ffffff';
  }

  getFillIntensity(period) {
    return {
      sunrise: 0.4,
      goldenHour: 0.5,
      morning: 0.3,
      midday: 0.2,
      noon: 0.2
    }[period] || 0.2;
  }

  // Basic terrain classification for lighting
  classifyBasicTerrain(lat, elevation) {
    if (elevation > 8000) return 'alpine';
    if (lat < 36 && elevation < 4000) return 'desert';
    return 'forest';
  }

  // Apply multiple light sources (Mapbox supports this in v3)
  applyMultipleLightSources(lightSources) {
    if (typeof map.setLight !== 'function') return;
    
    // Apply primary light (sun)
    map.setLight(lightSources.primary);
    
    // Note: Mapbox v3 supports multiple lights but the API is complex
    // For now, we'll use the primary light with enhanced settings
    // Future enhancement could add true multi-light support
  }

  // Dynamic terrain exaggeration based on lighting conditions
  applyDynamicTerrainExaggeration(conditions) {
    if (!map.getTerrain || !map.getSource('mapbox-dem')) return;
    
    // More dramatic terrain during golden hour and sunrise for better shadows
    let exaggeration = 1.5; // Default
    
    if (conditions.period === 'goldenHour' || conditions.period === 'sunrise') {
      exaggeration = 2.2; // More dramatic for better shadow effects
    } else if (conditions.period === 'midday' || conditions.period === 'noon') {
      exaggeration = 1.3; // Less dramatic in flat midday light
    }
    
    map.setTerrain({ 
      'source': 'mapbox-dem', 
      'exaggeration': exaggeration 
    });
  }

  // Enhanced volumetric fog effects
  applyVolumetricFog(conditions, elevation) {
    if (typeof map.setFog !== 'function') return;
    
    const baseFog = conditions.fogSettings;
    
    // Elevation-based fog modifications for enhanced 3D
    if (elevation > 8000) {
      // Alpine: clearer air, longer range
      baseFog.range = [1.5, 25];
      baseFog['horizon-blend'] = 0.03;
    } else if (elevation < 3000) {
      // Lower elevations: more atmospheric haze
      baseFog.range = [0.8, 18];
      baseFog['horizon-blend'] = 0.12;
    }
    
    // Enhanced fog for dramatic periods
    if (conditions.period === 'goldenHour' || conditions.period === 'sunrise') {
      baseFog['horizon-blend'] = 0.15; // More horizon glow
      baseFog.color = 'rgba(255, 230, 180, 0.4)'; // Warm fog
    }
    
    map.setFog(baseFog);
  }

  toRad(deg) {
    return deg * Math.PI / 180;
  }

  toDeg(rad) {
    return rad * 180 / Math.PI;
  }
}
