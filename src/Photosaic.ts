import fs from 'fs'
import sharp from 'sharp'
import { Readable } from 'stream'
import { bufferToStream, streamToBuffer } from './Utilities'

const DEFAULT_WIDTH: number = 400

export default function Photosaic(
  sourceImage: PhotosaicImage,
  subImages: PhotosaicImage[],
  {
    gridNum = 10,
    intensity = 0.5,
    outputWidth = DEFAULT_WIDTH,
  }: IPhotosaicOptions = {}
): IPhotosaicFactory {
  return {
    sourceImage,
    sourceImageSharp: null,
    sourceWidth: null,
    sourceHeight: null,

    subImages,
    subImagesSharp: null,
    subImageWidth: null,
    subImageHeight: null,

    setSourceImage(source: PhotosaicImage) {
      return (this.sourceImage = source)
    },

    setSubImages(subs: PhotosaicImage[]) {
      return (this.subImages = subs)
    },

    addSubImage(sub: PhotosaicImage) {
      this.subImages.push(sub)
      return this.subImages
    },

    imgToStream(img: PhotosaicImage) {
      if (typeof img === 'string') return fs.createReadStream(img)
      if (img instanceof Buffer) return bufferToStream(img)
      return img
    },

    async imgToBuffer(img: PhotosaicImage) {
      if (typeof img === 'string') return await fs.promises.readFile(img)
      if (img instanceof Readable) return await streamToBuffer(img)
      return img
    },

    async setupSourceImage() {
      this.sourceImageSharp = sharp(await this.imgToBuffer(this.sourceImage))
      // https://sharp.pixelplumbing.com/api-input#metadata
      const { width } = await this.sourceImageSharp.metadata()
      this.sourceImageSharp = sharp(
        await this.sourceImageSharp
          .resize({
            width: outputWidth || width || DEFAULT_WIDTH,
          })
          .toBuffer()
      )

      const newDims = await this.sourceImageSharp.metadata()
      this.sourceWidth = newDims.width || DEFAULT_WIDTH
      this.sourceHeight = newDims.height || DEFAULT_WIDTH
      return this.sourceImageSharp
    },

    async setupSubImages() {
      const sourceWidth = outputWidth || this.sourceWidth || 50
      const newWidth = sourceWidth / (gridNum || 10)
      const whRatio =
        sourceWidth / (this.sourceHeight || outputWidth || DEFAULT_WIDTH)

      this.subImageWidth = Math.floor(newWidth)
      this.subImageHeight = Math.floor(newWidth / whRatio)

      return (this.subImagesSharp = await Promise.all(
        this.subImages.map(async (img: PhotosaicImage) => {
          const sh = sharp(await this.imgToBuffer(img))
          return sh.resize({
            width: this.subImageWidth || newWidth,
            height: this.subImageHeight || newWidth / whRatio,
          })
        })
      ))
    },

    async getPieceAvgColor(x: number, y: number) {
      if (!this.sourceImageSharp)
        throw new Error(`source image was not provided correctly`)

      if (!(this.subImageWidth && this.subImageHeight))
        throw new Error(`no subimage image dimensions`)

      const piece = await this.sourceImageSharp
        .clone()
        .extract({
          left: x * this.subImageWidth,
          top: y * this.subImageHeight,
          width: this.subImageWidth,
          height: this.subImageHeight,
        })
        .toBuffer()
      const {
        channels: [r, g, b, a],
      } = await sharp(piece).stats()

      return {
        r: r.mean,
        g: g.mean,
        b: b.mean,
        a: a.mean,
      }
    },

    async build() {
      await this.setupSourceImage()
      await this.setupSubImages()

      if (this.sourceImageSharp == null)
        throw new Error(`source image was not provided correctly`)

      if (!this.subImagesSharp)
        throw new Error(`no subimages to build mosaic from`)

      if (!(this.subImageWidth && this.subImageHeight))
        throw new Error(`no subimage image dimensions`)

      let compositeSubImgObjects = []
      let iteration = 0
      for (let x = 0; x < gridNum; x++) {
        for (let y = 0; y < gridNum; y++) {
          const randImgInd = Math.floor(
            this.subImagesSharp.length * Math.random()
          )
          const subImg = this.subImagesSharp
            .slice(randImgInd, randImgInd + 1)[0]
            .clone()

          const { r, g, b, a } = await this.getPieceAvgColor(x, y)
          // If the square is completely transparent, don't insert image here.
          // TODO: should we have same logic here for all white or black squares?
          if ((a || 0) < 10) continue

          const overlayedSubImg = subImg.composite([
            {
              input: {
                create: {
                  width: this.subImageWidth,
                  height: this.subImageHeight,
                  channels: 4,
                  background: { r, g, b, alpha: intensity },
                },
              },
            },
          ])

          compositeSubImgObjects.push({
            input: await overlayedSubImg.toBuffer(),
            left: x * this.subImageWidth,
            top: y * this.subImageHeight,
          })

          // TODO: when the following are resolved remove this
          // https://github.com/lovell/sharp/issues/1708
          // https://github.com/lovell/sharp/issues/1626
          iteration++
          if (iteration > 0 && iteration % 100 === 0) {
            this.sourceImageSharp = sharp(
              await this.sourceImageSharp
                .composite(compositeSubImgObjects)
                .toBuffer()
            )
            compositeSubImgObjects = []
          }
        }
      }

      return this.sourceImageSharp.composite(compositeSubImgObjects).toBuffer()
    },
  }
}

/**
 * PhotosaicImage
 * @string will be a local filepath to the image
 * @Buffer a raw buffer of the image
 * @Readable a read stream containing the data to the image
 **/
export type PhotosaicImage = string | Buffer | Readable

export interface IColor {
  r: number
  g: number
  b: number
  a?: number
}

export interface IPhotosaicFactory {
  sourceImage: PhotosaicImage
  sourceImageSharp: null | sharp.Sharp
  sourceWidth: null | number
  sourceHeight: null | number
  subImages: PhotosaicImage[]
  subImagesSharp: null | sharp.Sharp[]
  subImageWidth: null | number
  subImageHeight: null | number
  setSourceImage(source: PhotosaicImage): PhotosaicImage
  setSubImages(subs: PhotosaicImage[]): PhotosaicImage[]
  addSubImage(sub: PhotosaicImage): PhotosaicImage[]
  imgToStream(img: PhotosaicImage): Readable
  imgToBuffer(img: PhotosaicImage): Promise<Buffer>
  setupSourceImage(): Promise<sharp.Sharp>
  setupSubImages(): Promise<sharp.Sharp[]>
  getPieceAvgColor(x: number, y: number): Promise<IColor>
  build(): Promise<Buffer>
}

export interface IPhotosaicOptions {
  gridNum?: number // number of columns and rows of subimages we'll use to build the mosaic
  intensity?: number // number between 0-1, the intesity that we'll overlay a color on subimages to insert into main image
  outputWidth?: null | number // width in pixels of the output image (DEFAULT: original width)
}
