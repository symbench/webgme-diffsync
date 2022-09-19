import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

export default defineConfig({
    plugins: [
        svelte({
            configFile: false,
            preprocess: sveltePreprocess()
        })
    ],
    build: {
        commonjsOptions: {
            sourceMap: true
        },
        outDir: 'src/visualizers/widgets/JSONEditor/build',
        lib: {
            entry: 'src/visualizers/widgets/JSONEditor/svelte/JSONEditor.svelte',
            name: 'JSONEditor',
            fileName: 'json-editor',
            formats: [
                'umd'
            ],
        },
    },
});
