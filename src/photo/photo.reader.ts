import dms2dec from 'dms2dec';
import { FastExifReader } from "./exif.reader";

export interface PhotoMetadata {
    capturedAt?: Date;
    device?:string;
    location?: {
        lat:number,
        lng:number
    };
}

export const PhotoReader = {
    async getMetadata(filePath:string):Promise<PhotoMetadata> {
        const data = await FastExifReader.readExif(filePath);
        if(data == null) {
            return {};
        }
        
        const metadata:PhotoMetadata = {};
        if(data.exif?.DateTimeOriginal != null) {
            metadata.capturedAt = data.exif.DateTimeOriginal;
        }

        if(data.image?.Make != null) {
            if(data.image?.Model != null) {
                metadata.device = `${data.image.Make.trim()} ${data.image.Model.trim()}`
            } else {
                metadata.device = data.image.Make.trim();
            }
        }

        if(data.gps?.GPSLatitude != null) {
            const latSexagesimal:number[] = data.gps.GPSLatitude;
            const lngSexagesimal:number[] = data.gps.GPSLongitude;

            const latRef = data.gps.GPSLatitudeRef ?? 'N';
            const lngRef = data.gps.GPSLongitudeRef ?? 'E';
            const locDecimal:number[] = dms2dec(latSexagesimal, latRef, lngSexagesimal, lngRef);
            if(locDecimal != null && locDecimal[0] !== 0 && locDecimal[1] !== 0) {
                metadata.location = {
                    lat: locDecimal[0],
                    lng: locDecimal[1]
                }
            }
        }

        return metadata;
    }
}