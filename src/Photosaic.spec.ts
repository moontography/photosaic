import assert from 'assert'
import crypto from 'crypto'
import path from 'path'
import sharp from 'sharp'
import { Readable } from 'stream'
import { streamToBuffer } from './Utilities'
import Photosaic, {
  ISubImage,
  binarySubImageSearch,
  getGrayscale,
} from './Photosaic'

describe('Photosaic', function () {
  const testImgPath = path.join(__dirname, '..', 'tests', 'test.png')
  const photosaic = Photosaic(testImgPath, [testImgPath])

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
    it('should convert the img to a raw image buffer', async function () {
      const readable = photosaic.imgToStream(testImgPath)
      const buffer1 = await photosaic.imgToBuffer(readable)
      const buffer2 = await photosaic.imgToBuffer(testImgPath)
      assert.equal(sha256(buffer1), sha256(buffer2))
    })
  })

  describe('#build', function () {
    // TODO finish all tests

    describe('emitter', function () {
      it('should iterate over gridNum^2 times', async function () {
        this.timeout(10000)

        let i1 = 0
        const p1 = Photosaic(testImgPath, [testImgPath], { gridNum: 2 })
        p1.emitter.on('processing', () => i1++)

        let i2 = 0
        const p2 = Photosaic(testImgPath, [testImgPath], { gridNum: 5 })
        p2.emitter.on('processing', () => i2++)

        await Promise.all([p1.build(), p2.build()])

        assert.equal(true, i1 >= 4 * 2)
        assert.equal(true, i2 >= 25 * 2)
      })
    })
  })

  describe('binarySubImageSearch', function () {
    it('should get the correct image based on grayscale values', async function () {
      // this.timeout(10000)
      const getISubImage = (rgb: number) => {
        const shImg = sharp()
        const shStats: sharp.Stats = {
          channels: [],
          isOpaque: true,
          entropy: 1,
        }
        let si: ISubImage = { img: shImg, stats: shStats }
        si.stats.channels[0] = si.stats.channels[0] || {}
        si.stats.channels[0].mean = rgb
        si.stats.channels[1] = si.stats.channels[1] || {}
        si.stats.channels[1].mean = rgb
        si.stats.channels[2] = si.stats.channels[2] || {}
        si.stats.channels[2].mean = rgb
        return si
      }
      const imgs = [
        getISubImage(0),
        getISubImage(1),
        getISubImage(10),
        getISubImage(255),
      ]

      const [r1, g1, b1] = [5, 5, 5] // 1
      const gr1 = getGrayscale(r1, g1, b1)
      const result1 = binarySubImageSearch(imgs, gr1, 0, imgs.length - 1)

      const [r2, g2, b2] = [210, 220, 240] // 255
      const gr2 = getGrayscale(r2, g2, b2)
      const result2 = binarySubImageSearch(imgs, gr2, 0, imgs.length - 1)

      assert.equal(
        imgs[1].stats.channels[0].mean,
        result1.stats.channels[0].mean
      )

      assert.equal(
        imgs[3].stats.channels[0].mean,
        result2.stats.channels[0].mean
      )
    })
  })
})

function sha256(data: Buffer | string) {
  const hash = crypto.createHash('sha256')
  hash.update(data)
  return hash.digest('hex')
}
