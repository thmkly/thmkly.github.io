// Atmospheric Lighting System - Enhanced but Minimal
class AtmosphereController {
  constructor() {
    this.currentConditions = null;
    this.transitionInProgress = false;
  }

  // Proper solar position calculation (fixed version)
  calculateSunPosition(date, lat, lng) {
    const pacificTime = this.convertToPacificTime(date);
    const { year, month, day, hour, minute } = pacificTime;
    
    console.log(`Calculating sun position for: ${hour}:${minute.toString().padStart(2, '0')} ${this.isDaylightSavingTime(pacificTime.originalDate) ? 'PDT' : 'PST'}`);
    
    // Convert to decimal hour
    const timeDecimal = hour + minute / 60;
    
    // Calculate sunrise/sunset times
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
    
    console.log(`Solar times - Sunrise: ${sunrise.toFixed(1)}h, Sunset: ${sunset.toFixed(1)}h, Solar noon: ${solarNoon.toFixed(1)}h`);
    
    let altitude, azimuth;
    
    if (timeDecimal < sunrise || timeDecimal > sunset) {
      // Night time - sun below horizon
      const hoursAfterSunset = timeDecimal > sunset ? timeDecimal - sunset : 24 - sunset + timeDecimal;
      const hoursBeforeSunrise = timeDecimal < sunrise ? sunrise - timeDecimal : sunrise + 24 - timeDecimal;
      
      if (Math.min(hoursAfterSunset, hoursBeforeSunrise) < 1) {
        altitude = -3; // Civil twilight
      } else if (Math.min(hoursAfterSunset, hoursBeforeSunrise) < 2) {
        altitude = -10; // Deeper twilight
      } else {
        altitude = -20; // Night
      }
      azimuth = timeDecimal < 12 ? 90 : 270;
    } else {
      // Daytime - sun above horizon
      const dayProgress = (timeDecimal - sunrise) / (sunset - sunrise);
      const maxAltitude = this.getMaxSolarAltitude(month, lat);
      altitude = maxAltitude * Math.sin(dayProgress * Math.PI);
      azimuth = 90 + (dayProgress * 180);
      
      console.log(`Day progress: ${(dayProgress * 100).toFixed(1)}%, Max altitude: ${maxAltitude.toFixed(1)}°`);
    }
    
    console.log(`Final result - Sun altitude: ${altitude.toFixed(1)}°, azimuth: ${azimuth.toFixed(1)}°`);
    
    return { altitude, azimuth };
  }

  // Helper functions
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

  getMaxSolarAltitude(month, lat) {
    const dayOfYear = month * 30;
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
    const maxAltitude = 90 - Math.abs(lat - declination);
    return Math.min(85, Math.max(20, maxAltitude));
  }

  // Time period classification (enhanced but realistic)
  getTimePeriod(altitude, azimuth, season, hour) {
    if (altitude < -18) return 'astronomicalNight';
    if (altitude < -12) return 'astronomicalTwilight';
    if (altitude < -6) return 'nauticalTwilight';
    if (altitude < -0.833) return 'civilTwilight';
    
    if (altitude > 0) {
      if (hour <= 6 || hour >= 19) {
        return altitude < 8 ? (hour <= 6 ? 'sunrise' : 'sunset') : 
               (hour <= 6 ? 'morningGoldenHour' : 'eveningGoldenHour');
      }
      
      if (hour >= 6 && hour < 11.5) {
        if (altitude < 10) return 'morningGoldenHour';
        if (hour < 9) return 'morning';
        if (hour < 11) return 'midMorning';
        return 'lateMorning';
      }
      
      if (hour >= 11.5 && hour <= 12.5) {
        return altitude > 45 ? 'highNoon' : 'midday';
      }
      
      if (hour > 12.5 && hour < 18) {
        if (hour < 14) return 'earlyAfternoon';
        if (hour < 16) return 'midAfternoon';
        if (altitude > 10) return 'lateAfternoon';
        return 'eveningGoldenHour';
      }
      
      if (altitude > 8) return 'evening';
      if (altitude > 3) return 'eveningGoldenHour';
      return 'sunset';
    }
    
    return 'midday';
  }

  // Get atmospheric conditions with terrain and elevation
  getAtmosphericConditions(track) {
    const date = new Date(track.timestamp);
    const lat = parseFloat(track.lat);
    const lng = parseFloat(track.lng);
    const elevation = parseFloat(track.elevation) || this.estimateElevation(track.mile);
    
    const sunPos = this.calculateSunPosition(date, lat, lng);
    const terrainInfo = this.classifyTerrain(lat, lng, elevation, track.mile);
    const season = this.getSeason(date, lat);
    const period = this.getTimePeriod(sunPos.altitude, sunPos.azimuth, season, this.convertToPacificTime(track.timestamp).hour);
    
    return {
      sunPosition: sunPos,
      period,
      season,
      terrainInfo,
      colors: { sky: '#87ceeb', fog: 'rgba(255, 255, 255, 0.3)', ambient: '#ffffff', horizon: '#E0F6FF' }
    };
  }

