import { GraphVertex } from "./graph.element";

export interface CityVertex extends GraphVertex {
    label: 'city',
    uniqueName: string;
}