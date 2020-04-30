/**
 * @file apis/utils/index.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * @function filterStations
 * @description Helper function to filter gas stations.
 *
 * @param {Object} station - Gas Station
 *
 * @returns {boolean} To keep or filter the station.
 */
function filterStations(station) {
    const prices = Object.keys(station.prices);

    return !prices.every(type => station.prices[type] === -1);
}

/**
 * @function sortByDistance
 * @description Helper function to sort gas stations by distance.
 *
 * @param {Object} a - Gas Station
 * @param {Object} b - Gas Station
 *
 * @returns {number} Sorting weight.
 */
function sortByDistance(a, b) {
    return a.distance - b.distance;
}

/**
 * @module apis/utils
 * @description Utility functions for API integrations.
 */
module.exports = {
    filterStations,
    sortByDistance
};
