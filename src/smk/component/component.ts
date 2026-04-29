/**
 * component — base Vue 2 component objects for SMK.
 * Converted from component/component.js (include.module -> ES module).
 */

import formatLinkHtml from './format-link.html?raw'
import toolWidgetHtml from './tool-widget.html?raw'
import { templateReplace } from '../util'
import { SMK } from '../smk-ref'

declare const Vue: any

// ---------------------------------------------------------------------------
// FeatureBase — base mixin for feature display components
// ---------------------------------------------------------------------------

export const FeatureBase: any = {
    props: [ 'feature', 'layer', 'showHeader', 'attributes' ],
    created( this: any ) {
        const smk = SMK
        if ( smk && smk.HANDLER && smk.HANDLER.has( 'IdentifyFeatureTool', 'attribute-replacer-context' ) ) {
            const rep = smk.HANDLER.get( 'IdentifyFeatureTool', 'attribute-replacer-context' )
            this.replacerContext = rep.call( this, this.layer.id )
        } else {
            this.replacerContext = function ( token: string ) {
                /* eslint-disable no-eval */
                return eval( token )
            }
        }
    },
    methods: {
        insertWordBreaks( str: string ) {
            return str.replace( /[^a-z0-9 ]+/ig, ( m ) => '<wbr>' + m )
        },
        formatValue( val: any ) {
            if ( /^https?[:][/]{2}[^/]/.test( ( '' + val ).trim() ) ) {
                return '<a href="' + val + '" target="_blank">Open in new window</a>'
            }
            return val
        },
        formatAttribute( this: any, attr: any ) {
            const m = attr.format.match( /^(.+)[(](.+)[)]$/ )
            if ( !m ) {
                const value = this.evalTemplate( attr.value )
                return formatter[ attr.format ]( Object.assign( {}, attr, { value } ), this.feature, this.layer )()
            }
            return formatter[ m[ 1 ] ]( attr, this.feature, this.layer ).apply( this, eval( '[' + m[ 2 ] + ']' ) )
        },
        formatTitle( this: any, attr: any ) {
            const title = this.evalTemplate( attr.title )
            return this.insertWordBreaks( title )
        },
        evalTemplate( this: any, templ: string ) {
            const self = this
            return templateReplace( templ, function ( token: string ) {
                return self.replacerContext( token )
            } )
        }
    }
}

// ---------------------------------------------------------------------------
// makeFormatter helper
// ---------------------------------------------------------------------------

function makeFormatter( template: string, input?: ( ...args: any[] ) => any ) {
    const component = Vue.extend( { template } )
    const formatInput = input || function () { return {} }
    return function ( attribute: any, feature: any, layer: any ) {
        return function ( ...args: any[] ) {
            const inp = formatInput.apply( null, args )
            const c1 = Vue.extend( {
                extends: component,
                data() {
                    return Object.assign( { attribute, feature, layer }, inp )
                }
            } )
            return new c1().$mount().$el.outerHTML
        }
    }
}

const formatter: Record<string, ReturnType<typeof makeFormatter>> = {
    simple:           makeFormatter( '<span class="smk-value" v-if="attribute.value">{{ attribute.value }}</span>' ),
    HTML:             makeFormatter( '<span class="smk-value" v-if="attribute.value" v-html="attribute.value"></span>' ),
    asLocalTimestamp: makeFormatter( '<span class="smk-value" v-if="attribute.value">{{ ( new Date( attribute.value ) ).toLocaleString() }}</span>' ),
    asLocalDate:      makeFormatter( '<span class="smk-value" v-if="attribute.value">{{ ( new Date( attribute.value ) ).toLocaleDateString() }}</span>' ),
    asLocalTime:      makeFormatter( '<span class="smk-value" v-if="attribute.value">{{ ( new Date( attribute.value ) ).toLocaleTimeString() }}</span>' ),
    asUnit:           makeFormatter(
        '<span class="smk-value" v-if="attribute.value">{{ attribute.value }} <span class="smk-unit">{{ unit }}</span></span>',
        ( unit: string ) => ( { unit } )
    ),
    asLink:           makeFormatter( formatLinkHtml, ( url: string, label: string ) => ( { url, label } ) ),
    asHTML:           makeFormatter( '<span class="smk-value" v-if="html" v-html="html"></span>', ( html: string ) => ( { html } ) ),
}

// ---------------------------------------------------------------------------
// Component mixins
// ---------------------------------------------------------------------------

export const ToolEmit: any = {
    methods: {
        $$emit( this: any, event: string, arg: any ) {
            this.$root.trigger( this.id, event, arg, this )
        }
    }
}

export const ToolBase: any = {
    mixins: [ ToolEmit ],
    props: {
        id:        String,
        type:      String,
        title:     String,
        status:    String,
        active:    Boolean,
        enabled:   Boolean,
        visible:   Boolean,
        group:     Boolean,
        showTitle: Boolean,
        icon:      String,
    },
    computed: {
        baseClasses( this: any ) {
            const c: Record<string, boolean> = {
                'smk-tool-active':   this.active,
                'smk-tool-visible':  this.visible,
                'smk-tool-enabled':  this.enabled,
            }
            c[ 'smk-tool-' + this.id ] = true
            if ( this.status )
                c[ 'smk-tool-status-' + this.status ] = true
            return c
        }
    }
}

const componentProps: Record<string, any> = {}

export const ToolPanelBase: any = {
    extends: ToolBase,
    props: {
        showPanel:   Boolean,
        showHeader:  Boolean,
        showSwipe:   Boolean,
        busy:        Boolean,
        expand:      Number,
        hasPrevious: Boolean,
        parentId:    String,
    },
    computed: {
        classes( this: any ) {
            return this.baseClasses
        }
    },
    methods: {
        $$projectProps( this: any, componentName: string ) {
            if ( !componentProps[ componentName ] ) {
                const { projection } = require( '../util' )
                componentProps[ componentName ] = projection.apply(
                    null,
                    Object.keys( ( new ( Vue.component( componentName ) )() )._props )
                )
            }
            return componentProps[ componentName ]( this.$props )
        }
    }
}

export const ToolWidgetBase: any = {
    extends: ToolBase,
    template: toolWidgetHtml,
    props: {
        showWidget: Boolean,
    },
    computed: {
        classes( this: any ) {
            const c = this.baseClasses
            c[ 'smk-tool-title' ] = this.showTitle
            return c
        }
    }
}

// ---------------------------------------------------------------------------
// Register on window.SMK.COMPONENT for backward compat
// ---------------------------------------------------------------------------

export function setupComponents(): void {
    const smkRef = SMK
    if ( !smkRef ) return
    if ( !smkRef.COMPONENT ) smkRef.COMPONENT = {}

    smkRef.COMPONENT.FeatureBase    = FeatureBase
    smkRef.COMPONENT.ToolEmit       = ToolEmit
    smkRef.COMPONENT.ToolBase       = ToolBase
    smkRef.COMPONENT.ToolPanelBase  = ToolPanelBase
    smkRef.COMPONENT.ToolWidgetBase = ToolWidgetBase
}

// Auto-register on module load so sub-component imports can extend these base components
if ( typeof window !== 'undefined' ) {
    setupComponents()
}

export default setupComponents
