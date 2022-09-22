/* eslint-env node, mocha */

describe('WebGMEDiffSyncer', function () {
    const testFixture = require('../globals');
    const Core = testFixture.requirejs('common/core/coreQ');
    const Importer = testFixture.requirejs('webgme-json-importer/JSONImporter');
    const diff = testFixture.requirejs('webgme-json-importer/changeset');
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
        core;
    const {GMENode} = testFixture.requirejs('WebGMEDiffSyncer/types');
    const {WebGMEDiffSyncer} = testFixture.requirejs('WebGMEDiffSyncer/index');

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
            projectSeed: testFixture.path.join(__dirname, '..', '..', 'node_modules', 'webgme-engine', 'seeds', 'EmptyProject.webgmex'),
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

    it('should convert new node to shadow', async () => {
        const rootNode = await getNewRootNode(core);
        const fco = await core.loadByPath(rootNode, '/1');
        const newNode = await core.createNode({
            parent: rootNode,
            base: fco,
        });
        core.setAttribute(newNode, 'name', 'NewNode');
        const fcoGuid = core.getGuid(fco);
        const importer = new Importer(core, rootNode);
        const gmeNode = new GMENode(newNode, importer);
        const shadow = await gmeNode.toShadow();
        assert(shadow.attributes.name === 'NewNode');
        assert(shadow.pointers.base === fcoGuid);
    });

    it('should correctly find the diffs', async () => {
        const rootNode = await getNewRootNode(core);
        const fco = await core.loadByPath(rootNode, '/1');
        const newNode = await core.createNode({
            parent: rootNode,
            base: fco,
        });
        core.setAttribute(newNode, 'name', 'NewNode');
        const wjiDiffSyncer = new WebGMEDiffSyncer(
            newNode,
            rootNode,
            core,
            Importer
        );
        await wjiDiffSyncer.populateCommonShadow();
        core.setAttribute(newNode, 'name', 'ChangedName');
        await wjiDiffSyncer.onUpdatesFromServer();
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });
});