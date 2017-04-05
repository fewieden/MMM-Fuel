/**
 * @file apis/spritpreisrechner.js
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
 * @module apis/spritpreisrechner
 * @description Queries data from spritpreisrechner.at
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
 */
module.exports = (config) => {
    /** @member {string} baseUrl - API url */
    const baseUrl = 'http://www.spritpreisrechner.at/espritmap-app/GasStationServlet';

    /** @member {Object} types - Mapping of fuel types to API fuel types. */
    const types = {
        diesel: 'DIE',
        e5: 'SUP',
        gas: 'GAS'
    };

    /** @member {Object} topLeft - Top left corner of lookup area. */
    const topLeft = Coordinate.from(config.lat, config.lng).to(315, config.radius);
    /** @member {Object} bottomRight - Bottom right corner of lookup area. */
    const bottomRight = Coordinate.to(135, config.radius);

    /**
     * @function generateOptions
     * @description Helper function to generate API request options.
     *
     * @param {string} type - Fuel type
     * @returns {Object} Options
     */
    const generateOptions = type => ({
        url: baseUrl,
        method: 'POST',
        form: `data=${
            encodeURI(
                JSON.stringify(
                    [
                        config.showOpenOnly ? '' : 'checked',
                        types[type],
                        topLeft.lng,
                        topLeft.lat,
                        bottomRight.lng,
                        bottomRight.lat
                    ]
                )
            )
        }`
    });

    /**
     * @function requestFuelType
     * @description API request for specified type.
     *
     * @param {string} type - Fuel type.
     * @returns {Promise} Data or error message.
     */
    const requestFuelType = type => new Promise((resolve, reject) => {
        request(generateOptions(type), (error, response, body) => {
            if (response.statusCode === 200) {
                resolve({ type, data: JSON.parse(body) });
            }
            reject(`Error getting fuel data ${response.statusCode}`);
        });
    });

    /**
     * @function compareStations
     * @description Helper function to compare gas stations.
     *
     * @param {Object} a - Gas Station
     * @param {Object} b - Gas Station
     * @returns {boolean}
     */
    const compareStations = (a, b) => a.city === b.city &&
        a.postalCode === b.postalCode &&
        a.gasStationName === b.gasStationName &&
        a.latitude === b.latitude &&
        a.longitude === b.longitude;

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
        const newAmount = parseFloat(price.amount);
        return current < newAmount ? newAmount : current;
    }, -1);

    /**
     * @function filterStations
     * @description Helper function to filter gas stations.
     *
     * @param {Object} station - Gas Station
     * @returns {boolean}
     */
    const filterStations = (station) => {
        const prices = Object.keys(station.prices);
        return !prices.every(type => station.prices[type] === -1);
    };

    /**
     * @function sortByDistance
     * @description Helper function to sort gas stations by distance.
     *
     * @param {Object} a - Gas Station
     * @param {Object} b - Gas Station
     * @returns {number}
     */
    const sortByDistance = (a, b) => a.distance - b.distance;

    /**
     * @function normalizeStations
     * @description Helper function to normalize the structure of gas stations for the UI.
     *
     * @param {Object[]} stations - Gas Station.
     * @param {string[]} keys - Fuel types except config option sortBy.
     *
     * @see apis/README.md
     */
    const normalizeStations = (stations, keys) => {
        stations.forEach((value, index) => {
            /* eslint-disable no-param-reassign */
            stations[index].name = value.gasStationName;
            stations[index].prices = { [config.sortBy]: reducePrice(value.spritPrice) };
            keys.forEach((type) => { stations[index].prices[type] = -1; });
            stations[index].isOpen = value.open;
            stations[index].address = `${value.postalCode} ${value.city} - ${value.address}`;
            stations[index].lat = parseFloat(value.latitude);
            stations[index].lng = parseFloat(value.longitude);
            /* eslint-enable no-param-reassign */
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
            Promise
                .all(config.types.map(requestFuelType))
                .then((responses) => {
                    const collection = {};
                    responses.forEach((element) => { collection[element.type] = element.data; });

                    let stations = collection[config.sortBy];
                    delete collection[config.sortBy];
                    const keys = Object.keys(collection);

                    normalizeStations(stations, keys);

                    keys.forEach((type) => {
                        collection[type].forEach((station) => {
                            for (let i = 0; i < stations.length; i += 1) {
                                if (compareStations(station, stations[i])) {
                                    stations[i].prices[type] = reducePrice(station.spritPrice);
                                    break;
                                }
                            }
                        });
                    });

                    stations = stations.filter(filterStations);

                    const distance = stations.slice(0);
                    distance.sort(sortByDistance);

                    callback(null, {
                        types: ['diesel', 'e5', 'gas'],
                        unit: 'km',
                        currency: 'EUR',
                        byPrice: stations,
                        byDistance: distance
                    });
                });
        }
    };
};
