import {
    Delta,
    Differ,
    DiffFunction,
    GMEDiffSync,
    NodeChangeSet,
    NodeChangeSetType,
    StateTransformer,
    WJIImporterType,
    WJIJson
} from './DiffSyncLib';
import {deepCopy} from './Utils';


export class WJIDelta implements Delta {
    patches: NodeChangeSet[];
    timeStamp: number;

    constructor(timeStamp: number, patches: any) {
        this.timeStamp = timeStamp;
        this.patches = patches;
    }

    static fromNodeChangeSet(changeSets: NodeChangeSet[]) {
        return new WJIDelta(Date.now(), changeSets);
    }
}

type ServerUpdateType = {updater: NodeToWJITransformer, delta: WJIDelta, state: Core.Node, context: PatchContext};
type ClientUpdateType = {updater: WJIToWJITransformer, delta: WJIDelta, state: WJIJson, context: PatchContext};

export class PatchContext {
    donotPatch : Set<string>;

    constructor() {
        this.donotPatch = new Set();
    }

    canPatch(diff: NodeChangeSet) {
        return !this.donotPatch.has(diff.nodeId);
    }

    isOfInterest(diff: NodeChangeSet) {
        return diff.type === NodeChangeSetType.delete && diff.key[0] === 'children';
    }

    blackList(diff: NodeChangeSet) {
        return this.donotPatch.add(diff.nodeId);
    }

    clear() {
        this.donotPatch.clear();
    }
}

export class UpdateQueue {
    internalQueue: (ServerUpdateType | ClientUpdateType)[] ;
    doing: boolean;

    constructor() {
        this.internalQueue = [];
        this.doing = false;
    }

    enqueue(task: ServerUpdateType | ClientUpdateType) {
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

    request(task: ServerUpdateType | ClientUpdateType) {
        if(this.doing) {
            this.enqueue(task);
        } else {
            this.do(task);
        }
    }

    async do(task: ServerUpdateType | ClientUpdateType) {
        this.doing = true;
        if(task.updater instanceof WJIToWJITransformer) {
            await task.updater.apply(task.state as WJIJson, task.delta, task.context);
        } else {
            await task.updater.apply(task.state as Core.Node, task.delta, task.context);
        }
        const next = this.dequeue();
        if(next) {
            this.do(next);
        }
        this.doing = false;
    }
}


export class NodeToWJITransformer implements StateTransformer<Core.Node, WJIJson> {
    importer: WJIImporterType;

    constructor(importer: WJIImporterType) {
        this.importer = importer;
    }

    async apply(node: Core.Node, edits: WJIDelta, context: PatchContext): Promise<void> {
        const wjiDiffs = edits.patches;
        await this.importer.patch(node, wjiDiffs.filter(diff => context.canPatch(diff)));
    }

    async convert(node: Core.Node): Promise<WJIJson> {
        return await this.importer.toJSON(node);
    }
}

class StateCache {
    cache: {[key: string]: WJIJson};
    state: WJIJson;
    constructor(state: WJIJson) {
        this.cache = {};
        this.state = state;
    }

    record(nodeId: string, state: WJIJson) {
        this.cache[nodeId] = state;
    }

    find(nodeId: string, state: WJIJson) {
        if(nodeId == state.id) {
            this.record(nodeId, state);
        } else {
            state.children?.forEach(child => {
                return this.find(nodeId, child);
            });
        }
    }

    get(nodeId: string): WJIJson {
        if(!this.cache[nodeId]) {
            this.find(nodeId, this.state);
        }
        if(this.cache[nodeId]) {
            return this.cache[nodeId];
        } else {
            throw new Error(`state for node Id: ${nodeId} not found`);
        }
    }
}

export class WJIToWJITransformer implements StateTransformer<WJIJson, WJIJson> {

    async apply(state: WJIJson, edits: WJIDelta, context: PatchContext): Promise<void> {
        const wjiDiffs = edits.patches.filter(diff => context.canPatch(diff));
        const cache = new StateCache(state);
        wjiDiffs.forEach(diff => {
            const nodeId = diff.nodeId;
            const state = cache.get(nodeId);
            switch (diff.type) {
                case NodeChangeSetType.put:
                    this.put(state, diff);
                    break;
                case NodeChangeSetType.delete:
                    this.delete(state, diff);
                    break;
            }
        });
    }

    put(state: WJIJson, diff: NodeChangeSet) {
        const [key] = diff.key;
        switch (key as keyof WJIJson) {
            case 'children':
                state.children = state.children || [];
                state.children.push(diff.value as WJIJson);
                break;
            default:
                this.putChangeSets(state, diff);
                break;
        }
    }

