/**
 * SMK Bootstrap
 *
 * TypeScript replacement for src/smk.js (the AMD-based IIFE).
 *
 * Key differences from the original:
 *  - No AMD `include()` / `include.option()` calls.
 *  - `initializeSmkMap()` instantiates `SMK.TYPE.SmkMap` directly (it is
 *    already registered by smk-map.ts which is imported before this module
 *    in main.ts).
 *  - Build info is injected at compile time via Vite's `define` option
 *    instead of Grunt template strings.
 *  - `setupGlobalSMK()` mutates the existing `window.SMK` object in place
 *    rather than replacing it, so references held by other modules remain
 *    valid.
 *
 * Import order in main.ts matters: this file must be imported LAST so that
 * all viewer/tool/layer modules have already registered themselves on
 * `window.SMK.TYPE.*` before the async init chain begins.
 */

// Build-time constants injected by vite.config.js via `define`
declare const __SMK_COMMIT__:      string
declare const __SMK_BRANCH__:      string
declare const __SMK_LAST_COMMIT__: string
declare const __SMK_ORIGIN__:      string
declare const __SMK_VERSION__:     string

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AddParseFn = ( source: string, getParse: () => any ) => boolean | undefined

interface SmkAttr {
    id:           string | number
    containerSel: string | null
    config:       string[]
    baseUrl:      string
    parsedConfig: any[]
}

// ---------------------------------------------------------------------------
// ON_FAILURE — show a red error overlay inside the map container
// ---------------------------------------------------------------------------

const ON_FAILURE_STYLE_ID = 'smk-on-failure-style'
const ON_FAILURE_STYLE = [
    '.smk-failure {',
        'box-shadow: inset 0px 0px 25px -1px #cc0000;',
        'background-color: white;',
        'font-family: sans-serif;',
        'position: absolute;',
        'top: 0;',
        'left: 0;',
        'right: 0;',
        'bottom: 0;',
        'padding: 20px;',
        'display: flex;',
        'flex-direction: column;',
        'align-items: stretch;',
        'justify-content: center;',
    '}',
    '.smk-failure h1 { margin: 0; }',
    '.smk-failure h2 { margin: 0; font-size: 1.2em; }',
    '.smk-failure p { font-size: 1.1em; }',
].join( '' )

function onFailure( err: Error, el?: Element | null ): void {
    if ( ( err as any ).parseSource )
        err.message += ', while parsing ' + ( err as any ).parseSource

    console.error( err )

    const message = document.createElement( 'div' )
    message.classList.add( 'smk-failure' )
    message.innerHTML =
        '<h1>Simple Map Kit</h1>' +
        '<h2>Initialization of SMK failed</h2>' +
        '<p>' + err + '</p>'

    if ( !el )
        el = document.querySelector( 'body' )

    el!.appendChild( message )

    if ( !document.getElementById( ON_FAILURE_STYLE_ID ) ) {
        const style = document.createElement( 'style' )
        style.id          = ON_FAILURE_STYLE_ID
        style.textContent = ON_FAILURE_STYLE
        document.getElementsByTagName( 'head' )[ 0 ].appendChild( style )
    }
}

// ---------------------------------------------------------------------------
// setupGlobalSMK — initialise window.SMK with all defaults
// ---------------------------------------------------------------------------

