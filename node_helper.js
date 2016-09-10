/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

const request = require("request");
const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({

    baseUrl: "https://creativecommons.tankerkoenig.de/json/list.php?",

    start: function() {
        console.log("Starting module: " + this.name);
    },

    socketNotificationReceived: function(notification, payload) {
        if(notification === "CONFIG"){
            this.config = payload;
            this.getData();
            setInterval(() => {
                this.getData();
            }, this.config.updateInterval);
        }
    },

    getData: function() {
        var options = {
            url: this.baseUrl +
                "lat=" + this.config.lat +
                "&lng=" + this.config.lng +
                "&rad=" + this.config.radius +
                "&type=" + this.config.type +
                "&apikey=" + this.config.api_key +
                "&sort=dist"
        };
        request(options, (error, response, body) => {
            if (response.statusCode === 200) {
                if(body.ok) {
                    var price = body.stations;
                    price.sort((a, b) => {
                        return a.dist - b.dist;
                    });
                    this.sendSocketNotification("PRICELIST", {byPrice: price, byDistance: body.stations});
                } else {
                    console.log("Error no fuel data");
                }
            } else {
                console.log("Error getting fuel data " + response.statusCode);
            }
        });
    }
});