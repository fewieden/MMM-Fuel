/* global Module Log google*/

/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

Module.register('MMM-Fuel', {

    sortByPrice: true,
    help: false,
    map: false,
    mapUI: null,
    interval: null,

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
        shortenAddress: false,
        showAddress: true,
        showOpenOnly: false,
        iconHeader: true,
        rotate: true,
        types: ['diesel'],
        sortBy: 'diesel',
        rotateInterval: 60 * 1000,           // every minute
        updateInterval: 15 * 60 * 1000       // every 15 minutes
    },

    voice: {
        mode: 'FUEL',
        sentences: [
            'OPEN HELP',
            'CLOSE HELP',
            'SHOW GAS STATIONS',
            'HIDE MAP'
        ]
    },

    getTranslations() {
        return {
            en: 'translations/en.json',
            de: 'translations/de.json'
        };
    },

    getStyles() {
        return ['font-awesome.css', 'MMM-Fuel.css'];
    },

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

    createInterval() {
        if (!this.config.rotate) {
            return null;
        }
        return setInterval(() => {
            this.sortByPrice = !this.sortByPrice;
            this.updateDom(300);
        }, this.config.rotateInterval);
    },

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

    socketNotificationReceived(notification, payload) {
        if (notification === 'PRICELIST') {
            this.priceList = payload;
            this.updateDom(300);
        }
    },

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
                            {center: new google.maps.LatLng(${parseFloat(this.config.lat)}, \
                            ${parseFloat(this.config.lng)}), zoom: ${this.config.zoom}, disableDefaultUI:true});
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
            const typeLabel = document.createElement('th');
            typeLabel.classList.add('centered');

            const typeSpan = document.createElement('span');
            typeSpan.innerHTML = this.config.types[i].charAt(0).toUpperCase() + this.config.types[i].slice(1);
            typeLabel.appendChild(typeSpan);

            if (this.sortByPrice && this.config.sortBy === this.config.types[i]) {
                const sortIcon = document.createElement('i');
                sortIcon.classList.add('fa', 'fa-long-arrow-down', 'sortBy');
                typeLabel.appendChild(sortIcon);
            }

            labelRow.appendChild(typeLabel);
        }

        const distanceIconLabel = document.createElement('th');
        distanceIconLabel.classList.add('centered');

        const distanceIcon = document.createElement('i');
        distanceIcon.classList.add('fa', 'fa-map-o');
        distanceIconLabel.appendChild(distanceIcon);

        if (!this.sortByPrice) {
            const sortIcon = document.createElement('i');
            sortIcon.classList.add('fa', 'fa-long-arrow-down', 'sortBy');
            distanceIconLabel.appendChild(sortIcon);
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

    shortenText(text) {
        let temp = text;
        if (this.config.shortenText && temp.length > this.config.shortenText) {
            temp = `${temp.slice(0, this.config.shortenText)}&#8230;`;
        }
        return temp;
    },
    
    shortenAddress(text) {
        let temp = text;
        if (this.config.shortenAddress && temp.length > this.config.shortenAddress) {
            temp = `${temp.slice(0, this.config.shortenAddress)}&#8230;`;
        }
        return temp;
    },

    appendDataRow(data, appendTo) {
        const row = document.createElement('tr');

        const name = document.createElement('td');
        name.innerHTML = this.shortenText(data.name);
        row.appendChild(name);

        for (let i = 0; i < this.config.types.length; i += 1) {
            const price = document.createElement('td');
            price.classList.add('centered');
            price.innerHTML = `${data[this.config.types[i]]} €`;
            row.appendChild(price);
        }

        const distance = document.createElement('td');
        distance.classList.add('centered');
        distance.innerHTML = `${data.dist} km`;
        row.appendChild(distance);

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
            address.innerHTML = this.shortenAddress(`${(`0${data.postCode}`).slice(-5)} ${data.place} - ${data.street
                } ${data.houseNumber}`);
            details.appendChild(address);

            appendTo.appendChild(details);
        }
    },

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
    }
});
