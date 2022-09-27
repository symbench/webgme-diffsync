'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

// Add/overwrite any additional settings here
config.server.port = 9990;
// config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_my_app';
config.requirejsPaths['webgme-json-importer'] = './node_modules/webgme-json-importer/src/common';
config.requirejsPaths['json-editor'] = './node_modules/vanilla-jsoneditor';

validateConfig(config);
module.exports = config;
