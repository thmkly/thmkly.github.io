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

  // Back to your original simple atmospheric application
  applyAtmosphere(track) {
    if (!map || !track) return;
    
    const conditions = this.getAtmosphericConditions(track);
    this.currentConditions = conditions;
    
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
      
      if (map.version && map.version >= '3.0.0') {
        fogConfig['high-color'] = conditions.colors.sky;
        fogConfig['space-color'] = conditions.period === 'night' ? '#000011' : '#000066';
        fogConfig['star-intensity'] = conditions.period === 'night' ? 0.8 : 
                                     conditions.period.includes('twilight') ? 0.4 : 0;
      }
      
      map.setFog(fogConfig);
    }

    // Apply light if 3D is enabled
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

  // Simple transition
  transitionToTrack(track, duration = 2000) {
    if (this.transitionInProgress) return;
    this.transitionInProgress = true;

    this.applyAtmosphere(track);

    setTimeout(() => {
      this.transitionInProgress = false;
    }, duration);
  }

  toRad(deg) {
    return deg * Math.PI / 180;
  }

  toDeg(rad) {
    return rad * 180 / Math.PI;
  }
}
