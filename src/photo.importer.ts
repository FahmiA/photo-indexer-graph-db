import * as fs from 'fs';
import * as path from 'path';
import { GeoLookup } from './geo/geo.lookup';
import { PhotoReader } from './photo/photo.reader';
import { PhotoVertex } from './graph/photo.vertex';
import { GraphDb } from './graph/graph.db';
import { DeviceVertex } from './graph/device.vertex';
import { CountryVertex } from './graph/country.vertex';
import { CityVertex } from './graph/city.vertex';

export class PhotoImporter {

  private static readonly PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff'];
  private static readonly PHOTO_LIMIT = 100_000;

  private readonly dir: string;
  private readonly geoLookup: GeoLookup;
  private readonly db: GraphDb;

  constructor(dir: string, geoLookup: GeoLookup, db: GraphDb) {
    this.dir = dir;
    this.geoLookup = geoLookup;
    this.db = db;
  }

  async sync() {
    const vistedDevices = new Map<string, number>(); // name -> id
    const visitedCountries = new Map<string, number>(); // name -> id
    const visitedCities = new Map<string, number>(); // country-name_city-name -> id

    let photoCount = 0;
    for await (const filePath of this.allPhotos(this.dir)) {
      console.log((photoCount + 1).toString().padEnd(2), 'Adding photo', filePath);
      const photoMetadata = await PhotoReader.getMetadata(filePath);

      const photoVertex: PhotoVertex = {
        label: 'photo',
        path: filePath,
        capturedAt: photoMetadata.capturedAt != null ? photoMetadata.capturedAt.toISOString() : null
      }
      const photoId = await this.db.addVertex(photoVertex);

      if (photoMetadata.device != null) {
        let deviceId = vistedDevices.get(photoMetadata.device);
        if (deviceId == null) {
          const deviceVertex: DeviceVertex = {
            label: 'device',
            name: photoMetadata.device
          }
          deviceId = await this.db.ensureVertex(deviceVertex, 'name')
        }

        await this.db.addEdge(deviceId, photoId, { label: 'taken_with' });
        vistedDevices.set(photoMetadata.device, deviceId);
      }

      if (photoMetadata.location != null) {
        const countryName = this.geoLookup.getCountry(photoMetadata.location) ?? 'unknown'; // Country names are unique
        const cityName = this.geoLookup.getCity(photoMetadata.location) ?? 'unknown'; // Cities names are unique within a country
        const uniqueCityName = `${countryName} > ${cityName}`

        let countryId = visitedCountries.get(countryName);
        if (countryId == null) {
          const countryVertex: CountryVertex = {
            label: 'country',
            name: countryName
          }
          countryId = await this.db.ensureVertex(countryVertex, 'name');

          visitedCountries.set(countryName, countryId);
        }

        let cityId = visitedCities.get(uniqueCityName);
        if (cityId == null) {
          const cityVertex: CityVertex = {
            label: 'city',
            name: cityName,
            uniqueName: uniqueCityName
          }
          cityId = await this.db.ensureVertex(cityVertex, 'uniqueName');

          await this.db.addEdge(countryId, cityId, { label: 'within_country' });

          visitedCities.set(uniqueCityName, cityId);
        }

        await this.db.addEdge(cityId, photoId, { label: 'taken_in_city' });
      }

      photoCount += 1;
      if (photoCount >= PhotoImporter.PHOTO_LIMIT) {
        break;
      }
    }
  }

  private async *allPhotos(dir: string): AsyncGenerator<string> {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const res = path.resolve(dir, dirent.name);
      const extension = path.extname(res)?.toLowerCase();
      if (dirent.isDirectory()) {
        yield* this.allPhotos(res);
      } else if (PhotoImporter.PHOTO_EXTENSIONS.includes(extension)) {
        yield res;
      }
    }
  }
}