function setupGlobalSMK(): void {
    const smk = window.SMK as any

    // INIT / failure-display are always set (may already exist on first run)
    smk.INIT       = SmkInit
    smk.ON_FAILURE = onFailure

    if ( !smk.MAP )       smk.MAP       = {}
    if ( !smk.VIEWER )    smk.VIEWER    = {}
    if ( !smk.TYPE )      smk.TYPE      = {}
    if ( !smk.UTIL )      smk.UTIL      = {}
    if ( !smk.COMPONENT ) smk.COMPONENT = {}

    if ( !smk.CONFIG )
        smk.CONFIG = {
            name: 'SMK Default Map',
            viewer: {
                type:                 'leaflet',
                device:               'auto',
                deviceAutoBreakpoint: 500,
                themes:               [],
                location: {
                    extent: [ -139.1782, 47.6039, -110.3533, 60.5939 ],
                },
                baseMap:        'bc-roads-raster',
                clusterOption:  { showCoverageOnHover: false },
                zoomSnap:       1,
                displayContext: [],
                baseMapConfig:  [],
            },
            tools: [
                { type: 'pan' },
                { type: 'actionbar', enabled: true },
                { type: 'zoom',      mouseWheel: true, doubleClick: true, box: true, control: true, position: 'actionbar' },
                { type: 'reset-view', position: 'actionbar' },
                { type: 'scale', showFactor: true, showBar: true },
                { type: 'coordinate' },
                { type: 'toolbar',  enabled: true },
                { type: 'about',    enabled: true, position: 'toolbar', icon: 'help' },
                { type: 'baseMaps', enabled: true, position: 'toolbar', icon: 'map', mapStyle: { width: '110px', height: '110px' } },
                { type: 'search',   enabled: true, position: 'toolbar', icon: 'search' },
                { type: 'identify', enabled: true, position: 'toolbar', icon: 'info_outline' },
                { type: 'layers',   enabled: true, position: 'toolbar', icon: 'layers' },
                { type: 'menu',     enabled: true, position: 'toolbar', icon: 'menu' },
            ],
        }

    if ( !smk.BOOT ) smk.BOOT = Promise.resolve()
    smk.TAGS_DEFINED = false

    smk.BUILD = {
        commit:     __SMK_COMMIT__,
        branch:     __SMK_BRANCH__,
        lastCommit: __SMK_LAST_COMMIT__,
        origin:     __SMK_ORIGIN__,
        version:    __SMK_VERSION__,
    }

    // Always install the full HANDLER (main.ts only stubs it with has/get)
    smk.HANDLER = {
        handler: {} as Record<string, Record<string, Function>>,
        set( id: string, method: string, handler: Function ) {
            if ( !this.handler[ id ] ) this.handler[ id ] = {}
            this.handler[ id ][ method ] = handler
        },
        get( id: string, method: string ): Function {
            if ( this.handler[ id ] && this.handler[ id ][ method ] )
                return this.handler[ id ][ method ]
            return function () {
                console.warn( 'handler ' + id + '.' + method + ' invoked' )
            }
        },
        has( id: string, method: string ): boolean {
            return !!( this.handler[ id ] && this.handler[ id ][ method ] )
        },
    }

    if ( !smk.PROJECTIONS )
        smk.PROJECTIONS = [
            {
                name: 'urn:ogc:def:crs:EPSG::3005',
                def:  '+proj=aea +lat_1=50 +lat_2=58.5 +lat_0=45 +lon_0=-126 +x_0=1000000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=m +no_defs',
            },
            {
                name:  'bc-albers',
                alias: 'urn:ogc:def:crs:EPSG::3005',
            },
        ]

    if ( !smk.TYPE.Viewer ) smk.TYPE.Viewer = {}
    if ( !smk.TYPE.Layer )  smk.TYPE.Layer  = {}
}

// ---------------------------------------------------------------------------
// IE11 guard — must run before setupGlobalSMK so the error is surfaced early
// ---------------------------------------------------------------------------

if ( navigator.userAgent.indexOf( 'MSIE ' ) > -1 || navigator.userAgent.indexOf( 'Trident/' ) > -1 ) {
    const ie11Err = new Error( 'SMK will not function in Internet Explorer 11.' )

    const scripts = document.getElementsByTagName( 'script' )
    let scriptEl: HTMLScriptElement | null = null

    let stack: string | undefined
    try {
        // Intentional reference error to capture the current stack and
        // locate this script element among document.scripts.
        // @ts-expect-error  omgwtf is intentionally undefined
        omgwtf  // eslint-disable-line no-undef
    } catch ( e: any ) {
        stack = e.stack
    }

    if ( stack ) {
        const entries = stack.split( /\s+at\s+/ )
        const last    = entries[ entries.length - 1 ]
        const m       = last.match( /[(](.+?)(?:[:]\d+)+[)]/ )
        if ( m ) {
            for ( let i = 0; i < scripts.length; i++ ) {
                if ( scripts[ i ].src !== m[ 1 ] ) continue
                scriptEl = scripts[ i ]
                break
            }
        }
    }

    ;( window.SMK as any ).INIT = function ( option: Record<string, any> ) {
        const containerSelector = option.containerSel || option[ 'smk-container-sel' ]
        setTimeout( () => {
            onFailure( ie11Err, document.querySelector( containerSelector ) )
        }, 2000 )
    }

    if ( scriptEl && scriptEl.attributes.getNamedItem( 'smk-container-sel' ) ) {
        ;( window.SMK as any ).INIT( { containerSel: scriptEl.attributes.getNamedItem( 'smk-container-sel' )!.value } )
    }

    ;( window.SMK as any ).FAILURE = ie11Err
    throw ie11Err
}

