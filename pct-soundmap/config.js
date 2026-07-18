// Configuration
const CONFIG = {
  MAPBOX_TOKEN: window.MAPBOX_CONFIG?.token || 'pk.eyJ1IjoidGhta2x5IiwiYSI6ImNseXVyMjhueDA3YTQybW9mcHJrZGJ3YnEifQ.Nv-LsNg5eKIE6SeOVVJpYg',
  GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby_r5ZmEKXTwNLEjjLlvk9PL50mvOKS8RferARanXtXdmG-uWxXIAAEkA6zRe5QKB44/exec',
  DEFAULT_CENTER: [-122.50276, 41.31727],
  DEFAULT_CENTER_MOBILE: [-119.80462182339255, 41.37182150227608],

  getDefaultZoom: () => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = window.innerWidth <= 768;

    // --- Browser detection ---
    const isBrave    = !!(navigator.brave && navigator.brave.isBrave);
    const isFirefox  = ua.includes('firefox');
    const isChrome   = ua.includes('chrome') && !ua.includes('edg') && !ua.includes('samsungbrowser');
    const isSafari   = ua.includes('safari') && !ua.includes('chrome');
    const isEdge     = ua.includes('edg/');
    const isSamsung  = ua.includes('samsungbrowser');

    // --- Social / in-app WebView detection ---
    const isInstagram = ua.includes('instagram');
    const isFacebook  = ua.includes('fban') || ua.includes('fbav');
    const isTikTok    = ua.includes('musical_ly') || ua.includes('tiktok');
    const isReddit    = ua.includes('reddit');
    const isTwitter   = ua.includes('twitter');
    const isLinkedIn  = ua.includes('linkedinapp');
    const isSnapchat  = ua.includes('snapchat');

    const isSocialWebView = isInstagram || isFacebook || isTikTok ||
                            isReddit || isTwitter || isLinkedIn || isSnapchat;

    // --- Social WebView: conservative zoom for reduced viewport environments ---
    if (isSocialWebView) {
      return isMobile ? 4.3 : 4.5;
    }

    // --- Mobile zoom — interpolated from viewport height reference points ---
    if (isMobile) {
      const viewportHeight = window.innerHeight;
      const ref1 = { height: 674, zoom: 4.37 };  // Chrome/Brave on iPhone
      const ref2 = { height: 713, zoom: 4.4181047703653835 };  // Safari on iPhone
      if (viewportHeight <= ref1.height) {
        return ref1.zoom;
      } else if (viewportHeight >= ref2.height) {
        return ref2.zoom;
      } else {
        const ratio = (viewportHeight - ref1.height) / (ref2.height - ref1.height);
        return ref1.zoom + ratio * (ref2.zoom - ref1.zoom);
      }
    }

    // --- Desktop zoom calculation ---
    const screenWidth  = window.screen.width;
    const screenHeight = window.screen.height;
    const diagonalPixels = Math.sqrt(screenWidth ** 2 + screenHeight ** 2);

    // Browsers with unreliable screen data — use viewport diagonal fallback
    const hasUnreliableScreenData =
      isBrave ||
      (isFirefox && screenWidth === 1366 && screenHeight === 768) || // Firefox privacy default
      screenWidth === 1024 || screenHeight === 768;                  // Common privacy screen sizes

    if (hasUnreliableScreenData) {
      const viewportDiagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
      // Brave on 5K/high-res monitors reports reduced viewport — apply Safari-equivalent zoom
      if (isBrave && viewportDiagonal > 2200) return 5.38;
      // Brave on 13" MBA — viewport diagonal ~1692
      if (isBrave && viewportDiagonal > 1600) return 4.65;
      if (viewportDiagonal > 2800) return 4.2;   // Large desktop / high-res
      if (viewportDiagonal > 2000) return 4.95;  // 27" equivalent
      if (viewportDiagonal > 1800) return 4.45;  // 13" laptop equivalent (Brave)
      if (viewportDiagonal > 1400) return 4.5;   // Standard laptop
      return 4.8;                                 // Smaller screens
    }

    // Reliable screen data — interpolate between reference points
    // MBA 13" M3 (1470x956 scaled): diagonal 1752px → zoom 4.65
    // BenQ 27" 1440p (2560x1440):   diagonal 2939px → zoom 5.38
    const ref1 = { diagonal: 1752, zoom: 4.65 };
    const ref2 = { diagonal: 2910, zoom: 5.38 };
    const slope = (ref2.zoom - ref1.zoom) / (ref2.diagonal - ref1.diagonal);

    if (diagonalPixels <= ref1.diagonal) {
      return ref1.zoom;
    } else if (diagonalPixels >= ref2.diagonal) {
      return Math.min(5.38, ref2.zoom + slope * (diagonalPixels - ref2.diagonal));
    } else {
      const ratio = (diagonalPixels - ref1.diagonal) / (ref2.diagonal - ref1.diagonal);
      return ref1.zoom + ratio * (ref2.zoom - ref1.zoom);
    }
  },

  ZOOM_2D: 10,
  ZOOM_3D: 14
};
