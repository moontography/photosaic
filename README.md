# photosaic

Create beautiful mosaics of an image from an original you specify, and are made up of many small images/photos you also provide!

<img src="https://user-images.githubusercontent.com/13718950/84646338-f0d25180-aecf-11ea-9926-b42cbfe251d9.png" width="600">

## Install

```sh
$ npm install -s photosaic
```

## Usage

```js
import fs from 'fs'
import Photosaic from 'photosaic'

const mosaic = Photosaic(`./targetMosaicImg.png`, [
  `./subImg1.png`,
  `./subImg2.png`,
  `./subImg2.png`,
])
const newImgBuffer = await mosaic.build()
await fs.promises.writeFile(`./finalMosaic.png`, newImgBuffer)
```

Main Image Type

- `type PhotosaicImage = string | Buffer | Readable`: main abstraction of an "image" used by Photosaic
  - `string`: the full file path of the image on the local file system
  - `Buffer`: a raw buffer of an image
  - `Readable`: a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of an image to be piped to a writable stream

Constructor

- `Photosaic(sourceImg, subImages, options?)`: factory function containing functionality to build mosaics
  - `sourceImg: PhotosaicImage`: The main image of the final mosaic that will be created
  - `subImages: PhotosaicImage[]`: The small, sub-images that will be used to build the mosaic
  - `options`: additional optional options you can provide to customize the output mosaic created
    - `options.gridNum?: number = 10`: The final mosaic will be made up of a 10x10 grid of subImages
    - `options.intensity?: number = 0.5`: Number between 0-1 indicating the opacity of the subImages that are shaded to help make the output image clearer. 0 is fully transparent (main image will be impossible to see), 1 is fully opaque (sub-images will be impossible to make out). The default of 0.5 should be good in most cases.
    - `options.outputWidth?: number = 400`: Number of pixels the output mosaic will be. The larger the width, the bigger the mosaic and the larger in size the final mosaic will be. The larger the output the longer it takes to generate a mosaic

Methods

Assuming `const photosaic = Photosaic(source, subImgs, opts)`, the methods below are exposed on `photosaic`

- `photosaic.setSourceImage(newSrc: PhotosaicImage) => PhotosaicImage`: reset source image created in mosaic
- `photosaic.setSubImages(subImgs: PhotosaicImage[]) => PhotosaicImage[]`: reset sub images used to build mosaic
- `photosaic.addSubImage(img: PhotosaicImage): PhotosaicImage[]`: add an image to the sub image list to build mosaic
- `photosaic.imgToStream(img: PhotosaicImage): Readable`: convert a PhotosaicImage to a Readable stream
- `photosaic.imgToBuffer(img: PhotosaicImage): Promise<Buffer>`: convert a PhotosaicImage to a raw Buffer
- `photosaic.build(): Promise<Buffer>`: create a mosaic and return the result in a raw buffer
