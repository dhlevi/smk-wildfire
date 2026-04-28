/**
 * SmkMap — main map controller.
 * Converted from smk-map.js (include.module -> ES module).
 *
 * jQuery ($) is expected to be provided by the host page (as with Vue, L,
 * turf, proj4 etc).  The viewer types and tool factories are pre-registered
 * on window.SMK.TYPE.* by the ES-module side-effects of their own files.
 */

import spinnerGifUrl from './spinner.gif'
import { waitAll, resolved } from './util'

declare const Vue: any
declare const $:   any

// ---------------------------------------------------------------------------
// SmkMap constructor
// ---------------------------------------------------------------------------

export function SmkMap( this: any, option: any ): void {
    this.$option = option

    this.$dispatcher = new Vue()

    this.$group = {}
}

SmkMap.prototype.resolveAssetUrl = function ( url: string ) {
    return ( new URL( url, this.$option.baseUrl + 'assets/src/' ) ).toString()
}

SmkMap.prototype.initialize = function () {
    const self = this

    const container = $( this.$option.containerSel )
    if ( container.length !== 1 )
        throw new Error( 'smk-container-sel "' + this.$option.containerSel + '" doesn\'t match a unique element' )

    container.empty()
    container.addClass( 'smk-map-frame smk-hidden' )

    const p       = container.position()
    const spinner = $( '<img>' )
        .attr( 'src', spinnerGifUrl )
        .insertAfter( container )
        .css( {
            zIndex:     99999,
            visibility: 'visible',
            position:   'absolute',
            width:      64,
            height:     64,
            left:       p.left + container.outerWidth()  / 2 - 32,
            top:        p.top  + container.outerHeight() / 2 - 32,
        } )

    container.empty()
    this.$container = container.get( 0 )

    const dojoConfig: any = ( window as any ).dojoConfig
    if ( dojoConfig && dojoConfig.packages && dojoConfig.packages[ 0 ] ) {
        dojoConfig.packages[ 0 ].location = this.resolveAssetUrl( 'lib/esri3d' )
    }

    return resolved()
        .then( loadConfigs )
        .then( mergeConfigs )
        .then( initMapFrame )
        .then( resolveDeviceConfig )
        .then( loadViewer )
        .then( loadTools )
        .then( initViewer )
        .then( initTools )
        .then( initDisplayContext )
        .then( showMap )
        .finally( function () {
            return ( new Promise<void>( function ( res ) {
                container
                    .hide()
                    .removeClass( 'smk-hidden' )
                    .fadeIn( 1000, res )

                spinner.fadeOut( 1000 )
            } ) )
            .then( function () {
                spinner.remove()
            } )
        } )

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    function loadConfigs() {
        return waitAll( self.$option.parsedConfig.map( function ( c: any ) {
            if ( c.obj ) {
                c.obj.$source = c.$source
                return resolved( c.obj )
            }

            // URL-based config: fetch as JSON
            return fetch( c.url )
                .then( function ( r ) {
                    if ( !r.ok ) throw new Error( 'HTTP ' + r.status + ' fetching ' + c.url )
                    return r.json()
                } )
                .then( function ( obj: any ) {
                    obj.$source = c.$source
                    return obj
                } )
                .catch( function ( e: Error ) {
                    console.warn( 'failed to load config from ' + c.url )
                    e.parseSource = c.$source
                    throw e
                } )
        } ) )
    }

    function mergeConfigs( configs: any[] ) {
        const smk = ( window as any ).SMK
        if ( smk && smk.TYPE && smk.TYPE.mergeConfigs ) {
            Object.assign( self, smk.TYPE.mergeConfigs( configs ) )
        } else {
            // Fallback: merge-config may be pre-registered
            const mc = smk && smk.TYPE && smk.TYPE[ 'merge-config' ]
            if ( mc ) Object.assign( self, mc( configs ) )
        }
    }

    function initMapFrame() {
        $( self.$container )
            .addClass( 'smk-viewer-' + self.viewer.type )

        const themes: string[] = [ 'base' ].concat( self.viewer.themes || [] ).map( ( th: string ) => 'theme-' + th )

        $( self.$container )
            .addClass( themes.map( ( th: string ) => 'smk-' + th ).join( ' ' ) )

        self.detectDevice()

        if ( self.viewer.panelWidth )
            self.setVar( 'panel-width', self.viewer.panelWidth + 'px' )

        // Inject theme CSS via link tags (replaces include(themes) from AMD build)
        return resolved()
    }

    function resolveDeviceConfig() {
        findProperty( self, 'tools', 'enabled', function ( val: any ) {
            if ( typeof val === 'string' ) return val === self.$device
        } )
        findProperty( self, 'tools', 'showTitle', function ( val: any ) {
            if ( typeof val === 'string' ) return val === self.$device
        } )
        findProperty( self, 'tools', 'control', function ( val: any ) {
            if ( typeof val === 'string' ) return val === self.$device
        } )
    }

    function loadViewer() {
        const smk = ( window as any ).SMK
        if ( !smk || !smk.TYPE || !smk.TYPE.Viewer ) {
            throw new Error( 'SMK.TYPE.Viewer is not available' )
        }
        if ( !( self.viewer.type in smk.TYPE.Viewer ) ) {
            throw new Error( 'viewer type "' + self.viewer.type + '" is not defined' )
        }
        return resolved()
    }

    function loadTools() {
        self.$tool     = {}
        self.$toolType = {}

        if ( !self.tools ) return

        const enabledTools = self.tools.filter( ( t: any ) => t.enabled !== false && t.instance !== true )
        if ( enabledTools.length === 0 ) return

        const smk = ( window as any ).SMK

        return waitAll( enabledTools.map( function ( t: any ) {
            const tag     = 'tool-' + t.type
            const factory = smk && smk.TYPE && smk.TYPE[ tag ]

            if ( !factory ) {
                console.warn( 'tool type "' + t.type + '" is not defined, skipping' )
                return resolved()
            }

            try {
                const tools: any[] = factory( t )

                tools.forEach( function ( tool: any ) {
                    if ( !tool.id ) throw new Error( 'tool with no id' )

                    if ( tool.id in self.$tool )
                        throw new Error( 'tool "' + tool.id + '" is defined more than once' )

                    if ( !self.$toolType[ tool.type ] ) self.$toolType[ tool.type ] = []
                    self.$toolType[ tool.type ].push( tool )

                    self.$tool[ tool.id ] = tool
                } )
            } catch ( e ) {
                console.warn( 'Failed to create tool:', e, t )
            }

            return resolved()
        } ) )
    }

    function initViewer() {
        const smkType = ( ( window as any ).SMK || {} ).TYPE || {}

        if ( !smkType.Viewer || !( self.viewer.type in smkType.Viewer ) )
            throw new Error( 'viewer type "' + self.viewer.type + '" not defined' )

        self.$viewer = new smkType.Viewer[ self.viewer.type ]()
        return resolved()
            .then( function () { return self.$viewer.initialize( self ) } )
            .then( function () { return self.$viewer.initializeLayers( self ) } )
    }

    function initTools() {
        const tools = Object.values( self.$tool )
            .sort( ( a: any, b: any ) => a.order - b.order )

        return waitAll( tools.map( function ( t: any ) {
            return resolved()
                .then( function () { return t.initialize( self ) } )
                .catch( function ( e: Error ) {
                    console.error( 'tool "' + t.id + '" failed to initialize:', e )
                } )
                .then( function () {
                    console.log( 'tool "' + t.id + '" initialized' )
                } )
        } ) )
    }

    function initDisplayContext() {
        self.$viewer.initializeDisplayContext()
        return self.$viewer.displayContextInitialized
    }

    function showMap() {
        return resolved()
            .then( function () {
                return self.$viewer.refreshLayers()
                    .catch( function ( e: Error ) { console.warn( e ) } )
            } )
            .then( function () {
                if ( self.viewer.activeTool )
                    self.withTool( self.viewer.activeTool, function ( t: any ) {
                        console.log( 'activating tool:', t.id )
                        t.active = true
                    } )
                return self
            } )
    }
}

