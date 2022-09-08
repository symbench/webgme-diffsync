module.exports = {
    'env': {
        'browser': true,
        'es6': true,
        'node': true
    },
    parser: '@typescript-eslint/parser',
    overrides: [{
        files: ['**/*.ts', '**/*.ts'],
        plugins: [
            '@typescript-eslint',
        ],
        extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
        parser: '@typescript-eslint/parser',
        parserOptions: {
            project: ['./tsconfig.json'],
        },
    }
    ],
    'extends': [
        'eslint:recommended'
    ],
    'parserOptions': {
        'ecmaVersion': 2020,
        'sourceType': 'module'
    },
    rules: {
        indent: [2, 4, {'SwitchCase': 1}],
        'linebreak-style': [2, 'unix'],
        quotes: [2, 'single'],
        semi: [2, 'always']
    }
};