import { GraphVertex } from './graph.element';

export interface PhotoVertex extends GraphVertex {
    label: 'photo',
    path: string;
    capturedAt?: string;
    hash: string;
}