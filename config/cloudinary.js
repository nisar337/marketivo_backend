import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const uploadToCloudinary = async (
  fileBuffer,
  folder = 'marketivo/products',
  transformation = [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation,
      },
      (error, result) => {
        if (error) return reject(error)
        resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    stream.end(fileBuffer)
  })
}

export const uploadAvatarToCloudinary = async (fileBuffer) => {
  return uploadToCloudinary(fileBuffer, 'marketivo/avatars', [
    { width: 400, height: 400, crop: 'limit', quality: 'auto' },
  ])
}

export const uploadVendorShopLogoToCloudinary = async (fileBuffer) => {
  return uploadToCloudinary(fileBuffer, 'marketivo/vendor-logos', [
    { width: 512, height: 512, crop: 'limit', quality: 'auto' },
  ])
}

export const deleteFromCloudinary = async (publicId) => {
  return cloudinary.uploader.destroy(publicId)
}

export default cloudinary
