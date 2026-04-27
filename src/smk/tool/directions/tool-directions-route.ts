/**
 * tool-directions-route — Directions route panel tool.
 * Converted from tool/directions/tool-directions-route.js.
 */

import Tool from '../../tool'
import panelDirectionsRouteHtml from './panel-directions-route.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

const instructionType: Record<string, [ string, boolean | null, string ]> = {
    START:             [ 'trip_origin',     null,  'Go on' ],
    START_NORTH:       [ 'trip_origin',     null,  'Head north on' ],
    START_SOUTH:       [ 'trip_origin',     null,  'Head south on' ],
    START_EAST:        [ 'trip_origin',     null,  'Head east on' ],
    START_WEST:        [ 'trip_origin',     null,  'Head west on' ],
    CONTINUE:          [ 'expand_more',     null,  'Continue onto' ],
    TURN_LEFT:         [ 'arrow_back',      null,  'Turn left onto' ],
    TURN_SLIGHT_LEFT:  [ 'undo',            null,  'Slight turn left onto' ],
    TURN_SHARP_LEFT:   [ 'directions',      true,  'Sharp turn left onto' ],
    TURN_RIGHT:        [ 'arrow_forward',   null,  'Turn right onto' ],
    TURN_SLIGHT_RIGHT: [ 'undo',            true,  'Slight turn right onto' ],
    TURN_SHARP_RIGHT:  [ 'directions',      null,  'Sharp turn right onto' ],
    FERRY:             [ 'directions_boat', null,  'Board' ],
    STOPOVER:          [ 'pause',           null,  '' ],
    FINISH:            [ 'stop',            null,  '' ],
}

Vue.component( 'route-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelDirectionsRouteHtml,
    props: [ 'directions', 'directionHighlight', 'directionPick' ],
    methods: {
        instructionTypeIcon( type: string ) {
            return instructionType[ type ] ? instructionType[ type ][ 0 ] : 'report'
        },
        instructionTypeClass( type: string ) {
            return instructionType[ type ]
                ? ( instructionType[ type ][ 1 ] ? 'smk-reverse' : '' )
                : 'smk-hidden'
        },
        instructionTypePrefix( type: string, heading: string ) {
            const key = heading ? type + '_' + heading : type
            return instructionType[ key ] ? ( instructionType[ key ][ 2 ] || '' ) : ''
        },
    },
} )

const factory = ( Tool as any ).define( 'DirectionsRouteTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'route-panel' )

        this.defineProp( 'directions' )
        this.defineProp( 'directionHighlight' )
        this.defineProp( 'directionPick' )

        this.directions = []

        this.parentId = 'DirectionsWaypointsTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        const directions = smk.getToolById( this.parentId )

        this.changedActive( function () {
            if ( self.active ) {
                self.directions        = directions.directions
                self.directionHighlight = directions.directionHighlight
                self.directionPick     = directions.directionPick
            }
        } )

        smk.on( this.id, {
            'hover-direction': function ( ev: any ) {
                self.directionHighlight = ev.highlight
            },
            'pick-direction': function ( ev: any ) {
                self.directionPick = ev.pick
            },
            'print': function ( ev: any ) {
                const cfg = smk.getConfig()
                cfg.etc = { directions: directions.directionsRaw }

                const key = smkRef.UTIL.makeUUID()
                window.sessionStorage.setItem( key, JSON.stringify( cfg ) )

                self.showStatusMessage( 'Preparing print...', 'progress', null )
                self.busy = true
                smkRef.HANDLER.get( self.id, 'print' )( smk, self, key, ev )
                    .then( function () {
                        self.busy = false
                        return self.showStatusMessage( 'Printing...', 'progress', 2000 )
                    } )
                    .catch( function () {
                        self.busy = false
                        return self.showStatusMessage( 'Print failed', 'error', 2000 )
                    } )
            },
        } )

        smk.$viewer.handlePick( 3, function () {
            if ( !self.active ) return
            directions.active = true
            return false
        } )
    }
)

smkRef.TYPE[ 'tool-directions-route' ] = factory
export default factory
