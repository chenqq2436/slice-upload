<template>
  <div id="app">
    <el-upload drag action :auto-upload="false" :show-file-list="false" :on-change="changeFile">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        将文件拖到此处，或
        <em>点击上传</em>
      </div>
    </el-upload>

    <!-- IMG -->
    <div class="uploadImg" v-show="img">
      <img :src="img" alt />
    </div>
  </div>
</template>

<script>
import { fileParse } from "./assets/utils";
import axios from "axios";
import qs from "qs";

export default {
  name: "App",
  data() {
    return {
      img: null,
    };
  },
  methods: {
    async changeFile(file) {
      if (!file) return
      console.log(file)
      let base64 = await fileParse(file.raw)
      console.log(base64)
      let { data } = await this.$http({
        url: '/single2',
        method: 'post',
        // qs.stringify将数据序列化成x-www-form-urlencoded格式
        data: qs.stringify({
          // 服务器再解码 防止传输乱码
          chunk: encodeURIComponent(base64),
          filename: file.name
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      if (data.code == 0) {
        this.img = data.path
      }
    },
  },
};
</script>
