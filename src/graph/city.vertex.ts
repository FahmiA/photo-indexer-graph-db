import { GraphElement } from "./graph.element";

export interface CityVertex extends GraphElement {
    label: 'city',
    name: string;
    uniqueName: string;
}