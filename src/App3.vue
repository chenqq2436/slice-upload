<template>
  <div id="app">
    <el-upload drag action :auto-upload="false" :show-file-list="false" :on-change="changeFile">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        将文件拖到此处，或
        <em>点击上传</em>
      </div>
    </el-upload>

    <!-- PROGRESS -->
    <div class="progress">
      <span>上传进度：{{total|totalText}}%</span>
      <el-link type="primary" v-if="total>0 && total<100" @click="handleBtn">{{btn|btnText}}</el-link>
    </div>

    <!-- VIDEO -->
    <div class="uploadImg" v-if="video">
      <video :src="video" controls />
    </div>
  </div>
</template>

<script>
import { fileParse } from "./assets/utils";
import axios from "axios";
import SparkMD5 from "spark-md5";

export default {
  name: "App",
  data() {
    return {
      total: 0,
      video: null,
      btn: false,
      abort: false,
      partList: [],
      hash: null
    };
  },
  filters: {
    btnText(btn) {
      return btn ? "继续" : "暂停";
    },
    totalText(total) {
      return total > 100 ? 100 : total;
    },
  },
  methods: {
    async changeFile(file) {
      if (!file) return;
      file = file.raw
      // 将文件二进制转换成buffer
      let buffer = await fileParse(file, 'buffer')
      // 文件后缀
      let suffix = /\.(\w+)$/.exec(file.name)[1]
      let sm = new SparkMD5.ArrayBuffer()
      sm.append(buffer)
      // 生成hash 这个hash来约定每个切片的文件名 hash_0 ...
      let hash = sm.end()
      // 存储切片列表
      let partList = [];
      // 分成多少个切片
      let count = 100
      // 切片起始位置
      let start = 0
      // 用文件大小计算出每个切片的大小 宁愿多切不能少切
      let partSize = Math.ceil(file.size / count)
      for (let i = 0; i < count; i++) {
        let filePart = file.slice(start, start += partSize)
        partList.push({
          chunk: filePart,
          filename: `${hash}_${i}.${suffix}`
        })
      }
      console.log(partList, start, buffer, file)
      this.partList = partList
      this.hash = hash
      this.sendRequest1()
    },
    async sendRequest1() {
      let requestList = this.partList.map((item, index) => {
        return async () => {
          try {
            let fd = new FormData()
            fd.append('chunk', item.chunk)
            fd.append('filename', item.filename)
            const { data } = await this.$http({
              url: '/single3',
              method: 'post',
              data: fd,
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            })
            if (data.code == 0) {
              // 进度+1
              this.total += 1
              // 从切片列表中剔除 不能用原来的索引删除
              this.partList.splice(this.partList.findIndex(temp => temp.filename == item.filename), 1)
            }
            return this.abort
          } catch (err) {
            throw err
          }
        }
      })
      const complete = async () => {
        await this.$http({
          url: '/merge',
          method: 'get',
          params: {
            hash: this.hash
          }
        }).then(({ data }) => {
          if (data.code == 0) {
            this.video = data.path
          }
        })
      }
      let currIndex = 0
      // 我们这里采用的串行 如果用并行 就需要cancelToken了
      const next = async () => {
        if (this.abort) return
        if (currIndex >= requestList.length) return complete()
        await requestList[currIndex]()
        currIndex++
        next()
      }
      next()
    },
    async sendRequest() {
      let requestList = []
      this.partList.forEach((item, index) => {
        const requestFn = () => {
          let fd = new FormData()
          fd.append('chunk', item.chunk)
          fd.append('filename', item.filename)
          return this.$http({
            url: '/single3',
            method: 'post',
            data: fd,
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }).then(({ data }) => {
            if (data.code == 0) {
              // 进度+1
              this.total += 1
              // 从切片列表中剔除
              this.partList.splice(index, 1)
            }
          })
        }
        requestList.push(requestFn)
      })
      let complete = async () => {
        await this.$http({
          url: '/merge',
          method: 'get',
          params: {
            hash: this.hash
          }
        }).then(({ data }) => {
          if (data.code == 0) {
            this.video = data.path
          }
        })
      }
      // 上传可以采用并行或串行都可以
      let sendIndex = 0
      const send = async () => {
        if (this.abort) {
          return
        }
        if (sendIndex >= requestList.length) {
          console.log("全部上传完成了")
          return complete()
        }
        await requestList[sendIndex]()
        sendIndex++
        send()
      }
      send()
    },
    handleBtn() {
      // 点击继续 断点续传
      if (this.btn) {
        this.btn = false
        this.abort = false
        this.sendRequest1()
        return
      }
      // 暂停上传
      this.btn = true
      this.abort = true
    },
  },
};
</script>
