<template>
  <div id="app">
    <!-- 
      action:存放的是文件上传到服务器的接口地址
    -->
    <el-upload
      action=""
      :file-list="fileList"
      :auto-upload="false"
      multiple
      :on-change="handleChange"
    >
      <el-button slot="trigger" size="small" type="primary">选取文件</el-button>
      <el-button style="margin-left: 10px;" size="small" type="success" @click="handleUpload">上传到服务器</el-button>
    </el-upload>

    <!-- IMG -->
    <div class="uploadImg" v-if="img">
      <img :src="img" alt />
    </div>
  </div>
</template>

<script>

export default {
  name: 'App',
  data() {
    return {
      img: null,
      fileList: []
    }
  },
  methods: {
    handleSuccess(result) {
      if (result.code == 0) {
        this.img = result.path
      }
    },
    beforeUpload(file) {
      let { type, size } = file;

      if (!/(png|gif|jpeg|jpg)/i.test(type)) {
        this.$message("文件合适不正确~~");
        return false;
      }

      if (size > 200 * 1024 * 1024) {
        this.$message("文件过大，请上传小于200MB的文件~~");
        return false;
      }

      return true;
    },
    handleChange(file, fileList) {
      this.fileList = fileList;
    },
    handleUpload(files) {
      this.img = null
      const fd = new FormData();
      this.fileList.forEach(item => {
        fd.append('file', item.raw)
      })
      this.$http({
        url: '/single1',
        data: fd,
        method: 'post'
      }).then(({ data }) => {
        if (data?.code == 0) {
          this.img = data.path
          this.fileList = []
        }
      }).catch(err => {
        console.log('上传失败', err)
      })
    }
  }
}
</script>

<style lang="scss">
</style>