// ---------------------------------------------------------------------------
// Main bootstrap — runs synchronously when the module is first evaluated
// ---------------------------------------------------------------------------

try {
    setupGlobalSMK()

    // Required by ESRI 3D viewer. Preserve any dojoConfig already set by the
    // host page — it must be configured (with the correct fcl package location)
    // BEFORE the ArcGIS JS API script loads and Dojo initialises.
    if ( !window.dojoConfig ) {
        window.dojoConfig = {
            packages: [ { name: 'fcl' } ],
            has: { 'esri-promise-compatibility': 1 },
        }
    }

    // Determine base URL from the <script> element that loaded this bundle.
    // document.currentScript is available for synchronously-executed scripts
    // (UMD bundles). It is null for ES modules loaded with type="module",
    // which can use import.meta.url instead.
    const scriptEl = document.currentScript as HTMLScriptElement | null
    const bundleUrl: string | undefined =
        scriptEl?.src ||
        ( typeof ( import.meta as any ).url === 'string' ? ( import.meta as any ).url : undefined )

    if ( !( window.SMK as any ).BASE_URL && bundleUrl ) {
        const path = bundleUrl.replace( /([/]?)[^/?]+([?].+)?$/, ( _m, a: string ) => a )
        ;( window.SMK as any ).BASE_URL = new URL( path, document.location.href ).toString()
        console.debug( 'Default base path from', bundleUrl, 'is', ( window.SMK as any ).BASE_URL )
    }

    // Auto-init: if the <script> tag has a smk-container-sel attribute, wire
    // up the map immediately and block manual SMK.INIT calls.
    if ( scriptEl && scriptEl.attributes.getNamedItem( 'smk-container-sel' ) ) {
        const sel = scriptEl.attributes.getNamedItem( 'smk-container-sel' )!.value

        ;( window.SMK as any ).INIT = function () {
            ;( window.SMK as any ).BOOT = ( ( window.SMK as any ).BOOT || Promise.resolve() )
                .then( () => {
                    const e = new Error( 'Cannot call SMK.INIT if map initialized from <script> element' )
                    onFailure( e, document.querySelector( sel ) )
                    throw e
                } )
            return ( window.SMK as any ).BOOT
        }

        SmkInit( null, scriptEl )
    }
} catch ( e: any ) {
    ;( window.SMK as any ).FAILURE = e
    throw e
}

// ---------------------------------------------------------------------------
// SmkInit — create a map instance from options / script element attributes
// ---------------------------------------------------------------------------

function SmkInit(
    option:   Record<string, any> | null,
    scriptEl?: HTMLScriptElement | null,
): Promise<any> {
    const smk = window.SMK as any

    if ( smk.FAILURE ) throw smk.FAILURE

    const attr: Partial<SmkAttr> = {}

    function defineAttr(
        name:      string,
        attrName:  string,
        defaultFn: () => any       = () => undefined,
        filterFn:  ( v: any ) => any = ( v ) => v,
    ): void {
        const scriptVal = scriptEl && scriptEl.attributes.getNamedItem( attrName )?.value
        const optionVal = option && ( ( option as any )[ attrName ] || ( option as any )[ name ] )

        let valFn: ( () => any ) | null = () => {
            if ( optionVal ) {
                console.debug( 'attr', name, 'from INIT arguments:', optionVal )
                return optionVal
            }
            if ( scriptVal ) {
                console.debug( 'attr', name, 'from script element attribute:', scriptVal )
                return scriptVal
            }
            const d = defaultFn()
            console.debug( 'attr', name, 'from default:', d )
            return d
        }

        let val: any
        Object.defineProperty( attr, name, {
            get() {
                if ( valFn ) val = filterFn( valFn() )
                valFn = null
                return val
            },
        } )
    }

    defineAttr( 'id', 'smk-id', () => Object.keys( smk.MAP ).length + 1 )
    defineAttr( 'containerSel', 'smk-container-sel' )
    defineAttr( 'config', 'smk-config', () => '?smk-', ( val ) => {
        if ( typeof val === 'string' )
            return val.split( /\s*[|]\s*/ ).filter( ( i: string ) => !!i )
        return val
    } )
    defineAttr( 'baseUrl', 'smk-base-url', () => smk.BASE_URL )

    const timer = 'SMK "' + ( attr as any ).id + '" initialize'
    console.time( timer )
    console.groupCollapsed( timer )

    smk.BOOT = ( smk.BOOT || Promise.resolve() )
        .then( () => ( attr as any ).config )
        .then( ( config: string[] ) => parseConfig( config ) )
        .then( ( parsedConfig: any[] ) => {
            ;( attr as any ).parsedConfig = parsedConfig
            return initializeSmkMap( attr as SmkAttr )
        } )
        .catch( ( e: Error ) => {
            try {
                onFailure( e, document.querySelector( ( attr as any ).containerSel ) )
            } catch ( ee ) {
                console.error( 'failure showing failure:', ee )
            }
            throw e
        } )
        .finally( () => {
            console.groupEnd()
            console.timeEnd( timer )
        } )

    return smk.BOOT
}

