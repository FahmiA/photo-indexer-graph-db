import exifReader from 'exif-reader';
import * as fs from 'fs';
import * as util from 'util';

const fsOpen = util.promisify(fs.open);
const fsRead = util.promisify(fs.read);
const fsClose = util.promisify(fs.close);

/** @see https://github.com/titarenko/fast-exif/blob/master/index.js */
export const FastExifReader = {
    readExif(filename:string) {
        const maxIterations = 1000;

        return fsOpen(filename, 'r').then((fd) => {
            const buffer = Buffer.alloc(512);
            return FastExifReader.searchExif(fd, buffer, 0, maxIterations)
                .then((exifBuffer) => {
                    return exifBuffer && exifReader(exifBuffer);
                })
                .catch(e => {
                    return null;
                })
                .finally(() => {
                    return fsClose(fd);
                });
        });
    },
    
    searchExif (fd:number, buffer:Buffer, fileOffset:number, remainingIterations:number) {
        let offset = 0, length = buffer.length;
        return fsRead(fd, buffer, 0, length, null).then((bytesRead) => {
            if (!bytesRead) {
                return null;
            }
            while (offset < length) {
                if (buffer[offset++] == 0xFF && buffer[offset] == 0xE1) {
                    const exifBuffer = Buffer.alloc(buffer.readUInt16BE(++offset));
                    return fsRead(fd, exifBuffer, 0, exifBuffer.length, fileOffset + offset + 2).then(() => exifBuffer);
                }
            }
            return remainingIterations > 1 ? FastExifReader.searchExif(fd, buffer, fileOffset + length, remainingIterations - 1) : null;
        });
    }
}