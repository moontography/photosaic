# photosaic

Create beautiful mosaics of an image from an original you specify, and are made up of many small images/photos you also provide!

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
