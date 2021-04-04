/**
 * @file apis/spritpreisrechner.js
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

const { filterStations, sortByDistance } = require('./utils');

const BASE_URL = 'https://api.e-control.at/sprit/1.0';
const TYPES = {
    diesel: 'DIE',
    e5: 'SUP',
    gas: 'GAS'
};

let config;

/**
 * @function generateUrl
 * @description Helper function to generate API request url.
 *
 * @param {string} type - Fuel type
 *
 * @returns {string} url
 */
function generateUrl(type) {
    return `${BASE_URL}/search/gas-stations/by-address?latitude=${config.lat}&longitude=${
        config.lng}&fuelType=${TYPES[type]}&includeClosed=${!config.showOpenOnly}`;
}

/**
 * @function requestFuelType
 * @description API request for specified type.
 * @async
 *
 * @param {string} type - Fuel type.
 *
 * @returns {Promise} Object with fuel type and data.
 */
async function requestFuelType(type) {
    const response = await fetch(generateUrl(type));

    return {
        type,
        data: await response.json()
    };
}

/**
 * @function compareStations
 * @description Helper function to compare gas stations.
 *
 * @param {Object} a - Gas Station
 * @param {Object} b - Gas Station
 *
 * @returns {boolean} Flag if the gas stations are equal.
 */
function compareStations(a, b) {
    return a.location.city === b.location.city
        && a.location.postalCode === b.location.postalCode
        && a.name === b.name
        && a.location.latitude === b.location.latitude
        && a.location.longitude === b.location.longitude;
}

/**
 * @function reducePrice
 * @description Reduces array of prices to single price.
 *
 * @param {Object[]} prices - All prices.
 *
 * @returns {number} Highest price or -1 if there is no price.
 */
function reducePrice(prices) {
    return prices.reduce((current, price) => {
        if (!Object.prototype.hasOwnProperty.call(price, 'amount') || price.amount === '') {
            return current;
        }

        return current < price.amount ? price.amount : current;
    }, -1);
}

/**
 * @function normalizeStations
 * @description Helper function to normalize the structure of gas stations for the UI.
 *
 * @param {Object[]} stations - Gas Station.
 * @param {string[]} keys - Fuel types except config option sortBy.
 *
 * @returns {void}
 *
 * @see apis/README.md
 */
function normalizeStations(stations, keys) {
    stations.forEach((value, index) => {
        /* eslint-disable no-param-reassign */
        stations[index].name = value.name;
        stations[index].prices = { [config.sortBy]: reducePrice(value.prices) };
        keys.forEach(type => {
            stations[index].prices[type] = -1;
        });
        stations[index].isOpen = value.open;
        stations[index].address = `${value.location.postalCode} ${value.location.city} - ${value.location.address}`;
        stations[index].lat = parseFloat(value.location.latitude);
        stations[index].lng = parseFloat(value.location.longitude);
        stations[index].distance = value.distance.toFixed(2);
        /* eslint-enable no-param-reassign */
    });
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
    const responses = await Promise.all(config.types.map(requestFuelType));
    const collection = {};
    responses.forEach(element => {
        collection[element.type] = element.data;
    });

    let stations = collection[config.sortBy];

    const maxPrices = {};
    for (const type in collection) {
        for (const station of collection[type]) {
            for (const price of station.prices) {
                if (!maxPrices[price.fuelType] || price.amount > maxPrices[price.fuelType]) {
                    maxPrices[price.fuelType] = price.amount;
                }
            }
        }
    }

    stations = stations.filter(station => station.distance <= config.radius);

    delete collection[config.sortBy];
    const keys = Object.keys(collection);

    normalizeStations(stations, keys);

    keys.forEach(type => {
        collection[type].forEach(station => {
            for (let i = 0; i < stations.length; i += 1) {
                if (compareStations(station, stations[i])) {
                    stations[i].prices[type] = reducePrice(station.prices);
                    break;
                }
            }
        });
    });

    for (const station of stations) {
        for (const type in station.prices) {
            if (station.prices[type] === -1) {
                station.prices[type] = `>${maxPrices[TYPES[type]]}`;
            }
        }
    }

    stations = stations.filter(filterStations);

    const distance = stations.slice(0);
    distance.sort(sortByDistance);

    return {
        types: ['diesel', 'e5', 'gas'],
        unit: 'kilometer',
        currency: 'EUR',
        byPrice: stations,
        byDistance: distance
    };
}

/**
 * @module apis/spritpreisrechner
 * @description Queries data from spritpreisrechner.at
 *
 * @requires external:node-fetch
 * @requires module:Utils
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
 */
module.exports = options => {
    config = options;

    return { getData };
};
