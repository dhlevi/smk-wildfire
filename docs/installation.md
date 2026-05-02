###### [SMK](..)

# Installing SMK

There are a variety of ways to install SMK into your application.

## Choosing a build

The `dist/` folder contains two builds of SMK:

- **Lite** — `smk.umd.js` / `smk.es.js` + `smk.css` (~2.3 MB JS, ~1.1 MB CSS).
  Does **not** include external libraries (Vue, Leaflet, MapLibre GL,
  esri-leaflet, esri-leaflet-vector, proj4, @turf/turf). The host page must
  load each library *before* `smk.umd.js`. See [Optional dependencies](#optional-dependencies).

- **Standalone** — `smk.standalone.js` + `smk.standalone.css` (~4.3 MB JS,
  ~1.1 MB CSS; ~958 KB / ~686 KB gzipped). A single drop-in bundle that
  includes every external library SMK needs. No other `<script>` tags
  required.

Pick **standalone** for the simplest integration. Pick **lite** if you
already load some of the libraries elsewhere on the page (e.g. you ship your
own Leaflet build) or want the smaller payload.


## Use `smk create`

If you want to create a new application using SMK, then the easiest way is with the `smk-cli`.
First make sure that the `smk-cli` is installed globally in your machine:

    > npm install --global smk-cli

Test that this worked:

    > smk help

You should see the help information for `smk-cli`.

Change to the a directory where you keep your projects, and create a new SMK application (change `my-new-app` to whatever you like).

    > cd projects
    > smk create my-new-app

You will be asked some questions about your new application.
Once they are answered you will have a new skeleton application at `projects/my-new-app`.


## Install from NPM

In your NPM project, use this command to add SMK as a dependency:

    > npm install smk

Then, in your application you add the SMK library like this — either the
standalone bundle (no other libs needed):

    <link rel="stylesheet" href="node_modules/smk/dist/smk.standalone.css" />
    <script src="node_modules/smk/dist/smk.standalone.js"></script>

…or the lite bundle (host page must load Vue, Leaflet, MapLibre GL, etc.
first — see [Optional dependencies](#optional-dependencies)):

    <link rel="stylesheet" href="node_modules/smk/dist/smk.css" />
    <script src="node_modules/smk/dist/smk.umd.js"></script>


## Download

Click one of the download links to left to download the most recent build of SMK.
After unzipping the package, you should copy the `dist` folder to your project.

Then in your application, you could include SMK like this (assuming you copied `dist` to `assets/js/smk`):

    <link rel="stylesheet" href="assets/js/smk/smk.standalone.css" />
    <script src="assets/js/smk/smk.standalone.js"></script>


## Use deployed version

Include this in your application:

    <link rel="stylesheet" href="[url of smk deployment]/smk.standalone.css" />
    <script src="[url of smk deployment]/smk.standalone.js"></script>


## Optional dependencies

These dependencies apply only to the **lite** build (`smk.umd.js`). The
**standalone** build (`smk.standalone.js`) already includes all of them.

The lite build expects the following libraries to be loaded by the host page
*before* `smk.umd.js`:

- **Vue 2.7** — `vue.min.js`
- **Leaflet 1.7+** — `leaflet.js` and `leaflet.css`
- **proj4** — `proj4.min.js`
- **@turf/turf 5+** — `turf.min.js`
- **esri-leaflet 3+** — `esri-leaflet.min.js` (extends `L.esri`)

Some viewer types require additional libraries:

- **MapLibre viewer** (`"viewer": { "type": "maplibre" }`) requires the
  MapLibre GL JS bundle and stylesheet, plus `esri-leaflet-vector` for the
  vector basemap support:

        <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
        <script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
        <script src="https://unpkg.com/esri-leaflet-vector@4/dist/esri-leaflet-vector.js"></script>

  When 3D mode is enabled the viewer also fetches DEM tiles from the
  configured [`"dem"` source](configuration/viewer#dem-property).

