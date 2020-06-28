import * as gremlin from 'gremlin';
import { GraphEdge, GraphElement, GraphVertex, NewGraphElement } from './graph.element';
import { Logger } from '@azure/functions';

type QueryBindings = Record<string, string | number | boolean>;

interface QueryInfo {
    query: string;
    bindings: QueryBindings;
}

export class GraphDb {
    private client: gremlin.driver.Client;

    constructor(graphDbUrl: string, database: string, collection: string, key: string) {
        const authenticator = new gremlin.driver.auth.PlainTextSaslAuthenticator(`/dbs/${database}/colls/${collection}`, key)
        this.client = new gremlin.driver.Client(graphDbUrl, {
            authenticator,
            traversalsource: 'g',
            rejectUnauthorized: true,
            mimeType: "application/vnd.gremlin-v2.0+json"
        })
    }

    ready(): Promise<void> {
        return this.client.open();
    }

    async upsertVertex<T extends NewGraphElement<GraphVertex>>(obj: T, key: keyof T, value: string, log: Logger): Promise<string> {
        const existingIds = await this.getByValue(obj.label, key, value, log);

        let query: string = '';
        let bindings: QueryBindings = {};

        const propsQueryInfo = this.getPropsSubQuery(obj);

        if (existingIds.length > 0) {
            const id = existingIds[0];
            const updateQueryInfo = this.getUpdatePropsSubQuery();
            query = `g.V('${id}')` + propsQueryInfo.query + updateQueryInfo.query;
            bindings = {
                ...bindings,
                ...propsQueryInfo.bindings,
                ...updateQueryInfo.bindings
            }
        } else {
            const createQueryInfo = this.getCreatePropsSubQuery();
            query = `g.addV(vLabel).property('pk', '${obj.pk}')` + propsQueryInfo.query + createQueryInfo.query;
            bindings = {
                vLabel: obj.label,
                ...bindings,
                ...propsQueryInfo.bindings,
                ...createQueryInfo.bindings
            }
        }

        log.info('Upsert vertex query:', query);
        const result = await this.client.submit(query + '.valueMap(true)', bindings);
        return result.toArray()[0].id;
    }

    async getByValue<T extends NewGraphElement<GraphVertex>>(label: string, key: keyof T, value: string, log: Logger): Promise<string[]> {
        const query = `g.V().hasLabel(vLabel).has(vKey, vValue)`
        const bindings: Record<string, any> = {
            vLabel: label,
            vKey: key,
            vValue: value
        };

        log.info('Get-vertex-by-value query:', query);
        const result = await this.client.submit(query, bindings);
        return result.toArray().map(v => v.id);
    }

    async ensureVertex<T extends NewGraphElement<GraphVertex>>(obj: T, key: keyof T, log: Logger): Promise<string> {
        // https://stackoverflow.com/questions/49758417/cosmosdb-graph-upsert-query-pattern
        const propsQueryInfo = this.getPropsSubQuery(obj);
        const createQueryInfo = this.getCreatePropsSubQuery();

        let query = `
            g.V().has(vKey, vValue)
            .limit(1)
            .fold()
            .coalesce(
                unfold(),
                addV(vLabel).property('pk', '${obj.pk}')${propsQueryInfo.query}${createQueryInfo.query}
            )
        `;

        const bindings: QueryBindings = {
            vKey: key as string,
            vValue: obj[key] as any,
            vLabel: obj.label,
            ...propsQueryInfo.bindings,
            ...createQueryInfo.bindings
        };

        log.info('Ensure vertex query:', query);
        const result = await this.client.submit(query, bindings);
        return result.toArray()[0].id;
    }

    async ensureEdge<T extends NewGraphElement<GraphEdge>>(fromId: string, toId: string, edge: T, log: Logger) {
        // Add 'targetId' to make checking target vertex significantly faster (don't have to fetch all out vertices)
        const propsQueryInfo = this.getPropsSubQuery({
            ...edge,
            targetId: toId
        });
        const createQueryInfo = this.getCreatePropsSubQuery();

        // https://stackoverflow.com/questions/49758417/cosmosdb-graph-upsert-query-pattern
        let query = `
            g.V(fromId)
                .coalesce(
                    outE(edgeLabel).has('targetId', toId),
                    addE(edgeLabel).to(g.V(toId))${propsQueryInfo.query}${createQueryInfo.query}
                )
        `;

        const bindings: Record<string, any> = {
            fromId,
            toId,
            edgeLabel: edge.label,
            ...propsQueryInfo.bindings,
            ...createQueryInfo.bindings
        };

        log.info('Ensure edge query:', query);
        return await this.client.submit(query, bindings);
    }

    close(): Promise<void> {
        return this.client.close();
    }

    private getPropsSubQuery(obj: NewGraphElement<GraphElement>): QueryInfo {
        let query: string = '';
        const bindings: QueryBindings = {};

        for (const [key, value] of Object.entries(obj)) {
            if (value == null) {
                continue;
            }

            if (key === 'label' || key === 'pk') {
                continue;
            }

            query += `.property(v_${key}, vv_${key})`
            bindings[`v_${key}`] = key;
            bindings[`vv_${key}`] = value;
        }

        return { query, bindings };
    }

    private getUpdatePropsSubQuery(): QueryInfo {
        const now = new Date().toISOString();
        return {
            query: `.property('updatedAt', vv_now)`,
            bindings: {
                vv_now: now
            }
        }
    }

    private getCreatePropsSubQuery(): QueryInfo {
        const now = new Date().toISOString();
        return {
            query: `.property('createdAt', vv_now).property('updatedAt', vv_now)`,
            bindings: {
                vv_now: now
            }
        }
    }
}