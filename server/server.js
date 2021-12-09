/*-CREATE SERVER-*/
const express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    SparkMD5 = require('spark-md5'),
    PORT = 8888;
app.listen(PORT, () => {
    console.log(`THE WEB SERVICE IS CREATED SUCCESSFULLY AND IS LISTENING TO THE PORT：${PORT}`);
});
app.use(bodyParser.urlencoded({
    extended: false,
    limit: '1024mb'
}));

/*-API-*/
const formidable = require("formidable"),
    uploadDir = `${__dirname}/upload`;

const rename = files => {
    const { file } = files
    const { filepath, newFilename, originalFilename } = file
    let newFilepath = filepath.replace(newFilename, originalFilename)
    fs.renameSync(filepath, newFilepath)
    file.filepath = newFilepath
}

/**
 * 目前一个formData通过append给一个属性里面添加多个文件 再解析时  只能解析到最后一个文件
 * 但是还是会把所有的文件都存储
 */
function handleMultiparty(req, res, temp, useOriginName) {
    return new Promise((resolve, reject) => {
        // multiparty的配置
        let options = {
            maxFieldsSize: 200 * 1024 * 1024,
            keepExtensions: true // 存储的文件包含原始文件的扩展名
        };
        !temp ? options.uploadDir = uploadDir : null;
        let form = formidable(options);
        // multiparty解析
        form.parse(req, function (err, fields, files) {
            console.log(err, fields, files)
            // 替换文件名 将hash替换成用户上传时的文件名
            if (useOriginName) {
                rename(files)
            }
            if (err) {
                res.send({
                    code: 1,
                    reason: err
                });
                reject(err);
                return;
            }
            resolve({
                fields,
                files
            });
        });
    });
}

// 基于FORM-DATA上传数据
app.post('/single1', async (req, res) => {
    let {
        files
    } = await handleMultiparty(req, res, false, true);
    let file = files.file;
    res.send({
        code: 0,
        originalFilename: file.originalFilename,
        path: file.filepath.replace(__dirname, `http://127.0.0.1:${PORT}`)
    });
});

// 上传BASE64
app.post('/single2', (req, res) => {
    let {
        chunk,
        filename
    } = req.body;

    // 解码 因为前端传过来的是加码的
    chunk = decodeURIComponent(chunk);
    // 将base64的声明头替换成空
    chunk = chunk.replace(/^data:image\/\w+;base64,/, "");
    // 转成buffer
    chunk = Buffer.from(chunk, 'base64');

    // 根据文件buffer生成hash戳 只要内容不变生成的hash就不变 再写入的时候就是覆盖操作
    let spark = new SparkMD5.ArrayBuffer(),
        suffix = /\.([0-9a-zA-Z]+)$/.exec(filename)[1],
        path;
    spark.append(chunk);
    path = `${uploadDir}/${spark.end()}.${suffix}`;
    // 将buffer写入到文件
    fs.writeFileSync(path, chunk);
    res.send({
        code: 0,
        originalFilename: filename,
        path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
    });
});

// 切片上传 && 合并 （其实可以先判断hash对应的文件存不存在 如果存在则没必要再传切片进行合成了 直接返回即可）
app.post('/single3', async (req, res) => {
    // 解析formData数据
    let {
        fields,
        files
    } = await handleMultiparty(req, res, true, false);
    // 获取文件内容和文件名
    let chunk = files.chunk
    let filename = fields.filename;
    console.log('files---------fields--------', filename, chunk);
    // 得到文件名的hash前缀，并拼接一个 服务器存放文件地址 + hash 的路径
    let hash = /([0-9a-zA-Z]+)_\d+/.exec(filename)[1],
        // suffix = /\.([0-9a-zA-Z]+)$/.exec(file.name)[1],
        path = `${uploadDir}/${hash}`;
    // 判断该路径（文件夹）是否存在 不存在则创建一个文件夹 用来专门存放当前hash对应的所有切片，因为同一个文件使用sparkMD5生成的hash是相同的
    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    path = `${path}/${filename}`; // 拼接出当前上传的切片文件路径 upload/hash/hash_index.xx
    // 判断当前切片文件是否在该hash对应的文件夹下存在
    fs.access(path, async err => {
        // 存在的则直接返回当前切片文件路径 达到一个秒传的效果
        if (!err) {
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
            return;
        }

        // 为了测试出效果，延迟1秒钟
        // await new Promise(resolve => {
        //     setTimeout(_ => {
        //         resolve();
        //     }, 2000);
        // });

        console.log('chunk.filepath-------------', chunk.filepath)
        /**
         * 不存在的再创建 根绝解析出的chunk生成可读流 
         * 因为我们再解析formData数据时没有传入uploadDir所以当时并没有存储 而是生成了一个文件链接,
         * 如：chunk.filepath: 'C:\\Users\\陈强\\AppData\\Local\\Temp\\dbc511c0fdad00bcaf4c43563'
         */
        let readStream = fs.createReadStream(chunk.filepath)
        // 根绝要写入的切片路径生成可写流
        let writeStream = fs.createWriteStream(path);
        // 写入
        readStream.pipe(writeStream);
        // 写入完毕
        readStream.on('end', function () {
            // 使用formidable解析出来的formData数据 会生成文件链接 当我们使用完之后将这个链接清除
            fs.unlinkSync(chunk.filepath);
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
        });
    });
});

app.get('/merge', (req, res) => {
    let {
        hash
    } = req.query;
    // 根据hash获取文件夹的名称
    let path = `${uploadDir}/${hash}`,
        fileList = fs.readdirSync(path),
        suffix;
    // 将读取到文件夹内所有的切片根据hash后面的索引从小到大排序
    fileList.sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
    }).forEach(item => {
        !suffix ? suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1] : null;
        // 依次将每个切片追加到最终以hash命名的文件中
        fs.appendFileSync(`${uploadDir}/${hash}.${suffix}`, fs.readFileSync(`${path}/${item}`));
        // 删除原有切片
        fs.unlinkSync(`${path}/${item}`);
    });
    // 全部合成完毕删除原有文件夹
    fs.rmdirSync(path);
    // 返回最终合成的文件地址
    res.send({
        code: 0,
        path: `http://127.0.0.1:${PORT}/upload/${hash}.${suffix}`
    });
});

app.use(express.static('./'));
app.use((req, res) => {
    res.status(404);
    res.send('NOT FOUND!');
});
