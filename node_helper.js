/**
 * @file node_helper.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/**
 * @external node_helper
 * @see https://github.com/MichMich/MagicMirror/blob/master/modules/node_modules/node_helper/index.js
 */
const NodeHelper = require('node_helper');

/**
 * @external logger
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */
const Log = require('logger');

/**
 * @external fs
 * @see https://nodejs.org/api/fs.html
 */
const fs = require('fs/promises');

/**
 * @external path
 * @see https://nodejs.org/api/path.html
 */
const path = require('path');

/**
 * @module node_helper
 * @description Backend for the module to query data from the API providers.
 *
 * @requires external:fs
 * @requires external:path
 * @requires external:node_helper
 * @requires external:logger
 */
module.exports = NodeHelper.create({
    /** @member {string} requiresVersion - Specifies minimum required version of MagicMirror². */
    requiresVersion: '2.15.0',

    /**
     * @function providerExists
     * @description Checks if the provider exists.
     * @async
     *
     * @param {string} providerName - Name of the provider
     *
     * @returns {boolean} Does provider exist?
     */
    async providerExists(providerName) {
        try {
            await fs.access(path.join(__dirname, 'apis', `${providerName}.js`));
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * @function socketNotificationReceived
     * @description Receives socket notifications from the module.
     * @async
     * @override
     *
     * @param {string} notification - Notification name
     * @param {*} payload - Detailed payload of the notification.
     *
     * @returns {void}
     */
    async socketNotificationReceived(notification, payload) {
        if (notification === 'CONFIG') {
            this.config = payload;

            const providerExists = await this.providerExists(this.config.provider);

            if (providerExists) {
                // eslint-disable-next-line global-require, import/no-dynamic-require
                this.provider = await require(`./apis/${this.config.provider}`)(this.config);
                this.getData();
                setInterval(() => {
                    this.getData();
                }, this.config.updateInterval);
            } else {
                Log.error(`${this.name}: Couldn't load provider ${this.config.provider}`);
            }
        }
    },

    /**
     * @function getData
     * @description Uses API provider to get data.
     * @async
     *
     * @returns {void}
     */
    async getData() {
        try {
            const data = await this.provider.getData();
            this.sendSocketNotification('PRICELIST', data);
        } catch (e) {
            Log.error(`${this.name}: Failed to retrieve prices`, e);
        }
    }
});