  // Terrain classification
  classifyTerrain(lat, lng, elevation, mile) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const elevNum = parseFloat(elevation) || this.estimateElevation(mile);
    
    const distanceFromCoast = Math.abs(lngNum + 120);
    const isInterior = distanceFromCoast > 4;
    
    let terrain = 'unknown';
    let biome = 'temperate';
    let exposure = 'moderate';
    let region = 'unknown';
    
    if (latNum >= 32.5 && latNum < 36.0) {
      region = 'Southern California';
      if (elevNum < 1000) {
        terrain = 'sonoran_desert';
        biome = 'desert';
        exposure = 'extreme';
      } else if (elevNum < 2500) {
        terrain = 'mojave_desert';
        biome = 'desert';
        exposure = 'extreme';
      } else if (elevNum < 4000) {
        terrain = isInterior ? 'desert_chaparral' : 'coastal_chaparral';
        biome = 'chaparral';
        exposure = 'high';
      } else if (elevNum < 6000) {
        terrain = 'oak_savanna';
        biome = 'oak_woodland';
        exposure = 'moderate';
      } else if (elevNum < 8000) {
        terrain = 'mixed_conifer';
        biome = 'montane';
        exposure = 'moderate';
      } else if (elevNum < 10000) {
        terrain = 'red_fir';
        biome = 'subalpine';
        exposure = 'high';
      } else if (elevNum < 11500) {
        terrain = 'lodgepole_pine';
        biome = 'subalpine';
        exposure = 'high';
      } else {
        terrain = 'whitebark_pine';
        biome = 'alpine';
        exposure = 'extreme';
      }
    } else if (latNum >= 36.0 && latNum < 39.3) {
      region = 'Sierra Nevada';
      if (elevNum < 2000) {
        terrain = 'oak_savanna';
        biome = 'oak_woodland';
        exposure = 'low';
      } else if (elevNum < 4000) {
        terrain = 'mixed_conifer';
        biome = 'montane';
        exposure = 'low';
      } else if (elevNum < 7000) {
        terrain = 'red_fir';
        biome = 'montane';
        exposure = 'moderate';
      } else if (elevNum < 9500) {
        terrain = 'lodgepole_pine';
        biome = 'subalpine';
        exposure = 'moderate';
      } else if (elevNum < 11500) {
        terrain = 'whitebark_pine';
        biome = 'subalpine';
        exposure = 'high';
      } else if (elevNum < 13000) {
        terrain = 'alpine_fell_field';
        biome = 'alpine';
        exposure = 'extreme';
      } else {
        terrain = 'high_alpine';
        biome = 'alpine';
        exposure = 'extreme';
      }
    } else if (latNum >= 39.3 && latNum < 42.0) {
      region = 'Northern California';
      if (elevNum < 1500) {
        terrain = 'oak_savanna';
        biome = 'oak_woodland';
        exposure = 'low';
      } else if (elevNum < 5000) {
        terrain = 'mixed_conifer';
        biome = 'montane';
        exposure = 'moderate';
      } else if (elevNum < 7000) {
        terrain = 'red_fir';
        biome = 'montane';
        exposure = 'moderate';
      } else if (elevNum < 9000) {
        terrain = 'mountain_hemlock';
        biome = 'subalpine';
        exposure = 'high';
      } else {
        terrain = 'alpine_fell_field';
        biome = 'alpine';
        exposure = 'extreme';
      }
    } else if (latNum >= 42.0 && latNum < 46.2) {
      region = 'Oregon';
      if (elevNum < 1500) {
        terrain = 'oak_savanna';
        biome = 'oak_woodland';
        exposure = 'low';
      } else if (elevNum < 3000) {
        terrain = 'douglas_fir_forest';
        biome = 'temperate';
        exposure = 'low';
      } else if (elevNum < 4500) {
        terrain = 'mixed_conifer';
        biome = 'montane';
        exposure = 'low';
      } else if (elevNum < 6000) {
        terrain = 'mountain_hemlock';
        biome = 'subalpine';
        exposure = 'moderate';
      } else if (elevNum < 8000) {
        terrain = 'whitebark_pine';
        biome = 'subalpine';
        exposure = 'high';
      } else {
        terrain = 'alpine_fell_field';
        biome = 'alpine';
        exposure = 'extreme';
      }
    } else if (latNum >= 46.2 && latNum <= 49.0) {
      region = 'Washington';
      if (elevNum < 1000) {
        terrain = 'temperate_rainforest';
        biome = 'temperate';
        exposure = 'low';
      } else if (elevNum < 2500) {
        terrain = 'western_hemlock_forest';
        biome = 'temperate';
        exposure = 'low';
      } else if (elevNum < 4000) {
        terrain = 'douglas_fir_forest';
        biome = 'temperate';
        exposure = 'low';
      } else if (elevNum < 5500) {
        terrain = 'pacific_silver_fir';
        biome = 'subalpine';
        exposure = 'moderate';
      } else if (elevNum < 7000) {
        terrain = 'mountain_hemlock';
        biome = 'subalpine';
        exposure = 'high';
      } else if (elevNum < 8500) {
        terrain = 'whitebark_pine';
        biome = 'subalpine';
        exposure = 'high';
      } else {
        terrain = 'alpine_fell_field';
        biome = 'alpine';
        exposure = 'extreme';
      }
    }
    
