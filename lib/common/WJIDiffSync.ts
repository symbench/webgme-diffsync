import {
    Delta,
    DiffSyncTask,
    GMEDiffSync
} from './DiffSyncLib';
import JSONImporter, {NodeChangeSet} from 'webgme-json-importer/lib/common/JSONImporter';
import NodeState from 'webgme-json-importer/lib/common/JSONImporter/NodeState';
import {diffNodeStates, nodePatch, nodeStatePatch} from './Differs';
import {deepCopy} from "./Utils";

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
    onComplete: (finalState: NodeState) => void;

    constructor(
        shadow: NodeState,
        state: NodeState,
        target: Core.Node,
        importer: JSONImporter,
        onComplete: (finalState: NodeState) => void,
        parentPath = ''
    ) {
        this.shadow = shadow;
        this.state = state;
        this.target = target;
        this.parentPath = parentPath;
        this.importer = importer;
        this.onComplete = onComplete;
    }

    diff(): Delta<NodeState> {
        const diffs = diffNodeStates(this.shadow, this.state, this.parentPath);
        return {
            timeStamp: Date.now(),
            patches: diffs
        };
    }

    async patch(diff: Delta<NodeState>): Promise<void> {
        await nodePatch(this.target, diff.patches, this.importer);
    }
}

class NodeStateUpdate implements DiffSyncTask<NodeState, NodeState> {
    shadow: NodeState;
    state: NodeState;
    target: NodeState;
    parentPath: string;
    onComplete: (finalState: NodeState) => void;

    constructor(shadow: NodeState, state: NodeState, target: NodeState, onComplete: (finalState: NodeState) => void, parentPath = '') {
        this.shadow = shadow;
        this.state = state;
        this.target = target;
        this.onComplete = onComplete;
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
        nodeStatePatch(this.target, diff.patches);
        if (this.onComplete) {
            this.onComplete(this.state);
        }
        return Promise.resolve();
    }
}

type UpdateTaskType = (NodeStateUpdate | GMENodeUpdate);

export class UpdateQueue {
    internalQueue: UpdateTaskType[];
    doing: boolean;

    constructor() {
        this.internalQueue = [];
        this.doing = false;
    }

    enqueue(task: UpdateTaskType) {
        this.internalQueue.push(task);
    }

    dequeue() {
        return this.internalQueue.shift();
    }

    clear() {
        this.internalQueue = [];
    }

    isEmpty() {
        return this.internalQueue.length === 0;
    }

    request(task: UpdateTaskType) {
        if (this.doing) {
            this.enqueue(task);
        } else {
            this.do(task);
        }
    }

    async do(task: UpdateTaskType) {
        this.doing = true;
        const diffs = await task.diff();

        await task.patch(diffs);
        const next = this.dequeue();
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
            this.parentPath
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
            this.onPatchComplete.bind(this)
        );
        this.updateQueue.request(updateTask);
    }

    onPatchComplete(shadow: NodeState) {
        this.shadow = shadow;
    }
}
