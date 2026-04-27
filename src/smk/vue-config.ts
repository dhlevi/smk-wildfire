/**
 * vue-config — Vue 2 filters, components, and directives for SMK.
 * Converted from vue-config.js (include.module -> ES module).
 */

import spinnerGifUrl from './spinner.gif'
import { getMetersPerUnit } from './util'

declare const Vue: any

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function formatTitle( value: any ): string {
    if ( value == null ) return '(Null)'

    return ( value as string )
        .replace( /([^\w\s]+)/, ' $1 ' )
        .replace( /\s*[A-Z]\S*?\w(?=\W)/g, ( m ) => ' ' + m.trim() + ' ' )
        .replace( /\s*[_-]\s*/g, ' ' )
        .toLowerCase()
        .replace( /^\w|\s\w/g, ( m ) => m.toUpperCase() )
        .replace( /\s+/g, ' ' )
        .trim()
}

function formatNumber( value: any, precision: number, fractionPlaces: number ): string {
    if ( value == null ) return '(Null)'
    var fixed = Number( value ).toFixed( precision || 0 )
    if ( fractionPlaces != null ) {
        var parts = fixed.split( '.' )
        return parts[0] + '.' + parts[1].substring( 0, fractionPlaces )
    }
    return fixed
}

function formatDate( value: any ): string {
    if ( !value ) return ''
    var d = new Date( value )
    return isNaN( d.getTime() ) ? String( value ) : d.toLocaleDateString()
}

function formatTime( value: any ): string {
    if ( !value ) return ''
    var d = new Date( value )
    return isNaN( d.getTime() ) ? String( value ) : d.toLocaleTimeString()
}

function dimensionalNumber( value: any, dim: number, unit: string, decimalPlaces: number ): string {
    if ( dim === 1 )
        switch ( unit ) {
            case 'imperial':
            case 'miles':          return formatNumber( value / getMetersPerUnit( 'mi' ), decimalPlaces ) + ' mi'
            case 'inches':         return formatNumber( value / getMetersPerUnit( 'inches' ), decimalPlaces ) + ' in'
            case 'feet':           return formatNumber( value / getMetersPerUnit( 'ft' ), decimalPlaces ) + ' ft'
            case 'yards':          return formatNumber( value / getMetersPerUnit( 'yd' ), decimalPlaces ) + ' yd'
            case 'nautical-miles': return formatNumber( value / getMetersPerUnit( 'nmi' ), decimalPlaces ) + ' nm'
            case 'kilometers':     return formatNumber( value / 1000, decimalPlaces ) + ' km'
            case 'acres':          return formatNumber( value / getMetersPerUnit( 'mi' ), decimalPlaces ) + ' mi'
            case 'hectares':       return formatNumber( value, decimalPlaces ) + ' m'
            case 'metric':
            case 'meters':
            default:               return formatNumber( value, decimalPlaces ) + ' m'
        }

    if ( dim === 2 )
        switch ( unit ) {
            case 'imperial':
            case 'miles':          return formatNumber( value / getMetersPerUnit( 'mi' ) / getMetersPerUnit( 'mi' ), decimalPlaces ) + ' mi²'
            case 'inches':         return formatNumber( value / getMetersPerUnit( 'inches' ) / getMetersPerUnit( 'inches' ), decimalPlaces ) + ' in²'
            case 'feet':           return formatNumber( value / getMetersPerUnit( 'ft' ) / getMetersPerUnit( 'ft' ), decimalPlaces ) + ' ft²'
            case 'yards':          return formatNumber( value / getMetersPerUnit( 'yd' ) / getMetersPerUnit( 'yd' ), decimalPlaces ) + ' yd²'
            case 'nautical-miles': return formatNumber( value / getMetersPerUnit( 'nmi' ) / getMetersPerUnit( 'nmi' ), decimalPlaces ) + ' nmi²'
            case 'kilometers':     return formatNumber( value / 1000 / 1000, decimalPlaces ) + ' km²'
            case 'acres':          return formatNumber( value / getMetersPerUnit( 'GunterChain' ) / getMetersPerUnit( 'Furlong' ), decimalPlaces ) + ' acres'
            case 'hectares':       return formatNumber( value / 100 / 100, decimalPlaces ) + ' ha'
            case 'metric':
            case 'meters':
            default:               return formatNumber( value, decimalPlaces ) + ' m²'
        }

    return formatNumber( value, decimalPlaces )
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function setupVueConfig(): void {
    Vue.filter( 'formatTitle', formatTitle )
    Vue.filter( 'formatNumber', formatNumber )
    Vue.filter( 'formatDate', formatDate )
    Vue.filter( 'formatTime', formatTime )
    Vue.filter( 'dimensionalNumber', dimensionalNumber )

    Vue.component( 'busy-spinner', {
        props: [ 'active' ],
        template: `<img v-if="active" class="smk-busy-spinner" :src="spinnerSrc">`,
        data() {
            return { spinnerSrc: spinnerGifUrl }
        }
    } )

    Vue.component( 'status-message', {
        props: [ 'status', 'message' ],
        template: `<div v-if="message" class="smk-status-message" :class="'smk-status-' + status">{{ message }}</div>`
    } )

    Vue.directive( 'content', {
        inserted( el: any, binding: any ) {
            if ( binding.value && binding.value.createContent )
                binding.value.createContent( el )
        }
    } )
}

// Auto-call on module load — Vue must be available as a global before SMK
if ( typeof window !== 'undefined' && ( window as any ).Vue ) {
    setupVueConfig()
}

export default setupVueConfig
