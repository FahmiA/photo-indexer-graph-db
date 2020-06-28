import { Logger } from '@azure/functions';
import * as exifReader from 'exif-reader';

/** @see https://github.com/titarenko/fast-exif/blob/master/index.js */
export const FastExifReader = {
    readExif(buffer: Buffer, log: Logger) {
        const exifBuffer = FastExifReader.searchExif(buffer);
        if (exifBuffer == null) {
            return null;
        }

        try {
            return exifReader(exifBuffer);
        } catch (e) {
            log.error('Failed to process EXIF:', e);
            return null;
        }
    },

    searchExif(buffer: Buffer): Buffer | null {
        let offset = 0;
        const length = buffer.length;
        while (offset < length) {
            if (buffer[offset++] == 0xFF && buffer[offset] == 0xE1) {
                const exifLength = buffer.readUInt16BE(++offset);
                return buffer.slice(offset + 2, exifLength);
            }
        }
    }
}