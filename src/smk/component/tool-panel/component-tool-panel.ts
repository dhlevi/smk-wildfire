/**
 * component-tool-panel — swipeable side panel with scroll indicators.
 */
import template from './component-tool-panel.html?raw'
declare const Vue: any

Vue.component( 'tool-panel', {
    extends: ( window as any ).SMK?.COMPONENT?.ToolPanelBase,
    template,
    data() {
        return {
            canScrollUp:   false,
            canScrollDown: false,
        }
    },
    methods: {
        startSwipe( this: any, ev: TouchEvent ) {
            this.xDown = ev.touches[ 0 ].clientX
            this.yDown = ev.touches[ 0 ].clientY
        },
        moveSwipe( this: any, ev: TouchEvent ) {
            if ( !this.xDown || !this.yDown ) return

            const xDiff = this.xDown - ev.touches[ 0 ].clientX
            const yDiff = this.yDown - ev.touches[ 0 ].clientY

            if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
                this.$emit( xDiff > 0 ? 'swipe-left' : 'swipe-right' )
            } else {
                this.$emit( yDiff > 0 ? 'swipe-up' : 'swipe-down' )
            }

            this.xDown = null
            this.yDown = null
        },
        scrollBody( this: any ) {
            this.updateScroll()
        },
        updateScroll( this: any ) {
            const el = this.$refs.body as HTMLElement
            this.canScrollUp   = el.scrollTop > 0
            this.canScrollDown = ( el.scrollTop + el.clientHeight ) < el.scrollHeight
        },
    },
    mounted( this: any ) {
        this.$nextTick( this.updateScroll )
    },
    updated( this: any ) {
        this.$nextTick( this.updateScroll )
    },
} )
