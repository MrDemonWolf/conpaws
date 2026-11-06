// Serialized theme code must not reference esbuild's name-preservation helpers.
export const WEB_BUNDLE_OPTIONS = { minify: true, keepNames: false } as const;
