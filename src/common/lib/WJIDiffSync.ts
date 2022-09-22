import {DiffFunction, Delta, Differ, GMEDiffSync, NodeChangeSet, StateTransformer, WJIImporterType, WJIJson} from './DiffSyncLib';
import {deepCopy} from './Utils';

export class WJIDelta implements Delta {
    patches: any;
    timeStamp: number;

    constructor(timeStamp: number, patches: any) {
        this.timeStamp = timeStamp;
        this.patches = patches;
    }

    static fromNodeChangeSet(changeSets: NodeChangeSet[]) {
        return new WJIDelta(Date.now(), changeSets);
    }
}

type ServerUpdateType = {updater: NodeToWJITransformer, delta: WJIDelta, state: Core.Node};
type ClientUpdateType = {updater: WJIToWJITransformer, delta: WJIDelta, state: WJIJson};

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
        // @ts-ignore
        await task.updater.apply(task.state, task.delta);
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

    async apply(node: Core.Node, edits: WJIDelta): Promise<void> {
        const wjiDiffs = edits.patches;
        await this.importer.patch(node, wjiDiffs);
    }

    async convert(node: Core.Node): Promise<WJIJson> {
        return await this.importer.toJSON(node);
    }
}

export class WJIToWJITransformer implements StateTransformer<WJIJson, WJIJson> {
    async apply(state: WJIJson, edits: WJIDelta): Promise<void> {
        const wjiDiffs = edits.patches;
        // @ts-ignore
        wjiDiffs.forEach(diff => {
            console.log(diff);
            if(diff.type === 'put') {
                const [key, toChange] = diff.key;
                if(key === 'attributes') {
                    this.putAttributes(state, toChange, diff.value);
                }
            }
        });
    }

    putAttributes(state:WJIJson, toChange: string, value: any) {
        if(state.attributes) {
            state.attributes[toChange] = value;
        }
    }

    convert(input: WJIJson): WJIJson {
        return input;
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
        const diff = this.differ.diff(this.shadow, clientState);
        this.shadow = clientState;
        this.updateQueue.request({
            updater: this.serverTransform,
            delta: diff,
            state: this.serverState
        });
    }

    async onUpdatesFromServer(node: Core.Node): Promise<void> {
        console.log('onUpdatesFromServer');
        const serverState = await this.serverTransform.convert(node);
        console.log(serverState.attributes, '>>>');
        const diff = this.differ.diff(this.shadow, serverState);
        this.shadow = serverState;
        this.updateQueue.request({
            updater: this.clientTransform, delta: diff, state: this.clientState
        });
    }
}