/**
 * @file apis/utils/Coordinate.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * Earth radius in meter.
 * @type {number}
 */
const earth = 6371e3;

/**
 * @function deg2rad
 * @description Converts degree to radian.
 *
 * @param {number} degree - Value to convert.
 * @returns {number} Converted value.
 */
const deg2rad = degree => degree * (Math.PI / 180);

/**
 * @function rad2deg
 * @description Converts radian to degree.
 *
 * @param {number} rad - Value to convert.
 * @returns {number} Converted value.
 */
const rad2deg = rad => rad * (180 / Math.PI);

/**
 * @module apis/utils/Coordinate
 * @description Utility to calculate target Coordinate based of a start Coordinate.
 */
module.exports = {

    /**
     * @function from
     * @description Sets the start Coordinate.
     *
     * @param {number} lat - Latitude of a Coordinate
     * @param {number} lng - Longitude of a Coordinate
     * @returns {module:Coordinate}
     */
    from(lat, lng) {
        this.lat = lat;
        this.lng = lng;
        return this;
    },

    /**
     * @function to
     * @description Calculates the target Coordinate.
     *
     * @param {number} degree - Direction to the target (North is 0).
     * @param {number} distance - Distance in kilometres to the target.
     * @returns {Object.<string, number>} Target Coordinate.
     *
     * @throws {Error} Error gets thrown if the start Coordinate wasn't set.
     *
     * @see https://github.com/chrisveness/geodesy
     */
    to(degree, distance) {
        const φ1 = deg2rad(this.lat);
        const λ1 = deg2rad(this.lng);

        if (!φ1 || !φ1) {
            throw new Error('No start Coordinate set!');
        }

        const radius = distance * 1000;

        const δ = Math.sqrt(2 * (radius * radius)) / earth;
        const θ = deg2rad(Number(degree));

        const sinφ1 = Math.sin(φ1);
        const cosφ1 = Math.cos(φ1);
        const sinδ = Math.sin(δ);
        const cosδ = Math.cos(δ);
        const sinθ = Math.sin(θ);
        const cosθ = Math.cos(θ);

        const sinφ2 = (sinφ1 * cosδ) + (cosφ1 * sinδ * cosθ);
        const φ2 = Math.asin(sinφ2);
        const y = sinθ * sinδ * cosφ1;
        const x = cosδ - (sinφ1 * sinφ2);
        const λ2 = λ1 + Math.atan2(y, x);

        return { lat: rad2deg(φ2), lng: ((rad2deg(λ2) + 540) % 360) - 180 };
    },

    /**
     * @function getDistance
     * @description Calculates the distance between two points.
     *
     * @param {Object.<number, number>} - Start point
     * @param {Object.<number, number>} - Target point
     * @returns {number} - Distance in kilometers
     */
    getDistance(pos1, pos2) {
        // Algorithm taken from https://stackoverflow.com/a/27943
        /* eslint-disable no-mixed-operators */

        const dLat = deg2rad(pos2.lat - pos1.lat);
        const dLon = deg2rad(pos2.lng - pos1.lng);

        const distance = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(pos1.lat)) * Math.cos(deg2rad(pos2.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));

        return earth * c / 1000;
    }
};
