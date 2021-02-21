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
 * @external geolib
 * @see https://www.npmjs.com/package/geolib
 */
const geolib = require('geolib');

const BASE_URL_RADIUS = 'https://creativecommons.tankerkoenig.de/json/list.php';
const BASE_URL_STATION = 'https://creativecommons.tankerkoenig.de/json/detail.php';

let config;

/**
 * @function generateUrlRadius
 * @description Helper function to generate API request url.
 *
 * @returns {string} url
 */
function generateUrlRadius() {
    return `${BASE_URL_RADIUS}?lat=${config.lat}&lng=${config.lng}&rad=${config.radius}&type=all&apikey=${
        config.api_key}&sort=dist`;
}

/**
 * @function generateUrlStation
 * @description Helper function to generate API request url.
 *
 * @param {Object} id - Gas Station id
 *
 * @returns {string} url
 */
function generateUrlStation(id) {
    return `${BASE_URL_STATION}?id=${id}&apikey=${config.api_key}`;
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
function sortByPrice(a, b) {
    if (b[config.sortBy] === 0) {
        return Number.MIN_SAFE_INTEGER;
    } else if (a[config.sortBy] === 0) {
        return Number.MAX_SAFE_INTEGER;
    }

    return a[config.sortBy] - b[config.sortBy];
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
    if (b.dist === 0) {
        return Number.MIN_SAFE_INTEGER;
    } else if (a.dist === 0) {
        return Number.MAX_SAFE_INTEGER;
    }

    return a.dist - b.dist;
}

/**
 * @function filterStations
 * @description Helper function to filter gas stations.
 *
 * @param {Object} station - Gas Station
 *
 * @returns {boolean} To keep or filter the station.
 */
function filterStations(station) {
    for (let i = 0; i < config.types.length; i += 1) {
        if (station[config.types[i]] <= 0 || config.showOpenOnly && !station.isOpen) {
            return false;
        }
    }

    return true;
}

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
function normalizeStations(value, index, stations) {
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
}

/**
 * @function getData
 * @description Performs the data query and processing.
 * @async
 *
 * @returns {Object} Returns object described in the provider documentation.
 *
 * @see apis
 */
async function getData() {
    let response = await fetch(generateUrlRadius());
    let parsedResponse = await response.json();

    if (!parsedResponse.ok) {
        throw new Error('Error no fuel radius data');
    }

    // Add stations by radius
    const stations = parsedResponse.stations;

    if (Array.isArray(config.stations)) {
        for (let i = 0; i < config.stations.length; i += 1) {
            response = await fetch(generateUrlStation(config.stations[i]));
            parsedResponse = await response.json();

            if (!parsedResponse.ok) {
                throw new Error('Error no fuel station detail');
            }

            const station = parsedResponse.station;

            // Calculate distance in meters
            const distanceMeters = station.distance = geolib.getDistance({
                latitude: config.lat,
                longitude: config.lng,
            }, {
                latitude: station.lat,
                longitude: station.lng,
            });

            station.dist = (distanceMeters / 1000).toFixed(1);

            // Add station detail
            stations.push(station)
        }
    }

    const stationsFiltered = stations.filter(filterStations);
    stationsFiltered.forEach(normalizeStations);

    const distance = stationsFiltered.slice(0);
    distance.sort(sortByDistance);

    const price = stationsFiltered.slice(0);
    price.sort(sortByPrice);

    return {
        types: ['diesel', 'e5', 'e10'],
        unit: 'kilometer',
        currency: 'EUR',
        byPrice: price,
        byDistance: distance
    };
}

/**
 * @module apis/tankerkoenig
 * @description Queries data from tankerkoenig.de
 *
 * @requires external:node-fetch
 *
 * @param {Object} options - Configuration.
 * @param {number} options.lat - Latitude of Coordinate.
 * @param {number} options.lng - Longitude of Coordinate.
 * @param {int} options.radius - Lookup area for gas stations.
 * @param {string} options.sortBy - Type to sort by price.
 * @param {string[]} options.types - Requested fuel types.
 * @param {boolean} options.showOpenOnly - Flag to show only open gas stations.
 *
 * @returns {Object} Object with function getData.
 *
 * @see https://creativecommons.tankerkoenig.de/
 */
module.exports = options => {
    config = options;

    return { getData };
};
