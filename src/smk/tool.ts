/**
 * Tool — base class for all SMK tools.
 * Converted from tool.js (include.module -> ES module).
 */

import { SMKEvent } from './event'
import { ToolBase } from './mixin/tool-base/tool-base'
import { type as smkType } from './util'

declare const Vue: any

// ---------------------------------------------------------------------------
// Tool event class
// ---------------------------------------------------------------------------

const ToolEvent: any = SMKEvent.define( [
    'changedVisible',
    'changedEnabled',
    'changedActive',
    'changedGroup',
] )

// ---------------------------------------------------------------------------
// Tool base constructor
// ---------------------------------------------------------------------------

export function Tool( this: any ): void {
    ToolEvent.prototype.constructor.call( this )

    this.$prop           = {}
    this.$propFilter     = { constructor: false }
    this.$componentProp  = {}
    this.$initializers   = []
}

Object.assign( Tool.prototype, ToolEvent.prototype )

Tool.prototype.configure = function ( name: string, option: any ) {
    Object.assign( this, option )

    if ( this.instance ) {
        this.id = name + '--' + this.instance
        if ( this.parentId )
            this.parentId = this.parentId + '--' + this.instance
    } else {
        this.id = name
    }

    return this
}

Tool.prototype.initialize = function ( smk: any ) {
    const self = this
    return this.$initializers.concat( this.$moreInitializers ).forEach(
        function ( init: Function, i: number ) {
            try {
                init.call( self, smk )
            } catch ( e ) {
                console.warn( self.id + ' initializer #' + i + ' failed' )
                throw e
            }
        }
    )
}

Tool.prototype.defineProp = function ( name: string, opt?: any ) {
    const self = this

    if ( name in this.$prop )
        throw new Error( 'prop "' + name + '" is already defined' )

    const prop = this.$prop[ name ] = Object.assign( {
        onSet:    [],
        validate: function ( val: any ) { return val },
    }, opt )

    prop.onSet = [].concat( prop.onSet )

    Object.defineProperty( this, name, {
        get() { return prop.val },
        set( val ) {
            const oldVal = prop.val
            const newVal = prop.validate( val, oldVal, name )
            if ( newVal === oldVal ) return

            prop.val = newVal
            prop.onSet.forEach( function ( f: Function ) {
                f.call( self, name, newVal )
            } )
        },
    } )
}

Tool.prototype.getComponentProps = function ( componentName: string ) {
    const self = this

    if ( this.$componentProp[ componentName ] )
        return this.$componentProp[ componentName ]

    const component = Vue.component( componentName )
    if ( !component ) throw new Error( 'component "' + componentName + '" not defined' )

    const propNames = Object.keys( component.prototype ).filter( function ( c: string ) {
        if ( c in self.$propFilter ) return self.$propFilter[ c ]
        if ( c in self.$prop ) return true
        console.warn( 'prop "' + c + '" is defined in "' + componentName + '", but is not in tool', self )
        return false
    } )

    const prop = this.$componentProp[ componentName ] = {}
    propNames.forEach( function ( p: string ) {
        ( prop as any )[ p ] = self[ p ]
        self.$prop[ p ].onSet.unshift( function ( name: string, val: any ) {
            console.debug( 'set', componentName, name, val )
            ;( prop as any )[ p ] = val
        } )
    } )

    return this.$componentProp[ componentName ]
}

Tool.prototype.modifyComponentProp = function ( propName: string, modify: Function ) {
    const self = this
    Object.keys( this.$componentProp ).forEach( function ( c: string ) {
        if ( !( propName in self.$componentProp[ c ] ) ) return
        modify.call( self, self.$componentProp[ c ][ propName ], c )
    } )
}

// ---------------------------------------------------------------------------
// Tool.define — factory that creates named tool constructor types
// ---------------------------------------------------------------------------

;( Tool as any ).define = function (
    name: string,
    construct?: any,
    initialize?: Function,
    methods?: any
): ( config: any ) => any[] {
    const option: any = {
        construct,
        initialize,
        methods,
    }

    if ( smkType( construct ) === 'object' ) {
        Object.assign( option, construct )
    }

    const initializers: Function[] = []

    let events: any
    if ( option.events ) {
        events = SMKEvent.define( option.events )
    }

    const smk = ( window as any ).SMK
    if ( !smk || !smk.TYPE ) throw new Error( 'SMK.TYPE not available' )

    smk.TYPE[ name ] = function ( this: any ) {
        Tool.prototype.constructor.call( this )

        if ( events )
            events.prototype.constructor.call( this )

        ToolBase.call( this )

        if ( option.construct ) option.construct.call( this )

        if ( option.initialize )
            this.$initializers.push( option.initialize )

        this.$moreInitializers = initializers

        Object.assign( this, option.methods )
    }

    Object.assign( smk.TYPE[ name ].prototype, Tool.prototype )

    if ( events )
        Object.assign( smk.TYPE[ name ].prototype, events.prototype )

    smk.TYPE[ name ].addInitializer = function ( init: Function ) {
        initializers.push( init )
    }

    return function ( config: any ) {
        return [ ( new smk.TYPE[ name ]() ).configure( name, config ) ]
    }
}

// ---------------------------------------------------------------------------
// Tool.defineComposite
// ---------------------------------------------------------------------------

;( Tool as any ).defineComposite = function ( toolDefs: Array<( config: any ) => any[]> ) {
    return function ( config: any ) {
        return toolDefs.map( function ( t ) {
            return t( config )[ 0 ]
        } )
    }
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = ( window as any ).SMK
    if ( smk && smk.TYPE ) smk.TYPE.Tool = Tool
}

export default Tool
