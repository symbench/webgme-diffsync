/* globals define */
/* eslint-env node, browser */
define([], function () {
    function NodeDiffFactory(diff, rootParentPath = null, NodeChangeSet) {
        function omit(obj, keys) {
            const result = Object.assign({}, obj);
            keys.forEach(key => delete result[key]);
            return result;
        }

        function compare(obj, obj2, ignore = ['id', 'children']) {
            return diff(
                omit(obj, ignore),
                omit(obj2, ignore),
            );
        }

        function _getSortedStateChanges(prevState, newState) {
            const keyOrder = [
                'children_meta',
                'pointer_meta',
                'pointers',
                'mixins',
                'sets',
                'member_attributes',
                'member_registry',
            ];

            const changes = compare(prevState, newState);
            const singleKeyFields = ['children_meta', 'guid'];
            const sortedChanges = changes.filter(
                change => change.key.length > 1 ||
                    (singleKeyFields.includes(change.key[0]) && change.type === 'put')
            )
                .map((change, index) => {
                    let order = 2 * keyOrder.indexOf(change.key[0]);
                    if (change.type === 'put') {
                        order += 1;
                    }
                    return [order, index];
                })
                .sort((p1, p2) => p1[0] - p2[0])
                .map(pair => changes[pair[1]]);
            return sortedChanges;
        }

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
                    return diffFunc(child, existingChild, newState.path);
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

            const changes = _getSortedStateChanges(prevState, newState);
            if(changes.length) {
                diffs.push(...changes.map(
                    change => NodeChangeSet.fromDiffObj(
                        parentPath,
                        newState.id || newState.path,
                        change
                    )
                ));
            }
            if(newState.children && currentChildren.length) {
                const deletions = currentChildren.map(child =>{
                    const  childPath = child.path;
                    return new NodeChangeSet(
                        newState.path,
                        childPath,
                        'del',
                        ['children'],
                        childPath
                    );
                });
                diffs.push(...deletions);
            }
            return diffs;
        };

        return diffFunc;
    }

    return {NodeDiffFactory};
});