// src/services/directionalAnalysis.js

/**
 * Analyzes a segment's polyline to calculate weighted directional distribution
 * @param {Array} coordinates - Array of [lat, lng] coordinate pairs from the polyline
 * @returns {Object} Directional distribution with percentages and dominant direction
 */
function analyzeSegmentDirection(coordinates) {
    if (!coordinates || coordinates.length < 2) {
        return {
            weighted: false,
            direction: 0,
            distribution: {}
        };
    }

    // Direction buckets (N, NE, E, SE, S, SW, W, NW)
    const directionBuckets = {
        "N": { range: [337.5, 22.5], distance: 0 },
        "NE": { range: [22.5, 67.5], distance: 0 },
        "E": { range: [67.5, 112.5], distance: 0 },
        "SE": { range: [112.5, 157.5], distance: 0 },
        "S": { range: [157.5, 202.5], distance: 0 },
        "SW": { range: [202.5, 247.5], distance: 0 },
        "W": { range: [247.5, 292.5], distance: 0 },
        "NW": { range: [292.5, 337.5], distance: 0 }
    };

    let totalDistance = 0;
    let cardinalDistribution = {};
    let degreesDistribution = {};

    // Calculate distance and direction for each segment portion
    for (let i = 0; i < coordinates.length - 1; i++) {
        const start = coordinates[i];
        const end = coordinates[i + 1];

        // Calculate distance between these two points
        const distance = calculateDistance(start, end);

        // Skip if points are too close (GPS noise)
        if (distance < 5) continue;

        // Calculate direction from start to end
        const direction = calculateDirection(start, end);

        // Track distribution by degree buckets (for detailed analysis)
        const degreeBucket = Math.floor(direction / 10) * 10;
        degreesDistribution[degreeBucket] = (degreesDistribution[degreeBucket] || 0) + distance;

        // Add to the appropriate cardinal direction bucket
        let assigned = false;

        for (const [cardinal, data] of Object.entries(directionBuckets)) {
            if (isInDirectionRange(direction, data.range)) {
                directionBuckets[cardinal].distance += distance;
                assigned = true;
                break;
            }
        }

        // Handle the special case of North (crossing 0/360 boundary)
        if (!assigned &&
            (direction >= directionBuckets["N"].range[0] ||
                direction <= directionBuckets["N"].range[1])) {
            directionBuckets["N"].distance += distance;
        }

        totalDistance += distance;
    }

    // Calculate percentages for each cardinal direction
    for (const [cardinal, data] of Object.entries(directionBuckets)) {
        const percentage = totalDistance > 0 ? (data.distance / totalDistance) * 100 : 0;
        cardinalDistribution[cardinal] = parseFloat(percentage.toFixed(1));
    }

    // Find dominant direction (the one with highest percentage)
    let dominantCardinal = "N";
    let maxPercentage = 0;

    for (const [cardinal, percentage] of Object.entries(cardinalDistribution)) {
        if (percentage > maxPercentage) {
            maxPercentage = percentage;
            dominantCardinal = cardinal;
        }
    }

    // Calculate a weighted direction in degrees
    let weightedDirection = 0;
    let sinSum = 0;
    let cosSum = 0;

    for (const [degreeBucket, distance] of Object.entries(degreesDistribution)) {
        const degrees = parseInt(degreeBucket) + 5; // use middle of bucket
        const radians = (degrees * Math.PI) / 180;
        sinSum += Math.sin(radians) * distance;
        cosSum += Math.cos(radians) * distance;
    }

    weightedDirection = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
    if (weightedDirection < 0) weightedDirection += 360;

    return {
        weighted: true,
        direction: parseFloat(weightedDirection.toFixed(1)),
        dominantCardinal,
        dominantPercentage: maxPercentage,
        distribution: cardinalDistribution,
        totalDistance: totalDistance
    };
}

/**
 * Check if a direction falls within a directional range
 * @param {number} direction - Direction in degrees (0-359)
 * @param {Array} range - [min, max] range in degrees
 * @returns {boolean} Whether direction is in range
 */
function isInDirectionRange(direction, range) {
    const [min, max] = range;
    return direction >= min && direction < max;
}

/**
 * Calculate distance between two coordinates in meters
 * @param {Array} point1 - [lat, lng] first point
 * @param {Array} point2 - [lat, lng] second point
 * @returns {number} Distance in meters
 */
