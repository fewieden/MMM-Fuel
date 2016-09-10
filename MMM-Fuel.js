/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

Module.register("MMM-Fuel", {

    sortByPrice: true,

    defaults: {
        radius: 5,
        max: 5,
        rotateInterval: 60 * 1000,           // every minute
        updateInterval: 10 * 60 * 1000       // every 10 minutes
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
        setInterval(() => {
            this.sortByPrice = !this.sortByPrice;
            this.updateDom(300);
        }, this.config.rotateInterval);
        this.sendSocketNotification("CONFIG", this.config);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "PRICELIST") {
            this.priceList = payload;
            this.updateDom(300);
        }
    },

    getDom: function () {

        var wrapper = document.createElement("div");
        var header = document.createElement("header");
        header.classList.add("align-left");
        var logo = document.createElement("i");
        logo.classList.add("fa", "fa-car", "logo");
        header.appendChild(logo);
        var name = document.createElement("span");
        name.innerHTML = this.translate("FUEL_PRICES");
        header.appendChild(name);
        wrapper.appendChild(header);

        if (!this.priceList) {
            var text = document.createElement("div");
            text.innerHTML = this.translate("LOADING");
            text.classList.add("dimmed", "light");
            wrapper.appendChild(text);
        } else {
            var table = document.createElement("table");
            table.classList.add("small", "table", "align-left");

            table.appendChild(this.createLabelRow());

            var data = this.sortByPrice ? this.priceList.byPrice : this.priceList.byDistance;

            for (var i = 0; i < Math.min(data.length, this.config.max); i++) {
                this.appendDataRow(data[i], table);
            }

            wrapper.appendChild(table);
        }

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
        address.innerHTML = data.postCode + " " + data.place + " - " + data.street + " " + data.houseNumber;
        details.appendChild(address);

        appendTo.appendChild(details);
    }
});