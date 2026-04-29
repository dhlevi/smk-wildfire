# smk-client
## Simple Map Kit Client
### A versatile and lightweight toolkit for building a simple web map.

[Repository](https://github.com/bcgov/smk-client)
|
[Docs](https://bcgov.github.io/smk-client/)
|
[Issues](https://github.com/bcgov/smk/issues)

### smk-client Export

This package is a self-contained component for a map.
This package contains map configuration that was built in the SMK admin tool, any data files that were loaded (as KML, SHP or GeoJSON), and the map component itself.

A web application can use this map as simply as this example:

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="smk.js" smk-container-sel="#smk-map-frame" smk-config="map-config.json|?"></script>
    </head>
    <body>
        <div id="smk-map-frame" style="width: 400px; height: 400px"></div>
    </body>
</html>
```

### Testing exported map configuration

If you wish to test this map configuration immediately, the export ships with a small static web server.
It is not the only way to serve this code to a web browser — the export is just a folder of static files, so it can equally be served via Apache, nginx, GitHub Pages, or any other web server.

The bundled test server requires [NodeJS](https://nodejs.org/en/) to be installed.

Install node modules:

    > npm install --production

Start the test server:

    > npm start

Your browser will open at [http://localhost:8080](http://localhost:8080).

### Doing development on smk-client

If you want to make changes to `smk.js`, the full source code is included in the export in `smk-<version>-src.zip`.

The build is driven by [Vite](https://vitejs.dev/) and TypeScript. To set up your environment for development, assuming the export is at `/smk-export`:

    > cd /smk-export

    # Install development libraries
    > npm install

    # Unzip source code into src/
    > unzip ../smk-<version>-src.zip

    # Build smk into dist/ (smk.umd.js, smk.es.js, smk.css)
    > npm run build

    # *OR* rebuild on every source change
    > npm run build:watch

    # *OR* run a dev server that watches src/ and reloads the browser
    > npm start

See [DEVELOPMENT.md](DEVELOPMENT.md) for more information on doing development on smk-client.