SmkMap.prototype.destroy = function () {
    if ( this.$viewer ) this.$viewer.destroy()
    const smkMaps = ( window as any ).SMK && ( window as any ).SMK.MAP
    if ( smkMaps ) delete smkMaps[ this.$option.id ]
}

SmkMap.prototype.addToContainer = function ( html: string, attr?: Record<string, any>, prepend?: boolean ) {
    return $( html )[ prepend ? 'prependTo' : 'appendTo' ]( this.$container ).attr( attr || {} ).get( 0 )
}

SmkMap.prototype.addToOverlay = function ( html: string ) {
    if ( !this.$overlay )
        this.$overlay = this.addToContainer( '<div class="smk-overlay">' )

    return $( html ).appendTo( this.$overlay ).get( 0 )
}

SmkMap.prototype.addToStatus = function ( html: string ) {
    if ( !this.$status )
        this.$status = this.addToOverlay( '<div class="smk-status smk-elastic-container">' )

    return $( html ).appendTo( this.$status ).get( 0 )
}

SmkMap.prototype.getSidepanel = function () {
    const self = this

    if ( this.$sidepanel ) return this.$sidepanel

    const smkType = ( ( window as any ).SMK || {} ).TYPE || {}

    this.$sidepanel = new smkType.Sidepanel( this )

    this.$sidepanel.changedVisible( function () {
        //$( self.$container ).toggleClass( 'smk-sidepanel-active', self.$sidepanel.isPanelVisible() )
        self.$container.classList.toggle( 
            'smk-sidepanel-active', 
            self.$sidepanel.isPanelVisible() 
        );
    } )

    this.$sidepanel.changedSize( function () {} )

    return this.$sidepanel
}

