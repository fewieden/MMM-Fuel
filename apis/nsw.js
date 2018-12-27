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

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const QUARTER_DAY = 6 * HOUR;

/**
 * @module apis/nsw
 * @description Queries data from https://api.nsw.gov.au
 * @async
 *
 * @requires external:node-fetch
 * @requires external:moment
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
 */
module.exports = async config => {
    /** @member {string} baseUrl - API url */
    const baseUrl = 'https://api.onegov.nsw.gov.au';

    /** @member {number} transaction - unique transaction id */
    let transaction = 1;

    /** @member {Object} types - Mapping of fuel types to API fuel types. */
    const types = {
        diesel: 'DL',
        e5: 'P95'
    };

    /** @member {string|undefined} token - authorization token */
    let token;

    async function refreshToken() {
        try {
            const response = await fetch(`${baseUrl}/oauth/client_credential/accesstoken?grant_type=client_credentials`, {
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

    await refreshToken();
    setInterval(refreshToken, QUARTER_DAY);

    /**
     * @function requestFuelType
     * @description API request for specified type.
     * @async
     *
     * @param {string} type - Fuel type.
     * @returns {Promise} Object with fuel type and data.
     */
    const requestFuelType = async type => {
        const response = await fetch(`${baseUrl}/FuelPriceCheck/v1/fuel/prices/nearby`, {
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
                fueltype: types[type],
                latitude: config.lat,
                longitude: config.lng,
                radius: config.radius,
                sortby: 'price',
                sortascending: true
            })
        });
        return {
            type,
            data: await response.json()
        };
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
        const prices = Object.keys(station.prices);
        return !prices.every(type => station.prices[type] === -1);
    };

    /**
     * @function sortByDistance
     * @description Helper function to sort gas stations by distance.
     *
     * @param {Object} a - Gas Station
     * @param {Object} b - Gas Station
     *
     * @returns {number} Sorting weight.
     */
    const sortByDistance = (a, b) => a.distance - b.distance;

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
    const normalizeStations = (stations, keys) => {
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
    };

    const mapPriceToStation = ({ stations, prices }) => {
        for (const station of stations) {
            for (const price of prices) {
                if (station.code === price.stationcode) {
                    station.price = price.price;
                    break;
                }
            }
        }

        return stations;
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
    };
};
