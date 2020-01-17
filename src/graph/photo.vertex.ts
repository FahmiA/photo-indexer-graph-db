import { GraphElement } from './graph.element';

export interface PhotoVertex extends GraphElement {
    path: string;
    capturedAt?: string;
}