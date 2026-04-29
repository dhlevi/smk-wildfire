import { SMK } from '../../smk-ref'
/**
 * tool-widget mixin — adds widget component support to a Tool.
 * Converted from mixin/tool-widget/tool-widget.js (include.module -> ES module).
 */

export function ToolWidget( this: any, componentName: string ): void {
    const self = this

    this.defineProp( 'showWidget' )
    this.showWidget = true

    this.makeWidgetComponent = function () {
        return {
            component: componentName,
            prop:      self.getComponentProps( componentName ),
        }
    }

    this.$propFilter.classes = false

    this.$initializers.push( function ( this: any, smk: any ) {
        const self = this

        smk.on( this.id, {
            'activate': function () {
                if ( !self.enabled ) return
                self.active = !self.active
            }
        } )
    } )
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = SMK
    if ( smk && smk.TYPE ) smk.TYPE.ToolWidget = ToolWidget
}

export default ToolWidget
