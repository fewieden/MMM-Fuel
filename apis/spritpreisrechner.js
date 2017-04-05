/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

/* eslint-env node */

const request = require('request');
const Coordinate = require('./utils/Coordinate.js');

module.exports = (config) => {
    const baseUrl = 'http://www.spritpreisrechner.at/espritmap-app/GasStationServlet';

    const types = {
        diesel: 'DIE',
        e5: 'SUP',
        gas: 'GAS'
    };

    const topLeft = Coordinate.from(config.lat, config.lng).to(315, config.radius);
    const bottomRight = Coordinate.to(135, config.radius);

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

    const requestFuelType = type => new Promise((resolve, reject) => {
        request(generateOptions(type), (error, response, body) => {
            if (response.statusCode === 200) {
                resolve({ type, data: JSON.parse(body) });
            }
            reject(`Error getting fuel data ${response.statusCode}`);
        });
    });

    const compareStations = (a, b) => a.city === b.city &&
        a.postalCode === b.postalCode &&
        a.gasStationName === b.gasStationName &&
        a.latitude === b.latitude &&
        a.longitude === b.longitude;

    const reducePrice = array => array.reduce((current, price) => {
        if (!Object.prototype.hasOwnProperty.call(price, 'amount') || price.amount === '') {
            return current;
        }
        const newAmount = parseFloat(price.amount);
        return current < newAmount ? newAmount : current;
    }, -1);

    const filterStations = (station) => {
        const prices = Object.keys(station.prices);
        return !prices.every(type => station.prices[type] === -1);
    };

    const sortByDistance = (a, b) => a.distance - b.distance;

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
