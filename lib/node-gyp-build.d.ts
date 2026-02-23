// Type declaration for the untyped node-gyp-build package.
// Loads the prebuilt native module for the current platform/arch.
declare module 'node-gyp-build' {
	function nodeGypBuild(dir: string): unknown;
	export = nodeGypBuild;
}
