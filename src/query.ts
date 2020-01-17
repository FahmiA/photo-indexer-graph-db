import 'source-map-support/register'

import * as gremlin from 'gremlin';

const traversal = gremlin.process.AnonymousTraversalSource.traversal;
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;

const dbConnection = new DriverRemoteConnection('ws://localhost:8182/gremlin');
const g = traversal().withRemote(dbConnection);

(async function() {
    // const result = await g.V().hasLabel('device').order().by('name').valueMap().toList();
    // const result = await g.V().hasLabel('device').has('name', 'Nokia N8-00').out('taken_with').valueMap().toList();
    // const result = await g.V().hasLabel('photo').has('capturedAt').order().by('capturedAt', gremlin.process.order.decr).limit(1).valueMap().toList();
    const result = await g.V().groupCount().by(gremlin.process.t.label).next();
    // const result = await g.V().hasLabel('city').values('name').order().toList();
    // const result = await g.V().hasLabel('album').order().by('endedAt', gremlin.process.order.incr).valueMap('name').toList();
    console.log('result', result);

    console.log('Closing database connection...');
    await dbConnection.close();
    console.log('\tDone.');
})();
