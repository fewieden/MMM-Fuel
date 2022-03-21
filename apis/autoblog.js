/**
 * @file apis/autoblog.js
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
const {parse} = require('node-html-parser');

const BASE_URL = 'https://www.autoblog.com';
const MAX_PAGE = 2;

let config;

/**
 * @function getRequestPaths
 * @description URL paths for fuel type to request data sorted by distance and by price.
 *
 * @param {string} type - Fuel type.
 *
 * @returns {string[]} URL paths for fuel type.
 */
function getRequestPaths(type) {
    const typeSuffix = type === 'regular' ? '' : `/${type}`;

    return [
        `/${config.zip}-gas-prices${typeSuffix}`,
        `/${config.zip}-gas-prices${typeSuffix}/sort-price`
    ];
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
        name: htmlGasStation.querySelector('li.name h4').text,
        address: htmlGasStation.querySelector('li.name address').text,
        prices: {[type]: parseFloat(htmlGasStation.querySelector('li.price data.price').getAttribute('value'))},
        distance: parseFloat(htmlGasStation.querySelector('li.dist data.distance').getAttribute('value')),
    };
}

/**
 * @function fillMissingPrices
 * @description Replaces missing price information with max price for type.
 *
 * @param {Object[]} stations - Gas Stations
 * @param {Object} maxPricesByType - Maximum price per fuel type.
 *
 * @returns {void}
 */
function fillMissingPrices(stations, maxPricesByType) {
    for (let station of stations) {
        for (const type of config.types) {
            if (!station.prices[type]) {
                station.prices[type] = `>${maxPricesByType[type]}`;
            }
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
function sortByPrice(a, b) {
    const aPrice = a.prices[config.sortBy];
    const bPrice = b.prices[config.sortBy];

    if (!isNaN(aPrice) && isNaN(bPrice)) {
        return -1;
    } else if (isNaN(aPrice) && !isNaN(bPrice)) {
        return 1;
    } else if (!isNaN(aPrice) && !isNaN(bPrice)) {
        if (aPrice < bPrice) {
            return -1;
        } else if (aPrice > bPrice) {
            return 1;
        }
    }

    return 0;
}

/**
 * @function fetchPaginatedStations
 * @description Paginated API requests for specified type.
 * @async
 *
 * @param {string} type - Fuel type.
 * @param {string} path - URL path.
 *
 * @returns {Promise} Array with station.
 */
async function fetchPaginatedStations(type, path) {
    let stations = [];
    let nextPage = 1;

    while (nextPage !== -1 && nextPage <= MAX_PAGE) {
        try {
            const pageSuffix = `/pg-${nextPage}`;
            const response = await fetch(`${BASE_URL}${path}${pageSuffix}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
                }
            });
            const html = await response.text();
            const parsedHtml = parse(html);

            const htmlStations = parsedHtml.querySelectorAll('li.shop ul.details');
            const parsedStations = htmlStations.map(station => mapGasStation(station, type));
            stations = stations.concat(parsedStations);

            nextPage = htmlStations.length === 10 ? nextPage + 1 : -1;
        } catch (e) {
            nextPage = -1;
        }
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
 * @see apis/README.md
 */
async function getData() {
    let maxPricesByType = {};
    let indexedStations = {};

    for (const type of config.types) {
        const paths = getRequestPaths(type);

        for (const path of paths) {
            const stations = await fetchPaginatedStations(type, path);

            for (const station of stations) {
                const stationKey = `${station.name}-${station.address}`;
                if (!indexedStations[stationKey]) {
                    indexedStations[stationKey] = station;
                } else {
                    indexedStations[stationKey].prices[type] = station.prices[type];
                }

                if (!maxPricesByType[type] || maxPricesByType[type] < station.prices[type]) {
                    maxPricesByType[type] = station.prices[type];
                }
            }
        }
    }

    let stations = Object.values(indexedStations);

    fillMissingPrices(stations, maxPricesByType);

    stations = stations.filter(station => station.distance <= config.radius);

    const stationsSortedByDistance = stations.sort((a, b) => a.distance - b.distance);
    const stationsSortedByPrice = [...stationsSortedByDistance].sort(sortByPrice);

    return {
        types: ['regular', 'premium', 'mid-grade', 'diesel'],
        unit: 'mile',
        currency: 'USD',
        byPrice: stationsSortedByPrice,
        byDistance: stationsSortedByDistance
    };
}

/**
 * @module apis/autoblog
 * @description Queries data from https://www.autoblog.com
 *
 * @requires external:node-fetch
 * @requires external:node-html-parser
 *
 * @param {Object} options - Configuration.
 * @param {int} options.radius - Lookup area for gas stations.
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
