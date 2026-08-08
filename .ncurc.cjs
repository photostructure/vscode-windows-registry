/** @type {import("npm-check-updates").RcOptions} */
module.exports = {
  removeRange: true,
  cooldown: 14,
  target(name) {
    // node-gyp 13 drops Node 20, which remains in this package's test matrix.
    return name === "node-gyp" ? "minor" : "latest";
  },
};
