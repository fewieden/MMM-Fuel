/* Magic Mirror
 * Module: MMM-Fuel
 *
 * By fewieden https://github.com/fewieden/MMM-Fuel
 * MIT Licensed.
 */

/* eslint-env node */

const earth = 6371e3;

const deg2rad = degree => degree * (Math.PI / 180);

const rad2deg = rad => rad * (180 / Math.PI);

module.exports = {

    from(lat, lng) {
        this.lat = lat;
        this.lng = lng;
        return this;
    },

    to(degree, distance) {
        const radius = distance * 1000;

        const δ = Math.sqrt(2 * (radius * radius)) / earth;
        const θ = deg2rad(Number(degree));

        const φ1 = deg2rad(this.lat);
        const λ1 = deg2rad(this.lng);

        const sinφ1 = Math.sin(φ1);
        const cosφ1 = Math.cos(φ1);
        const sinδ = Math.sin(δ);
        const cosδ = Math.cos(δ);
        const sinθ = Math.sin(θ);
        const cosθ = Math.cos(θ);

        const sinφ2 = (sinφ1 * cosδ) + (cosφ1 * sinδ * cosθ);
        const φ2 = Math.asin(sinφ2);
        const y = sinθ * sinδ * cosφ1;
        const x = cosδ - (sinφ1 * sinφ2);
        const λ2 = λ1 + Math.atan2(y, x);

        return { lat: rad2deg(φ2), lng: ((rad2deg(λ2) + 540) % 360) - 180 };
    }
};
