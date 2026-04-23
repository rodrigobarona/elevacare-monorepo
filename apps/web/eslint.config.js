import { nextJsConfig } from '@eleva/eslint-config/next-js';
import { boundariesConfig } from '@eleva/eslint-config/boundaries';

/** @type {import("eslint").Linter.Config} */
export default [...nextJsConfig, ...boundariesConfig];
