/**
 * @file apis/nsw.js
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
 * @external moment
 * @see https://www.npmjs.com/package/moment
 */
const moment = require('moment');

const { filterStations, sortByDistance } = require('./utils');

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const QUARTER_DAY = 6 * HOUR;
const BASE_URL = 'https://api.onegov.nsw.gov.au';
const TYPES = {
    diesel: 'DL',
    e5: 'P95'
};

let transaction = 1;
let config;
let token;

/**
 * @function refreshToken
 * @description Helper function to refresh the API token.
 * @async
 *
 * @returns {Promise}
 *
 * @see apis/README.md
 */
async function refreshToken(config) {
    try {
        const response = await fetch(`${BASE_URL}/oauth/client_credential/accesstoken?grant_type=client_credentials`, {
            headers: {
                'Content-Type': 'application/json',
                authorization: `Basic ${Buffer.from(`${config.api_key}:${config.secret}`).toString('base64')}`,
                'User-Agent': 'MagicMirror²'
            }
        });
        const parsedResponse = await response.json();

        if (parsedResponse.Error) {
            throw new Error(parsedResponse.Error);
        }

        token = parsedResponse.access_token;
    } catch (e) {
        console.log('MMM-Fuel: Failed to refresh token', e);
    }
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
    for (const response of responses) {
        collection[response.type] = mapPriceToStation(response.data);
    }

    let stations = collection[config.sortBy];

    const maxPrices = {};
    for (const type in collection) {
        for (const station of collection[type]) {
            if (!maxPrices[type] || station.price > maxPrices[type]) {
                maxPrices[type] = station.price;
            }
        }
    }

    delete collection[config.sortBy];
    const keys = Object.keys(collection);

    normalizeStations(stations, keys);

    keys.forEach(type => {
        collection[type].forEach(station => {
            for (let i = 0; i < stations.length; i += 1) {
                if (station.code === stations[i].code) {
                    stations[i].prices[type] = station.price;
                    break;
                }
            }
        });
    });

    for (const station of stations) {
        for (const type in station.prices) {
            if (station.prices[type] === -1) {
                station.prices[type] = `>${maxPrices[type]}`;
            }
        }
    }

    stations = stations.filter(filterStations);

    const distance = stations.slice(0);
    distance.sort(sortByDistance);

    return {
        types: ['diesel', 'e5'],
        unit: 'km',
        currency: 'AUD',
        byPrice: stations,
        byDistance: distance
    };
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
    const response = await fetch(`${BASE_URL}/FuelPriceCheck/v1/fuel/prices/nearby`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: config.api_key,
            Authorization: `Bearer ${token}`,
            transactionid: transaction++,
            requesttimestamp: moment().utc()
                .format('DD/MM/YYYY hh:mm:ss A')
        },
        body: JSON.stringify({
            fueltype: TYPES[type],
            latitude: config.lat,
            longitude: config.lng,
            radius: config.radius,
            sortby: 'price',
            sortascending: true
        })
    });

    return { type, data: await response.json() };
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
        stations[index].prices = { [config.sortBy]: value.price };
        keys.forEach(type => {
            stations[index].prices[type] = -1;
        });
        stations[index].lat = value.location.latitude;
        stations[index].lng = value.location.longitude;
        stations[index].distance = value.location.distance;
        /* eslint-enable no-param-reassign */
    });
}

/**
 * @function mapPriceToStation
 * @description Helper function to map prices to gas stations.
 *
 * @param {Object} entities - Entities.
 * @param {Object[]} entities.stations - Gas Stations.
 * @param {Object[]} entities.prices - Fuel Prices.
 *
 * @returns {Object[]} Gas Stations.
 *
 * @see apis/README.md
 */
function mapPriceToStation({ stations, prices }) {
    for (const station of stations) {
        for (const price of prices) {
            if (station.code === price.stationcode) {
                station.price = price.price;
                break;
            }
        }
    }

    return stations;
}

/**
 * @module apis/nsw
 * @description Queries data from https://api.nsw.gov.au
 * @async
 *
 * @requires external:node-fetch
 * @requires external:moment
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
module.exports = async options => {
    config = options;

    await refreshToken(config);
    setInterval(() => refreshToken(config), QUARTER_DAY);

    return { getData };
};
