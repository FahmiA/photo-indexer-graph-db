import { AzureFunction, Context } from "@azure/functions";
import * as fs from 'fs';
import 'source-map-support/register';
import { GeoLookup } from './geo/geo.lookup';
import { GraphDb } from './graph/graph.db';
import { PhotoImporter } from './photo.importer';

interface BlobBindingData {
    invocationId: string;
    name: string;
    uri: string;
    blobTrigger: string;
    properties: {
        length: number;
        contentType: string;
        // contentMD5: string; // TODO:Use suggested SHA-256 or SHA-512
        eTag: string;
        created: string;
        lastModified: string;
    }
}

let countriesGeoJson: any;
let citiesGeoJson:any;

const blobTrigger: AzureFunction = async function (context: Context, blob: Buffer): Promise<void> {
    const data: BlobBindingData = context.bindingData as BlobBindingData;
    context.log.info("Processing blob \n Name:", data.name, "\n Blob Size:", blob.length, "Bytes");

    if (data.properties.contentType !== 'image/jpeg') {
        context.log.warn('Blob content type unsupported (', data.properties.contentType, '). Exiting.');
        return;
    }

    const dbConnectStart = Date.now();
    context.log.info('Connecting to database...');
    const db = new GraphDb(
        process.env.AZURE_COSMOS_URL,
        process.env.AZURE_COSMOS_DATABASE,
        process.env.AZURE_COSMOS_COLLECTION,
        process.env.AZURE_COSMOS_KEY
    );
    try {
        await db.ready();
        context.log.info(`Connecting to database... Done (${Date.now() - dbConnectStart}ms)`);
    } catch (e) {
        context.log.error('Failed to connect to database.', e);
        throw e;
    }

    context.log.info('Loading geo data...');
    const geoDataLoadStart = Date.now();
    countriesGeoJson = countriesGeoJson ?? JSON.parse(fs.readFileSync('./geojson/countries.geojson').toString());
    citiesGeoJson = citiesGeoJson ?? JSON.parse(fs.readFileSync('./geojson/cities.geojson').toString());
    const geoLookup = new GeoLookup(countriesGeoJson, citiesGeoJson);
    context.log.info(`Loading geo data... Done (${Date.now() - geoDataLoadStart}ms)`);

    context.log.info('Adding photo...')
    const photoImportStart = Date.now();
    const photoImporter = new PhotoImporter(geoLookup, db);
    await photoImporter.addPhoto(data.uri, blob, context.log);
    context.log.info(`Adding photo... Done (${Date.now() - photoImportStart}ms)`)

    context.log.info('Closing database connection...');
    const dbConnectClose = Date.now();
    await db.close();
    context.log.info(`Closing database connection... Done (${Date.now() - dbConnectClose}ms)`);
};

export default blobTrigger;

// context.bindingData
//{
//  invocationId: '8775f7a2-af81-4398-bb5a-8f664d2f2926',
//  blobTrigger: 'photo/PxlJm_1.png',
//  uri: 'https://stphotos.blob.core.windows.net/photo/PxlJm_1.png',
//  properties: {
//    cacheControl: null,
//    contentDisposition: null,
//    contentEncoding: null,
//    contentLanguage: null,
//    length: 404284,
//    contentMD5: 'jPVFMzVwaozSsaaIHkim5A==',
//    contentType: 'image/png',
//    eTag: '"0x8D7DDCF588803EC"',
//    created: '2020-04-11T04:18:10+00:00',
//    lastModified: '2020-04-11T04:18:10+00:00',
//    blobType: 2,
//    leaseStatus: 2,
//    leaseState: 1,
//    leaseDuration: 0,
//    pageBlobSequenceNumber: null,
//    appendBlobCommittedBlockCount: null,
//    isServerEncrypted: true,
//    isIncrementalCopy: false,
//    standardBlobTier: 1,
//    rehydrationStatus: null,
//    premiumPageBlobTier: null,
//    blobTierInferred: true,
//    blobTierLastModifiedTime: null,
//    deletedTime: null,
//    remainingDaysBeforePermanentDelete: null
//  },
//  metadata: {},
//  name: 'PxlJm_1.png',
//  sys: {
//    methodName: 'photo-update-trigger',
//    utcNow: '2020-04-11T04:18:14.0685221Z',
//    randGuid: 'a2a71e56-57bf-4b77-a8ca-5ff0cef3eef0'
//  },
//  '$request': undefined
//}

