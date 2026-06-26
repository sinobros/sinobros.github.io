// High-quality SVG playing cards for Sinobros
// Crisp, realistic cards with proper shadows, borders, and four-color suits

const CARD_WIDTH = 78;
const CARD_HEIGHT = 112;

function createCardSVG(rank, suit, faceUp = true) {
  const suitColors = {
    h: '#e51e47', // hearts - red
    d: '#3b82f6', // diamonds - blue
    c: '#22c55e', // clubs - green
    s: '#111111'  // spades - purple
  };
  
  const suitSymbols = {
    h: '♥',
    d: '♦',
    c: '♣',
    s: '♠'
  };

  const color = suitColors[suit] || '#111';
  const symbol = suitSymbols[suit] || '?';
  const displayRank = rank === 'T' ? '10' : rank;

  if (!faceUp) {
    // Back design - elegant beach/casino theme
    return `
      <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#166534"/>
            <stop offset="50%" style="stop-color:#052e16"/>
            <stop offset="100%" style="stop-color:#166534"/>
          </linearGradient>
          <pattern id="wavePattern" patternUnits="userSpaceOnUse" width="20" height="20">
            <path d="M0 10 Q5 5 10 10 Q15 15 20 10" stroke="#fefce8" stroke-width="1.5" fill="none" opacity="0.3"/>
          </pattern>
        </defs>
        
        <!-- Card background -->
        <rect x="2" y="2" width="${CARD_WIDTH-4}" height="${CARD_HEIGHT-4}" rx="8" ry="8" fill="url(#backGrad)" stroke="#052e16" stroke-width="3"/>
        
        <!-- Inner border -->
        <rect x="7" y="7" width="${CARD_WIDTH-14}" height="${CARD_HEIGHT-14}" rx="5" ry="5" fill="none" stroke="#fefce8" stroke-width="1" opacity="0.4"/>
        
        <!-- Wave pattern -->
        <rect x="9" y="9" width="${CARD_WIDTH-18}" height="${CARD_HEIGHT-18}" rx="4" ry="4" fill="url(#wavePattern)"/>
        
        <!-- Center logo -->
        <text x="${CARD_WIDTH/2}" y="${CARD_HEIGHT/2 + 8}" text-anchor="middle" fill="#fefce8" font-size="28" font-weight="900" opacity="0.9">🌊</text>
        
        <!-- Corner decorations -->
        <circle cx="14" cy="14" r="3" fill="#fefce8" opacity="0.5"/>
        <circle cx="${CARD_WIDTH-14}" cy="${CARD_HEIGHT-14}" r="3" fill="#fefce8" opacity="0.5"/>
      </svg>
    `;
  }

  // Face up card - premium design
  return `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Premium card gradient -->
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff"/>
          <stop offset="8%" style="stop-color:#f8f4e6"/>
          <stop offset="92%" style="stop-color:#f8f4e6"/>
          <stop offset="100%" style="stop-color:#f0e9d2"/>
        </linearGradient>
        
        <!-- Subtle inner shadow -->
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
        </filter>
      </defs>
      
      <!-- Main card body with premium bevel -->
      <rect x="1" y="1" width="${CARD_WIDTH-2}" height="${CARD_HEIGHT-2}" rx="7" ry="7" 
            fill="url(#cardGrad)" stroke="#d4c9a8" stroke-width="2" filter="url(#cardShadow)"/>
      
      <!-- Inner white border -->
      <rect x="5" y="5" width="${CARD_WIDTH-10}" height="${CARD_HEIGHT-10}" rx="4" ry="4" 
            fill="none" stroke="#e8e0c8" stroke-width="1"/>
      
      <!-- Top-left rank + suit -->
      <text x="9" y="18" fill="#111" font-size="13" font-weight="900" font-family="Poppins, sans-serif">${displayRank}</text>
      <text x="9" y="32" fill="${color}" font-size="16" font-weight="900">${symbol}</text>
      
      <!-- Center large suit -->
      <text x="${CARD_WIDTH/2}" y="${CARD_HEIGHT/2 + 8}" text-anchor="middle" fill="${color}" 
            font-size="42" font-weight="900" opacity="0.15">${symbol}</text>
      
      <!-- Bottom-right rank + suit (rotated) -->
      <g transform="rotate(180 ${CARD_WIDTH/2} ${CARD_HEIGHT/2})">
        <text x="${CARD_WIDTH - 9}" y="${CARD_HEIGHT - 18}" fill="#111" font-size="13" font-weight="900" font-family="Poppins, sans-serif" text-anchor="end">${displayRank}</text>
        <text x="${CARD_WIDTH - 9}" y="${CARD_HEIGHT - 6}" fill="${color}" font-size="16" font-weight="900" text-anchor="end">${symbol}</text>
      </g>
      
      <!-- Subtle corner accents -->
      <circle cx="8" cy="8" r="1.5" fill="#d4c9a8"/>
      <circle cx="${CARD_WIDTH-8}" cy="${CARD_HEIGHT-8}" r="1.5" fill="#d4c9a8"/>
    </svg>
  `;
}

// Export for use in games
window.createCardSVG = createCardSVG;
window.CARD_WIDTH = CARD_WIDTH;
window.CARD_HEIGHT = CARD_HEIGHT;