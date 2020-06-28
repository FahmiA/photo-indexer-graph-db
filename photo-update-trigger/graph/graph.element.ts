import { GraphPartitionKey } from "./graph.partition.key";

/** ISO 8601 string */
export type IsoString = string;

export interface GraphElement {
    id: string;
    label: string;
    name: string;
    createdAt: IsoString;
    updatedAt: IsoString;
}

export interface GraphVertex extends GraphElement {
    pk: GraphPartitionKey;
}

export interface GraphEdge extends GraphElement {
    
}

export type NewGraphElement<T extends GraphElement> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;