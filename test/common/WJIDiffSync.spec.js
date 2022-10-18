/* eslint-env node, mocha */

describe('WebGMEDiffSyncer', function () {
    const testFixture = require('../globals');
    const Core = testFixture.requirejs('common/core/coreQ');
    const Importer = testFixture.requirejs('webgme-json-importer/JSONImporter');
    const WJIDiffSync = testFixture.requirejs('webgme-diffsync/WJIDiffSync');
    const {deepCopy} = WJIDiffSync;
    const assert = require('assert');
    const gmeConfig = testFixture.getGmeConfig();
    const Q = testFixture.Q;
    let counter = 0;
    const logger = testFixture.logger.fork('JSONImporter');
    const projectName = 'testProject';
    let project,
        gmeAuth,
        storage,
        commitHash,
        core,
        rootNode,
        targetSubtree;

    async function getNewRootNode(core) {
        const branchName = 'test' + counter++;
        await project.createBranch(branchName, commitHash);
        const branchHash = await project.getBranchHash(branchName);
        const commit = await Q.ninvoke(project, 'loadObject', branchHash);
        return await Q.ninvoke(core, 'loadRoot', commit.root);
    }

    before(async function () {
        this.timeout(7500);
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: testFixture.path.join(__dirname, '..', '..', 'src', 'seeds', 'project', 'project.webgmex',),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        project = importResult.project;
        core = new Core(project, {
            globConf: gmeConfig,
            logger: logger.fork('core')
        });
        commitHash = importResult.commitHash;
    });

    beforeEach(async () => {
        rootNode = await getNewRootNode(core);
        targetSubtree = await core.loadByPath(rootNode, '/t');
    });


    describe('client updates', function () {
        let clientState, shadow, diffSync, importer;
        beforeEach(async function () {
            importer = new Importer(core, rootNode);
            clientState = await importer.toJSON(targetSubtree);
            shadow = deepCopy(clientState);
            diffSync = new WJIDiffSync(
                importer,
                shadow
            );
        });

        describe('attributes', function () {
            it('should diff and apply attribute changes from client', async () => {
                assert(clientState.attributes.name === 'Continents');
                clientState.attributes.name = 'Changed Name';
                await diffSync.onUpdatesFromClient(clientState, targetSubtree);
                await delay(10);
                assert(core.getAttribute(targetSubtree, 'name') === 'Changed Name', 'name change not synchronized');
            });

            it('should diff and apply multiple attribute changes throughout the subtree', async () => {

                clientState.children[2].attributes.name = 'Changed Name';
                clientState.children[2].attributes.shortName = 'CN';
                await diffSync.onUpdatesFromClient(clientState, targetSubtree);

                clientState.children[0].attributes.name = 'Changed Name';
                clientState.children[0].attributes.shortName = 'CN';
                await diffSync.onUpdatesFromClient(clientState, targetSubtree);

                await delay(500);

                const child2Path = clientState.children[2].path;
                const child0Path = clientState.children[0].path;

                const child0 = await core.loadByPath(rootNode, child0Path);
                const child2 = await core.loadByPath(rootNode, child2Path);

                assert(core.getAttribute(child2, 'name') === 'Changed Name', 'change not synchronized throughout subtree');
                assert(core.getAttribute(child0, 'name') === 'Changed Name', 'change not synchronized throughout subtree');
            });

            it('should apply multiple concurrent edits from different clients', async () => {
                const diffSync2 = new WJIDiffSync(
                    importer,
                    deepCopy(diffSync.shadow)
                );

                const clientState2 = deepCopy(clientState);

                clientState2.children[1].attributes.name = 'changed name';

                clientState.children[0].attributes.name = 'Afrika';

                diffSync2.onUpdatesFromClient(clientState2, targetSubtree);
                diffSync.onUpdatesFromClient(clientState, targetSubtree);

                await delay(100);

                diffSync.onUpdatesFromServer(targetSubtree, clientState);
                diffSync2.onUpdatesFromServer(targetSubtree, clientState2);

                await delay(50);

                assert(clientState.children[1].attributes.name === 'changed name', 'updates not synchronized on concurrent edits');
                assert(clientState2.children[0].attributes.name === 'Afrika', 'updates not synchronized on concurrent edits');

            });

            it('should not apply attribute changes of a deleted node', async () => {
                const children = await core.loadChildren(targetSubtree);
                clientState.children[0].name = 'changedName';
                diffSync.onUpdatesFromClient(clientState, targetSubtree);
                core.deleteNode(children[0]);

                diffSync.onUpdatesFromServer(targetSubtree, clientState);
                clientState.children[0].name = 'changedName2';

                const currentLength = clientState.children.length;
                diffSync.onUpdatesFromClient(clientState, targetSubtree);

                await delay(1000);
                assert(clientState.children.length === currentLength - 1, JSON.stringify({currentLength, prev: clientState.children.length}));
            });

            it('should not patch attributes removed by server', async () => {
                const children = await core.loadChildren(targetSubtree);
                clientState.children.forEach(child => child.attributes.shortName = 'myContinent');

                children.forEach(child => core.delAttribute(child, 'shortName')); // Deletes Attributes
                await diffSync.onUpdatesFromServer(targetSubtree, clientState);
                await diffSync.onUpdatesFromClient(clientState, targetSubtree); // Updates Name
                await delay(100);
                const newChildren = await core.loadChildren(targetSubtree);
                newChildren.forEach(child => assert(!core.getOwnAttributeNames(child).includes('shortName')));
            });
        });

        describe('pointers', function () {
            it('should change the base pointer to FCO on change from client', async () => {
                const fco = await core.loadByPath(rootNode, '/1');
                clientState.children[0].pointers.base = core.getGuid(fco);
                await diffSync.onUpdatesFromClient(clientState, targetSubtree);

                await delay(100);

                const firstChild = await core.loadByPath(rootNode, clientState.children[0].path);
                assert (core.getPointerPath(firstChild, 'base') === '/1');
            });
        });

        describe('sets', function () {

        });


    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });
});


function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}
