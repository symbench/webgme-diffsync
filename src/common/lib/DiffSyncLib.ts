export type Diff<T> = T | any;

export interface Delta<T> {
    timeStamp: number;
    patches: Diff<T>;
}


// In an atomic update operation following things should happen(Context clientText is VizState; serverText is GMENode
// 1. Diff ClientText with Shadow (get patches)
// 2. Apply patches to the GMENode
// 3. Update Shadow with clientText
// All these tasks are atomic but not blocking

export interface UpdateTask<T2, T3> {
    shadow: T2;
    state: T2;
    target: T3;
    diff: () => Delta<T2>;
    patch: (patches: Delta<T2>) => Promise<void>;
    onComplete: (finalState: T2) => void;
}

export interface GMEDiffSync<T1, T2, T3> {
    shadow: T2;
    onUpdatesFromClient(input: T3, target: T1) : Promise<void>;
    onUpdatesFromServer(input: T1, target: T3): Promise<void>;
}