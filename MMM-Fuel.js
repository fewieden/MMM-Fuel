/**
 * @file MMM-Fuel.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-Fuel
 */

/* global Module Log config google */

/**
 * @external Module
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/module.js
 */

/**
 * @external Log
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */

/**
 * @module MMM-Fuel
 * @description Frontend for the module to display data.
 *
 * @requires external:Module
 * @requires external:Log
 */
Module.register('MMM-Fuel', {

    /** @member {Object} units - Is used to determine the unit symbol of the global config option units. */
    units: {
        imperial: 'ml',
        metric: 'km'
    },

    /** @member {Object} currencies - Is used to convert currencies into symbols. */
    currencies: {
        EUR: '€'
    },

    /** @member {boolean} sortByPrice - Flag to switch between sorting (price and distance). */
    sortByPrice: true,
    /** @member {boolean} help - Flag to switch between render help or not. */
    help: false,
    /** @member {boolean} map - Flag to switch between render map or not. */
    map: false,
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
     * @property {boolean} iconHeader - Flag to display the car icon in the header.
     * @property {boolean} rotate - Flag to enable/disable rotation between sort by price and distance.
     * @property {string[]} types - Fuel types to show.
     * @property {string} sortBy - Type to sort by price.
     * @property {int} rotateInterval - Speed of rotation.
     * @property {int} updateInterval - Speed of update.
     * @property {string} provider - API provider of the data.
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
        iconHeader: true,
        rotate: true,
        types: ['diesel'],
        sortBy: 'diesel',
        rotateInterval: 60 * 1000, // every minute
        updateInterval: 15 * 60 * 1000, // every 15 minutes
        provider: 'tankerkoenig'
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
     *
     * @returns {Object.<string, string>} Available translations for this module (key: language code, value: filepath).
     */
    getTranslations() {
        return {
            en: 'translations/en.json',
            de: 'translations/de.json'
        };
    },

    /**
     * @function getStyles
     * @description Style dependencies for this module.
     *
     * @returns {string[]} List of the style dependency filepaths.
     */
    getStyles() {
        return ['font-awesome.css', 'MMM-Fuel.css'];
    },

    /**
     * @function start
     * @description Appends Google Map script to the body, if the config option map_api_key is defined. Calls
     * createInterval and sends the config to the node_helper.
     * @override
     */
    start() {
        Log.info(`Starting module: ${this.name}`);
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
            this.help = false;
            this.map = false;
            this.updateDom(300);
        }
    },

    /**
     * @function socketNotificationReceived
     * @description Handles incoming messages from node_helper.
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
     * @function getDom
     * @description Creates the UI as DOM for displaying in MagicMirror application.
     * @override
     *
     * @returns {Element}
     */
    getDom() {
        const wrapper = document.createElement('div');
        const list = document.createElement('div');
        const header = document.createElement('header');
        header.classList.add('align-left');
        if (this.config.iconHeader) {
            const logo = document.createElement('i');
            logo.classList.add('fa', 'fa-car', 'logo');
            header.appendChild(logo);
        }
        const name = document.createElement('span');
        name.innerHTML = this.translate('FUEL_PRICES');
        header.appendChild(name);
        list.appendChild(header);

        if (!this.priceList) {
            const text = document.createElement('div');
            text.innerHTML = this.translate('LOADING');
            text.classList.add('dimmed', 'light');
            list.appendChild(text);
        } else {
            const table = document.createElement('table');
            table.classList.add('small', 'table', 'align-left');

            table.appendChild(this.createLabelRow());

            const data = this.sortByPrice ? this.priceList.byPrice : this.priceList.byDistance;

            for (let i = 0; i < Math.min(data.length, this.config.max); i += 1) {
                this.appendDataRow(data[i], table);
            }

            list.appendChild(table);

            const modules = document.querySelectorAll('.module');
            for (let i = 0; i < modules.length; i += 1) {
                if (!modules[i].classList.contains('MMM-Fuel')) {
                    if (this.map || this.help) {
                        modules[i].classList.add('MMM-Fuel-blur');
                    } else {
                        modules[i].classList.remove('MMM-Fuel-blur');
                    }
                }
            }

            if (this.map || this.help) {
                list.classList.add('MMM-Fuel-blur');
                const modal = document.createElement('div');
                modal.classList.add('modal');
                if (this.map && this.config.map_api_key) {
                    if (typeof google === 'object' && typeof google.maps === 'object') {
                        if (!this.config.colored) {
                            modal.classList.add('no-color');
                        }
                        const map = document.createElement('div');
                        map.classList.add('MMM-Fuel-map');
                        map.style.height = `${this.config.height}px`;
                        map.style.width = `${this.config.width}px`;
                        modal.appendChild(map);
                        const script = document.createElement('script');
                        script.innerHTML = `var MMM_Fuel_map = \
                            new google.maps.Map(document.querySelector('div.MMM-Fuel-map'), \
                            {center: new google.maps.LatLng(${this.config.lat}, \
                            ${this.config.lng}), zoom: ${this.config.zoom}, disableDefaultUI:true});
                            var trafficLayer = new google.maps.TrafficLayer();
                            trafficLayer.setMap(MMM_Fuel_map);
                            var MMM_Fuel_array = ${JSON.stringify(this.priceList.byPrice)};
                            for(let i = 0; i < MMM_Fuel_array.length; i += 1){
                            var marker = new google.maps.Marker({ position: {lat: MMM_Fuel_array[i].lat, \
                            lng: MMM_Fuel_array[i].lng}, label: i + 1 + '', map: MMM_Fuel_map});
                            }`;
                        modal.appendChild(script);
                    } else {
                        modal.innerHTML = this.translate('MAP_API_NOT_READY');
                    }
                } else if (this.map) {
                    modal.innerHTML = this.translate('API_KEY_NEEDED');
                } else {
                    this.appendHelp(modal);
                }
                wrapper.appendChild(modal);
            }
        }

        wrapper.appendChild(list);

        return wrapper;
    },

    /**
     * @function createLabelRow
     * @description Creates label row for price table.
     *
     * @returns {Element}
     */
    createLabelRow() {
        const labelRow = document.createElement('tr');

        const sortLabel = document.createElement('th');
        if (this.sortByPrice) {
            sortLabel.innerHTML = this.translate('CHEAPEST_STATIONS');
        } else {
            sortLabel.innerHTML = this.translate('CLOSEST_STATIONS');
        }
        labelRow.appendChild(sortLabel);

        for (let i = 0; i < this.config.types.length; i += 1) {
            if (this.priceList.types.includes(this.config.types[i])) {
                const typeLabel = document.createElement('th');
                typeLabel.classList.add('centered');

                const typeSpan = document.createElement('span');
                typeSpan.innerHTML = this.capitalizeFirstLetter(this.config.types[i]);
                typeLabel.appendChild(typeSpan);

                if (this.sortByPrice && this.config.sortBy === this.config.types[i]) {
                    typeLabel.appendChild(this.createSortIcon());
                }

                labelRow.appendChild(typeLabel);
            }
        }

        const distanceIconLabel = document.createElement('th');
        distanceIconLabel.classList.add('centered');

        const distanceIcon = document.createElement('i');
        distanceIcon.classList.add('fa', 'fa-map-o');
        distanceIconLabel.appendChild(distanceIcon);

        if (!this.sortByPrice) {
            distanceIconLabel.appendChild(this.createSortIcon());
        }

        labelRow.appendChild(distanceIconLabel);

        if (this.config.open) {
            const openCloseIconLabel = document.createElement('th');
            openCloseIconLabel.classList.add('centered');
            const openCloseIcon = document.createElement('i');
            openCloseIcon.classList.add('fa', 'fa-clock-o');
            openCloseIconLabel.appendChild(openCloseIcon);
            labelRow.appendChild(openCloseIconLabel);
        }

        return labelRow;
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
     * @function appendDataRow
     * @description Creates the UI for the station price table.
     *
     * @param {Object} data - Information about a station.
     * @param {string} data.name - The gas station name.
     * @param {Object.<string, number>} data.prices - Prices (value) of the different fuel types (key).
     * @param {number} data.distance - Distance between user location and gas station.
     * @param {boolean} data.isOpen - Indicator if the gas station is currently open or closed.
     * @param {string} data.address - Address of the gas station in the format: Postcode City - Street Housenumber.
     * @param {Element} appendTo - DOM Element where the UI gets appended as child.
     *
     * @example <caption>data object</caption>
     * {
     *   "name": "Aral Tankstelle",
     *   "prices": {
     *     "diesel": 1.009,
     *     "e5": 1.009,
     *     "e10": 1.009
     *   },
     *   "distance": 2.2,
     *   "isOpen": true,
     *   "address": "70372 Stuttgart - Waiblinger Straße 23-25",
     *   "lat": 48.8043442,
     *   "lng": 9.220273
     * }
     */
    appendDataRow(data, appendTo) {
        const row = document.createElement('tr');

        const name = document.createElement('td');
        name.innerHTML = this.shortenText(data.name);
        row.appendChild(name);

        for (let i = 0; i < this.config.types.length; i += 1) {
            if (this.priceList.types.includes(this.config.types[i])) {
                const price = document.createElement('td');
                price.classList.add('centered');
                if (data.prices[this.config.types[i]] === -1) {
                    price.innerHTML = '-';
                } else {
                    price.innerHTML = `${data.prices[this.config.types[i]].toFixed(2)} ${
                        this.currencies[this.priceList.currency]}`;
                }
                row.appendChild(price);
            }
        }

        const distanceUnit = this.units[config.units];
        let distance = data.distance;

        if (distanceUnit !== this.priceList.unit) {
            distance = this[`${this.priceList.unit}2${distanceUnit}`](distance);
        }

        const distanceColumn = document.createElement('td');
        distanceColumn.classList.add('centered');
        distanceColumn.innerHTML = `${distance.toFixed(2)} ${distanceUnit}`;
        row.appendChild(distanceColumn);

        if (this.config.open) {
            const lockUnlockIconLabel = document.createElement('td');
            lockUnlockIconLabel.classList.add('centered');
            const lockUnlockIcon = document.createElement('i');
            if (data.isOpen) {
                lockUnlockIcon.classList.add('fa', 'fa-unlock');
            } else {
                lockUnlockIcon.classList.add('fa', 'fa-lock');
            }
            lockUnlockIconLabel.appendChild(lockUnlockIcon);
            row.appendChild(lockUnlockIconLabel);
        }

        appendTo.appendChild(row);

        if (this.config.showAddress) {
            const details = document.createElement('tr');
            details.setAttribute('colspan', 2 + this.config.types.length + (this.config.open ? 1 : 0));

            const address = document.createElement('td');
            address.classList.add('xsmall');
            address.innerHTML = this.shortenText(data.address);
            details.appendChild(address);

            appendTo.appendChild(details);
        }
    },

    /**
     * @function checkCommands
     * @description Checks for voice commands.
     *
     * @param {string} data - Text with commands.
     */
    checkCommands(data) {
        if (/(HELP)/g.test(data)) {
            if (/(CLOSE)/g.test(data) || (this.help && !/(OPEN)/g.test(data))) {
                this.help = false;
                this.interval = this.createInterval();
            } else if (/(OPEN)/g.test(data) || (!this.help && !/(CLOSE)/g.test(data))) {
                this.map = false;
                this.help = true;
                clearInterval(this.interval);
            }
        } else if (/(HIDE)/g.test(data) && /(MAP)/g.test(data)) {
            this.map = false;
            this.interval = this.createInterval();
        } else if (/(GAS)/g.test(data) && /(STATIONS)/g.test(data)) {
            this.help = false;
            this.map = true;
            clearInterval(this.interval);
        }
        this.updateDom(300);
    },

    /**
     * @function appendTo
     * @description Creates the UI for the voice command SHOW HELP.
     *
     * @param {Element} appendTo - DOM Element where the UI gets appended as child.
     */
    appendHelp(appendTo) {
        const title = document.createElement('h1');
        title.classList.add('medium');
        title.innerHTML = `${this.name} - ${this.translate('COMMAND_LIST')}`;
        appendTo.appendChild(title);

        const mode = document.createElement('div');
        mode.innerHTML = `${this.translate('MODE')}: ${this.voice.mode}`;
        appendTo.appendChild(mode);

        const listLabel = document.createElement('div');
        listLabel.innerHTML = `${this.translate('VOICE_COMMANDS')}:`;
        appendTo.appendChild(listLabel);

        const list = document.createElement('ul');
        for (let i = 0; i < this.voice.sentences.length; i += 1) {
            const item = document.createElement('li');
            item.innerHTML = this.voice.sentences[i];
            list.appendChild(item);
        }
        appendTo.appendChild(list);
    },

    /**
     * @function createSortIcon
     * @description Creates a DOM Element with the FontAwesome icon
     * fa-long-arrow-down {@link http://fontawesome.io/icons/}.
     *
     * @returns {Element} Element with icon.
     */
    createSortIcon() {
        const sortIcon = document.createElement('i');
        sortIcon.classList.add('fa', 'fa-long-arrow-down', 'sortBy');
        return sortIcon;
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
     * @function km2ml
     * @description Converts the unit kilometres to miles.
     *
     * @param {number} value - Distance in kilometres.
     *
     * @returns {number} Distance in miles.
     */
    km2ml(value) {
        return value * 0.62137;
    },

    /**
     * @function ml2km
     * @description Converts the unit miles to kilometres.
     *
     * @param {number} value - Distance in miles.
     *
     * @returns {number} Distance in kilometres.
     */
    ml2km(value) {
        return value * 1.60934;
    }
});
