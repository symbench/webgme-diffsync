export type Diff<T> = T | any;

export interface Delta<T> {
    timeStamp: number | string;
    patches: Diff<T>;
}

export enum DiffSyncTaskStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    FAILED = 'failed',
    SUCCEEDED = 'succeeded'
}

export interface FailedPatch<T2> {
    data: Delta<T2>;
    failureReason: string;
}

// In an atomic update operation following things should happen(Context clientText is VizState; serverText is GMENode
// 1. Diff ClientText with Shadow (get patches)
// 2. Apply patches to the GMENode
// 3. Update Shadow with clientText
// All these tasks are atomic but not blocking

export interface DiffSyncTask<T2, T3> {
    shadow: T2;
    state: T2;
    target: T3;
    diff: () => Delta<T2>;
    patch: (patches: Delta<T2>) => Promise<void>;
    onComplete: (finalState: T2) => void;
    onFailed: (e: Error, data: Delta<T2>) => void;
    status: DiffSyncTaskStatus;
}

export interface GMEDiffSync<T1, T2, T3> {
    shadow: T2;
    onUpdatesFromClient(input: T3, target: T1) : Promise<void>;
    onUpdatesFromServer(input: T1, target: T3): Promise<void>;
}