import { SMK } from '../smk-ref'
/**
 * Geocoder — BC Geocoder API wrapper.
 * Converted from api/geocoder.js.
 */

const smkRef = SMK

function Geocoder( this: any, config: any ) {
    Object.assign( this, {
        timeout:   10 * 1000,
        url:       'https://geocoder.api.gov.bc.ca/',
        parameter: {}
    }, config )
}

Geocoder.prototype.fetchAddresses = function ( address: string, option?: any ) {
    option = Object.assign( {
        maxResults:         20,
        outputSRS:          4326,
        addressString:      address,
        autoComplete:       true,
        locationDescriptor: 'accessPoint'
    }, this.parameter, option )

    delete option.maxDistance
    delete option.locationMode

    return this.fetchGeocoder( 'addresses', option )
        .then( function ( data: any ) {
            return data.features
                .filter( function ( feature: any ) {
                    if ( !feature.geometry.coordinates ) return false
                    if ( feature.properties.fullAddress === 'BC' ) return false
                    return true
                } )
                .map( function ( feature: any ) {
                    return {
                        longitude:          feature.geometry.coordinates[ 0 ],
                        latitude:           feature.geometry.coordinates[ 1 ],
                        civicNumber:        feature.properties.civicNumber,
                        civicNumberSuffix:  feature.properties.civicNumberSuffix,
                        fullAddress:        feature.properties.fullAddress,
                        localityName:       feature.properties.localityName,
                        localityType:       feature.properties.localityType,
                        streetName:         feature.properties.streetName,
                        streetType:         feature.properties.streetType,
                        siteName:           feature.properties.siteName,
                        matchPrecision:     feature.properties.matchPrecision,
                    }
                } )
        } )
}

Geocoder.prototype.fetchNearestSite = function ( location: any, option?: any ) {
    option = Object.assign( {
        locationOut:        'geocoder',
        point:              [ location.longitude, location.latitude ].join( ',' ),
        outputSRS:          4326,
        locationDescriptor: 'routingPoint',
        maxDistance:        1000,
    }, this.parameter, option )

    const locationOut = option.locationOut
    delete option.locationOut

    return this.fetchGeocoder( 'sites/nearest', option )
        .then( function ( data: any ) {
            const site: any = {
                civicNumber:        data.properties.civicNumber,
                civicNumberSuffix:  data.properties.civicNumberSuffix,
                fullAddress:        data.properties.fullAddress,
                localityName:       data.properties.localityName,
                localityType:       data.properties.localityType,
                streetName:         data.properties.streetName,
                streetType:         data.properties.streetType,
                siteName:           data.properties.siteName,
                matchPrecision:     data.properties.matchPrecision,
            }

            if ( locationOut === 'geocoder' ) {
                site.longitude = data.geometry.coordinates[ 0 ]
                site.latitude  = data.geometry.coordinates[ 1 ]
            }
            else if ( locationOut === 'input' ) {
                Object.assign( site, location )
            }

            return site
        } )
        .catch( function ( err: any ) {
            console.debug( err.responseText )
            return location
        } )
}

Geocoder.prototype.fetchIntersections = function ( _points: any, _option?: any ) {}
Geocoder.prototype.fetchOccupants    = function ( _points: any, _option?: any ) {}

Geocoder.prototype.fetchGeocoder = function ( endpoint: string, query: any ) {
    const self = this

    return self.fetchData(endpoint, query)
}

Geocoder.prototype.fetchData = async function (endpoint: string, query: any) {
    const self = this
    // 1. Handle Query Parameters
    const url = new URL(self.url + endpoint + '.geojson');
    if (query) {
        Object.keys(query).forEach(key => url.searchParams.append(key, query[key]));
    }

    // 2. Handle Timeout using AbortController
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), self.timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            method: 'GET', // Default
            headers: {
                'Accept': 'application/json'
            }
        });

        clearTimeout(id);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 3. Parse JSON
        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw err;
    }
}

smkRef.TYPE.Geocoder = Geocoder
export default Geocoder
