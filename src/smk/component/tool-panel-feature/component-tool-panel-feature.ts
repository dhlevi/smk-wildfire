/**
 * component-tool-panel-feature — panel for displaying a single feature's details.
 */
import template from './component-tool-panel-feature.html?raw'
declare const Vue: any

Vue.component( 'tool-panel-feature', {
    extends: ( window as any ).SMK?.COMPONENT?.ToolPanelBase,
    template,
    props: [
        'feature',
        'layer',
        'attributeComponent',
        'tool',
        'resultPosition',
        'resultCount',
        'instance',
        'command',
        'attributeMode',
    ],
    computed: {
        attributes( this: any ): any[] {
            const ft = this.feature
            if ( !this.layer.attributes ) return []
            return this.layer.attributes
                .filter( ( at: any ) => at.visible !== false )
                .map( ( at: any ) => ( {
                    id:     at.name || at.title,
                    name:   at.name,
                    title:  at.title,
                    value:  at.name ? ft.properties[ at.name ] : at.value,
                    format: at.format || 'simple',
                } ) )
        },
        customLabel( this: any ): any {
            if ( !this.command?.custom ) return false
            return ( window as any ).SMK?.HANDLER?.get( this.id, 'show-custom' )( this )
        },
    },
} )
