# MMM-Fuel
Gas Station price Module for MagicMirror<sup>2</sup>

## Example

![](.github/example.jpg) ![](.github/example2.jpg)

## Dependencies
  * An installation of [MagicMirror<sup>2</sup>](https://github.com/MichMich/MagicMirror)
  * npm
  * [request](https://www.npmjs.com/package/request)
  
## Info
The data used in this module comes from [tankerkoenig.de](www.tankerkoenig.de) and is only for Gas Stations in Germany.
If you find an API for other countries let me know and i will implement them as well.

## Installation
 1. Clone this repo into `~/MagicMirror/modules` directory.
 2. Configure your `~/MagicMirror/config/config.js`:

    ```
    {
        module: "MMM-Fuel",
        position: "top_right",
        config: {
            api_key: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            lat: 52.518611,
            lng: 13.408333,
            type: "diesel",
            ...
        }
    }
    ```
 3. Run command `npm install` in `~/MagicMirror/modules/MMM-Fuel` directory.

## Config Options
| **Option** | **Default** | **Description** |
| --- | --- | --- |
| `api_key` | REQUIRED | Get an API key for free access to the data of www.tankerkoenig.de [here](https://creativecommons.tankerkoenig.de/#register). |
| `lat` | REQUIRED | Decimal degrees latitude. |
| `lng` | REQUIRED | Decimal degrees longitude. |
| `type` | REQUIRED | Fuel type `'diesel'`, `'e5'` or `'e10'`. |
| `radius` | `5` | Lookup Area for Gas Stations in km. Possible values 1-25. |
| `max` | `5` | How many gas stations should be displayed. |
| `rotateInterval` | `60000` (1 min) | How fast the sorting should be switched between byPrice and byDistance. |
| `updateInterval` | `600000` (10 mins) | How often should the data be fetched. |
