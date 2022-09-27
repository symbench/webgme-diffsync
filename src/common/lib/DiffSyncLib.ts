export type DiffFunction = (input: WJIJson, newState: WJIJson) => NodeChangeSet[];

export enum NodeChangeSetType {
    put='put',
    delete='del'
}

type ChangeKeyType = [keyof WJIJson, ...Array<any>];

export interface NodeChangeSet {
    parentPath: string,
    nodeId: string,
    type: NodeChangeSetType,
    key: ChangeKeyType,
    value: any
}

export type WJIImporterType = any;

export interface Delta {
    timeStamp: number;
    patches: any;
}

export interface StateTransformer<T1, T2> {
    convert(input: T1) : T2 | Promise<T2>;
    apply(state: T1, patch: Delta, context: {canPatch: (a: NodeChangeSet) => boolean}) : void | Promise<void>;
}

export interface Differ<T2> {
    diffFunc: DiffFunction;
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
    mixins?: string[];
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