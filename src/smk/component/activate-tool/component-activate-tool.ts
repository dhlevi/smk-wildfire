/**
 * component-activate-tool — Vue component for triggering another tool.
 */
import template from './component-activate-tool.html?raw'
declare const Vue: any

Vue.component( 'activate-tool', {
    extends: ( window as any ).SMK?.COMPONENT?.ToolEmit,
    template,
    props: {
        id:    { type: String },
        title: { type: String },
    }
} )