    delete(state: WJIJson, diff: NodeChangeSet) {
        const [key] = diff.key;
        switch (key as keyof WJIJson) {
            case 'children':
                this.deleteChild(state, diff);
                break;
            default:
                this.deleteChangeSets(state, diff);
                break;
        }
    }

    deleteChild(state: WJIJson, diff: NodeChangeSet) {
        const childIndex = (state.children || []).findIndex(child => child.id === diff.value);
        if(childIndex > -1) {
            state.children?.splice(childIndex, 1);
        }
    }


    deleteChangeSets(state: WJIJson | null, diff: NodeChangeSet) {
        let ptr: any, keys, len: number;
        ptr = ptr;
        keys = diff.key;
        len = keys.length;
        if (len) {
            keys.forEach(function (prop, i) {
                if (!(prop in ptr)) {
                    ptr[prop] = {};
                }

                if (i < len - 1) {
                    ptr = ptr[prop];
                } else {
                    if (Array.isArray(ptr)) {
                        ptr.splice(parseInt(prop, 10), 1);
                    } else if (ptr.hasOwnProperty(prop)) {
                        delete ptr[prop];
                    }
                }
            });
        } else {
            state = null;
        }
        return state;
    }

    putChangeSets(state: WJIJson, diff: NodeChangeSet) {
        let ptr: any = state;
        const keys = diff.key;
        ptr = state;
        const len = keys.length;
        if (len) {
            keys.forEach(function (prop, i) {
                if (!(prop in ptr)) {
                    ptr[prop] = {};
                }

                if (i < len - 1 && ptr.hasOwnProperty(prop)) {
                    ptr = ptr[prop];
                } else {
                    ptr[prop] = diff.value;
                }
            });
        } else {
            state = diff.value;
        }
        return state;
    }

    convert(input: WJIJson): WJIJson {
        return deepCopy(input);
    }
}

export class WJIDiff implements Differ<WJIJson> {
    diffFunc: DiffFunction;

    constructor(diff:  DiffFunction) {
        this.diffFunc = diff;
    }

    diff(state: WJIJson, newState: WJIJson): WJIDelta {
        const changeSets = this.diffFunc(deepCopy(state), deepCopy(newState));
        return WJIDelta.fromNodeChangeSet(changeSets);
    }
}

export class WJIDiffSync implements GMEDiffSync<Core.Node, WJIJson, WJIJson> {
    shadow: WJIJson;
    serverTransform: NodeToWJITransformer;
    clientTransform: WJIToWJITransformer;
    importer: WJIImporterType;
    differ: WJIDiff;
    serverState: Core.Node;
    clientState: WJIJson;
    updateQueue: UpdateQueue = new UpdateQueue();
    clientContext: PatchContext = new PatchContext();
    serverContext: PatchContext = new PatchContext();


    constructor(
        serverState: Core.Node,
        shadow: WJIJson,
        clientState: WJIJson,
        importer: WJIImporterType,
        diff: DiffFunction,
    ) {
        this.serverState = serverState;
        this.shadow = shadow;
        this.importer = importer;
        this.clientState = clientState;
        this.serverTransform = new NodeToWJITransformer(this.importer);
        this.clientTransform = new WJIToWJITransformer();
        this.differ = new WJIDiff(diff);
    }

    async onUpdatesFromClient(clientState: WJIJson): Promise<void> {
        console.log('onUpdatesFromClient');
        const clientStateSnapShot = this.clientTransform.convert(clientState);
        const diff = this.differ.diff(this.shadow, clientStateSnapShot);
        if(diff.patches.length) {
            diff.patches
                .filter(patch => this.serverContext.isOfInterest(patch))
                .forEach(patch => this.serverContext.blackList(patch));
        } else {
            this.clientContext.clear();
        }
        this.shadow = clientStateSnapShot;
        this.updateQueue.request({
            updater: this.serverTransform,
            delta: diff,
            state: this.serverState,
            context: this.serverContext
        });
    }

    async onUpdatesFromServer(node: Core.Node): Promise<void> {
        console.log('onUpdatesFromServer');
        const serverStateSnapshot = await this.serverTransform.convert(node);
        const diff = this.differ.diff(this.shadow, serverStateSnapshot);
        if(diff.patches.length) {
            diff.patches
                .filter(patch => this.serverContext.isOfInterest(patch))
                .forEach(patch => this.serverContext.blackList(patch));
        } else {
            this.serverContext.clear();
        }
        this.shadow = serverStateSnapshot;
        this.updateQueue.request({
            updater: this.clientTransform, delta: diff, state: this.clientState, context: this.clientContext
        });
    }
}