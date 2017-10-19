/**
 * @file apis/tankerkoenig.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * @external request
 * @see https://www.npmjs.com/package/request
 */
const request = require('request');
const Coordinate = require('./utils/Coordinate.js');

/**
 * @module apis/tankerkoenig
 * @description Queries data from tankerkoenig.de
 *
 * @requires external:request
 * @requires module:Coordinate
 *
 * @param {Object} config - Configuration.
 * @param {number} config.lat - Latitude of Coordinate.
 * @param {number} config.lng - Longitude of Coordinate.
 * @param {int} config.radius - Lookup area for gas stations.
 * @param {string} config.sortBy - Type to sort by price.
 * @param {string[]} config.types - Requested fuel types.
 * @param {boolean} config.showOpenOnly - Flag to show only open gas stations.
 *
 * @see https://creativecommons.tankerkoenig.de/
 */
module.exports = (config) => {
    /** @member {string} baseUrl - API url */
    const baseUrl = 'https://creativecommons.tankerkoenig.de/json';

    /**
     * @function generateOptions
     * @description Helper function to generate the options.
     *
     * @param {string} gasStationId - Optional gas station ID
     * @returns {Object.<string>} Options-object
     */
    const generateOptions = (gasStationId) => {
        let url = baseUrl;

        if (config.ids && gasStationId && config.ids.length > 0) {
            url += `/detail.php?id=${gasStationId}`;
        } else {
            url += `/list.php?lat=${config.lat}&lng=${config.lng}&rad=${config.radius}&type=all&sort=dist`;
        }

        url += `&apikey=${config.api_key}`;

        return {
            url
        };
    };

    /**
     * @function sortByPrice
     * @description Helper function to sort gas stations by price.
     *
     * @param {Object} a - Gas Station
     * @param {Object} b - Gas Station
     * @returns {number}
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
     * @returns {boolean}
     */
    const filterStations = (station) => {
        for (let i = 0; i < config.types.length; i += 1) {
            if (station[config.types[i]] <= 0 || (config.showOpenOnly && !station.isOpen)) {
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
        stations[index].address = `${(`0${value.postCode}`).slice(-5)} ${
            value.place} - ${value.street} ${value.houseNumber}`;
        /* eslint-enable no-param-reassign */
    };

    /**
     * @function requestPrice
     * @description Function to fetch the details for a given station.
     *
     * @param {string} gasStationId - ID of the gas station
     *
     * @returns {Promise} Data or error message
     */
    const requestPrice = gasStationId => new Promise((resolve, reject) => {
        request(generateOptions(gasStationId), (error, response, body) => {
            if (response.statusCode === 200) {
                const parsedBody = JSON.parse(body);

                if (parsedBody.ok) {
                    parsedBody.station.dist = Coordinate.getDistance({
                        lat: config.lat,
                        lng: config.lng
                    }, {
                        lat: parsedBody.station.lat,
                        lng: parsedBody.station.lng
                    });
                    resolve(parsedBody.station);
                } else {
                    reject(`Error getting station details ${parsedBody.status}`);
                }
            } else {
                reject(`Error getting fuel data ${response.statusCode}`);
            }
        });
    });

    /**
     * @function parseStationList
     * @description Helper function to pars the list of gas stations.
     *
     * @param {Object[]} stationList - List of gas stations
     * @param {getDataCallback} callback - Callback that handles the API data.
     *
     * @returns {Promise} Data or error message
     */
    const parseStationList = (stationList, callback) => {
        const stations = stationList.filter(filterStations);

        stations.forEach(normalizeStations);

        const price = stations.slice(0);
        price.sort(sortByPrice);


        callback(null, {
            types: ['diesel', 'e5', 'e10'],
            unit: 'km',
            currency: 'EUR',
            byPrice: price,
            byDistance: stations
        });
    };

    return {
        /**
         * @callback getDataCallback
         * @param {?string} error - Error message.
         * @param {Object} data - API data.
         *
         * @see apis/README.md
         */

        /**
         * @function getData
         * @description Performs the data query and processing.
         *
         * @param {getDataCallback} callback - Callback that handles the API data.
         */
        getData(callback) {
            if (config.ids && config.ids.length > 0) {
                Promise
                    .all(config.ids.map(requestPrice))
                    .then((stationList) => {
                        parseStationList(stationList, callback);
                    }, callback);
            } else {
                request(generateOptions(), (error, response, body) => {
                    if (response.statusCode === 200) {
                        const parsedBody = JSON.parse(body);
                        if (parsedBody.ok) {
                            parseStationList(parsedBody.stations, callback);
                        } else {
                            callback('Error no fuel data');
                        }
                    } else {
                        callback(`Error getting fuel data ${response.statusCode}`);
                    }
                });
            }
        }
    };
};
