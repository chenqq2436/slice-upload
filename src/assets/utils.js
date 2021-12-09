export const fileParse = (file, type = 'base64') => {
    return new Promise((resolve, reject) => {
        let fr = new FileReader();
        if (type === 'base64') {
            fr.readAsDataURL(file)
        } else if (type === 'buffer') {
            fr.readAsArrayBuffer(file)
        }
        fr.onload = e => resolve(e.target.result)
    })
}
