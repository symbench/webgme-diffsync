export type Diff<T> = T | any;
export type DiffFunction<T2> = (input: T2, newState: T2) => Diff[];

export interface Delta<T> {
    timeStamp: number;
    patches: Diff<T>;
}

export interface StateTransformer<T1, T2> {
    shadow: T2;
    convert(input: T1) : T2 | Promise<T2>;
    apply(state: T1, patch: Delta<T2>) : void | Promise<void>;
}

export interface Differ<T2> {
    diffFunc: DiffFunction<T2>;
    diff(state: T2, newState: T2): Delta<T2>;
}

export interface GMEDiffSync<T1, T2, T3> {
    shadow: T2;
    serverTransform: StateTransformer<T1, T2>;
    clientTransform: StateTransformer<T3, T2>;
    differ: Differ<T2>;
    onUpdatesFromClient(input: T3) : Promise<void>;
    onUpdatesFromServer(input: T1): Promise<void>;
}