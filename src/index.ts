import 'source-map-support/register';

import * as fs from 'fs';
import { GeoLookup } from './geo/geo.lookup';
import { GraphDb } from './graph/graph.db';
import { PhotoImporter } from './photo.importer';
import { PhotoOrganiser } from './photo.organiser';

(async function() {
    if(process.argv.length !== 3) {
        console.log('Usage: yarn start /path/to/photos');
        process.exit(1);
    }

    const photoPath = process.argv[2];

    console.group('Connecting to database...');
    const db = new GraphDb();
    try {
        await db.ready();
    } catch (e) {
        console.error('Failed to connect to database.');
        console.error(e);
        process.exit(1);
    }

    console.log('Done.');
    console.groupEnd();

    console.group('Clearing database...');
    await db.clear();
    console.log('Done.');
    console.groupEnd();

    console.group('Loading geo data...');
    const geoDataLoadStart = Date.now();
    const countriesGeoJson = JSON.parse(fs.readFileSync('./geojson/countries.geojson').toString());
    const citiesGeoJson = JSON.parse(fs.readFileSync('./geojson/cities.geojson').toString());
    const geoLookup = new GeoLookup(countriesGeoJson, citiesGeoJson);
    console.log(`Done (${Date.now() - geoDataLoadStart}ms)`);
    console.groupEnd()

    console.group('Adding Photos...')
    const photoImporter = new PhotoImporter(photoPath, geoLookup, db);
    await photoImporter.sync();
    console.groupEnd();

    console.group('Fetching photos...');
    const dbSummary = await db.getSummary();
    console.log('Done.', dbSummary.value);
    console.groupEnd();

    console.group('Organising photos...');
    const photoOrganiser = new PhotoOrganiser(db);
    await photoOrganiser.sync();
    console.log('Done.');
    console.groupEnd();

    console.group('Closing database connection...');
    await db.close();
    console.log('Done.');
    console.groupEnd();
})();
