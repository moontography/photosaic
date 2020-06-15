import fs from 'fs'
import sharp from 'sharp'
import { EventEmitter } from 'events'
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
    emitter: new EventEmitter(),
    sourceImage,
    sourceImageSharp: sharp(),
    sourceWidth: 0,
    sourceHeight: 0,

    subImages,
    subImagesSharp: [sharp()],
    subImageWidth: 0,
    subImageHeight: 0,

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

      // resetting sourceWidth and sourceHeight to be gridNum * subImgWidth etc.
      // because when we Math.floor() above it might be several pixels too small
      this.sourceWidth = this.subImageWidth * gridNum
      this.sourceHeight = this.subImageHeight * gridNum

      return (this.subImagesSharp = await Promise.all(
        this.subImages.map(async (img: PhotosaicImage) => {
          const sh = sharp(await this.imgToBuffer(img))
          return sh.resize({
            width: this.subImageWidth,
            height: this.subImageHeight,
          })
        })
      ))
    },

    async getPieceAvgColor(x: number, y: number) {
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

      let compositeSubImgObjects: object[] = []
      let iteration = 0
      let subImagesCache = this.subImagesSharp.slice(0)

      // we're going to execute each column in series, but all rows
      // in each column in parallel to try and improve speed
      for (let y = 0; y < gridNum; y++) {
        await Promise.all(
          new Array(gridNum).fill(0).map(async (_, x) => {
            iteration++
            this.emitter.emit(`processing`, iteration)

            const { r, g, b, a } = await this.getPieceAvgColor(x, y)
            // If the square is completely transparent, don't insert image here.
            // TODO: should we have same logic here for all white or black squares?
            if ((a || 0) < 10) return

            if (subImagesCache.length === 0)
              subImagesCache = this.subImagesSharp.slice(0)

            const randImgInd = Math.floor(subImagesCache.length * Math.random())
            const subImg = subImagesCache.splice(randImgInd, 1)[0].clone()

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
          })
        )

        // TODO: when the following are resolved remove this
        // https://github.com/lovell/sharp/issues/1708
        // https://github.com/lovell/sharp/issues/1626
        if (compositeSubImgObjects.length >= 80) {
          this.sourceImageSharp = sharp(
            await this.sourceImageSharp
              .composite(compositeSubImgObjects)
              .toBuffer()
          )
          compositeSubImgObjects = []
        }
      }

      const buffer = await this.sourceImageSharp
        .composite(compositeSubImgObjects)
        .toBuffer()
      this.emitter.emit(`complete`, buffer)
      return buffer
    },
  }
}

/**
 * @PhotosaicImage
 * "string": local filepath to the image
 * "Buffer": raw buffer of the image
 * "Readable": readable stream of image that can be piped to writable stream
 **/
export type PhotosaicImage = string | Buffer | Readable

export interface IColor {
  r: number
  g: number
  b: number
  a: number
}

export interface IPhotosaicFactory {
  emitter: EventEmitter
  sourceImage: PhotosaicImage
  sourceImageSharp: sharp.Sharp
  sourceWidth: number
  sourceHeight: number
  subImages: PhotosaicImage[]
  subImagesSharp: sharp.Sharp[]
  subImageWidth: number
  subImageHeight: number
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
