// Mixin config defaults — AMD legacy, superseded by TS tool constructors.
// Adds highlight layers for point, line, and polygon to internalLayers.
export const highlightLayers = [
    {
        id: 'highlight-polygon',
        style: {
            fill:         true,
            stroke:       true,
            fillColor:    'white',
            fillOpacity:  0.5,
            strokeColor:  'black',
            strokeWidth:  3,
            strokeOpacity: 0.8,
        },
    },
    {
        id: 'highlight-line',
        style: {
            stroke:        true,
            strokeColor:   'black',
            strokeWidth:   3,
            strokeOpacity: 0.8,
        },
    },
    {
        id: 'highlight-point',
        style: {
            markerSize:   [ 25, 41 ],
            markerOffset: [ 12, 41 ],
            shadowSize:   [ 41, 41 ],
        },
    },
]
export default highlightLayers
