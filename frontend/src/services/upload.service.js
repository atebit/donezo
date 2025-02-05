export const uploadService = {
  uploadImg
}
function uploadImg(ev) {
  const CLOUD_NAME = "c-d7b03799b40c1d9aa3526e88576974"
  const UPLOAD_PRESET = "donezo"
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

  const formData = new FormData()
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('file', ev.target.files[0])

  return fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(res => {
      return res
    })
    .catch(err => console.error(err))
}
