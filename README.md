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
