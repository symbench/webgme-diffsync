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
import NodeState from "webgme-json-importer/lib/common/JSONImporter/NodeState";
import {nodePatch, nodeStatePatch} from "./Differs";

class WJIDiff extends NodeChangeSet implements Diff<NodeState> {}

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

    constructor(shadow: NodeState, importer: JSONImporter){
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

    constructor(shadow: NodeState){
        this.shadow = deepCopy(shadow);
    }


    apply(state: NodeState, diff: NodeChangeSetPatch): void {
        nodeStatePatch(state, diff.patches as NodeChangeSet[]);
    }

    convert(input: NodeState): NodeState {
        return deepCopy(input);
    }
}

class UpdateTask {
    shadow: NodeState;
    state: NodeState;
    target: Core.Node | NodeState;
    diffFunction: any;
    patchFunction: any;

    constructor(shadow, state, target, diff, patch) {

    }

}

class UpdateQueue {
    internal: UpdateTask[];
    constructor() {

    }

}


class WJIDiffSync implements GMEDiffSync<Core.Node, NodeState, NodeState> {
    clientTransform: WJItoWJITransform;
    serverTransform: GMENodetoWJITransform;
    shadow: NodeState;
    importer: JSONImporter;

    constructor(importer: JSONImporter, shadow: NodeState) {
        this.importer = importer;
        this.shadow = shadow;
    }

    onUpdatesFromClient(input: NodeState): Promise<void> {
        return Promise.resolve(undefined);
    }

    onUpdatesFromServer(input: Core.Node): Promise<void> {
        return Promise.resolve(undefined);
    }
}
