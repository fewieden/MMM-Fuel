/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

/* eslint-env node */
/* eslint-disable no-console */

const request = require('request');
const NodeHelper = require('node_helper');

module.exports = NodeHelper.create({

    baseUrl: 'https://creativecommons.tankerkoenig.de/json/list.php',

    start() {
        console.log(`Starting module: ${this.name}`);
    },

    socketNotificationReceived(notification, payload) {
        if (notification === 'CONFIG') {
            this.config = payload;
            this.getData();
            setInterval(() => {
                this.getData();
            }, this.config.updateInterval);
        }
    },

    getData() {
        const options = {
            url: `${this.baseUrl}?lat=${this.config.lat}&lng=${this.config.lng}&rad=${this.config.radius
                }&type=all&apikey=${this.config.api_key}&sort=dist`
        };
        request(options, (error, response, body) => {
            if (response.statusCode === 200) {
                const parsedBody = JSON.parse(body);
                if (parsedBody.ok) {
                    for (let i = parsedBody.stations.length - 1; i >= 0; i -= 1) {
                        let removeFlag = false;
                        for (let n = 0; n < this.config.types.length; n += 1) {
                            if (parsedBody.stations[i][this.config.types[n]] <= 0 ||
                                (this.config.showOpenOnly && !parsedBody.stations[i].isOpen)) {
                                removeFlag = true;
                                break;
                            }
                        }
                        if (removeFlag) {
                            parsedBody.stations.splice(i, 1);
                        }
                    }
                    const price = parsedBody.stations.slice(0);
                    price.sort((a, b) => {
                        if (b[this.config.sortBy] === 0) {
                            return Number.MIN_SAFE_INTEGER;
                        } else if (a[this.config.sortBy] === 0) {
                            return Number.MAX_SAFE_INTEGER;
                        }
                        return a[this.config.sortBy] - b[this.config.sortBy];
                    });
                    this.sendSocketNotification('PRICELIST', { byPrice: price, byDistance: parsedBody.stations });
                } else {
                    console.log('Error no fuel data');
                }
            } else {
                console.log(`Error getting fuel data ${response.statusCode}`);
            }
        });
    }
});
