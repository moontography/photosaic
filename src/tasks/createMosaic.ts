import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import Photosaic from '../Photosaic'

const argv = minimist(process.argv.slice(2))
const input =
  argv.i ||
  argv.input ||
  path.join(__dirname, '..', '..', 'src', 'tasks', 'test.png')
const output =
  argv.o ||
  argv.output ||
  path.join(__dirname, '..', '..', 'src', 'tasks', 'test.png')
const gridNum = argv.g || argv.grid || 10
const outputWidth = argv.w || argv.width || 500

;(async function createPhotosaic() {
  try {
    const photosaic = Photosaic(
      input,
      output instanceof Array ? output : [output],
      {
        gridNum,
        outputWidth,
      }
    )
    const newImgBuffer = await photosaic.build()
    const dest = path.join(path.dirname(input), `${Date.now()}.png`)
    await fs.promises.writeFile(dest, newImgBuffer)

    console.log(`successfully created photosaic located at ${dest}`)
  } catch (err) {
    console.error(`error creating photosaic`, err.message, err.stack)
  }
})()
