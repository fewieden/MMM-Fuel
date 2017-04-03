/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

/* eslint-env node */

const NodeHelper = require('node_helper');
const fs = require('fs');

module.exports = NodeHelper.create({

    start() {
        console.log(`Starting module helper: ${this.name}`);
    },

    socketNotificationReceived(notification, payload) {
        if (notification === 'CONFIG') {
            this.config = payload;
            if (fs.existsSync(`modules/${this.name}/apis/${this.config.provider}.js`)) {
                // eslint-disable-next-line global-require, import/no-dynamic-require
                this.provider = require(`./apis/${this.config.provider}`)(this.config);
                this.getData();
                setInterval(() => {
                    this.getData();
                }, this.config.updateInterval);
            } else {
                console.log(`${this.name}: Couldn't load provider ${this.config.provider}`);
            }
        }
    },

    getData() {
        this.provider.getData((err, data) => {
            if (err) {
                console.log(err);
            } else {
                this.sendSocketNotification('PRICELIST', data);
            }
        });
    }
});
