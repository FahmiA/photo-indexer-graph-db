import * as GeoJsonGeometriesLookup from 'geojson-geometries-lookup';

export interface Coord {
    lat: number;
    lng: number;
}

export class GeoLookup {
    private countriesLookup:GeoJsonGeometriesLookup;
    private citiesLookup:GeoJsonGeometriesLookup;

    constructor(countriesGeoJson:any, citiesGeoJson:any) {
        this.countriesLookup = new GeoJsonGeometriesLookup(countriesGeoJson);
        this.citiesLookup = new GeoJsonGeometriesLookup(citiesGeoJson);
    }

    getCountry(loc:Coord):string | null {
        const geoJsonPoint = {type: 'Point', coordinates: [loc.lng, loc.lat]};
        const collection = this.countriesLookup.getContainers(geoJsonPoint, {limit: 1});

        return collection?.features?.[0]?.properties?.name?.toLowerCase();
    }

    getCity(loc:Coord):string | null {
        const geoJsonPoint = {type: 'Point', coordinates: [loc.lng, loc.lat]};
        const collection = this.citiesLookup.getContainers(geoJsonPoint, {limit: 1});

        return collection?.features?.[0]?.properties?.NAME?.toLowerCase();
    }
}