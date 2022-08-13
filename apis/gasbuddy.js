/**
 * @file apis/gasbuddy.js
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
 * @external node-html-parser
 * @see https://www.npmjs.com/package/node-html-parser
 */
const { parse } = require('node-html-parser');

/**
 * @external logger
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */
const Log = require('logger');

const { fillMissingPrices, sortByPrice } = require('./utils');

const BASE_URL = 'https://www.gasbuddy.com';
const TYPES = {
    regular: 1,
    midgrade: 2,
    premium: 3,
    diesel: 4,
    e85: 5,
    unl88: 12
};

let config;

/**
 * @function getRequestPath
 *
 * @description URL path for fuel type to request data.
 *
 * @param {string} type - Fuel type.
 *
 * @returns {string} URL path for fuel type.
 */
function getRequestPath(type) {
    return `/home?search=${config.zip}&fuel=${TYPES[type]}&maxAge=0&method=all`;
}

/**
 * @function mapGasStation
 * @description Maps HTML gas station to reguilar object.
 *
 * @param {Object} htmlGasStation - HTML node of gas station.
 * @param {string} type - Fuel type.
 *
 * @returns {Object} Gas station
 */
function mapGasStation(htmlGasStation, type) {
    return {
        name: htmlGasStation.querySelector('[class*=header__header3___] a[href*=station]').text,
        address: htmlGasStation.querySelector('[class*=StationDisplay-module__address___]').innerHTML.replace('<br>', ' '),
        prices: { [type]: parseFloat(htmlGasStation.querySelector('[class*=StationDisplayPrice-module__price___]').text.replace('$', '')) },
        distance: 0,
        stationId: htmlGasStation.querySelector('[class*=header__header3___] a[href*=station]').rawAttributes.href.replace('/station/', '')
    };

}

/**
 * @function fetchStations
 * @description API requests for specified type.
 * @async
 *
 * @param {string} type - Fuel type.
 * @param {string} path - URL path.
 *
 * @returns {Promise} Array with stations including fuelType.
 */
async function fetchStations(type, path) {
    let stations = [];
    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
            }
        });
        const html = await response.text();
        const parsedHtml = parse(html);

        const htmlStations = parsedHtml.querySelectorAll('[class*=GenericStationListItem-module__stationListItem___]');

        const parsedStations = htmlStations.map(station => mapGasStation(station, type));

        stations = stations.concat(parsedStations);
    } catch (error) {
        Log.error(`MMM-Fuel: Failed to fetch stations for type ${type}`, error);
    }

    stations.forEach(station => {
        station.fuelType = type;
    });

    return stations;
}

/**
 * @function getAllStations
 * @description Requests all stations and fuel types.
 * @async
 *
 * @returns {Object[]} Returns object described in the provider documentation.
 */
async function getAllStations() {
    const promises = config.types.reduce((acc, type) => {
        const path = getRequestPath(type);

        acc.push(fetchStations(type, path));
        return acc;
    }, []);

    const responses = await Promise.all(promises);

    return responses.flat();
}

/**
 * @function mergePrices
 * @description Merges fuel prices of different types of gas station
 *
 * @param {Object[]} responses - List of gas stations with prices of single fuel type.
 *
 * @returns {Object} Returns gas stations with merged prices and max prices per fuel type.
 */
function mergePrices(responses) {
    const { indexedStations, maxPricesByType } = responses.reduce(({ indexedStations, maxPricesByType }, station) => {
        if (!indexedStations[station.stationId]) {
            indexedStations[station.stationId] = station;
        } else {
            indexedStations[station.stationId].prices[station.fuelType] = station.prices[station.fuelType];
        }

        if (!maxPricesByType[station.fuelType] || maxPricesByType[station.fuelType] < station.prices[station.fuelType]) {
            maxPricesByType[station.fuelType] = station.prices[station.fuelType];
        }

        return { indexedStations, maxPricesByType };
    }, { indexedStations: {}, maxPricesByType: {} });

    return { stations: Object.values(indexedStations), maxPricesByType };
}

/**
 * @function getData
 * @description Performs the data query and processing.
 * @async
 *
 * @returns {Object} Returns object described in the provider documentation.
 *
 * @see apis/README.md
 */
async function getData() {
    const responses = await getAllStations();

    const { stations, maxPricesByType } = mergePrices(responses);

    stations.forEach(station => fillMissingPrices(config, station, maxPricesByType));

    // Webpage doesn't support distance (only zip code).
    const stationsSortedByPrice = stations.sort(sortByPrice.bind(null, config));
    const stationsSortedByDistance = stationsSortedByPrice;

    return {
        types: ['regular', 'midgrade', 'premium', 'diesel', 'e85', 'unl88'],
        unit: 'mile',
        currency: 'USD',
        byPrice: stationsSortedByPrice,
        byDistance: stationsSortedByDistance
    };
}

/**
 * @module apis/gasbuddy
 * @description Queries data from https://www.gasbuddy.com
 *
 * @requires external:node-fetch
 * @requires external:node-html-parser
 * @requires external:logger
 *
 * @param {Object} options - Configuration.
 * @param {string} options.zip - Zip code of address.
 * @param {string} options.sortBy - Type to sort by price.
 * @param {string[]} options.types - Requested fuel types.
 *
 * @returns {Object} Object with function getData.
 */
module.exports = options => {
    config = options;
    return { getData };
};
