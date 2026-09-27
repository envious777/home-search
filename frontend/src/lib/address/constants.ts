export const DEFAULT_CITY = "FORT COLLINS";

// The Larimer assessor search matches bare street names, so directionals and suffixes must be removed.
export const STREET_SUFFIXES =
  /\s+(dr|drive|st|street|ave|avenue|ct|court|ln|lane|rd|road|way|blvd|boulevard|cir|circle|pl|place|trl|trail|pkwy|parkway|ter|terrace|loop|hwy|highway)\.?$/i;
export const STREET_DIRECTIONALS =
  /^(n|s|e|w|ne|nw|se|sw|north|south|east|west|northeast|northwest|southeast|southwest)\.?\s+/i;