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

/**
 * @module apis/spritpreisrechner
 * @description Queries data from spritpreisrechner.at
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
 */
module.exports = config => {
    /** @member {string} baseUrl - API url */
    const baseUrl = 'https://api.e-control.at/sprit/1.0';

    /** @member {Object} types - Mapping of fuel types to API fuel types. */
    const types = {
        diesel: 'DIE',
        e5: 'SUP',
        gas: 'GAS'
    };

    /**
     * @function generateUrl
     * @description Helper function to generate API request url.
     *
     * @param {string} type - Fuel type
     * @returns {string} url
     */

    const generateUrl = type => `${baseUrl}/search/gas-stations/by-address?latitude=${config.lat}&longitude=${
        config.lng}&fuelType=${types[type]}&includeClosed=${!config.showOpenOnly}`;

    /**
     * @function requestFuelType
     * @description API request for specified type.
     * @async
     *
     * @param {string} type - Fuel type.
     * @returns {Promise} Object with fuel type and data.
     */
    const requestFuelType = async type => {
        const response = await fetch(generateUrl(type));
        return {
            type,
            data: await response.json()
        };
    };

    /**
     * @function compareStations
     * @description Helper function to compare gas stations.
     *
     * @param {Object} a - Gas Station
     * @param {Object} b - Gas Station
     *
     * @returns {boolean} Flag if the gas stations are equal.
     */
    const compareStations = (a, b) => a.location.city === b.location.city
        && a.location.postalCode === b.location.postalCode
        && a.name === b.name
        && a.location.latitude === b.location.latitude
        && a.location.longitude === b.location.longitude;

    /**
     * @function reducePrice
     * @description Reduces array of prices to single price.
     *
     * @param {Object[]} prices - All prices.
     * @returns {number} Highest price or -1 if there is no price.
     */
    const reducePrice = prices => prices.reduce((current, price) => {
        if (!Object.prototype.hasOwnProperty.call(price, 'amount') || price.amount === '') {
            return current;
        }
        return current < price.amount ? price.amount : current;
    }, -1);

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
            stations[index].name = value.name;
            stations[index].prices = { [config.sortBy]: reducePrice(value.prices) };
            keys.forEach(type => {
                stations[index].prices[type] = -1;
            });
            stations[index].isOpen = value.open;
            stations[index].address = `${value.location.postalCode} ${value.location.city} - ${value.location.address}`;
            stations[index].lat = parseFloat(value.location.latitude);
            stations[index].lng = parseFloat(value.location.longitude);
            /* eslint-enable no-param-reassign */
        });
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
                        station.prices[type] = `>${maxPrices[types[type]]}`;
                    }
                }
            }

            stations = stations.filter(filterStations);

            const distance = stations.slice(0);
            distance.sort(sortByDistance);

            return {
                types: ['diesel', 'e5', 'gas'],
                unit: 'km',
                currency: 'EUR',
                byPrice: stations,
                byDistance: distance
            };
        }
    };
};
