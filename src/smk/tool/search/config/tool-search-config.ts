// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:         'search',
    enabled:      true,
    order:        2,
    position:     'toolbar',
    icon:         'search',
    title:        'Search for Location',
    showPanel:    true,
    showLocation: true,
    command: {
        identify:   true,
        measure:    true,
        directions: true,
    },
    internalLayers: [
        {
            id:    'result-selected',
            title: 'Selected Search Result',
            style: { markerSize: [ 25, 41 ], markerOffset: [ 12, 41 ], shadowSize: [ 41, 41 ] },
            legend: { point: true },
        },
        {
            id:    'result-highlight',
            title: 'Highlighted Search Result',
            style: { markerSize: [ 40, 36 ], markerOffset: [ 20, 18 ], shadowSize: [ 31, 31 ] },
            legend: { point: true },
        },
        {
            id:    'results',
            title: 'Search Results',
            style: { markerSize: [ 20, 19 ], markerOffset: [ 10, 9 ], shadowSize: [ 21, 21 ] },
            legend: { point: true },
        },
    ],
}
export default config
