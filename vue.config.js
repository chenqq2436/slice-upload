module.exports = {
  lintOnSave: true,
  devServer: {
    open: true,
    proxy: {
      '/': {
        target: 'http://192.168.0.102:8888',
        changeOrigin: true,
      }
    }
  }
}
