# photosaic

Create beautiful mosaics of an image from an original you specify, and are made up of many small images/photos you also provide!

<img src="https://user-images.githubusercontent.com/13718950/84645370-73f2a800-aece-11ea-9a04-380271fc23dd.png" width="600">

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