// ---------------------------------------------------------------------------
// parseConfig and helpers
// ---------------------------------------------------------------------------

function parseConfig( config: string[] ): any[] {
    return config.reduce( ( acc: any[], c: any, i: number ) => {
        const addParse: AddParseFn = ( source, getParse ) => {
            source += ' in config[' + i + ']'
            try {
                const parse = getParse()
                if ( !parse ) return true
                parse.$source = source
                acc.push( parse )
                return true
            } catch ( e: any ) {
                if ( !e.parseSource ) e.parseSource = source
                throw e
            }
        }

        if ( parseObject( c, addParse ) )            return acc
        if ( parseDocumentArguments( c, addParse ) ) return acc
        if ( parseLiteralJson( c, addParse ) )       return acc
        if ( parseOption( c, addParse ) )            return acc
        if ( parseUrl( c, addParse ) )               return acc

        return acc
    }, [] )
}

function parseObject( config: any, addParse: AddParseFn ): boolean | undefined {
    if ( typeof config !== 'object' || Array.isArray( config ) || config === null ) return
    return addParse( 'object', () => ( { obj: config } ) )
}

function parseDocumentArguments( config: string, addParse: AddParseFn ): boolean | undefined {
    if ( !/^[?]/.test( config ) ) return

    const paramPattern = new RegExp( '^' + config.substring( 1 ) + '(.+)$', 'i' )
    const params       = location.search.substring( 1 ).split( '&' )

    params.forEach( ( p, i ) => {
        const addParamParse: AddParseFn = ( source, getParse ) =>
            addParse( source + ' in arg[' + config + ',' + i + ']', getParse )

        let m: RegExpMatchArray | null
        try {
            m = decodeURIComponent( p ).match( paramPattern )
        } catch {
            return
        }
        if ( !m ) return

        parseOption( m[ 1 ], addParamParse )
    } )

    return true
}

function parseLiteralJson( config: string, addParse: AddParseFn ): boolean | undefined {
    if ( !/^[{].+[}]$/.test( config ) ) return
    return addParse( 'json', () => ( { obj: JSON.parse( config ) } ) )
}

function parseOption( config: string, addParse: AddParseFn ): boolean | undefined {
    const m = config.match( /^(.+?)([=](.+))?$/ )
    if ( !m ) return

    const option = m[ 1 ].toLowerCase()
    if ( !( option in optionHandler ) ) return

    return addParse( 'option[' + option + ']', () => {
        const res = ( optionHandler as any )[ option ]( m[ 3 ], ( source: string, getParse: () => any ) =>
            addParse( source + ' in option[' + option + ']', getParse ),
        )
        if ( res ) return { obj: res }
    } )
}

function parseUrl( config: string, addParse: AddParseFn ): boolean | undefined {
    return addParse( 'url[' + config + ']', () => ( { url: config } ) )
}

// ---------------------------------------------------------------------------
// optionHandler — handles -viewer, -extent, -center, -theme, etc. options
// ---------------------------------------------------------------------------

