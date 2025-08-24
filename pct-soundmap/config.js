    // Configuration
    const CONFIG = {
      MAPBOX_TOKEN: window.MAPBOX_CONFIG?.token || 'pk.eyJ1IjoidGhta2x5IiwiYSI6ImNseXVyMjhueDA3YTQybW9mcHJrZGJ3YnEifQ.Nv-LsNg5eKIE6SeOVVJpYg',
      GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwEvzIyQTFTwmPqU0xIoty1iuBd3xxBeLFYHljXrXCYSkxJEsWKPKYJKti9rBqGx6-0/exec',
      DEFAULT_CENTER: [-122.50276, 41.31727],
      getDefaultZoom: () => {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        // Detect browsers that might report altered screen dimensions
        const isBrave = navigator.brave && navigator.brave.isBrave;
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        const isTor = navigator.userAgent.toLowerCase().includes('tor');
        
        // Some browsers alter screen dimensions for privacy or have inconsistent reporting
        const hasUnreliableScreenData = isBrave || isTor || 
          (isFirefox && screenWidth === 1366 && screenHeight === 768) || // Firefox often defaults to this
          screenWidth === 1024 || screenHeight === 768; // Common privacy screen sizes
        
        // Calculate diagonal pixel resolution
        const diagonalPixels = Math.sqrt(screenWidth * screenWidth + screenHeight * screenHeight);
        
        // Reference points based on your current preferences:
        // 13" MacBook Air M3: zoom = 4.4
        // 27" monitor: zoom = 4.95
        
        if (hasUnreliableScreenData) {
          // Fallback logic for browsers with unreliable screen data
          // Use viewport dimensions as backup indicator
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const viewportDiagonal = Math.sqrt(viewportWidth * viewportWidth + viewportHeight * viewportHeight);
          
          if (viewportDiagonal > 2800) {
            return 4.2; // Large desktop/high-res
          } else if (viewportDiagonal > 2000) {
            return 4.95; // Desktop equivalent - adjusted threshold for 27" monitors  
          } else if (viewportDiagonal > 1800) {
            return 4.45; // Laptop equivalent - fine-tuned for Brave on 13"
          } else if (viewportDiagonal > 1400) {
            return 4.5; // Standard laptop
          } else {
            return 4.8; // Smaller screens/mobile
          }
        } else {
          // Safari/Chrome and other browsers with reliable screen data
          // Use your exact measurements for interpolation
          const ref1 = { diagonal: 3037, zoom: 4.4 };  // 13" MacBook Air M3 (2560x1664)
          const ref2 = { diagonal: 2203, zoom: 4.95 }; // 27" monitor (1920x1080)
          
          // Calculate zoom using linear interpolation between reference points
          if (diagonalPixels <= ref2.diagonal) {
            // Smaller/lower-res than 27" monitor - extrapolate to higher zoom
            const slope = (ref2.zoom - ref1.zoom) / (ref2.diagonal - ref1.diagonal);
            return Math.min(5.5, ref2.zoom + slope * (ref2.diagonal - diagonalPixels));
          } else if (diagonalPixels >= ref1.diagonal) {
            // Higher-res than MacBook Air - extrapolate to lower zoom  
            const slope = (ref2.zoom - ref1.zoom) / (ref2.diagonal - ref1.diagonal);
            return Math.max(4.0, ref1.zoom + slope * (diagonalPixels - ref1.diagonal));
          } else {
            // Between the two reference points - interpolate
            const ratio = (diagonalPixels - ref2.diagonal) / (ref1.diagonal - ref2.diagonal);
            return ref2.zoom + ratio * (ref1.zoom - ref2.zoom);
          }
        }
      },
      ZOOM_2D: 10,
      ZOOM_3D: 14
    };
