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

const mosaic = Photosaic(`./targetImgForMosaic.png`, [
  `./subImg1.png`,
  `./subImg2.png`,
  `./subImg3.png`,
])
const finalMosaicBuffer = await mosaic.build()
await fs.promises.writeFile(`./finalMosaic.png`, finalMosaicBuffer)
```

### Main Image Type

- `type PhotosaicImage = string | Buffer | Readable`: main abstraction of an "image" used by Photosaic
  - `string`: the full file path of the image on the local file system
  - `Buffer`: a raw buffer of an image
  - `Readable`: a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) of an image to be piped to a writable stream

### Constructor

- `Photosaic(sourceImg, subImages, options?)`: factory function containing functionality to build mosaics
  - `sourceImg: PhotosaicImage`: The image of the final mosaic that will be created
  - `subImages: PhotosaicImage[]`: The small, subImages that will be used to build the mosaic
  - `options?`: additional options you can provide to customize the output mosaic created
    - `options.gridNum?: number = 10`: The final mosaic will be made up of a `gridNum x gridNum` grid of subImages
    - `options.intensity?: number = 0.5`: Number between 0-1 indicating the opacity of the shading on the subImages to help make the output image clearer. 0 is fully transparent shading (main image will be impossible to see), 1 is fully opaque (subImages will be impossible to make out). The default of 0.5 should be fine in most cases.
    - `options.outputWidth?: number = 400`: Number of pixels the output mosaic's width will be (height will auto scale). The larger the width, the bigger the mosaic and the larger in size the final mosaic will be. The larger the output the longer it takes to generate a mosaic
    - `options.algo?: 'closestColor' | 'random' = 'random'`: How the subImages will be dispersed throughout when building the mosaic.
      - `'random'` selects one of the subImages randomly each iteration to be inserted in that slice of the mosaic
      - `'closestColor'` selects the subImage that is closest to the average color of the slice of the main image that the subImage is getting inserted to build the mosaic.

### Methods

Assuming `const photosaic = Photosaic(source, subImgs, opts)`, the methods below are exposed on `photosaic`

- `photosaic.build(): Promise<Buffer>`: create a mosaic and return the result in a raw Buffer
- `photosaic.setSourceImage(newSrc: PhotosaicImage) => PhotosaicImage`: reset source image created in mosaic
- `photosaic.setSubImages(subImgs: PhotosaicImage[]) => PhotosaicImage[]`: reset subImages used to build mosaic
- `photosaic.addSubImage(img: PhotosaicImage): PhotosaicImage[]`: add an image to the subImage list to build mosaic
- `photosaic.imgToStream(img: PhotosaicImage): Readable`: convert a PhotosaicImage to a Readable stream
- `photosaic.imgToBuffer(img: PhotosaicImage): Promise<Buffer>`: convert a PhotosaicImage to a raw Buffer

### Tracking Mosaic Progress

Depending on the options provided (specifically `gridNum` and `outputWidth`) and
the hardware you're running to build the mosaic, it could take several to tens of minutes
for `photosaic.build()` to complete. Therefore, `photosaic` has an `EventEmitter`, `photosaic.emitter`
you can listen for `processing` events to get the progress of the mosaic being built.

There will be a total of `gridNum^2` iterations processed.

```js
const photosaic = Photosaic(source, subImgs, opts)
photosaic.emitter.on('processing', (iteration) => {
  console.log(`Currently processing '${iteration}' subImage for the mosaic`)
})
await photosaic.build()

// Currently processing '1' subImage for the mosaic
// Currently processing '2' subImage for the mosaic
// Currently processing '3' subImage for the mosaic
// ...
```
