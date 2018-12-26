# Documentation for API integration

## Import

The API provider gets imported in the node_helper.js. As parameter it gets the config of the module.

## Stations

To display the data of the stations in the UI, a single station has to be in the following format:

```
{
    "name": "Aral Tankstelle", // String
    "prices": {  // Object
        "diesel": 1.009, // Float
        // "type": amount
    },
    "distance": 2.2, // Float
    "isOpen": true, // Boolean
    "address": "70376 Stuttgart - Pragstraße 138A", // String
    "lat": 48.8075371, // Float
    "lng": 9.194154, // Float
}
```

## getData

The API provider needs to implement the async function `getData`, which gets a callback as parameter.
The response has to have the following format:

```
{
    types: ['diesel', 'e5', 'e10'], // Array | types supported by the API provider.
    unit: 'km', // String | unit for the distance either in kilometres (km) or miles (ml).
    currency: 'EUR', // String | curreny of the fuel prices either in EUR or USD.
    byPrice: stations, // Array | stations (see above) sorted by price.
    byDistance: distance // Array | stations (see above) sorted by distance.
};
```

If an error occurs in the process you can throw an exception.
