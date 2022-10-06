import {Delta, DiffSyncTask, DiffSyncTaskStatus, FailedPatch, GMEDiffSync} from './DiffSyncLib';
import JSONImporter, {NodeChangeSet} from 'webgme-json-importer/lib/common/JSONImporter';
import NodeState from 'webgme-json-importer/lib/common/JSONImporter/NodeState';
import {diffNodeStates, nodePatch, nodeStatePatch} from './Differs';
import {deepCopy} from './Utils';


class NodeChangeSetPatch implements Delta<NodeState> {
    patches: NodeChangeSet[];
    timeStamp: number;

    constructor(patches: NodeChangeSet[]) {
        this.patches = patches;
        this.timeStamp = Date.now();
    }

    static fromNodeChangeSets(changeSets: NodeChangeSet[]) {
        return new NodeChangeSetPatch(changeSets);
    }
}

class GMENodeUpdate implements DiffSyncTask<NodeState, Core.Node> {
    shadow: NodeState;
    state: NodeState;
    target: Core.Node;
    parentPath: string;
    importer: JSONImporter;
    status: DiffSyncTaskStatus = DiffSyncTaskStatus.PENDING;
    onFailed: (e: Error, data: Delta<NodeState>) => void;

    onComplete: (finalState: NodeState) => void;

    constructor(
        shadow: NodeState,
        state: NodeState,
        target: Core.Node,
        importer: JSONImporter,
        onComplete: (finalState: NodeState) => void,
        onFailed: (e: Error, data: Delta<NodeState>) => void,
        parentPath = ''
    ) {
        this.shadow = shadow;
        this.state = state;
        this.target = target;
        this.parentPath = parentPath;
        this.importer = importer;
        this.onComplete = onComplete;
        this.onFailed = onFailed;
    }

    diff(): Delta<NodeState> {
        const diffs = diffNodeStates(this.shadow, this.state, this.parentPath);
        return {
            timeStamp: Date.now(),
            patches: diffs
        };
    }

    async patch(diff: Delta<NodeState>): Promise<void> {
        try {
            this.status = DiffSyncTaskStatus.RUNNING;
            await nodePatch(this.target, diff.patches, this.importer);
            this.status = DiffSyncTaskStatus.SUCCEEDED;
        } catch (e) {
            this.status = DiffSyncTaskStatus.FAILED;
            if(this.onFailed) {
                this.onFailed(e as Error, diff);
            }
        }

        if(this.onComplete) {
            this.onComplete(this.state);
        }
    }

}

class NodeStateUpdate implements DiffSyncTask<NodeState, NodeState> {
    shadow: NodeState;
    state: NodeState;
    target: NodeState;
    parentPath: string;
    onComplete: (finalState: NodeState) => void;
    onFailed: (e: Error, data: Delta<NodeState>) => void;
    status: DiffSyncTaskStatus = DiffSyncTaskStatus.PENDING;

    constructor(
        shadow: NodeState,
        state: NodeState,
        target: NodeState,
        onComplete: (finalState: NodeState) => void,
        onFailed: (e: Error, data: Delta<NodeState>) => void,
        parentPath = ''
    ) {
        this.shadow = shadow;
        this.state = state;
        this.target = target;
        this.onComplete = onComplete;
        this.onFailed = onFailed;
        this.parentPath = parentPath;
    }

    diff(): Delta<NodeState> {
        const diffs = diffNodeStates(this.shadow, this.state, this.parentPath || '');
        return {
            timeStamp: Date.now(),
            patches: diffs
        };
    }

    patch(diff: Delta<NodeState>): Promise<void> {
        try {
            this.status = DiffSyncTaskStatus.RUNNING;
            nodeStatePatch(this.target, diff.patches);
            this.status = DiffSyncTaskStatus.SUCCEEDED;
        } catch (e) {
            this.status = DiffSyncTaskStatus.FAILED;
            this.onFailed(e as Error, diff);
        }
        if (this.onComplete) {
            this.onComplete(this.state);
        }
        return Promise.resolve();
    }

}

type UpdateTaskType = (NodeStateUpdate | GMENodeUpdate);

class Queue<T> {
    _internal: T[];
    size: number;

    constructor(size: number) {
        this._internal = [];
        this.size = size;
    }


    enqueue(element: T) {
        if(!this.isFull()) {
            this._internal.push(element);
        } else {
            throw new Error('Queue is full');
        }
    }

    dequeue() {
        return this._internal.shift();
    }

    clear() {
        this._internal = [];
    }

    isEmpty() {
        return this._internal.length === 0;
    }

    isFull() {
        return this._internal.length === this.size;
    }

    get length() {
        return this._internal.length;
    }
}

export class UpdateQueue {
    internalQueue: Queue<UpdateTaskType>;
    doing: boolean;

    constructor() {
        this.internalQueue = new Queue<UpdateTaskType>(2000);
        this.doing = false;
    }

    request(task: UpdateTaskType) {
        if (this.doing) {
            if(!this.internalQueue.isFull()) {
                this.internalQueue.enqueue(task);
            } else {
                console.log('Queue full, no new updates can be added');  // FixMe: What is the correct behavior?
            }
        } else {
            this.do(task);
        }
    }

    async do(task: UpdateTaskType) {
        this.doing = true;
        const diffs = await task.diff();
        await task.patch(diffs);
        const next = this.internalQueue.dequeue();
        if (next) {
            this.do(next);
        }
        this.doing = false;
    }
}


export class WJIDiffSync implements GMEDiffSync<Core.Node, NodeState, NodeState> {
    shadow: NodeState;
    importer: JSONImporter;
    parentPath: GmeCommon.Path | undefined;
    updateQueue = new UpdateQueue();
    clientUpdateFailures = new Queue<FailedPatch<NodeChangeSetPatch>>(5);
    serverUpdateFailures = new Queue<FailedPatch<NodeChangeSetPatch>>(5);

    constructor(importer: JSONImporter, shadow: NodeState, parentPath='') {
        this.importer = importer;
        this.shadow = shadow;
        this.parentPath = parentPath;
    }

    onUpdatesFromClient(input: NodeState, target: Core.Node) {
        const updateTask = new GMENodeUpdate(
            this.shadow,
            deepCopy(input),
            target,
            this.importer,
            this.onPatchComplete.bind(this),
            this.onServerPatchFailed.bind(this)
        );
        this.updateQueue.request(updateTask);
        return Promise.resolve();
    }

    async onUpdatesFromServer(input: Core.Node, target: NodeState): Promise<void> {
        const inputState = await this.importer.toJSON(input) as NodeState;
        const updateTask = new NodeStateUpdate(
            this.shadow,
            inputState,
            target,
            this.onPatchComplete.bind(this),
            this.onClientPatchFailed.bind(this)
        );
        this.updateQueue.request(updateTask);
    }

    onPatchComplete(newShadow: NodeState) {
        this.shadow = newShadow;
    }

    onClientPatchFailed(err: Error, data: Delta<NodeState>) {
        if(this.clientUpdateFailures.isFull()) {
            this.clientUpdateFailures.dequeue();
        }
        
        this.clientUpdateFailures.enqueue({
            failureReason: err.message,
            data: data
        });
    }

    onServerPatchFailed(err: Error, data: Delta<NodeState>) {
        if(this.clientUpdateFailures.isFull()) {
            this.serverUpdateFailures.dequeue();
        }

        this.serverUpdateFailures.enqueue({
            failureReason: err.message,
            data: data
        });
    }
}
