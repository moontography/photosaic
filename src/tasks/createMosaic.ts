import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import Mosaic from '../Mosaic'

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

;(async function createMosaic() {
  try {
    const mosaic = Mosaic(input, output instanceof Array ? output : [output], {
      gridNum,
      outputWidth,
    })
    const newImgBuffer = await mosaic.build()
    await fs.promises.writeFile(
      path.join(path.dirname(input), `${Date.now()}.png`),
      newImgBuffer
    )
  } catch (err) {
    console.error(`error creating mosaic`, err.message, err.stack)
  }
})()
