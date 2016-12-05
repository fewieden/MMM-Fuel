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
                "&type=all" +
                "&apikey=" + this.config.api_key +
                "&sort=dist"
        };
        request(options, (error, response, body) => {
            if (response.statusCode === 200) {
                body = JSON.parse(body);
                if(body.ok) {
                    for(var i = body.stations.length - 1; i >= 0; i--){
                        var zeroFlag = true;
                        for(var n = 0; n < this.config.types.length; n++){
                            if(body.stations[i][this.config.types[n]] > 0){
                                zeroFlag = false;
                                break;
                            }
                        }
                        if(zeroFlag){
                            body.stations.splice(i, 1);
                        }
                    }
                    var price = body.stations.slice(0);
                    price.sort((a, b) => {
                        if(b[this.config.sortBy] == 0){
                            return Number.MIN_SAFE_INTEGER;
                        } else if(a[this.config.sortBy] == 0){
                            return Number.MAX_SAFE_INTEGER;
                        } else {
                            return a[this.config.sortBy] - b[this.config.sortBy];
                        }
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