const optionHandler: Record<string, ( arg: string, addParse?: AddParseFn ) => any> = {

    config( arg, addParse ) {
        if ( parseLiteralJson( arg, addParse! ) ) return
        if ( parseUrl( arg, addParse! ) ) return
    },

    theme( arg ) {
        const args = arg.split( ',' )
        if ( args.length !== 1 ) throw new Error( '-theme needs at least 1 argument' )
        return { viewer: { themes: args } }
    },

    device( arg ) {
        const args = arg.split( ',' )
        if ( args.length !== 1 ) throw new Error( '-device needs 1 argument' )
        return { viewer: { device: args[ 0 ] } }
    },

    extent( arg ) {
        const args = arg.split( ',' )
        if ( args.length !== 4 ) throw new Error( '-extent needs 4 arguments' )
        return { viewer: { location: { extent: args, center: null, zoom: null } } }
    },

    center( arg ) {
        const args = arg.split( ',' )
        if ( args.length < 2 || args.length > 3 ) throw new Error( '-center needs 2 or 3 arguments' )
        const loc: any = { center: [ args[ 0 ], args[ 1 ] ] }
        if ( args[ 2 ] ) loc.zoom = args[ 2 ]
        return { viewer: { location: loc } }
    },

    viewer( arg ) {
        return { viewer: { type: arg } }
    },

    'active-tool'( arg ) {
        const args = arg.split( ',' )
        if ( args.length !== 1 && args.length !== 2 ) throw new Error( '-active-tool needs 1 or 2 arguments' )
        let toolId = args[ 0 ]
        if ( args[ 1 ] ) toolId += '--' + args[ 1 ]
        return { viewer: { activeTool: toolId } }
    },

    query( arg ) {
        const args    = arg.split( ',' )
        if ( args.length < 3 && args.length !== 1 ) throw new Error( '-query needs at least 3 arguments, or exactly 1' )

        const queryId = 'makeshift'
        const layerId = args[ 0 ]

        if ( args.length === 1 )
            return {
                viewer: { activeTool: 'QueryParametersTool--' + layerId + '--' + queryId },
                tools: [
                    { type: 'query', instance: layerId + '--' + queryId, enabled: true, position: 'toolbar', command: { attributeMode: true }, onActivate: 'execute' },
                    { type: 'toolbar', enabled: true },
                ],
                layers: [ {
                    id:      layerId,
                    queries: [ {
                        id:          queryId,
                        title:       'Querying ' + layerId,
                        description: 'Created using: ' + arg,
                        parameters:  [ { id: 'p1', type: 'constant', value: 1 } ],
                        predicate:   { operator: 'equals', arguments: [ { operand: 'parameter', id: 'p1' }, { operand: 'parameter', id: 'p1' } ] },
                    } ],
                } ],
            }

        const conj = args[ 1 ].trim().toLowerCase()
        if ( conj !== 'and' && conj !== 'or' ) throw new Error( '-query conjunction must be one of: AND, OR' )

        const opName: Record<string, string> = {
            '~':  ' contains',
            '^~': ' starts with',
            '$~': ' ends with',
            '=':  ' is equal to',
            '>':  ' is greater than',
            '<':  ' is less than',
            '>=': ' is greater than or equal to',
            '<=': ' is less than or equal to',
        }
        const parameters: any[] = []

        function parameter( value: string, op: string, field: string ): string {
            const id = 'p' + ( parameters.length + 1 )
            if ( value === '?' )
                parameters.push( { id, type: 'input',         title: field + opName[ op ] } )
            else if ( value === '@' )
                parameters.push( { id, type: 'select-unique', title: field + opName[ op ], uniqueAttribute: field } )
            else
                parameters.push( { id, type: 'constant',      value: JSON.parse( value ) } )
            return id
        }

        const clauses = args.slice( 2 ).map( ( p ) => {
            const m = p.trim().match( /^(\w+)\s*([$^]?~|=|<=?|>=?)\s*(.+?)$/ )
            if ( !m ) throw new Error( '-query expression is invalid' )

            const clauseArgs = [
                { operand: 'attribute', name:  m[ 1 ] },
                { operand: 'parameter', id:    parameter( m[ 3 ], m[ 2 ], m[ 1 ] ) },
            ]

            switch ( m[ 2 ].toLowerCase() ) {
                case '~':  return { operator: 'contains',     arguments: clauseArgs }
                case '^~': return { operator: 'starts-with',  arguments: clauseArgs }
                case '$~': return { operator: 'ends-with',    arguments: clauseArgs }
                case '=':  return { operator: 'equals',       arguments: clauseArgs }
                case '>':  return { operator: 'greater-than', arguments: clauseArgs }
                case '<':  return { operator: 'less-than',    arguments: clauseArgs }
                case '>=': return { operator: 'not', arguments: [ { operator: 'less-than',     arguments: clauseArgs } ] }
                case '<=': return { operator: 'not', arguments: [ { operator: 'greater-than',  arguments: clauseArgs } ] }
            }
        } )

        return {
            viewer: { activeTool: 'QueryParametersTool--' + layerId + '--' + queryId },
            tools: [
                { type: 'query', instance: layerId + '--' + queryId, enabled: true, position: 'toolbar', command: { attributeMode: true }, onActivate: 'execute' },
                { type: 'toolbar', enabled: true },
            ],
            layers: [ {
                id:      layerId,
                queries: [ {
                    id:          queryId,
                    title:       'Querying ' + layerId,
                    description: 'Created using: ' + arg,
                    parameters,
                    predicate:   { operator: conj, arguments: clauses },
                } ],
            } ],
        }
    },

    layer( arg ) {
        const args    = arg.split( ',' )
        if ( args.length < 2 ) throw new Error( '-layer needs at least 2 arguments' )

        const layerId = 'layer-' + arg.replace( /[^a-z0-9]+/ig, '-' ).replace( /(^[-]+)|([-]+$)/g, '' ).toLowerCase()
        const type    = args[ 0 ].trim().toLowerCase()

        switch ( type ) {
            case 'esri-dynamic':
                if ( args.length < 3 ) throw new Error( '-layer=esri-dynamic needs at least 3 arguments' )
                return { layers: [ { id: layerId, type: 'esri-dynamic', isVisible: true, serviceUrl: args[ 1 ], mpcmId: args[ 2 ], title: args[ 3 ] || ( 'ESRI Dynamic ' + args[ 2 ] ) } ] }

            case 'wms':
                if ( args.length < 3 ) throw new Error( '-layer=wms needs at least 3 arguments' )
                return { layers: [ { id: layerId, type: 'wms', isVisible: true, serviceUrl: args[ 1 ], layerName: args[ 2 ], styleName: args[ 3 ], title: args[ 4 ] || ( 'WMS ' + args[ 2 ] ) } ] }

            case 'vector':
                return { layers: [ { id: layerId, type: 'vector', isVisible: true, dataUrl: args[ 1 ], title: args[ 2 ] || ( 'Vector ' + args[ 1 ] ) } ] }

            default: throw new Error( 'unknown layer type: ' + type )
        }
    },

    'show-tool'( arg ) {
        const args = arg.split( ',' )
        if ( args.length < 1 ) throw new Error( '-show-tool needs at least 1 argument' )
        return { tools: args.map( ( type ) => ( { type: type === 'all' ? '*' : type, enabled: true } ) ) }
    },

    'hide-tool'( arg ) {
        const args = arg.split( ',' )
        if ( args.length < 1 ) throw new Error( '-hide-tool needs at least 1 argument' )
        return { tools: args.map( ( type ) => ( { type: type === 'all' ? '*' : type, enabled: false } ) ) }
    },

    'show-layer'( arg ) {
        const args = arg.split( ',' )
        if ( args.length < 1 ) throw new Error( '-show-layer needs at least 1 argument' )
        return { layers: args.map( ( id ) => ( { id: id === 'all' ? '**' : id, isVisible: true } ) ) }
    },

    'hide-layer'( arg ) {
        const args = arg.split( ',' )
        if ( args.length < 1 ) throw new Error( '-hide-layer needs at least 1 argument' )
        return { layers: args.map( ( id ) => ( { id: id.toLowerCase() === 'all' ? '**' : id, isVisible: false } ) ) }
    },

    storage( arg ) {
        const args = arg.split( ',' )
        if ( args.length < 1 ) throw new Error( '-storage needs at least 1 argument' )
        return args.map( ( key ) => JSON.parse( window.sessionStorage.getItem( key ) as string ) )
    },

    // Backward compatibility with DMF

    ll( arg ) {
        const args = arg.split( ',' )
        if ( args.length !== 2 ) throw new Error( '-ll needs 2 arguments' )
        return { viewer: { location: { center: [ args[ 0 ], args[ 1 ] ] } } }
    },

    z( arg ) {
        const args = arg.split( ',' )
        if ( args.length !== 1 ) throw new Error( '-z needs 1 argument' )
        return { viewer: { location: { zoom: args[ 0 ] } } }
    },

}

// ---------------------------------------------------------------------------
// initializeSmkMap — replaces the AMD include('smk-map') call
// ---------------------------------------------------------------------------

function initializeSmkMap( attr: SmkAttr ): Promise<any> {
    const smk = window.SMK as any

    if ( attr.id in smk.MAP )
        throw new Error( 'An SMK map with smk-id "' + attr.id + '" already exists' )

    console.log( 'Creating map "' + attr.id + '":', JSON.parse( JSON.stringify( attr ) ) )

    const map = smk.MAP[ attr.id ] = new smk.TYPE.SmkMap( attr )
    return map.initialize()
}
