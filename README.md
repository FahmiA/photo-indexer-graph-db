# Photo Indexer for Graph Database

An experimental project to index a photo library into a graph database.

Written in TypeScript using the [gremlin](https://www.npmjs.com/package/gremlin) NPM package to index and query photos using an [Apache TinkerPop](http://tinkerpop.apache.org/) graph database.

The project recursivly iterates over photos, extracts the time and location from the EXIF data, and creates a graph structure. The graph structure is then used to build "smart" photo albums based on time and location. For example "2 days in Wellington".

Coungtry and city are located from the GPS coordinates with a lookup into two geojson files (faster than API calls to an external service but less accurate).

## Build and Run

```bash
# Start the database
docker run -d -p 8182:8182 tinkerpop/gremlin-server:3.4

# Build the project
yarn install
yarn run build

# Index your photos
yarn start -- /path/to/photos

# Run queries against your photos using the gremlin NPM package
editor src/query.js
yarn run build
node build/query.js
```
