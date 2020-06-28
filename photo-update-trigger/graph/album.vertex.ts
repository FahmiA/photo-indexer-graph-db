import { GraphElement } from "./graph.element";

export interface AlbumVertex extends GraphElement {
    label: 'album',
    name: string;
    days: number;
    place: string;
    startedAt: string;
    endedAt: string;
}