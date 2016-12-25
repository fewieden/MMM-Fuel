/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

Module.register("MMM-Fuel", {

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
        shortenStation: false,
		shortenAddress: false,
        showAddress: true,
        showOpenOnly: false,
        iconHeader: true,
        rotate: true,
        types: ["diesel"],
        sortBy: "diesel",
        rotateInterval: 60 * 1000,           // every minute
        updateInterval: 15 * 60 * 1000       // every 15 minutes
    },

    voice: {
        mode: "FUEL",
        sentences: [
            "OPEN HELP",
            "CLOSE HELP",
            "SHOW GAS STATIONS",
            "HIDE MAP"
        ]
    },

    getTranslations: function () {
        return {
            en: "translations/en.json",
            de: "translations/de.json"
        };
    },

    getStyles: function () {
        return ["font-awesome.css", "MMM-Fuel.css"];
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        //Add script manually, getScripts doesn't work for it!
        if(this.config.map_api_key){
            var script = document.createElement("script");
            script.src = "https://maps.googleapis.com/maps/api/js?key=" + this.config.map_api_key;
            document.querySelector("body").appendChild(script);
        }
        this.interval = this.createInterval();
        this.sendSocketNotification("CONFIG", this.config);
    },

    createInterval: function(){
        if(!this.config.rotate){
            return null;
        } else {
            return setInterval(() => {
                this.sortByPrice = !this.sortByPrice;
                this.updateDom(300);
            }, this.config.rotateInterval);
        }
    },

    notificationReceived: function (notification, payload, sender) {
        if(notification === "ALL_MODULES_STARTED"){
            this.sendNotification("REGISTER_VOICE_MODULE", this.voice);
        } else if(notification === "VOICE_FUEL" && sender.name === "MMM-voice"){
            this.checkCommands(payload);
        } else if(notification === "VOICE_MODE_CHANGED" && sender.name === "MMM-voice" && payload.old === this.voice.mode){
            this.help = false;
            this.map = false;
            this.updateDom(300);
        }
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "PRICELIST") {
            this.priceList = payload;
            this.updateDom(300);
        }
    },

    getDom: function () {

        var wrapper = document.createElement("div");
        var list = document.createElement("div");
        var header = document.createElement("header");
        header.classList.add("align-left");
        if(this.config.iconHeader){
            var logo = document.createElement("i");
            logo.classList.add("fa", "fa-car", "logo");
            header.appendChild(logo);
        }
        var name = document.createElement("span");
        name.innerHTML = this.translate("FUEL_PRICES");
        header.appendChild(name);
        list.appendChild(header);

        if (!this.priceList) {
            var text = document.createElement("div");
            text.innerHTML = this.translate("LOADING");
            text.classList.add("dimmed", "light");
            list.appendChild(text);
        } else {
            var table = document.createElement("table");
            table.classList.add("small", "table", "align-left");

            table.appendChild(this.createLabelRow());

            var data = this.sortByPrice ? this.priceList.byPrice : this.priceList.byDistance;

            for (var i = 0; i < Math.min(data.length, this.config.max); i++) {
                this.appendDataRow(data[i], table);
            }

            list.appendChild(table);

            var modules = document.querySelectorAll(".module");
            for (var i = 0; i < modules.length; i++) {
                if(!modules[i].classList.contains("MMM-Fuel")){
                    if(this.map || this.help){
                        modules[i].classList.add("MMM-Fuel-blur");
                    } else {
                        modules[i].classList.remove("MMM-Fuel-blur");
                    }
                }
            }

            if(this.map || this.help){
                list.classList.add("MMM-Fuel-blur");
                var modal = document.createElement("div");
                modal.classList.add("modal");
                if(this.map && this.config.map_api_key) {
                    if (typeof google === 'object' && typeof google.maps === 'object') {
                        if (!this.config.colored) {
                            modal.classList.add("no-color");
                        }
                        var map = document.createElement("div");
                        map.classList.add("MMM-Fuel-map");
                        map.style.height = this.config.height + "px";
                        map.style.width = this.config.width + "px";
                        modal.appendChild(map);
                        var script = document.createElement("script");
                        script.innerHTML = "var MMM_Fuel_map = new google.maps.Map(document.querySelector('div.MMM-Fuel-map'), {center: new google.maps.LatLng(" + parseFloat(this.config.lat) + ", " + parseFloat(this.config.lng) + "), zoom: " + this.config.zoom + ", disableDefaultUI:true});" +
                            "var trafficLayer = new google.maps.TrafficLayer();" +
                            "trafficLayer.setMap(MMM_Fuel_map);" +
                            "var MMM_Fuel_array = " + JSON.stringify(this.priceList.byPrice) + ";" +
                            "for(var i = 0; i < MMM_Fuel_array.length; i++){" +
                            "var marker = new google.maps.Marker({ position: {lat: MMM_Fuel_array[i].lat, lng: MMM_Fuel_array[i].lng}, label: i + 1 + '', map: MMM_Fuel_map});" +
                            "}";
                        modal.appendChild(script);
                    } else {
                        modal.innerHTML = this.translate("MAP_API_NOT_READY");
                    }
                } else if(this.map){
                    modal.innerHTML = this.translate("API_KEY_NEEDED");
                } else {
                    this.appendHelp(modal);
                }
                wrapper.appendChild(modal);
            }
        }

        wrapper.appendChild(list);

        return wrapper;
    },

    createLabelRow: function () {
        var labelRow = document.createElement("tr");

        var sortLabel = document.createElement("th");
        if(this.sortByPrice){
            sortLabel.innerHTML = this.translate("CHEAPEST_STATIONS");
        } else {
            sortLabel.innerHTML = this.translate("CLOSEST_STATIONS");
        }
        labelRow.appendChild(sortLabel);

        for(var i = 0; i < this.config.types.length; i++) {
            var typeLabel = document.createElement("th");
            typeLabel.classList.add("centered");

            var typeSpan = document.createElement("span");
            typeSpan.innerHTML = this.config.types[i].charAt(0).toUpperCase() + this.config.types[i].slice(1);
            typeLabel.appendChild(typeSpan);

            if(this.sortByPrice && this.config.sortBy === this.config.types[i]){
                var sortIcon = document.createElement("i");
                sortIcon.classList.add("fa", "fa-long-arrow-down", "sortBy");
                typeLabel.appendChild(sortIcon);
            }

            labelRow.appendChild(typeLabel);
        }

        var distanceIconLabel = document.createElement("th");
        distanceIconLabel.classList.add("centered");

        var distanceIcon = document.createElement("i");
        distanceIcon.classList.add("fa", "fa-map-o");
        distanceIconLabel.appendChild(distanceIcon);

        if(!this.sortByPrice){
            var sortIcon = document.createElement("i");
            sortIcon.classList.add("fa", "fa-long-arrow-down", "sortBy");
            distanceIconLabel.appendChild(sortIcon);
        }

        labelRow.appendChild(distanceIconLabel);

        if (this.config.open){
            var openCloseIconLabel = document.createElement("th");
            openCloseIconLabel.classList.add("centered");
            var openCloseIcon = document.createElement("i");
            openCloseIcon.classList.add("fa", "fa-clock-o");
            openCloseIconLabel.appendChild(openCloseIcon);
            labelRow.appendChild(openCloseIconLabel);
        }

        return labelRow;
    },

    appendDataRow: function (data, appendTo) {
        var row = document.createElement("tr");

        var station_name = data.name;
		if(station_name=="Hilden, Herder Str. 44"){
			station_name="FT Wysocki";
		}
		if(station_name.startsWith('JET')){
			station_name="Jet";
		}
		if(station_name.startsWith('TOTAL')){
			station_name="Total";
		}
		if(station_name.startsWith('star')){
			station_name="Star";
		}
		if(station_name.startsWith('Aral')){
			station_name="Aral";
		}
		if(station_name.startsWith('Esso')){
			station_name="Esso";
		}
		if(station_name=="HILDEN, HOCHDAHLER STR"){
			station_name="Shell";
		}
		if(station_name=="HILDEN, WALDER STR."){
			station_name="Shell";
		}
		if(station_name=="ERKRATH, MAX-PLANCK-STR. 81"){
			station_name="Shell";
		}
		if(station_name=="HAAN, GINSTERWEG"){
			station_name="Shell";
		}
		
        if(this.config.shortenStation && station_name.length > this.config.shortenStation){
            station_name = station_name.slice(0, this.config.shortenStation) + "&#8230;";
        }
        var name = document.createElement("td");
        name.innerHTML = station_name;
        row.appendChild(name);

        for(var i = 0; i < this.config.types.length; i++) {
            var price = document.createElement("td");
            price.classList.add("centered");
            price.innerHTML = data[this.config.types[i]] + " €";
            row.appendChild(price);
        }

        var distance = document.createElement("td");
        distance.classList.add("centered");
        distance.innerHTML = data.dist + " km";
        row.appendChild(distance);

        if (this.config.open){
            var lockUnlockIconLabel = document.createElement("td");
            lockUnlockIconLabel.classList.add("centered");
            var lockUnlockIcon = document.createElement("i");
            if (data.isOpen) {
                lockUnlockIcon.classList.add("fa", "fa-unlock");
            } else {
                lockUnlockIcon.classList.add("fa", "fa-lock");
            }
            lockUnlockIconLabel.appendChild(lockUnlockIcon);
            row.appendChild(lockUnlockIconLabel);
        }

        appendTo.appendChild(row);

        if(this.config.showAddress){
			function titleCase(str) {
				words = str.toLowerCase().split(/-| /);

				for(var i = 0; i < words.length; i++) {
				var letters = words[i].split('');
				letters[0] = letters[0].toUpperCase();
				words[i] = letters.join('');
				}
				return words.join(' ');
			}
            var details = document.createElement("tr");
            details.setAttribute("colspan", 2 + this.config.types.length + (this.config.open ? 1 : 0));
            var city_string = data.place.charAt(0).toUpperCase() + data.place.toLowerCase().slice(1);
            var street_string = ((titleCase(data.street)).replace("Straße", "Str.")).replace("Duesseldorf","Düsseldorf");
			var streetno_string = "";
			
			if(data.houseNumber!=null) {
            streetno_string = data.houseNumber;
			} else {
			streetno_string = "";	
			}
			
            var address_string = ("0" + data.postCode).slice(-5) + " " + city_string + " - " + street_string + " " + streetno_string;
			

            if(this.config.shortenAddress && address_string.length > this.config.shortenAddress){
                address_string = address_string.slice(0, this.config.shortenAddress) + "&#8230;";
            }
            var address = document.createElement("td");
            address.classList.add("xsmall");
            address.innerHTML = address_string;
            details.appendChild(address);

            appendTo.appendChild(details);
        }
    },

    checkCommands: function(data){
        if(/(HELP)/g.test(data)){
            if(/(CLOSE)/g.test(data) || this.help && !/(OPEN)/g.test(data)){
                this.help = false;
                this.interval = this.createInterval();
            } else if(/(OPEN)/g.test(data) || !this.help && !/(CLOSE)/g.test(data)){
                this.map = false;
                this.help = true;
                clearInterval(this.interval);
            }
        } else if(/(HIDE)/g.test(data) && /(MAP)/g.test(data)){
            this.map = false;
            this.interval = this.createInterval();
        } else if(/(GAS)/g.test(data) && /(STATIONS)/g.test(data)){
            this.help = false;
            this.map = true;
            clearInterval(this.interval);
        }
        this.updateDom(300);
    },

    appendHelp: function(appendTo){
        var title = document.createElement("h1");
        title.classList.add("medium");
        title.innerHTML = this.name + " - " + this.translate("COMMAND_LIST");
        appendTo.appendChild(title);

        var mode = document.createElement("div");
        mode.innerHTML = this.translate("MODE") + ": " + this.voice.mode;
        appendTo.appendChild(mode);

        var listLabel = document.createElement("div");
        listLabel.innerHTML = this.translate("VOICE_COMMANDS") + ":";
        appendTo.appendChild(listLabel);

        var list = document.createElement("ul");
        for(var i = 0; i < this.voice.sentences.length; i++){
            var item = document.createElement("li");
            item.innerHTML = this.voice.sentences[i];
            list.appendChild(item);
        }
        appendTo.appendChild(list);
    }
});
