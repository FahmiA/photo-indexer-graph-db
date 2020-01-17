import { GraphElement } from "./graph.element";

export interface CountryVertex extends GraphElement {
    label: 'country';
    name: string;
}