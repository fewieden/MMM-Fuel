/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

/* eslint-env node */

const request = require('request');

module.exports = (config) => {
    const baseUrl = 'https://creativecommons.tankerkoenig.de/json/list.php';

    const options = {
        url: `${baseUrl}?lat=${config.lat}&lng=${config.lng}&rad=${config.radius}&type=all&apikey=${
            config.api_key}&sort=dist`
    };

    const sortByPrice = (a, b) => {
        if (b[config.sortBy] === 0) {
            return Number.MIN_SAFE_INTEGER;
        } else if (a[config.sortBy] === 0) {
            return Number.MAX_SAFE_INTEGER;
        }
        return a[config.sortBy] - b[config.sortBy];
    };

    const filterStations = (element) => {
        for (let i = 0; i < config.types.length; i += 1) {
            if (element[config.types[i]] <= 0 || (config.showOpenOnly && !element.isOpen)) {
                return false;
            }
        }
        return true;
    };

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

    return {
        getData(callback) {
            request(options, (error, response, body) => {
                if (response.statusCode === 200) {
                    const parsedBody = JSON.parse(body);
                    if (parsedBody.ok) {
                        const stations = parsedBody.stations.filter(filterStations);

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
                    } else {
                        callback('Error no fuel data');
                    }
                } else {
                    callback(`Error getting fuel data ${response.statusCode}`);
                }
            });
        }
    };
};
