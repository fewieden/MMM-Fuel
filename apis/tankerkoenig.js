/**
 * @file apis/tankerkoenig.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * @external node-fetch
 * @see https://www.npmjs.com/package/node-fetch
 */
const fetch = require('node-fetch');

/**
 * @module apis/tankerkoenig
 * @description Queries data from tankerkoenig.de
 *
 * @requires external:node-fetch
 *
 * @param {Object} config - Configuration.
 * @param {number} config.lat - Latitude of Coordinate.
 * @param {number} config.lng - Longitude of Coordinate.
 * @param {int} config.radius - Lookup area for gas stations.
 * @param {string} config.sortBy - Type to sort by price.
 * @param {string[]} config.types - Requested fuel types.
 * @param {boolean} config.showOpenOnly - Flag to show only open gas stations.
 *
 * @returns {Object} Object with function getData.
 *
 * @see https://creativecommons.tankerkoenig.de/
 */
module.exports = config => {
    /** @member {string} baseUrl - API url */
    const baseUrl = 'https://creativecommons.tankerkoenig.de/json/list.php';

    /** @member {string} url - API url combined with config options. */
    const url = `${baseUrl}?lat=${config.lat}&lng=${config.lng}&rad=${config.radius}&type=all&apikey=${
        config.api_key}&sort=dist`;

    /**
     * @function sortByPrice
     * @description Helper function to sort gas stations by price.
     *
     * @param {Object} a - Gas Station
     * @param {Object} b - Gas Station
     *
     * @returns {number} Sorting weight.
     */
    const sortByPrice = (a, b) => {
        if (b[config.sortBy] === 0) {
            return Number.MIN_SAFE_INTEGER;
        } else if (a[config.sortBy] === 0) {
            return Number.MAX_SAFE_INTEGER;
        }
        return a[config.sortBy] - b[config.sortBy];
    };

    /**
     * @function filterStations
     * @description Helper function to filter gas stations.
     *
     * @param {Object} station - Gas Station
     *
     * @returns {boolean} To keep or filter the station.
     */
    const filterStations = station => {
        for (let i = 0; i < config.types.length; i += 1) {
            if (station[config.types[i]] <= 0 || config.showOpenOnly && !station.isOpen) {
                return false;
            }
        }
        return true;
    };

    /**
     * @function normalizeStations
     * @description Helper function to normalize the structure of gas stations for the UI.
     *
     * @param {Object} value - Gas Station
     * @param {int} index - Array index
     * @param {Object[]} stations - Original Array.
     *
     * @returns {void}
     *
     * @see apis/README.md
     */
    const normalizeStations = (value, index, stations) => {
        /* eslint-disable no-param-reassign */
        stations[index].prices = {
            diesel: value.diesel,
            e5: value.e5,
            e10: value.e10
        };
        stations[index].distance = value.dist;
        stations[index].address = `${`0${value.postCode}`.slice(-5)} ${
            value.place} - ${value.street} ${value.houseNumber}`;
        /* eslint-enable no-param-reassign */
    };

    return {
        /**
         * @function getData
         * @description Performs the data query and processing.
         * @async
         *
         * @returns {Object} Returns object described in the provider documentation.
         *
         * @see apis
         */
        async getData() {
            const response = await fetch(url);
            const parsedResponse = response.json();


            if (!parsedResponse.ok) {
                throw new Error('Error no fuel data');
            }

            const stations = parsedResponse.stations.filter(filterStations);

            stations.forEach(normalizeStations);

            const price = stations.slice(0);
            price.sort(sortByPrice);

            return {
                types: ['diesel', 'e5', 'e10'],
                unit: 'km',
                currency: 'EUR',
                byPrice: price,
                byDistance: stations
            };
        }
    };
};
