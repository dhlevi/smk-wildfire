// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:     'pan',
    position: 'actionbar',
    enabled:  false,
    order:    2,
    control:  true,
    icon: {
        compass:      'navigation',
        navModePan:   'open_with',
        navModeRotate: '3d_rotation',
    },
    title: {
        compass:      'Reset Orientation',
        navModePan:   'Panning Mode',
        navModeRotate: 'Rotate Mode',
    },
}
export default config
