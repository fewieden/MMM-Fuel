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
 * @external logger
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */
const Log = require('logger');

const BASE_URL = 'https://creativecommons.tankerkoenig.de/json';

let config;
let stationInfos;

/**
 * @function generateRadiusUrl
 * @description Helper function to generate API request url.
 *
 * @returns {string} url
 */
function generateRadiusUrl() {
    return `${BASE_URL}/list.php?lat=${config.lat}&lng=${config.lng}&rad=${config.radius}&type=all&apikey=${
        config.api_key}&sort=dist`;
}

/**
 * @function generateStationPricesUrl
 * @description Helper function to generate API request url.
 *
 * @param {string[]} ids - Gas Station IDs
 *
 * @returns {string} url
 */
function generateStationPricesUrl(ids) {
    return `${BASE_URL}/prices.php?ids=${ids.join(',')}&apikey=${config.api_key}`;
}

/**
 * @function generateStationInfoUrl
 * @description Helper function to generate API request url.
 *
 * @param {string} id - Gas Station ID
 *
 * @returns {string} url
 */
function generateStationInfoUrl(id) {
    return `${BASE_URL}/detail.php?id=${id}&apikey=${config.api_key}`;
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
 * @function getPricesByRadius
 * @description Fetches the prices by radius.
 * @async
 *
 * @returns {Object[]} List of stations in raw format.
 */
async function getPricesByRadius() {
    const response = await fetch(generateRadiusUrl());
    const parsedResponse = await response.json();

    if (!parsedResponse.ok) {
        throw new Error('Error no fuel radius prices');
    }

    return parsedResponse.stations;
}

/**
 * @function degreesToRadians
 * @description Converst degrees to radians
 * @see https://stackoverflow.com/questions/365826/calculate-distance-between-2-gps-coordinates/365853#365853
 *
 * @param {number} degrees - Degrees
 *
 * @returns {number} Radians
 */
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * @function distanceInMBetweenCoordinates
 * @description Calculates the distance of two coordinates in meters.
 * @see https://stackoverflow.com/questions/365826/calculate-distance-between-2-gps-coordinates/365853#365853
 *
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lon1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lon2 - Longitude of point 2.
 *
 * @returns {number} Distance in meters rounded to the closest 100m.
 */
function distanceInMBetweenCoordinates(lat1, lon1, lat2, lon2) {
    const earthRadiusM = 6371000;

    const dLat = degreesToRadians(lat2-lat1);
    const dLon = degreesToRadians(lon2-lon1);

    lat1 = degreesToRadians(lat1);
    lat2 = degreesToRadians(lat2);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return Math.round(earthRadiusM * c / 100) * 100;
}

/**
 * @function setStationInfos
 * @description Initializes the gas station information.
 * @async
 *
 * @param {Object[]} stationsByRadius - Gas Stations by radius. Used to filter out possible duplicate stations.
 *
 * @returns {void}
 */
async function setStationInfos(stationsByRadius) {
    for (const station of stationsByRadius) {
        config.stationIds = config.stationIds.filter(id => id !== station.id);
    }

    if (config.stationIds.length > 10) {
        Log.warn(`MMM-Fuel: You can only ask for a maximum of 10 station prices`);
        config.stations = config.stationIds.slice(0, 10);
    }

    stationInfos = {};

    for (const stationId of config.stationIds) {
        const response = await fetch(generateStationInfoUrl(stationId));
        const parsedResponse = await response.json();

        if (!parsedResponse.ok) {
            Log.warn(`MMM-Fuel: No fuel station detail. StationId: ${stationId} Error: ${parsedResponse.message}`);
            continue;
        }

        const station = parsedResponse.station;

        const distanceMeters = distanceInMBetweenCoordinates(config.lat, config.lng, station.lat, station.lng);

        stationInfos[station.id] = { ...station, dist: distanceMeters / 1000 };
    }
}

/**
 * @function getPricing
 * @description Helper function to calculate prices for getPricesByStationList.
 * @async
 *
 * @returns {Object} Fuel prices for all types.
 */
function getPricing({ status, ...prices }) {
    const pricing = { diesel: -1, e5: -1, e10: -1 };

    if (status !== 'open') {
        return pricing;
    }

    for (const type in prices) {
        if (prices[type]) {
            pricing[type] = prices[type];
        }
    }

    return pricing;
}

/**
 * @function getPricesByStationList
 * @description Fetches the prices by station ID list.
 * @async
 *
 * @param {Object[]} stationsByRadius - Gas Stations by radius. Used to filter out possible duplicate stations.
 *
 * @returns {Object[]} List of stations in raw format.
 */
async function getPricesByStationList(stationsByRadius) {
    if (!stationInfos) {
        await setStationInfos(stationsByRadius);
    }

    const stationIds = Object.keys(stationInfos);
    const stations = [];

    if (!stationIds.length) {
        Log.warn('MMM-Fuel: Filtered stationIds list is empty');
        return stations;
    }

    const response = await fetch(generateStationPricesUrl(stationIds));
    const parsedResponse = await response.json();

    if (!parsedResponse.ok) {
        throw new Error('Error no fuel station prices');
    }

    for (const [stationId, info] of Object.entries(parsedResponse.prices)) {
        stations.push({
            ...stationInfos[stationId],
            isOpen: info.status !== 'closed',
            prices: getPricing(info)
        });
    }

    return stations;
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
    let stations = [];

    if (config.radius > 0) {
        stations = stations.concat(await getPricesByRadius());
    }

    if (Array.isArray(config.stationIds)) {
        stations = stations.concat(await getPricesByStationList(stations));
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
 * @requires external:logger
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