function calculateDistance(point1, point2) {
    const [lat1, lng1] = point1;
    const [lat2, lng2] = point2;

    // Haversine formula
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate bearing/direction between two points
 * @param {Array} start - [lat, lng] start point
 * @param {Array} end - [lat, lng] end point
 * @returns {number} Direction in degrees (0-359)
 */
function calculateDirection(start, end) {
    const [lat1, lng1] = start;
    const [lat2, lng2] = end;

    const lat1Rad = lat1 * (Math.PI / 180);
    const lat2Rad = lat2 * (Math.PI / 180);
    const lngDiffRad = (lng2 - lng1) * (Math.PI / 180);

    const y = Math.sin(lngDiffRad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lngDiffRad);

    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    if (bearing < 0) {
        bearing += 360;
    }

    return bearing;
}

/**
 * Calculate wind impact factor based on weighted directional analysis
 * @param {Object} wind - Wind data (speed and direction)
 * @param {Object} segmentAnalysis - Directional analysis of the segment
 * @returns {number} Wind assistance factor (-1 to 1)
 */
function calculateWeightedWindAssistance(wind, segmentAnalysis) {
    if (!wind || !wind.speed || wind.speed < 1) {
        return 0; // No significant wind
    }

    if (!segmentAnalysis || !segmentAnalysis.weighted) {
        return 0; // No directional analysis available
    }

    const windDirection = wind.deg;
    const windSpeed = wind.speed;

    // Calculate wind impact for each cardinal direction
    const cardinalImpacts = {};
    let totalImpact = 0;

    for (const [cardinal, percentage] of Object.entries(segmentAnalysis.distribution)) {
        if (percentage <= 0) continue;

        // Get middle angle for this cardinal direction
        const cardinalAngle = getCardinalAngle(cardinal);

        // Calculate angle difference between wind and this direction
        // Normalize to 0-180 (we only care about if it's head/tail wind)
        const angleDiff = Math.abs(((windDirection - cardinalAngle + 180) % 360) - 180);

        // Determine impact: 1 for perfect tailwind, -1 for perfect headwind
        let directionImpact;

        if (angleDiff <= 45) {
            // Tailwind (0-45 degrees off) - positive impact
            directionImpact = mapRange(angleDiff, 0, 45, 1, 0.5);
        } else if (angleDiff >= 135) {
            // Headwind (135-180 degrees off) - negative impact
            directionImpact = mapRange(angleDiff, 135, 180, -0.5, -1);
        } else {
            // Crosswind (45-135 degrees off) - small impact
            directionImpact = mapRange(angleDiff, 45, 135, 0.5, -0.5);
        }

        // Scale by percentage of segment in this direction
        const weightedImpact = directionImpact * (percentage / 100);
        cardinalImpacts[cardinal] = weightedImpact;
        totalImpact += weightedImpact;
    }

    // Scale based on wind speed - stronger winds have more impact
    const speedFactor = mapRange(windSpeed, 1, 20, 0.2, 1);

    // Return detailed analysis
    return {
        overallImpact: totalImpact * speedFactor,
        cardinalImpacts,
        windSpeedFactor: speedFactor,
        analysis: segmentAnalysis
    };
}

/**
 * Maps a value from one range to another
 * @param {number} value - Value to map
 * @param {number} fromMin - Input range minimum
 * @param {number} fromMax - Input range maximum
 * @param {number} toMin - Output range minimum
 * @param {number} toMax - Output range maximum
 * @returns {number} Mapped value
 */
function mapRange(value, fromMin, fromMax, toMin, toMax) {
    // Ensure value is within the from range
    value = Math.max(fromMin, Math.min(value, fromMax));

    // Calculate the mapped value
    return toMin + (toMax - toMin) * ((value - fromMin) / (fromMax - fromMin));
}

/**
 * Get the angle in degrees for a cardinal direction
 * @param {string} cardinal - Cardinal direction (N, NE, E, etc.)
 * @returns {number} Angle in degrees
 */
function getCardinalAngle(cardinal) {
    const angles = {
        "N": 0,
        "NE": 45,
        "E": 90,
        "SE": 135,
        "S": 180,
        "SW": 225,
        "W": 270,
        "NW": 315
    };

    return angles[cardinal] || 0;
}

export {
    analyzeSegmentDirection,
    calculateWeightedWindAssistance
};