SmkMap.prototype.getSidepanelPosition = function () {
    if ( !this.$sidepanel || !this.$sidepanel.isPanelVisible() )
        return { left: 0, width: 0, top: 0, height: 0 }

    const overlayEl    = this.$overlay
    const sidepanelEl  = this.$sidepanel.vm.$el

    return {
        left:   overlayEl.offsetLeft   + sidepanelEl.offsetLeft,
        top:    overlayEl.offsetTop    + sidepanelEl.offsetTop,
        width:  sidepanelEl.clientWidth,
        height: sidepanelEl.clientHeight,
    }
}

SmkMap.prototype.setEditFocus = function ( focus: boolean ) {
    //$( this.$container ).toggleClass( 'smk-edit-focus', focus )
    this.$container.classList.toggle( 
        'smk-edit-focus', 
        focus 
    );
}

SmkMap.prototype.debugMessage = function ( opt: Record<string, any> ) {
    if ( !this.debugVm ) {
        this.debugVm = new Vue( {
            el: this.addToOverlay( '<div class="smk-debug"><div v-for="k in keys">{{ k }} : {{ status[ k ] }}</div></div>' ),
            data: { status: {} },
            computed: {
                keys( this: any ) { return Object.keys( this.status ) },
            },
        } )
    }

    opt.ts = ( new Date() ).toLocaleTimeString()
    const d = this.debugVm.$data
    Object.keys( opt || {} ).forEach( function ( k: string ) {
        Vue.set( d.status, k, opt[ k ] )
    } )
}

SmkMap.prototype.getVar = function ( cssVar: string ) {
    return $( this.$container ).css( '--' + cssVar )
}

SmkMap.prototype.setVar = function ( cssVar: string, value: string ) {
    return $( this.$container ).css( '--' + cssVar, value )
}

SmkMap.prototype.emit = function ( toolId: string, event: string, arg: any, comp: any ) {
    this.$dispatcher.$emit( toolId + '.' + event, arg, comp )
    return this
}

SmkMap.prototype.on = function ( toolId: string, handler: Record<string, Function> ) {
    const self = this
    Object.keys( handler ).forEach( function ( k: string ) {
        self.$dispatcher.$on( toolId + '.' + k, handler[ k ] )
    } )
    return this
}

SmkMap.prototype.detectDevice = function () {
    let dev = this.viewer.device

    if ( dev === 'auto' ) {
        const w = $( window ).width()
        dev = w >= this.viewer.deviceAutoBreakpoint ? 'desktop' : 'mobile'
    }

    if ( dev === this.$device ) return

    if ( this.$device )
        $( this.$container ).removeClass( 'smk-device-' + this.$device )

    this.$device = dev
    $( this.$container ).addClass( 'smk-device-' + this.$device )

    return this.$device
}

SmkMap.prototype.showFeature = function ( acetate: any, geometry: any, opt: any ) {
    if ( this.$viewer.temporaryFeature )
        this.$viewer.temporaryFeature( acetate, geometry, opt )
}

