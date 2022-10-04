import {
    Delta,
    Diff,
    Differ,
    DiffFunction,
    GMEDiffSync,
    StateTransformer
} from './DiffSyncLib';
import JSONImporter, {gmeDiff, NodeChangeSet} from 'webgme-json-importer/lib/common/JSONImporter';
import {deepCopy} from "./Utils";
import NodeState from 'webgme-json-importer/lib/common/JSONImporter/NodeState';
import {diffNodeStates, nodePatch, nodeStatePatch} from "./Differs";
import diff from "changeset";

class WJIDiff extends NodeChangeSet implements Diff<NodeState> {
}

class NodeChangeSetPatch implements Delta<NodeState> {
    patches: WJIDiff[];
    timeStamp: number;

    constructor(patches: WJIDiff[]) {
        this.patches = patches;
        this.timeStamp = Date.now();
    }

    static fromNodeChangeSets(changeSets: NodeChangeSet[]) {
        const patches = changeSets.map(changeSet => {
            return new WJIDiff(
                changeSet.parentPath,
                changeSet.nodeId,
                changeSet.type,
                changeSet.key,
                changeSet.value
            );
        });
        return new NodeChangeSetPatch(patches);
    }
}

class GMENodetoWJITransform implements StateTransformer<Core.Node, NodeState> {
    shadow: NodeState;
    importer: JSONImporter;

    constructor(shadow: NodeState, importer: JSONImporter) {
        this.shadow = deepCopy(shadow);
        this.importer = importer;
    }

    async apply(state: Core.Node, diff: NodeChangeSetPatch): Promise<void> {
        await nodePatch(state, diff.patches as NodeChangeSet[], this.importer);
    }

    async convert(input: Core.Node): Promise<NodeState> {
        const jsonNode = await this.importer.toJSON(input);
        return jsonNode as NodeState;
    }
}

class WJItoWJITransform implements StateTransformer<NodeState, NodeState> {
    shadow: NodeState;

    constructor(shadow: NodeState) {
        this.shadow = deepCopy(shadow);
    }


    apply(state: NodeState, diff: NodeChangeSetPatch): void {
        nodeStatePatch(state, diff.patches as NodeChangeSet[]);
    }

    convert(input: NodeState): NodeState {
        return deepCopy(input);
    }
}


// In an atomic update operation following things should happen(Context clientText is VizState; serverText is GMENode
// 1. Diff ClientText with Shadow (get patches)
// 2. Apply patches to the GMENode
// 3. Update Shadow with clientText

interface UpdateTask<T2, T3> {
    shadow: T2;
    state: T2;
    target: T3;
    diff: () => Delta<T2>;
    patch: (patches: Delta<T2>) => Promise<void>;
}

class GMENodeUpdate implements UpdateTask<NodeState, Core.Node> {
    shadow: NodeState;
    state: NodeState;
    target: Core.Node;
    parentPath: string;
    importer: JSONImporter;


    constructor(shadow: NodeState, state: NodeState, target: Core.Node, importer: JSONImporter, parentPath = '') {
        this.shadow = shadow;
        this.state = state;
        this.target = target;
        this.parentPath = parentPath;
        this.importer = importer;
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

class NodeStateUpdate implements UpdateTask<NodeState, NodeState> {
    shadow: NodeState;
    state: NodeState;
    target: NodeState;

    constructor(shadow: NodeState, state: NodeState, target: NodeState) {
        this.shadow = shadow;
        this.state = state;
        this.target = target;
    }

    diff(): Delta<NodeState> {
        const diffs = diffNodeStates(this.shadow, this.state, this.parentPath);
        return {
            timeStamp: Date.now(),
            patches: diffs
        };
    }

    patch(diff: Delta<NodeState>): Promise<void> {
        return Promise.resolve(nodeStatePatch(this.target, diff.patches));
    }
}

type UpdateTaskType =(NodeStateUpdate|GMENodeUpdate);

export class UpdateQueue {
    internalQueue: UpdateTaskType[] ;
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
        if(this.doing) {
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
        if(next) {
            this.do(next);
        }
        this.doing = false;
    }
}


export class WJIDiffSync {
    shadow: NodeState;
    importer: JSONImporter;
    updateQueue = new UpdateQueue();

    constructor(importer: JSONImporter, shadow: NodeState) {
        this.importer = importer;
        this.shadow = shadow;
    }

    onUpdatesFromClient(input: NodeState, target: Core.Node) {
        const updateTask = new GMENodeUpdate(
            this.shadow,
            input,
            target,
            this.importer
        );

        this.updateQueue.request(updateTask);
    }

    async onUpdatesFromServer(input: Core.Node, target: NodeState): Promise<void> {
        const inputState = await this.importer.toJSON(input) as NodeState;
        const updateTask = new NodeStateUpdate(
            this.shadow,
            inputState,
            target,
        );
        this.updateQueue.request(updateTask);
    }
}
