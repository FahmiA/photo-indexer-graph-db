import { Logger } from '@azure/functions';
import * as crypto from 'crypto';
import * as path from 'path';
import { GeoLookup } from './geo/geo.lookup';
import { CityVertex } from './graph/city.vertex';
import { CountryVertex } from './graph/country.vertex';
import { DeviceVertex } from './graph/device.vertex';
import { GraphDb } from './graph/graph.db';
import { NewGraphElement } from './graph/graph.element';
import { GraphPartitionKey } from './graph/graph.partition.key';
import { PhotoVertex } from './graph/photo.vertex';
import { PhotoReader } from './photo/photo.reader';

export class PhotoImporter {

  private readonly geoLookup: GeoLookup;
  private readonly db: GraphDb;

  constructor(geoLookup: GeoLookup, db: GraphDb) {
    this.geoLookup = geoLookup;
    this.db = db;
  }

  async addPhoto(uri: string, buffer: Buffer, log: Logger): Promise<void> {
    const photoMetadata = await PhotoReader.getMetadata(buffer, log);

    const pathname = new URL(uri).pathname;

    const photoName = decodeURIComponent(path.basename(pathname));
    log.info('Adding photo vertex:', photoName);
    const photoVertex: NewGraphElement<PhotoVertex> = {
      label: 'photo',
      name: photoName,
      pk: GraphPartitionKey.photo,
      path: pathname,
      capturedAt: photoMetadata.capturedAt != null ? photoMetadata.capturedAt.toISOString() : null,
      hash: 'sha256+' + crypto.createHash('sha256').update(buffer).digest('hex')
    }
    const photoId = await this.db.upsertVertex(photoVertex, 'path', photoVertex.path, log);

    if (photoMetadata.device != null) {
      log.info('Adding device vertex:', photoMetadata.device);

      const deviceVertex: NewGraphElement<DeviceVertex> = {
        label: 'device',
        name: photoMetadata.device,
        pk: GraphPartitionKey.category
      }
      let deviceId = await this.db.ensureVertex(deviceVertex, 'name', log);

      await this.db.ensureEdge(deviceId, photoId, { label: 'device_took_photo', name: 'device_took_photo' }, log);
    }

    if (photoMetadata.location != null) {
      const countryName = this.geoLookup.getCountry(photoMetadata.location) ?? 'unknown'; // Country names are unique
      const cityName = this.geoLookup.getCity(photoMetadata.location) ?? 'unknown'; // Cities names are unique within a country
      const uniqueCityName = `${countryName} > ${cityName}`

      log.info('Adding country vertex:', countryName);
      const countryVertex: NewGraphElement<CountryVertex> = {
        label: 'country',
        name: countryName,
        pk: GraphPartitionKey.category
      }
      const countryId = await this.db.ensureVertex(countryVertex, 'name', log);

      log.info('Adding city vertex', cityName);
      const cityVertex: NewGraphElement<CityVertex> = {
        label: 'city',
        name: cityName,
        pk: GraphPartitionKey.category,
        uniqueName: uniqueCityName
      }
      const cityId = await this.db.ensureVertex(cityVertex, 'uniqueName', log);

      await this.db.ensureEdge(countryId, cityId, { label: 'country_contains_city', name: 'country_contains_city' }, log);

      await this.db.ensureEdge(cityId, photoId, { label: 'city_location_of_photo', name: 'city_location_of_photo' }, log);
    }
  }
}