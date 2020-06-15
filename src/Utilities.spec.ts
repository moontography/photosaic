import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { bufferToStream, streamToBuffer } from './Utilities'

describe('bufferToStream', function () {
  it('should convert a buffer to a Readable stream', function () {
    const buffer = Buffer.from("I'm lance", 'utf-8')
    const readable = bufferToStream(buffer)
    assert.equal(true, readable instanceof Readable)
  })
})

describe('streamToBuffer', function () {
  it('should convert a Readable stream to a buffer', async function () {
    const buffer = Buffer.from("I'm lance", 'utf-8')
    const readable = bufferToStream(buffer)
    const sameBuffer = await streamToBuffer(readable)
    assert.equal(true, sameBuffer instanceof Buffer)
    assert.equal(sameBuffer.toString('utf-8'), buffer.toString('utf-8'))
  })

  it('should convert a file system Readable stream to a buffer', async function () {
    const readable = fs.createReadStream(
      path.join(__dirname, '..', 'tests', 'test.png')
    )
    const buffer = await streamToBuffer(readable)
    assert.equal(true, buffer instanceof Buffer)
  })
})
