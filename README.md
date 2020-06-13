# mosaicjs

Create beautiful mosaics that build a final image from an original you specify, and are made up of many small/"sub"-images you also provide.

## Install

```sh
$ npm install -s mosaicjs
```

## Usage

```js
import fs from 'fs'
import Mosaic from 'mosaicjs'

const mosaic = Mosaic(`./targetMosaicImg.png`, [
  `./subImg1.png`,
  `./subImg2.png`,
  `./subImg2.png`,
])
const newImgBuffer = await mosaic.build()
await fs.promises.writeFile(`./finalMosaic.png`, newImgBuffer)
```
