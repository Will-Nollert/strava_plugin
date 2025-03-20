// src/services/weatherAnalysis.js

/**
 * Segment types that affect how weather assistance is calculated
 * @enum {string}
 */
const SegmentType = {
  CLIMB: "climb",
  DESCENT: "descent",
  FLAT: "flat",
  SPRINT: "sprint",
  UNKNOWN: "unknown",
};

/**
 * Weather assistance levels
 * @enum {string}
 */
const AssistLevel = {
  FAVORABLE: "Favorable",
  NEUTRAL: "Neutral",
  UNFAVORABLE: "Unfavorable",
};

/**
 * Determines the type of segment based on its properties
 * @param {Object} segment - Segment data
 * @returns {SegmentType} The determined segment type
 */
function determineSegmentType(segment) {
  const avgGrade = segment.average_grade;
  const distance = segment.distance; // in meters

  if (!avgGrade) return SegmentType.UNKNOWN;

  if (avgGrade > 3) {
    return SegmentType.CLIMB;
  } else if (avgGrade < -3) {
    return SegmentType.DESCENT;
  } else if (distance < 500) {
    // Less than 500m with low grade
    return SegmentType.SPRINT;
  } else {
    return SegmentType.FLAT;
  }
}

/**
 * Calculate the wind assistance based on wind and segment data
 * @param {Object} wind - Wind data (speed and direction)
 * @param {Object} segment - Segment data (including direction)
 * @returns {number} Wind assistance factor (-1 to 1)
 */
function calculateWindAssistance(wind, segment) {
  if (!wind || !wind.speed || wind.speed < 1) {
    return 0; // No significant wind
  }

  // If segment has directional data, use it
  if (segment.direction) {
    // Calculate the angle between wind direction and segment direction
    const windDirection = wind.deg;
    const segmentDirection = segment.direction;

    // Normalize the angle difference to 0-180 degrees
    const angleDiff = Math.abs(
      ((windDirection - segmentDirection + 180) % 360) - 180
    );

    // Convert to a factor: 1 for tailwind, -1 for headwind, 0 for crosswind
    if (angleDiff <= 45) {
      return 1; // Tailwind
    } else if (angleDiff >= 135) {
      return -1; // Headwind
    } else {
      return 0; // Crosswind
    }
  }

  // For segments without direction data, we just use wind speed as a general factor
  if (wind.speed > 8) {
    return 0.5; // Stronger wind has more potential for assistance (or hindrance)
  } else {
    return 0.2; // Light wind has less impact
  }
}

/**
 * Analyze weather conditions for a segment
 * @param {Object} weather - Weather data
 * @param {Object} segment - Segment data
 * @returns {Object} Analysis result with assistance level
 */
function analyzeWeather(weather, segment) {
  if (!weather || !segment) {
    return {
      level: AssistLevel.NEUTRAL,
      message: "Insufficient data for analysis",
    };
  }

  // Extract key weather data
  const current = weather.current || {};
  const wind = current.wind || {};
  const temp = current.temp;
  const humidity = current.humidity;
  const precip = current.rain ? current.rain["1h"] : 0;

  // Determine segment type
  const segmentType = determineSegmentType(segment);

  // Calculate individual factors
  let windFactor = calculateWindAssistance(wind, segment);

  // For climbs, headwind can actually be good for cooling
  if (segmentType === SegmentType.CLIMB && windFactor < 0) {
    windFactor = windFactor * -0.5; // Reduce the negative impact
  }

  // Temperature factor
  let tempFactor = 0;
  if (temp < 5) {
    tempFactor = -0.8; // Very cold
  } else if (temp < 10) {
    tempFactor = -0.4; // Cold
  } else if (temp > 30) {
    tempFactor = -0.8; // Very hot
  } else if (temp > 25) {
    tempFactor = -0.4; // Hot
  } else {
    tempFactor = 0.5; // Ideal temperature
  }

  // Precipitation factor
  const precipFactor = precip > 0 ? -0.8 : 0;

  // Humidity factor
  const humidityFactor = humidity > 85 ? -0.4 : 0;

  // Calculate overall score
  const factors = [windFactor, tempFactor, precipFactor, humidityFactor];
  const totalScore =
    factors.reduce((sum, factor) => sum + factor, 0) / factors.length;

  // Determine assistance level
  let level, message;
  if (totalScore > 0.2) {
    level = AssistLevel.FAVORABLE;
    message = getPositiveMessage(weather, segmentType);
  } else if (totalScore < -0.2) {
    level = AssistLevel.UNFAVORABLE;
    message = getNegativeMessage(weather, segmentType);
  } else {
    level = AssistLevel.NEUTRAL;
    message = getNeutralMessage(weather);
  }

  return {
    level,
    message,
    factors: {
      wind: windFactor,
      temperature: tempFactor,
      precipitation: precipFactor,
      humidity: humidityFactor,
    },
    score: totalScore,
  };
}

/**
 * Get a positive message based on weather conditions
 * @param {Object} weather - Weather data
 * @param {SegmentType} segmentType - Type of segment
 * @returns {string} Message
 */
function getPositiveMessage(weather, segmentType) {
  const wind = weather.current?.wind;
  const temp = weather.current?.temp;

  if (wind && wind.speed > 5 && segmentType !== SegmentType.CLIMB) {
    return "Good tailwind conditions";
  } else if (temp && temp >= 15 && temp <= 25) {
    return "Ideal temperature";
  } else {
    return "Favorable conditions";
  }
}

/**
 * Get a negative message based on weather conditions
 * @param {Object} weather - Weather data
 * @param {SegmentType} segmentType - Type of segment
 * @returns {string} Message
 */
function getNegativeMessage(weather, segmentType) {
  const wind = weather.current?.wind;
  const temp = weather.current?.temp;
  const rain = weather.current?.rain?.["1h"];

  if (rain && rain > 0) {
    return "Wet conditions";
  } else if (wind && wind.speed > 5 && segmentType !== SegmentType.CLIMB) {
    return "Strong headwind";
  } else if (temp && temp > 30) {
    return "Excessive heat";
  } else if (temp && temp < 5) {
    return "Very cold";
  } else {
    return "Challenging conditions";
  }
}

/**
 * Get a neutral message based on weather conditions
 * @returns {string} Message
 */
function getNeutralMessage() {
  return "Average conditions";
}

export { analyzeWeather, AssistLevel, SegmentType };
