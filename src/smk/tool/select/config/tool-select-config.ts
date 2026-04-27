// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:     'select',
    enabled:  false,
    order:    6,
    position: 'list-menu',
    icon:     'select_all',
    title:    'Selected Features',
    command: {
        clear:  true,
        remove: true,
    },
}
export default config
