export type DiffFunction = (input: WJIJson, newState: WJIJson) => Delta;
export type NodeChangeSet = any;
export type WJIImporterType = any;

export interface Delta {
    timeStamp: number;
    patches: any;
}

export interface StateTransformer<T1, T2> {
    convert(input: T1) : T2 | Promise<T2>;
    apply(state: T1, patch: Delta) : void | Promise<void>;
}

export interface Differ<T2> {
    diff(state: T2, newState: T2) : Delta
}

export interface WJIJson {
    id: string;
    path?: string;
    guid: string;
    attributes?: { [key: string]: any };
    attribute_meta?: { [key: string]: any };
    pointers?: { [key: string]: any };
    pointer_meta?: { [key: string]: any };
    mixins?: { [key: string]: any }[];
    registry?: { [key: string]: any };
    sets?: { [key: string]: any };
    member_attributes?: { [key: string]: any };
    member_registry?: { [key: string]: any };
    children_meta?: { [key: string]: any };
    children?: WJIJson[];
}

export interface GMEDiffSync<T1, T2, T3> {
    shadow: T2;
    serverTransform: StateTransformer<T1, T2>;
    clientTransform: StateTransformer<T3, T2>;
    differ: Differ<T2>;
    onUpdatesFromClient(input: T3) : Promise<void>;
    onUpdatesFromServer(input: T1): Promise<void>;
}