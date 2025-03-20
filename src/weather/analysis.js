// src/weather/analysis.js - Algorithms for analyzing weather impact on cycling performance

/**
 * Calculate wind impact factor based on segment and weather data
 * @param {Object} segment - Segment data with start/end coordinates and direction
 * @param {Object} weather - Weather data with wind speed and direction
 * @returns {Object} - Wind impact analysis
 */
function calculateWindImpact(segment, weather) {
  // Extract relevant data
  const windSpeed = weather.wind_speed; // m/s
  const windDegree = weather.wind_deg; // meteorological degrees (0=N, 90=E, 180=S, 270=W)
  const windGust = weather.wind_gust || windSpeed * 1.5; // Use actual gust or estimate if not available

  // Calculate segment direction (simplified - assumes straight segment)
  // In a real implementation, you would calculate this from polyline points
  const segmentDirection = calculateSegmentDirection(segment);

  // Calculate relative wind angle (0 = headwind, 180 = tailwind)
  const relativeWindAngle = Math.abs(
    ((windDegree - segmentDirection + 180) % 360) - 180
  );

  // Calculate effective wind speed (negative for tailwind, positive for headwind)
  const effectiveWindSpeed =
    windSpeed * Math.cos((relativeWindAngle * Math.PI) / 180);

  // Calculate crosswind component
  const crosswindComponent =
    windSpeed * Math.sin((relativeWindAngle * Math.PI) / 180);

  // Calculate estimated time impact (simplified model)
  // Assumes: 1 m/s headwind slows rider by ~3% on flat terrain
  const flatWindImpactPercent = effectiveWindSpeed * 3;

  // Calculate gust impact (added difficulty factor)
  const gustImpact =
    (windGust - windSpeed) *
    Math.abs(Math.sin((relativeWindAngle * Math.PI) / 180)) *
    0.5;

  return {
    headwind: effectiveWindSpeed > 0,
    tailwind: effectiveWindSpeed < 0,
    crosswind: Math.abs(crosswindComponent) > 1, // Significant crosswind if > 1 m/s
    effectiveWindSpeed,
    crosswindComponent,
    relativeWindAngle,
    estimatedTimeImpact: flatWindImpactPercent,
    gustImpact,
    windCondition: classifyWindCondition(windSpeed, windGust),
  };
}

/**
 * Calculate segment direction in degrees
 * @param {Object} segment - Segment with start and end points
 * @returns {number} - Direction in degrees (0=N, 90=E, 180=S, 270=W)
 */
