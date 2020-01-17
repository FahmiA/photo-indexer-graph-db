import * as gremlin from 'gremlin';
import { GraphElement } from './graph.element';


const traversal = gremlin.process.AnonymousTraversalSource.traversal;

export class GraphDb {
    private connection: gremlin.driver.DriverRemoteConnection;
    private g: gremlin.process.GraphTraversalSource;

    constructor() {
        this.connection = new gremlin.driver.DriverRemoteConnection('ws://localhost:8182/gremlin');
        this.g = traversal().withRemote(this.connection);
    }

    ready():Promise<void> {
        return new Promise<void>(async (resolve, reject)  => {
            const errorCallback = err => reject(err);
            (this.connection as any).addListener('socketError', errorCallback);

            // If already open, this will not re-open it.
            await this.connection.open();

            (this.connection as any).removeListener('socketError', errorCallback)
            resolve();
        });
    }

    async addVertex(obj: GraphElement): Promise<number> {
        let t: gremlin.process.GraphTraversal = this.g.addV(obj.label);

        for (const [key, value] of Object.entries(obj)) {
            if (value != null && key !== 'label') {
                t = t.property(key, value);
            }
        }

        const newVertex = await t.next();
        return newVertex.value.id;
    }

    async ensureVertex<T extends GraphElement>(obj: T, key: keyof T = 'id'): Promise<number> {
        const result = await this.g.V().has(key, obj[key]).limit(1).next();
        if (result.value != null) {
            return result.value.id; // Exists. Nothing to do.
        }

        return this.addVertex(obj);
    }

    async addEdge(fromId: number, toId: number, edge: GraphElement) {
        return this.g.V(fromId).addE(edge.label).to(this.g.V(toId)).iterate();
    }

    async getByLabel<T extends GraphElement>(label: T['label']): Promise<T[]> {
        const graphValueMaps:any[] = await this.g.V().hasLabel(label).valueMap(true).toList();
        return this.asVertex<T>(graphValueMaps);
    }

    async getReleatedOut<T extends GraphElement>(vertex:GraphElement, edgeLabel:string):Promise<T[]> {
        const graphValueMaps:any[] = await this.g.V().hasId(vertex.id).out(edgeLabel).valueMap(true).toList();
        return this.asVertex<T>(graphValueMaps);
    }

    getSummary() {
        return this.g.V().groupCount().by(gremlin.process.t.label).next();
    }

    clear() {
        return this.g.V().drop().next();
    }

    close(): Promise<void> {
        return this.connection.close();
    }

    private asVertex<T extends GraphElement>(graphValueMaps):T[] {
        const result:T[] = [];
        for(const valueMap of graphValueMaps) {
            const vertex = {
                id: valueMap.get(gremlin.process.t.id),
                label: valueMap.get(gremlin.process.t.label)
            };

            valueMap.forEach(([value],key) =>  {
                if(typeof key === 'string' && value != null) {
                    vertex[key] = value;
                }
            });

            result.push(vertex as T);
        }
        return result;
    }
}