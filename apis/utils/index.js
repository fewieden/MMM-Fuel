/**
 * @file apis/utils/index.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * @external lodash
 * @see https://www.npmjs.com/package/lodash
 */
const _ = require('lodash');

/**
 * @function filterStations
 * @description Helper function to filter gas stations.
 *
 * @param {Object} station - Gas Station
 *
 * @returns {boolean} To keep or filter the station.
 */
function filterStations(station) {
    const prices = _.keys(station.prices);

    return !_.every(prices, type => _.get(station, `prices.${type}`) === -1);
}

/**
 * @function fillMissingPrices
 * @description Replaces missing price information with max price for type.
 *
 * @param {Object} station - Gas Station
 * @param {Object} maxPricesByType - Maximum price per fuel type.
 *
 * @returns {void}
 */
function fillMissingPrices(config, station, maxPricesByType) {
    for (const type of config.types) {
        if (!_.get(station, `prices.${type}`)) {
            _.set(station, `prices.${type}`, `>${maxPricesByType[type]}`);
        }
    }
}

/**
 * @function sortByPrice
 * @description Helper function to sort gas stations by price.
 *
 * @param {Object} a - Gas Station
 * @param {Object} b - Gas Station
 *
 * @returns {number} Sorting weight.
 */
function sortByPrice(config, station) {
    const price = _.get(station, `prices.${config.sortBy}`);

    if (_.isNumber(price)) {
        return price;
    }

    return Number.POSITIVE_INFINITY;
}

/**
 * @function mergePrices
 * @description Merges fuel prices of different types of gas station
 *
 * @param {Object[]} responses - List of gas stations with prices of single fuel type.
 * @param {function} getStationKeyFunc - Helper to retrieve unique station key.
 *
 * @returns {Object} Returns gas stations with merged prices and max prices per fuel type.
 */
function mergePrices(responses, getStationKeyFunc) {
    const { indexedStations, maxPricesByType } = responses.reduce(({ indexedStations, maxPricesByType }, station) => {
        const stationKey = getStationKeyFunc(station);

        if (!indexedStations[stationKey]) {
            indexedStations[stationKey] = station;
        } else {
            indexedStations[stationKey].prices[station.fuelType] = station.prices[station.fuelType];
        }

        if (!maxPricesByType[station.fuelType] || maxPricesByType[station.fuelType] < station.prices[station.fuelType]) {
            maxPricesByType[station.fuelType] = station.prices[station.fuelType];
        }

        return { indexedStations, maxPricesByType };
    }, { indexedStations: {}, maxPricesByType: {} });

    return { stations: Object.values(indexedStations), maxPricesByType };
}

/**
 * @module apis/utils
 * @description Utility functions for API integrations.
 */
module.exports = {
    fillMissingPrices,
    filterStations,
    mergePrices,
    sortByPrice
};
