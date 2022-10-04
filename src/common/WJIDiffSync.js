/* globals define */
/* eslint-env node, browser */

define([
    './lib/build/WJIDiffSync.umd'
], function (
    DiffSyncLib
) {
    const {default: WJIDiffSync, deepCopy} = DiffSyncLib;

    return {WJIDiffSync, deepCopy};
});