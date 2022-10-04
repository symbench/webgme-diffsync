import {gmeDiff} from 'webgme-json-importer/lib/common/JSONImporter/SortedChanges';
import diff from 'changeset';
import NodeState from 'webgme-json-importer/lib/common/JSONImporter/NodeState';
import {NodeChangeSet, NodeChangeSetType} from 'webgme-json-importer/lib/common/JSONImporter/NodeChangeSet';
import JSONImporter from "webgme-json-importer/lib/common/JSONImporter";

class StateCache {
    cache: {[key: string]: Partial<NodeState>};
    state: Partial<NodeState>;
    constructor(state: Partial<NodeState>) {
        this.cache = {};
        this.state = state;
    }

    record(nodeId: string, state: Partial<NodeState>) {
        this.cache[nodeId] = state;
    }

    find(nodeId: string, state: Partial<NodeState>) {
        if(nodeId == state.id) {
            this.record(nodeId, state);
        } else {
            state.children?.forEach(child => {
                return this.find(nodeId, child);
            });
        }
    }

    get(nodeId: string): Partial<NodeState> {
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

export function diffNodeStates(prev: Partial<NodeState>, new_: Partial<NodeState>, parentPath: string | undefined): NodeChangeSet[] {
    const diffs = [];
    const currentChildren = prev.children || [];
    const children = new_.children || [];
    diffs.push(...children.map(child => {
        const existingChild = currentChildren.find(currentChild => currentChild.id === child.id);
        if (existingChild) {
            const index = currentChildren.indexOf(existingChild);
            if (index > -1) {
                currentChildren.splice(index, 1);
            }
        }


        if (existingChild) {
            return diffNodeStates(existingChild, child, new_.path);
        } else {
            return new NodeChangeSet(
                new_.path || '',
                child.id || '',
                NodeChangeSetType.PUT,
                ['children'],
                child
            );
        }
    }).flat());

    const changes = gmeDiff(prev as NodeState, new_ as NodeState);
    if (changes.length) {
        diffs.push(...changes.map(
            change => NodeChangeSet.fromChangeSet(
                parentPath || '',
                new_.id || new_.path || '',
                change
            )
        ));
    }
    if (new_.children && currentChildren.length) {
        const deletions = currentChildren.map(child => {
            return new NodeChangeSet(
                new_.path as string,
                new_.id as string,
                NodeChangeSetType.DEL,
                ['children'],
                child.id
            );
        });
        diffs.push(...deletions);
    }

    return diffs;
}

export function nodeStatePatch(state: NodeState, patches: NodeChangeSet[]) {
    const cache = new StateCache(state);
    patches.forEach(patch => {
        const patchState = cache.get(patch.nodeId);
        const key = patch.key[0];
        switch (patch.type) {
            case NodeChangeSetType.PUT:
                key === 'children' ? state.children = [patch.value].flat(): diff.apply([patch], patchState, true);
                break;
            case NodeChangeSetType.DEL:
                key === 'children'? state.children = [] : diff.apply([patch], patchState, true);
                break;
        }
    });

    return state;
}

export async function nodePatch(node: Core.Node, patches: NodeChangeSet[], importer: JSONImporter) {
    await importer.patch(node, patches);
}

