/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

/* eslint-env node */

const request = require('request');

const baseUrl = 'http://www.spritpreisrechner.at/espritmap-app/GasStationServlet';

const earthRadius = 6371e3;

const types = {
    diesel: 'DIE',
    e5: 'SUP',
    gas: 'GAS'
};

module.exports = (config) => {
    const deg2rad = degree => degree * (Math.PI / 180);

    const rad2deg = rad => rad * (180 / Math.PI);

    const calculateCoordinate = (degree) => {
        const radius = config.radius * 1000;
        const distance = Math.sqrt(2 * (radius * radius));

        const δ = Number(distance) / earthRadius;
        const θ = deg2rad(Number(degree));

        const φ1 = deg2rad(config.lat);
        const λ1 = deg2rad(config.lng);

        const sinφ1 = Math.sin(φ1);
        const cosφ1 = Math.cos(φ1);
        const sinδ = Math.sin(δ);
        const cosδ = Math.cos(δ);
        const sinθ = Math.sin(θ);
        const cosθ = Math.cos(θ);

        const sinφ2 = (sinφ1 * cosδ) + (cosφ1 * sinδ * cosθ);
        const φ2 = Math.asin(sinφ2);
        const y = sinθ * sinδ * cosφ1;
        const x = cosδ - (sinφ1 * sinφ2);
        const λ2 = λ1 + Math.atan2(y, x);

        return { lat: rad2deg(φ2), lng: ((rad2deg(λ2) + 540) % 360) - 180 };
    };

    const topLeft = calculateCoordinate(315);
    const bottomRight = calculateCoordinate(135);

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

    return {
        getData(callback) {
            Promise
                .all(config.types.map(requestFuelType))
                .then((responses) => {
                    const collection = {};
                    responses.forEach((element) => { collection[element.type] = element.data; });

                    const stations = collection[config.sortBy];
                    delete collection[config.sortBy];

                    stations.forEach((value, index) => {
                        stations[index].name = value.gasStationName;
                        stations[index].prices = { [config.sortBy]: reducePrice(value.spritPrice) };
                        stations[index].isOpen = value.open;
                        stations[index].address = `${value.postalCode} ${value.city} - ${value.address}`;
                        stations[index].lat = parseFloat(value.latitude);
                        stations[index].lng = parseFloat(value.longitude);
                    });

                    const keys = Object.keys(collection);
                    keys.forEach((key) => {
                        collection[key].forEach((station) => {
                            for (let i = 0; i < stations.length; i += 1) {
                                if (compareStations(station, stations[i])) {
                                    stations[i].prices[key] = reducePrice(station.spritPrice);
                                    break;
                                }
                            }
                        });
                    });

                    const distance = stations.slice(0);
                    distance.sort((a, b) => a.distance - b.distance);

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
