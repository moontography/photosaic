import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import Photosaic from '../Photosaic'

const argv = minimist(process.argv.slice(2))
const input = argv.i || argv.input
const singleSubImg = argv.s || argv.sub
const subImgDir = argv.dir
const gridNum = argv.g || argv.grid || 10
const outputWidth = argv.w || argv.width || 500

;(async function createPhotosaic() {
  try {
    let subImages
    if (subImgDir) {
      const files = await fs.promises.readdir(subImgDir)
      subImages = files.map((f) => `${subImgDir}/${f}`)
    } else {
      subImages =
        singleSubImg instanceof Array ? singleSubImg : singleSubImg.split(',')
    }

    const photosaic = Photosaic(input, subImages, {
      gridNum,
      outputWidth,
    })

    photosaic.emitter.on('processing', (iteration) => {
      const perc = (iteration / gridNum ** 2) * 100
      if (perc % 1 === 0) process.stdout.write(`.`)
    })

    const newImgBuffer = await photosaic.build()
    const dest = path.join(path.dirname(input), `${Date.now()}.png`)

    await fs.promises.writeFile(dest, newImgBuffer)
    process.stdout.write(`\n`)
    console.log(dest)
  } catch (err) {
    console.error(`error creating photosaic`, err.message, err.stack)
  }
})()