SmkMap.prototype.getToolGroup  = function ( rootId: string ) { return this.$group[ rootId ] }
SmkMap.prototype.setToolGroup  = function ( rootId: string, ids: string[] ) { this.$group[ rootId ] = ids }
SmkMap.prototype.getToolRootIds = function () { return Object.keys( this.$group ) }

SmkMap.prototype.getConfig = function () {
    const self = this

    const ks = [ 'name', 'viewer', 'tools' ]

    const cfg: any = ks.reduce( function ( acc: any, k: string ) {
        acc[ k ] = JSON.parse( JSON.stringify( self[ k ] ) )
        return acc
    }, {} )

    cfg.layers = this.$viewer.getLayerConfig()

    const { projection } = require( './util' )
    cfg.viewer.location = projection( 'center', 'zoom', 'extent' )( this.$viewer.getView() )
    cfg.viewer.location.center = [ cfg.viewer.location.center.longitude, cfg.viewer.location.center.latitude ]

    cfg.viewer.displayContext = this.$viewer.getDisplayContextConfig()

    cfg.layers.forEach( function ( ly: any ) {
        const item = self.$viewer.getDisplayContextItem( ly.id )
        if ( item ) {
            ly.isVisible = self.$viewer.isDisplayContextItemVisible( ly.id )
            ly.class     = item.class
        } else {
            ly.isVisible = false
        }
    } )

    return cfg
}

SmkMap.prototype.updateMapSize = function () {
    if ( this.$viewer.mapResized ) this.$viewer.mapResized()
}

SmkMap.prototype.getStatusMessage = function () {
    if ( this.$statusMessage ) return this.$statusMessage
    const smkType = ( ( window as any ).SMK || {} ).TYPE || {}
    this.$statusMessage = new smkType.StatusMessage( this )
    return this.$statusMessage
}

SmkMap.prototype.getToolById      = function ( id?: string )   { if ( !id ) return; return this.$tool[ id ] }
SmkMap.prototype.getToolsByType   = function ( type?: string ) { if ( !type ) return []; return this.$toolType[ type ] || [] }
SmkMap.prototype.hasToolType      = function ( type?: string ) { if ( !type ) return false; return !!this.$toolType[ type ] && this.$toolType[ type ].length > 0 }

SmkMap.prototype.getToolTypesAvailable = function ( types?: string[] ) {
    const self = this

    if ( !types || !Array.isArray( types ) || types.length === 0 )
        types = Object.keys( this.$toolType )

    return types.reduce( function ( acc: any, t: string ) {
        acc[ t ] = self.hasToolType( t )
        return acc
    }, {} )
}

SmkMap.prototype.forEachTool = function ( cb: Function ) {
    return Object.values( this.$tool ).forEach( cb as any )
}

SmkMap.prototype.withTool = function ( toolIdOrType: string, action: Function, context?: any ) {
    const self = this

    if ( !toolIdOrType ) throw new Error( 'no tool id or type' )

    let tool = this.getToolById( toolIdOrType )
    if ( tool ) {
        action.call( context || tool, tool )
        return
    }

    const tools: any[] = this.getToolsByType( toolIdOrType )
    if ( tools.length === 0 ) throw new Error( 'tool type not defined' )
    if ( tools.length === 1 ) {
        action.call( context || tools[ 0 ], tools[ 0 ] )
        return
    }

    const rootId: string | null = tools.reduce( function ( acc: any, t: any ) {
        if ( acc === undefined ) return t.rootId
        if ( acc === t.rootId )  return acc
        return null
    }, undefined )

    if ( !rootId ) throw new Error( 'tool type is ambiguous' )

    tool = this.getToolById( rootId )
    action.call( context || tool, tool )
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function findProperty(
    obj: any,
    collectionName: string,
    propName: string,
    cb: ( val: any ) => any,
) {
    if ( !( collectionName in obj ) )
        throw new Error( collectionName + ' is not in obj' )

    if ( !Array.isArray( obj[ collectionName ] ) )
        throw new Error( collectionName + ' is not an array' )

    obj[ collectionName ].forEach( function ( item: any ) {
        if ( !( propName in item ) ) return

        const res = cb( item[ propName ] )
        if ( res === undefined ) return

        item[ propName ] = res
    } )
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = ( window as any ).SMK
    if ( smk && smk.TYPE ) smk.TYPE.SmkMap = SmkMap
}

export default SmkMap
