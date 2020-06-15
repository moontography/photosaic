import assert from 'assert'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { streamToBuffer } from './Utilities'
import Photosaic from './Photosaic'

describe('Photosaic', function () {
  const testImgPath = path.join(__dirname, '..', 'tests', 'test.png')
  const photosaic = Photosaic(testImgPath, [testImgPath])
  let testImgBuf = Buffer.from('test', 'utf-8')

  before('setup', async function () {
    testImgBuf = await fs.promises.readFile(testImgPath)
  })

  describe('#setSourceImage', function () {
    it('should update the source img', function () {
      photosaic.setSourceImage('test')
      assert.equal(photosaic.sourceImage, 'test')
    })
  })

  describe('#setSubImages', function () {
    it('should update the sub images', function () {
      photosaic.setSubImages(['test'])
      assert.equal(1, photosaic.subImages.length)
      assert.equal(photosaic.subImages[0], 'test')
    })
  })

  describe('#addSubImage', function () {
    it('should add the info as a sub image', function () {
      photosaic.addSubImage('test')
      assert.equal(2, photosaic.subImages.length)
      assert.equal(photosaic.subImages[0], 'test')
    })
  })

  describe('#imgToStream', function () {
    it('should convert the img to a readable stream', async function () {
      const readable1 = photosaic.imgToStream(testImgPath)
      const buffer1 = await streamToBuffer(readable1)
      const readable2 = photosaic.imgToStream(Buffer.from('test', 'utf-8'))
      const buffer2 = await streamToBuffer(readable2)
      const readable3 = photosaic.imgToStream(testImgPath)
      const buffer3 = await streamToBuffer(readable3)

      assert.equal(true, readable1 instanceof Readable)
      assert.equal(true, readable2 instanceof Readable)
      assert.equal(true, readable3 instanceof Readable)
      assert.equal('test', buffer2.toString('utf-8'))
      assert.equal(sha256(buffer1), sha256(buffer3))
    })
  })

  describe('#imgToBuffer', function () {
    // TODO
  })

  describe('#build', function () {
    // TODO finish all tests

    it('should iterate over gridNum^2 times', async function () {
      this.timeout(10000)

      let i1 = 0
      const p1 = Photosaic(testImgPath, [testImgPath], { gridNum: 2 })
      p1.emitter.on('processing', () => i1++)

      let i2 = 0
      const p2 = Photosaic(testImgPath, [testImgPath], { gridNum: 5 })
      p2.emitter.on('processing', () => i2++)

      await Promise.all([p1.build(), p2.build()])

      assert.equal(4, i1)
      assert.equal(25, i2)
    })
  })
})

function sha256(data: Buffer | string) {
  const hash = crypto.createHash('sha256')
  hash.update(data)
  return hash.digest('hex')
}