    // Special cases
    if (terrain === 'coastal_chaparral' && lngNum < -118) {
      terrain = 'desert_chaparral';
    }
    
    if (latNum >= 34.0 && latNum <= 35.5 && lngNum <= -117.5 && elevNum >= 2000 && elevNum <= 4000) {
      terrain = 'mojave_desert';
      biome = 'desert';
      exposure = 'extreme';
    }
    
    if (latNum <= 33.5 && elevNum < 2000) {
      terrain = 'sonoran_desert';
      biome = 'desert';
      exposure = 'extreme';
    }
    
    return { terrain, biome, exposure, region, elevation: elevNum };
  }

  estimateElevation(mile) {
    if (!mile || isNaN(parseFloat(mile))) return 3000;
    const m = parseFloat(mile);
    if (m < 100) return 2500;
    if (m < 300) return 4500;
    if (m < 500) return 1500;
    if (m < 650) return 3500;
    if (m < 750) return 8000;
    if (m < 900) return 6500;
    if (m < 1100) return 9000;
    if (m < 1300) return 10500;
    if (m < 1700) return 7000;
    if (m < 1900) return 5500;
    if (m < 2100) return 4500;
    if (m < 2400) return 5500;
    if (m < 2650) return 4000;
    return 3200;
  }

  getSeason(date, lat) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if (month === 12 && day >= 21 || month <= 2 || month === 3 && day < 20) return 'winter';
    if (month === 3 && day >= 20 || month <= 5 || month === 6 && day < 21) return 'spring';
    if (month === 6 && day >= 21 || month <= 8 || month === 9 && day < 23) return 'summer';
    return 'autumn';
  }

  // Simple atmospheric application (back to your original minimal approach)
  applyAtmosphere(track) {
    if (!map || !track) return;
    
    const conditions = this.getAtmosphericConditions(track);
    this.currentConditions = conditions;
    
    console.log('Applying atmosphere for track:', track.name);
    console.log('Time:', this.formatPacificTime(this.convertToPacificTime(track.timestamp)));
    console.log('Period:', conditions.period);
    console.log('Terrain:', conditions.terrainInfo);

    // Very minimal sky adjustment
    if (typeof map.setSky === 'function') {
      map.setSky({
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [conditions.sunPosition.azimuth, Math.max(0, conditions.sunPosition.altitude)],
        'sky-atmosphere-sun-intensity': 15
      });
    }
    
    // Very minimal fog - preserve visibility
    if (typeof map.setFog === 'function') {
      map.setFog({
        'range': [0.8, 15],
        'color': 'white',
        'high-color': '#87CEEB',
        'space-color': '#000044',
        'horizon-blend': 0.08,
        'star-intensity': conditions.period === 'astronomicalNight' ? 0.6 : 0
      });
    }
    
    // 3D lighting if enabled
    if (uiController.is3DEnabled && typeof map.setLight === 'function') {
      map.setLight({
        anchor: 'viewport',
        color: conditions.period.includes('golden') ? '#ffcc88' : '#ffffff',
        intensity: 0.3,
        position: [1.15, conditions.sunPosition.azimuth, Math.max(5, conditions.sunPosition.altitude)]
      });
    }

    // Minimal CSS fallback
    this.applyMinimalFallback(conditions);
    
    // Enhanced notification
    const timeDesc = conditions.period.replace(/([A-Z])/g, ' $1').toLowerCase();
    const terrainDesc = conditions.terrainInfo.terrain.replace(/_/g, ' ');
    const elevationDisplay = Math.round(conditions.terrainInfo.elevation / 100) * 100;
    showNotification(`${timeDesc} in ${terrainDesc} (${elevationDisplay}ft)`, 3000);
  }

  applyMinimalFallback(conditions) {
    if (typeof map.setSky !== 'function' || typeof map.setFog !== 'function') {
      const mapContainer = document.getElementById('map');
      
      // Only apply very subtle effects for dramatic periods
      const subtleFilters = {
        astronomicalNight: 'brightness(0.9)',
        sunrise: 'brightness(1.02) sepia(0.02)',
        morningGoldenHour: 'brightness(1.03) sepia(0.01)',
        eveningGoldenHour: 'brightness(1.02) sepia(0.02)',
        sunset: 'brightness(1.0) sepia(0.03)'
      };
      
      const filter = subtleFilters[conditions.period] || 'none';
      mapContainer.style.filter = filter;
      mapContainer.style.transition = 'filter 2s ease-in-out';
    }
  }

  // Simple transition
  transitionToTrack(track, duration = 2500) {
    if (this.transitionInProgress) return;
    this.transitionInProgress = true;
    
    this.applyAtmosphere(track);
    
    setTimeout(() => {
      this.transitionInProgress = false;
    }, duration);
  }
}
