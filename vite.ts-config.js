import {defineConfig} from 'vite';
import {resolve} from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            formats: ['umd'],
            entry: resolve(__dirname, 'src', 'common', 'lib', 'index.ts'),
            fileName: 'WJIDiffSync',
            name: 'WJIDiffSync',
        },
        outDir: 'src/common/lib/build',
    },
    plugins: [dts()]
});