function calculateSegmentDirection(segment) {
  // Extract start and end coordinates
  // This is simplified - actual implementation would use the segment's polyline
  const startLat = segment.start_latlng[0];
  const startLng = segment.start_latlng[1];
  const endLat = segment.end_latlng[0];
  const endLng = segment.end_latlng[1];

  // Calculate bearing
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;

  // Convert to degrees and normalize
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Classify wind condition based on speed
 * @param {number} windSpeed - Wind speed in m/s
 * @param {number} windGust - Wind gust in m/s
 * @returns {string} - Wind condition classification
 */
function classifyWindCondition(windSpeed) {
  // Beaufort scale (simplified)
  if (windSpeed < 0.5) return "Calm";
  if (windSpeed < 1.5) return "Light Air";
  if (windSpeed < 3.3) return "Light Breeze";
  if (windSpeed < 5.5) return "Gentle Breeze";
  if (windSpeed < 7.9) return "Moderate Breeze";
  if (windSpeed < 10.7) return "Fresh Breeze";
  if (windSpeed < 13.8) return "Strong Breeze";
  if (windSpeed < 17.1) return "Near Gale";
  if (windSpeed < 20.7) return "Gale";
  if (windSpeed < 24.4) return "Strong Gale";
  if (windSpeed < 28.4) return "Storm";
  if (windSpeed < 32.6) return "Violent Storm";
  return "Hurricane";
}

/**
 * Calculate temperature impact factor
 * @param {Object} weather - Weather data with temperature information
 * @returns {Object} - Temperature impact analysis
 */
function calculateTemperatureImpact(weather) {
  const temp = weather.temp;
  const feelsLike = weather.feels_like;

  // Optimal temperature range for cycling (in Celsius)
  const optimalLow = 15;
  const optimalHigh = 25;

  // Calculate distance from optimal range
  let tempImpact = 0;

  if (temp < optimalLow) {
    // Cold impact
    tempImpact = (optimalLow - temp) * 0.5; // 0.5% per degree below optimal
  } else if (temp > optimalHigh) {
    // Heat impact
    tempImpact = (temp - optimalHigh) * 1.0; // 1% per degree above optimal
  }

  // Additional impact from feels_like difference (wind chill or heat index)
  const perceptionImpact = Math.abs(feelsLike - temp) * 0.3;

  return {
    temperature: temp,
    feelsLike,
    optimal: temp >= optimalLow && temp <= optimalHigh,
    estimatedTimeImpact: tempImpact,
    perceptionImpact,
    condition: classifyTemperatureCondition(temp),
  };
}

/**
 * Classify temperature condition
 * @param {number} temp - Temperature in Celsius
 * @returns {string} - Temperature condition
 */
function classifyTemperatureCondition(temp) {
  if (temp < 0) return "Freezing";
  if (temp < 5) return "Very Cold";
  if (temp < 10) return "Cold";
  if (temp < 15) return "Cool";
  if (temp < 25) return "Comfortable";
  if (temp < 30) return "Warm";
  if (temp < 35) return "Hot";
  return "Very Hot";
}

/**
 * Calculate air density impact on performance
 * @param {Object} weather - Weather data with air_density or components to calculate it
 * @returns {Object} - Air density impact analysis
 */
function calculateAirDensityImpact(weather) {
  // Get air density directly or calculate if not provided
  const airDensity =
    weather.air_density ||
    (weather.temp && weather.humidity && weather.pressure
      ? calculateAirDensity(weather.temp, weather.humidity, weather.pressure)
      : 1.225);

  // Reference air density at sea level (kg/m³)
  const referenceAirDensity = 1.225;

  // Calculate percentage difference from reference
  const densityDifference =
    ((airDensity - referenceAirDensity) / referenceAirDensity) * 100;

  // Calculate estimated power impact (simplified model)
  // Assumes: 1% increase in air density ≈ 0.3% increase in power needed at same speed
  const powerImpact = densityDifference * 0.3;

  return {
    airDensity,
    densityDifference,
    estimatedPowerImpact: powerImpact,
    condition: classifyAirDensityCondition(airDensity),
  };
}

/**
 * Calculate air density if not provided directly
 * @param {number} temp - Temperature in Celsius
 * @param {number} humidity - Relative humidity (0-100)
 * @param {number} pressure - Atmospheric pressure in hPa
 * @returns {number} - Air density in kg/m³
 */
function calculateAirDensity(temp, humidity, pressure) {
  // Constants
  const R = 287.05; // Specific gas constant for dry air, J/(kg·K)
  const Rv = 461.495; // Specific gas constant for water vapor, J/(kg·K)

  // Convert temperature to Kelvin
  const tempK = temp + 273.15;

  // Calculate saturation vapor pressure (hPa)
  const es = 6.1078 * Math.exp((17.27 * temp) / (temp + 237.3));

  // Calculate actual vapor pressure (hPa)
  const e = (humidity / 100) * es;

  // Calculate dry air pressure (hPa)
  const pd = pressure - e;

  // Calculate air density using the formula for moist air
  const density = (pd * 100) / (R * tempK) + (e * 100) / (Rv * tempK);

  return density;
}

/**
 * Classify air density condition
 * @param {number} airDensity - Air density in kg/m³
 * @returns {string} - Air density condition
 */
function classifyAirDensityCondition(airDensity) {
  if (airDensity < 1.1) return "Very Low (High Altitude/Hot)";
  if (airDensity < 1.175) return "Low";
  if (airDensity < 1.225) return "Slightly Low";
  if (airDensity < 1.275) return "Normal";
  if (airDensity < 1.325) return "Slightly High";
  if (airDensity < 1.4) return "High";
  return "Very High (Cold/Dense)";
}

/**
 * Generate comprehensive weather impact analysis for a segment effort
 * @param {Object} segment - Segment data including coordinates and elevation
 * @param {Object} weather - Weather data for the segment at time of effort
 * @returns {Object} - Comprehensive weather impact analysis
 */
function analyzeWeatherImpact(segment, weather) {
  // Calculate individual impacts
  const windImpact = calculateWindImpact(segment, weather);
  const temperatureImpact = calculateTemperatureImpact(weather);
  const airDensityImpact = calculateAirDensityImpact(weather);

  // Calculate humidity impact (simplified)
  const humidityImpact = {
    humidity: weather.humidity,
    impact:
      weather.humidity > 80
        ? "High"
        : weather.humidity > 60
          ? "Moderate"
          : "Low",
    condition:
      weather.humidity > 80
        ? "Very Humid"
        : weather.humidity > 60
          ? "Humid"
          : weather.humidity > 40
            ? "Comfortable"
            : "Dry",
  };

  // Calculate overall conditions summary
  const conditions = {
    wind: windImpact.windCondition,
    temperature: temperatureImpact.condition,
    humidity: humidityImpact.condition,
    airDensity: airDensityImpact.condition,
  };

  // Calculate total estimated time impact (very simplified model)
  const totalTimeImpact =
    windImpact.estimatedTimeImpact + temperatureImpact.estimatedTimeImpact;

  // Generate summary text
  const summary = generateWeatherSummary(conditions, totalTimeImpact);

  // Generate rating (0-100, where 100 is perfect conditions)
  const rating = calculateWeatherRating(
    windImpact,
    temperatureImpact,
    airDensityImpact,
    weather.humidity
  );

  return {
    timestamp: weather.timestamp,
    summary,
    rating,
    conditions,
    estimatedTimeImpact: totalTimeImpact,
    components: {
      wind: windImpact,
      temperature: temperatureImpact,
      airDensity: airDensityImpact,
      humidity: humidityImpact,
    },
    weather: {
      temp: weather.temp,
      humidity: weather.humidity,
      pressure: weather.pressure,
      wind_speed: weather.wind_speed,
      wind_deg: weather.wind_deg,
      wind_gust: weather.wind_gust,
      uvi: weather.uvi || 0,
      dew_point: weather.dew_point,
      air_density: airDensityImpact.airDensity,
    },
  };
}

/**
 * Generate a human-readable weather summary
 * @param {Object} conditions - Weather conditions summaries
 * @param {number} timeImpact - Estimated total time impact percentage
 * @returns {string} - Human-readable summary
 */
function generateWeatherSummary(conditions, timeImpact) {
  const conditionParts = [];

  if (conditions.temperature !== "Comfortable") {
    conditionParts.push(conditions.temperature.toLowerCase() + " temperature");
  }

  if (conditions.wind !== "Calm" && conditions.wind !== "Light Air") {
    conditionParts.push(conditions.wind.toLowerCase() + " winds");
  }

  if (conditions.humidity === "Very Humid" || conditions.humidity === "Dry") {
    conditionParts.push(conditions.humidity.toLowerCase() + " conditions");
  }

  let conditionsText =
    conditionParts.length > 0 ? conditionParts.join(", ") : "ideal conditions";

  let impactText = "";
  if (Math.abs(timeImpact) < 1) {
    impactText = "minimal impact on performance";
  } else if (timeImpact > 0) {
    impactText = `approximately ${timeImpact.toFixed(
      1
    )}% slower than ideal conditions`;
  } else {
    impactText = `approximately ${Math.abs(timeImpact).toFixed(
      1
    )}% faster than ideal conditions`;
  }

  return `Effort was made in ${conditionsText} with ${impactText}.`;
}

/**
 * Calculate overall weather rating for cycling (0-100)
 * @param {Object} windImpact - Wind impact analysis
 * @param {Object} temperatureImpact - Temperature impact analysis
 * @param {Object} airDensityImpact - Air density impact analysis
 * @param {number} humidity - Relative humidity (0-100)
 * @returns {number} - Weather rating (0-100)
 */
function calculateWeatherRating(
  windImpact,
  temperatureImpact,
  airDensityImpact,
  humidity
) {
  // Base score
  let score = 100;

  // Wind penalty
  score -= Math.abs(windImpact.effectiveWindSpeed) * 2; // 2 points per m/s
  score -= Math.abs(windImpact.crosswindComponent) * 1.5; // 1.5 points per m/s of crosswind
  score -= Math.abs(windImpact.gustImpact) * 3; // 3 points per m/s for gusts

  // Temperature penalty
  score -= Math.abs(temperatureImpact.estimatedTimeImpact) * 1.5;

  // Air density
  score -= Math.abs(airDensityImpact.densityDifference) * 0.5;

  // Humidity penalty (only when combined with heat)
  if (temperatureImpact.temperature > 25 && humidity > 70) {
    score -= (humidity - 70) * 0.2;
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

export {
  analyzeWeatherImpact,
  calculateWindImpact,
  calculateTemperatureImpact,
  calculateAirDensityImpact,
};
