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
    algo = 'closestColor',
  }: IPhotosaicOptions = {}
): IPhotosaicFactory {
  return {
    emitter: new EventEmitter(),
    sourceImage,
    sourceImageSharp: sharp(),
    sourceWidth: 0,
    sourceHeight: 0,

    subImages,
    subImagesList: [],
    subImagesListCache: [],
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
          .rotate()
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

      return (this.subImagesList = await Promise.all(
        this.subImages.map(async (img: PhotosaicImage) => {
          const s1 = sharp(await this.imgToBuffer(img))
          const sharpImg = sharp(
            await s1
              .rotate()
              .resize({
                width: this.subImageWidth,
                height: this.subImageHeight,
              })
              .toBuffer()
          )

          return {
            img: sharpImg,
            stats: await sharpImg.stats(),
          }
        })
      ))
    },

    async getPieceAvgColor(
      x: number,
      y: number,
      source?: sharp.Sharp,
      subImgWidth?: number,
      subImgHeight?: number
    ) {
      const w = subImgWidth || this.subImageWidth
      const h = subImgHeight || this.subImageHeight
      const piece = await (source || this.sourceImageSharp)
        .clone()
        .extract({
          left: x * w,
          top: y * h,
          width: w,
          height: h,
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

    getSubImage(pieceColor: IColor): sharp.Sharp {
      switch (algo) {
        case 'closestColor': {
          const getDiff = (c1: number, c2: number): number => Math.abs(c1 - c2)
          const getGrayscale = (r: number, g: number, b: number): number =>
            0.3 * r + 0.59 * g + 0.11 * b
          let selectedGrayscale: number = 0
          const closestSubImage = this.subImagesListCache.reduce(
            (curr: null | ISubImage, img: ISubImage) => {
              const [r, g, b] = img.stats.channels
              if (!curr) {
                selectedGrayscale = getGrayscale(
                  getDiff(pieceColor.r, r.mean),
                  getDiff(pieceColor.g, g.mean),
                  getDiff(pieceColor.b, b.mean)
                )
                return img
              }

              const imgGrayscale = getGrayscale(
                getDiff(pieceColor.r, r.mean),
                getDiff(pieceColor.g, g.mean),
                getDiff(pieceColor.b, b.mean)
              )
              if (imgGrayscale < selectedGrayscale) {
                selectedGrayscale = imgGrayscale
                return img
              }
              return curr
            },
            null
          )
          return closestSubImage
            ? closestSubImage.img.clone()
            : this.sourceImageSharp.clone()
        }
        default: {
          // 'random'
          const randImgInd = Math.floor(
            this.subImagesListCache.length * Math.random()
          )
          return this.subImagesListCache.splice(randImgInd, 1)[0].img.clone()
        }
      }
    },

    async getSourceImgAvgColors(): Promise<IColor[][]> {
      let gridColors: IColor[][] = []
      let iteration = 0
      const smallSource = sharp(
        await this.sourceImageSharp
          .clone()
          .resize({ width: DEFAULT_WIDTH })
          .toBuffer()
      )
      const smallSourceMeta = await smallSource.metadata()
      const subWidth = Math.floor(DEFAULT_WIDTH / gridNum)
      const subHeight = Math.floor(
        (smallSourceMeta.height || DEFAULT_WIDTH) / gridNum
      )
      for (let x = 0; x < gridNum; x++) {
        await Promise.all(
          new Array(gridNum).fill(0).map(async (_, y) => {
            iteration++
            this.emitter.emit(`processing`, iteration)
            gridColors[x] = gridColors[x] || []
            gridColors[x][y] = await this.getPieceAvgColor(
              x,
              y,
              smallSource,
              subWidth,
              subHeight
            )
          })
        )
      }
      return gridColors
    },

    async build() {
      await this.setupSourceImage()
      await this.setupSubImages()
      const avgMainImgColors: IColor[][] = await this.getSourceImgAvgColors()

      let compositeSubImgObjects: object[] = []
      let iteration = 0
      this.subImagesListCache = this.subImagesList.slice(0)

      // we're going to execute each row in series, but all cols
      // in each row in parallel to try and improve speed
      for (let x = 0; x < gridNum; x++) {
        await Promise.all(
          new Array(gridNum).fill(0).map(async (_, y) => {
            iteration++
            this.emitter.emit(`processing`, iteration)

            const pieceColor = avgMainImgColors[x][y]
            const { r, g, b, a } = pieceColor
            // If the square is completely transparent, don't insert image here.
            // TODO: should we have same logic here for all white or black squares?
            if ((a || 0) < 10) return

            if (this.subImagesListCache.length === 0)
              this.subImagesListCache = this.subImagesList.slice(0)

            const subImg = this.getSubImage(pieceColor)
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
      }

      // TODO: when the following are resolved remove this and only use
      // `.composite` once with all small images
      //
      // https://github.com/lovell/sharp/issues/1708
      // https://github.com/lovell/sharp/issues/1626
      while (compositeSubImgObjects.length > 0) {
        iteration++
        this.emitter.emit(`processing`, iteration)
        const compositeImages = compositeSubImgObjects.splice(0, gridNum)
        this.sourceImageSharp = sharp(
          await this.sourceImageSharp.composite(compositeImages).toBuffer()
        )
      }

      const buffer = await this.sourceImageSharp.toBuffer()
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

export interface ISubImage {
  img: sharp.Sharp
  stats: sharp.Stats
}

export interface IPhotosaicFactory {
  emitter: EventEmitter
  sourceImage: PhotosaicImage
  sourceImageSharp: sharp.Sharp
  sourceWidth: number
  sourceHeight: number
  subImages: PhotosaicImage[]
  subImagesList: ISubImage[]
  subImagesListCache: ISubImage[]
  subImageWidth: number
  subImageHeight: number
  setSourceImage(source: PhotosaicImage): PhotosaicImage
  setSubImages(subs: PhotosaicImage[]): PhotosaicImage[]
  addSubImage(sub: PhotosaicImage): PhotosaicImage[]
  imgToStream(img: PhotosaicImage): Readable
  imgToBuffer(img: PhotosaicImage): Promise<Buffer>
  setupSourceImage(): Promise<sharp.Sharp>
  setupSubImages(): Promise<ISubImage[]>
  getPieceAvgColor(
    x: number,
    y: number,
    source?: sharp.Sharp,
    subWidth?: number,
    subHeight?: number
  ): Promise<IColor>
  getSubImage(pieceColor: IColor): sharp.Sharp
  getSourceImgAvgColors(): Promise<IColor[][]>
  build(): Promise<Buffer>
}

export interface IPhotosaicOptions {
  gridNum?: number // number of columns and rows of subimages we'll use to build the mosaic
  intensity?: number // number between 0-1, the intesity that we'll overlay a color on subimages to insert into main image
  outputWidth?: null | number // width in pixels of the output image (DEFAULT: original width)
  algo?: 'random' | 'closestColor' // how the sub images will be dispersed to build the mosaic
}
