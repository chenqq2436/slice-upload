module.exports = {
  apps: [{
    name: "app",
    script: "./server.js",
    watch: true,
    ignore_watch: ["node_modules", "upload"],
  }]
}
