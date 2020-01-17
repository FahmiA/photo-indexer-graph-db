import { GraphDb } from "./graph/graph.db";
import { CityVertex } from "./graph/city.vertex";
import getClusters from 'time-series-clustering';
import { PhotoVertex } from "./graph/photo.vertex";
import { AlbumVertex } from "./graph/album.vertex";
import { CountryVertex } from "./graph/country.vertex";

interface ClusterPoint {
    id: number;
    /** UNIX timestamp */
    value: number;
}

interface ClusterResult {
    value_max: number;
    value_min: number;
    value_range: number;
    relevance: number;
    ids: number[];
}

interface ClusterBatchResult {
    clusters: ClusterResult[]
}

export class PhotoOrganiser {
    private static readonly MIN_CLUSTER_COUNT = 5;

    private readonly db: GraphDb;

    constructor(db: GraphDb) {
        this.db = db;
    }

    async sync() {
        const countries = await this.db.getByLabel<CountryVertex>('country');
        for (const country of countries) {
            const cities = await this.db.getReleatedOut<CityVertex>(country, 'within_country');
            for (const city of cities) {
                const photos = await this.db.getReleatedOut<PhotoVertex>(city, 'taken_in_city');

                const photoData: ClusterPoint[] = [];
                for (const photo of photos) {
                    if (photo.capturedAt != null) {
                        photoData.push({ id: photo.id, value: Date.parse(photo.capturedAt) });
                    }
                }

                if (photoData.length < PhotoOrganiser.MIN_CLUSTER_COUNT) {
                    continue;
                }

                const photoMap = new Map<number, PhotoVertex>();
                for (const photo of photos) {
                    photoMap.set(photo.id, photo);
                }

                // See: https://github.com/repeale/time-series-clustering
                photoData.sort((a, b) => b.value - a.value);
                const clusters: ClusterBatchResult = getClusters({ data: photoData }, {
                    // max time distance for two items to be in the same cluster
                    // ie: each photo is within x days from the previous
                    maxDistance: this.getDaysAsMs(1),
                    // filter cluster with a time frame smaller than minTimeFrame
                    // ie: no clusters which span for less than one day
                    minTimeFrame: this.getDaysAsMs(1),
                    // min number of items to get a relevant cluster
                    // ie: no clusters with less than 5 photos
                    minRelevance: PhotoOrganiser.MIN_CLUSTER_COUNT
                });


                for (const cluster of clusters.clusters) {
                    const clusterPhotos: PhotoVertex[] = [];
                    for (const id of cluster.ids) {
                        clusterPhotos.push(photoMap.get(id));
                    }

                    const startedAt = clusterPhotos[clusterPhotos.length - 1].capturedAt;
                    const endedAt = clusterPhotos[0].capturedAt;
                    const startedAtUnix = Date.parse(startedAt);
                    const endedAtUnix = Date.parse(endedAt);

                    const place = city.name === 'unknown' ? country.name : city.name;
                    const albumName = `${this.formatDuration(startedAtUnix, endedAtUnix)} in ${place}`;
                    const days = Math.ceil((endedAtUnix - startedAtUnix) / this.getDaysAsMs(1));
                    const albumId = await this.db.addVertex({
                        label: 'album',
                        name: albumName,
                        place,
                        days,
                        startedAt,
                        endedAt
                    } as AlbumVertex);

                    for (const clusterPhoto of clusterPhotos) {
                        await this.db.addEdge(albumId, clusterPhoto.id, { label: 'photo_in_album' })
                    }

                    console.log('Created album:', albumName, `(size: ${clusterPhotos.length})`)
                }
            }
        }
    }

    private getDaysAsMs(days: number): number {
        return 60 * 60 * 24 * 1000 * days;
    }

    private formatDuration(start: number, end: number): string {
        // Approximate duration

        const days = (end - start) / this.getDaysAsMs(1);
        if (days < 6) {
            return `${Math.ceil(days)} days`
        }

        if (days < 30) {
            return `${Math.ceil(days / 7)} weeks`
        }

        return `${Math.ceil(days / 30)} months`
    }
}