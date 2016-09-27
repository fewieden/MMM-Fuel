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

    defaults: {
        radius: 5,
        max: 5,
        modal: 10,
        map_api_key: false,
        zoom: 12,
        rotateInterval: 60 * 1000,           // every minute
        updateInterval: 15 * 60 * 1000       // every 15 minutes
    },

    voice: {
        mode: "FUEL",
        sentences: [
            "OPEN HELP",
            "CLOSE HELP",
            "SHOW GAS STATIONS MAP",
            "HIDE GAS STATIONS MAP"
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

    getScripts: function() {
        return this.config.map_api_key ? ["https://maps.googleapis.com/maps/api/js?key=" + this.config.map_api_key] : [];
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        setInterval(() => {
            this.sortByPrice = !this.sortByPrice;
            this.updateDom(300);
        }, this.config.rotateInterval);
        this.sendSocketNotification("CONFIG", this.config);
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
            this.createMapUI();
            this.updateDom(300);
        }
    },

    getDom: function () {

        var wrapper = document.createElement("div");
        var list = document.createElement("div");
        var header = document.createElement("header");
        header.classList.add("align-left");
        var logo = document.createElement("i");
        logo.classList.add("fa", "fa-car", "logo");
        header.appendChild(logo);
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
                if(this.map){
                    modal.appendChild(this.mapUI);
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

        var priceIconLabel = document.createElement("th");
        priceIconLabel.classList.add("centered");
        var priceIcon = document.createElement("i");
        priceIcon.classList.add("fa", "fa-money");
        priceIconLabel.appendChild(priceIcon);
        labelRow.appendChild(priceIconLabel);

        var distanceIconLabel = document.createElement("th");
        distanceIconLabel.classList.add("centered");
        var distanceIcon = document.createElement("i");
        distanceIcon.classList.add("fa", "fa-map-o");
        distanceIconLabel.appendChild(distanceIcon);
        labelRow.appendChild(distanceIconLabel);

        return labelRow;
    },

    appendDataRow: function (data, appendTo) {
        var row = document.createElement("tr");

        var name = document.createElement("td");
        name.innerHTML = data.name;
        row.appendChild(name);

        var price = document.createElement("td");
        price.classList.add("centered");
        price.innerHTML = data.price + " €";
        row.appendChild(price);

        var distance = document.createElement("td");
        distance.classList.add("centered");
        distance.innerHTML = data.dist + " km";
        row.appendChild(distance);

        appendTo.appendChild(row);

        var details = document.createElement("tr");
        details.setAttribute("colspan", 3);

        var address = document.createElement("td");
        address.classList.add("xsmall");
        address.innerHTML = ("0" + data.postCode).slice(-5) + " " + data.place + " - " + data.street + " " + data.houseNumber;
        details.appendChild(address);

        appendTo.appendChild(details);
    },

    checkCommands: function(data){
        if(/(HELP)/g.test(data)){
            if(/(OPEN)/g.test(data) || !this.help && !/(CLOSE)/g.test(data)){
                this.map = false;
                this.help = true;
            } else if(/(CLOSE)/g.test(data) || this.help && !/(OPEN)/g.test(data)){
                this.help = false;
            }
        } else if(/(MAP)/g.test(data)){
            if(/(SHOW)/g.test(data) || !this.map && !/(HIDE)/g.test(data)){
                this.help = false;
                this.map = true;
            } else if(/(HIDE)/g.test(data) || this.map && !/(SHOW)/g.test(data)){
                this.map = false;
            }
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
    },

    createMapUI: function(){
        this.mapUI = document.createElement("div");
        if(this.config.map_api_key){
            var map = new google.maps.Map(this.mapUI, {
                center: {lat: this.config.lat, lng: this.config.lng},
                zoom: this.config.zoom
            });

            var trafficLayer = new google.maps.TrafficLayer();
            trafficLayer.setMap(map);

            for(var i = 0; i < this.priceList.byPrice.length; i++){
                var marker = new google.maps.Marker({
                    position: {lat: this.priceList.byPrice[i].lat, lng: this.priceList.byPrice[i].lng},
                    label: i + 1,
                    map: map
                });
            }
        } else {
            this.mapUI.innerHTML = this.translate("API_KEY_NEEDED");
        }
    }
});