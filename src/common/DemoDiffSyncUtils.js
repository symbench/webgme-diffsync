/* globals define */
/* eslint-env node, browser */
define([
    'webgme-json-importer/JSONImporter',
], function (
    Importer
) {
    const {gmeDiff, NodeChangeSet} = Importer;
    function NodeDiffFactory(rootParentPath = null) {
        const diffFunc = (prevState, newState, parentPath = rootParentPath) => {
            const diffs = [];
            const currentChildren = prevState.children || [];
            const children = newState.children || [];
            diffs.push(...children.map(child => {
                const existingChild = currentChildren.find(currentChild => currentChild.id === child.id);
                const index = currentChildren.indexOf(existingChild);
                if (index > -1) {
                    currentChildren.splice(index, 1);
                }

                if (existingChild) {
                    return diffFunc(existingChild, child, newState.path);
                } else {
                    return new NodeChangeSet(
                        newState.path,
                        child.id,
                        'put',
                        ['children'],
                        child
                    );
                }
            }).flat());

            const changes = gmeDiff(prevState, newState);
            if(changes.length) {
                diffs.push(...changes.map(
                    change => NodeChangeSet.fromChangeSet(
                        parentPath,
                        newState.id || newState.path,
                        change
                    )
                ));
            }
            if(newState.children && currentChildren.length) {
                const deletions = currentChildren.map(child =>{
                    return new NodeChangeSet(
                        newState.path,
                        newState.id,
                        'del',
                        ['children'],
                        child.id
                    );
                });
                diffs.push(...deletions);
            }
            return diffs;
        };

        return diffFunc;
    }

    class SaveTask {
        constructor(synchronizer, project, branchName, parentCommit) {
            this.synchronizer = synchronizer;
            this.project = project;
            this.branchName = branchName;
            this.parentCommit = parentCommit;
            this.canceled = false;
        }

        async save(currentNodeId, json) {
            const {core, rootNode} = this.synchronizer.importer;
            const activeNode = await core.loadByPath(rootNode, currentNodeId);
            if(this.canceled) return;
            await this.synchronizer.onUpdatesFromClient(json);
            if (this.canceled) return;
            const {rootHash, objects} = core.persist(rootNode);
            const nodeName = core.getAttribute(activeNode, 'name');

            await this.project.makeCommit(
                this.branchName,
                [this.parentCommit],
                rootHash,
                objects,
                `Updated WJI for ${nodeName}`,
            );
        }

        cancel() {
            this.canceled = true;
        }
    }

    return {NodeDiffFactory, SaveTask};
});