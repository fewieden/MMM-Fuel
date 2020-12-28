/**
 * @file MMM-Fuel.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/* global google */

/**
 * @external Module
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/module.js
 */

/**
 * @external Log
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */

/**
 * @external google
 * @see https://maps.googleapis.com/maps/api/js
 */

/**
 * @module MMM-Fuel
 * @description Frontend for the module to display data.
 *
 * @requires external:Module
 * @requires external:Log
 * @requires external:google
 */
Module.register('MMM-Fuel', {
    /** @member {Object} units - Is used to determine the unit symbol of the global config option units. */
    units: {
        imperial: 'ml',
        metric: 'km'
    },

    /** @member {Object} currencies - Is used to convert currencies into symbols. */
    currencies: {
        AUD: '$',
        EUR: '€'
    },

    /** @member {boolean} sortByPrice - Flag to switch between sorting (price and distance). */
    sortByPrice: true,
    /** @member {?Interval} interval - Toggles sortByPrice */
    interval: null,

    /**
     * @member {Object} defaults - Defines the default config values.
     * @property {int} radius - Lookup area for gas stations.
     * @property {int} max - Amount of gas stations to display.
     * @property {boolean|string} map_api_key - API key for Google Maps.
     * @property {int} zoom - Zoom level of the map.
     * @property {int} width - Width of the map.
     * @property {int} height - Height of the map.
     * @property {boolean} colored - Flag to render map in colour or greyscale.
     * @property {boolean} open - Flag to render column to indicate if the gas stations are open or closed.
     * @property {boolean|int} shortenText - Max characters to be shown for name and address.
     * @property {boolean} showAddress - Flag to show the gas stations address.
     * @property {boolean} showOpenOnly - Flag to show only open gas stations or all.
     * @property {boolean} showDistance - Flag to show the distance to your specified position.
     * @property {boolean} iconHeader - Flag to display the car icon in the header.
     * @property {boolean} rotate - Flag to enable/disable rotation between sort by price and distance.
     * @property {string[]} types - Fuel types to show.
     * @property {string} sortBy - Type to sort by price.
     * @property {int} rotateInterval - Speed of rotation.
     * @property {int} updateInterval - Speed of update.
     * @property {string} provider - API provider of the data.
     * @property {boolean} toFixed - Flag to show price with only 2 decimals.
     */
    defaults: {
        radius: 5,
        max: 5,
        map_api_key: false,
        zoom: 12,
        width: 600,
        height: 600,
        colored: false,
        open: false,
        shortenText: false,
        showAddress: true,
        showOpenOnly: false,
	    showDistance: true,
        iconHeader: true,
        rotate: true,
        types: ['diesel'],
        sortBy: 'diesel',
        rotateInterval: 60 * 1000, // every minute
        updateInterval: 15 * 60 * 1000, // every 15 minutes
        provider: 'tankerkoenig',
        toFixed: false
    },

    /**
     * @member {Object} voice - Defines the voice recognition part.
     * @property {string} mode - MMM-voice mode of this module.
     * @property {string[]} sentences - All commands of this module.
     */
    voice: {
        mode: 'FUEL',
        sentences: [
            'OPEN HELP',
            'CLOSE HELP',
            'SHOW GAS STATIONS',
            'HIDE MAP'
        ]
    },

    /**
     * @function getTranslations
     * @description Translations for this module.
     * @override
     *
     * @returns {Object.<string, string>} Available translations for this module (key: language code, value: filepath).
     */
    getTranslations() {
        return {
            en: 'translations/en.json',
            de: 'translations/de.json',
            fr: 'translations/fr.json'
        };
    },

    /**
     * @function getStyles
     * @description Style dependencies for this module.
     * @override
     *
     * @returns {string[]} List of the style dependency filepaths.
     */
    getStyles() {
        return ['font-awesome.css', 'MMM-Fuel.css'];
    },

    /**
     * @function getTemplate
     * @description Nunjuck template.
     * @override
     *
     * @returns {string} Path to nunjuck template.
     */
    getTemplate() {
        return 'templates/MMM-Fuel.njk';
    },

    /**
     * @function getTemplateData
     * @description Data that gets rendered in the nunjuck template.
     * @override
     *
     * @returns {Object} Data for the nunjuck template.
     */
    getTemplateData() {
        let gasStations;

        if (this.priceList) {
            gasStations = this.sortByPrice ? this.priceList.byPrice : this.priceList.byDistance;
            gasStations = gasStations.slice(0, Math.min(gasStations.length, this.config.max));
        }

        return {
            config: this.config,
            priceList: this.priceList,
            sortByPrice: this.sortByPrice,
            gasStations
        };
    },

    /**
     * @function start
     * @description Appends Google Map script to the body, if the config option map_api_key is defined. Calls
     * createInterval and sends the config to the node_helper.
     * @override
     *
     * @returns {void}
     */
    start() {
        Log.info(`Starting module: ${this.name}`);

        if (!this.config.types.includes(this.config.sortBy)) {
            Log.error('Config option sortBy has no matching value in config option types! Falling back to first entry.');
            this.config.sortBy = this.config.types[0];
        }

        this.addGlobals();
        this.addFilters();
        // Add script manually, getScripts doesn't work for it!
        if (this.config.map_api_key) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.map_api_key}`;
            document.querySelector('body').appendChild(script);
        }
        this.interval = this.createInterval();
        this.sendSocketNotification('CONFIG', this.config);
    },

    /**
     * @function createInterval
     * @description Creates an interval if config option rotate is set.
     *
     * @returns {?Interval} The Interval toggles sortByPrice between true and false.
     */
    createInterval() {
        if (!this.config.rotate) {
            return null;
        }
        return setInterval(() => {
            this.sortByPrice = !this.sortByPrice;
            this.updateDom(300);
        }, this.config.rotateInterval);
    },

    /**
     * @function notificationReceived
     * @description Handles incoming broadcasts from other modules or the MagicMirror core.
     * @override
     *
     * @param {string} notification - Notification name
     * @param {*} payload - Detailed payload of the notification.
     * @param {MM} [sender] - The sender of the notification. If sender is undefined the sender is the core.
     */
    notificationReceived(notification, payload, sender) {
        if (notification === 'ALL_MODULES_STARTED') {
            this.sendNotification('REGISTER_VOICE_MODULE', this.voice);
        } else if (notification === 'VOICE_FUEL' && sender.name === 'MMM-voice') {
            this.checkCommands(payload);
        } else if (notification === 'VOICE_MODE_CHANGED' && sender.name === 'MMM-voice' && payload.old === this.voice.mode) {
            this.sendNotification('CLOSE_MODAL');
        } else if (notification === 'MODAL_CLOSED' && payload.identifier === this.identifier) {
            this.deinitMap();
        }
    },

    /**
     * @function socketNotificationReceived
     * @description Handles incoming messages from node_helper.
     * @override
     *
     * @param {string} notification - Notification name
     * @param {*} payload - Detailed payload of the notification.
     */
    socketNotificationReceived(notification, payload) {
        if (notification === 'PRICELIST') {
            this.priceList = payload;
            this.updateDom(300);
        }
    },

    /**
     * @function shortenText
     * @description Shortens text based on config option (shortenText) and adds ellipsis at the end.
     *
     * @param {string} text - Text which should be shorten.
     *
     * @returns {string} The shortened text.
     */
    shortenText(text) {
        let temp = text;
        if (this.config.shortenText && temp.length > this.config.shortenText) {
            temp = `${temp.slice(0, this.config.shortenText)}&#8230;`;
        }
        return temp;
    },

    /**
     * @function checkCommands
     * @description Checks for voice commands.
     *
     * @param {string} data - Text with commands.
     *
     * @returns {void}
     */
    checkCommands(data) {
        if (/(HELP)/g.test(data)) {
            if (/(CLOSE)/g.test(data) && !/(OPEN)/g.test(data)) {
                this.sendNotification('CLOSE_MODAL');
            } else if (/(OPEN)/g.test(data) && !/(CLOSE)/g.test(data)) {
                this.sendNotification('OPEN_MODAL', {
                    template: 'templates/HelpModal.njk',
                    data: {
                        ...this.voice,
                        fns: {
                            translate: this.translate.bind(this)
                        }
                    }
                });
            }
        } else if (/(HIDE)/g.test(data) && /(MAP)/g.test(data)) {
            this.sendNotification('CLOSE_MODAL');
        } else if (/(GAS)/g.test(data) && /(STATIONS)/g.test(data)) {
            this.sendNotification('OPEN_MODAL', {
                template: 'templates/MapModal.njk',
                data: {
                    config: this.config,
                    fns: {
                        translate: this.translate.bind(this)
                    }
                },
                options: {
                    callback: this.initMap.bind(this)
                }
            });
        }
    },

    /**
     * @function initMap
     * @description Initializes the map, markers and layers.
     *
     * @param {boolean} success - Only initialize the map if success is truthy.
     *
     * @returns {void}
     */
    initMap(success) {
        if (!success || this.map) {
            return;
        }

        const mapContainer = document.querySelector('div.MMM-Fuel-map');

        if (!mapContainer) {
            return;
        }

        const center = new google.maps.LatLng(this.config.lat, this.config.lng);
        const zoom = this.config.zoom;
        this.map = new google.maps.Map(mapContainer, { center, zoom, disableDefaultUI: true });

        this.trafficLayer = new google.maps.TrafficLayer();
        this.trafficLayer.setMap(this.map);

        const list = this.priceList.byPrice;
        this.markers = [];

        for (let i = 0; i < list.length; i += 1) {
            this.markers.push(new google.maps.Marker({
                position: { lat: list[i].lat, lng: list[i].lng },
                label: i + 1 + '',
                map: this.map
            }));
        }
    },

    /**
     * @function deinitMap
     * @description Deinitializes the map, markers and layers.
     *
     * @returns {void}
     */
    deinitMap() {
        if (!this.map) {
            return;
        }

        this.trafficLayer.setMap(null);
        this.trafficLayer = null;

        for (let i = 0; i < this.markers.length; i += 1) {
            this.markers[i].setMap(null);
        }

        this.markers = [];

        this.map = null;
    },

    /**
     * @function capitalizeFirstLetter
     * @description Capitalizes the first character in a string.
     *
     * @param {string} text - text to capitalize the first letter.
     *
     * @returns {string} Capitalized string.
     */
    capitalizeFirstLetter(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    },

    /**
     * @function addGlobals
     * @description Adds custom globals used by the nunjuck template.
     *
     * @returns {void}
     */
    addGlobals() {
        this.nunjucksEnvironment().addGlobal('includes', (array, item) => array.includes(item));
    },

    /**
     * @function addFilters
     * @description Adds custom filters used by the nunjuck template.
     *
     * @returns {void}
     */
    addFilters() {
        this.nunjucksEnvironment().addFilter('capitalizeFirstLetter', text => this.capitalizeFirstLetter(text));
        this.nunjucksEnvironment().addFilter('shortenText', text => this.shortenText(text));
        this.nunjucksEnvironment().addFilter('formatPrice', price => {
            if (price === -1) {
                return '-';
            }

            return `${this.config.toFixed ? price.toFixed(2) : price} ${this.currencies[this.priceList.currency]}`;
        });
    }
});
