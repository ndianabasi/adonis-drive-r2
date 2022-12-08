/*
 * adonis-drive-r2
 *
 * (c) Ndianabasi Udonkang <ndianabasi@gotedo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import 'reflect-metadata'

import { URL } from 'url'
import { join } from 'path'
import supertest from 'supertest'
import { Readable } from 'stream'
import { test } from '@japa/runner'
import { createServer } from 'http'
import { R2Driver } from '../Drivers/R2'
import { config as dotEnvConfig } from 'dotenv'
import { Logger } from '@adonisjs/logger/build/index'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { string } from '@poppinss/utils/build/helpers'
import { setupApplication, fs } from '../test-helpers'
import type { R2DriverConfig } from '@ioc:Adonis/Core/Drive'

const logger = new Logger({ enabled: true, name: 'adonisjs', level: 'info' })

dotEnvConfig()

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET!
const R2_PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET!
const R2_PUBLIC_BUCKET_PUBLIC_URL = process.env.R2_PUBLIC_BUCKET_PUBLIC_URL!
const R2_PRIVATE_BUCKET_PUBLIC_URL = process.env.R2_PRIVATE_BUCKET_PUBLIC_URL!

test.group('R2 driver | put', (group) => {
  group.each.timeout(6000)

  test('write file to the destination', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PUBLIC_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'public' as const,
      cdnUrl: R2_PUBLIC_BUCKET_PUBLIC_URL,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.getUrl(fileName)

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName)
  })

  test('write to nested path', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName)
  })

  test('overwrite destination when already exists', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')
    await driver.put(fileName, 'hi world')

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hi world')

    await driver.delete(fileName)
  })

  test('set custom content-type for the file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, '{ "hello": "world" }', {
      contentType: 'application/json',
    })

    const response = await driver.adapter.send(
      new HeadObjectCommand({ Key: fileName, Bucket: R2_PRIVATE_BUCKET })
    )

    assert.equal(response.ContentType, 'application/json')
    await driver.delete(fileName)
  })

  test('switch bucket at runtime', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: 'foo',
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'public' as const,
      cdnUrl: R2_PUBLIC_BUCKET_PUBLIC_URL,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.bucket(R2_PUBLIC_BUCKET).put(fileName, 'hello world')
    await driver.bucket(R2_PUBLIC_BUCKET).getUrl(fileName)

    const contents = await driver.bucket(R2_PUBLIC_BUCKET).get(fileName)
    assert.equal(contents.toString(), 'hello world')

    await driver.bucket(R2_PUBLIC_BUCKET).delete(fileName)
  })

  test('switch/set public url at runtime', async ({ assert, client }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PUBLIC_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'public' as const,
      cdnUrl: R2_PRIVATE_BUCKET_PUBLIC_URL,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    let driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')

    const incorrectUrl = await driver.getUrl(fileName)
    const response = await client.get(incorrectUrl)
    response.assertStatus(401)

    const correctDriver = driver.publicUrl(R2_PUBLIC_BUCKET_PUBLIC_URL)

    const contents = await correctDriver.get(fileName)
    assert.equal(contents.toString(), 'hello world')

    await correctDriver.delete(fileName)
  })
})

test.group('R2 driver | putStream', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('write file to the destination', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await fs.add('foo.txt', 'hello stream')
    const stream = fs.fsExtra.createReadStream(join(fs.basePath, 'foo.txt'))
    await driver.putStream(fileName, stream)

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hello stream')

    await driver.delete(fileName)
  })

  test('write to nested path', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await fs.add('foo.txt', 'hello stream')
    const stream = fs.fsExtra.createReadStream(join(fs.basePath, 'foo.txt'))
    await driver.putStream(fileName, stream)

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hello stream')

    await driver.delete(fileName)
  })

  test('overwrite destination when already exists', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await fs.add('foo.txt', 'hi stream')
    const stream = fs.fsExtra.createReadStream(join(fs.basePath, 'foo.txt'))
    await driver.put(fileName, 'hello world')
    await driver.putStream(fileName, stream)

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hi stream')

    await driver.delete(fileName)
  })

  test('set custom content-type for the file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await fs.add('foo.txt', '{ "hello": "world" }')
    const stream = fs.fsExtra.createReadStream(join(fs.basePath, 'foo.txt'))
    await driver.putStream(fileName, stream, {
      contentType: 'application/json',
    })

    const response = await driver.adapter.send(
      new HeadObjectCommand({ Key: fileName, Bucket: R2_PRIVATE_BUCKET })
    )
    assert.equal(response.ContentType, 'application/json')

    await driver.delete(fileName)
  })
})

test.group('S3 Drive | moveToDisk', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('upload small files', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const fileName = `${string.generateRandom(10)}.txt`
    const driver = new R2Driver(config, logger)

    const app = await setupApplication({ autoProcessMultipartFiles: true })
    const Route = app.container.resolveBinding('Adonis/Core/Route')
    const Server = app.container.resolveBinding('Adonis/Core/Server')

    Server.middleware.register([
      async () => {
        return {
          default: new (app.container.resolveBinding('Adonis/Core/BodyParser'))(app.config, {
            use() {
              return driver
            },
          }),
        }
      },
    ])

    Route.post('/', async ({ request }) => {
      const file = request.file('package')!
      await file.moveToDisk('./', {
        name: fileName,
      })
    })

    Server.optimize()

    const server = createServer(Server.handle.bind(Server))
    await supertest(server).post('/').attach('package', Buffer.from('hello world', 'utf-8'), {
      filename: 'package.txt',
    })

    const metadata = await driver.adapter.send(
      new HeadObjectCommand({
        Key: fileName,
        Bucket: config.bucket,
      })
    )

    assert.equal(metadata.ContentLength, 11)
    await driver.delete(fileName)
  })
})

test.group('R2 driver | multipartStream', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('write file to the destination', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const fileName = `${string.generateRandom(10)}.json`
    const driver = new R2Driver(config, logger)

    const app = await setupApplication()
    const Route = app.container.resolveBinding('Adonis/Core/Route')
    const Server = app.container.resolveBinding('Adonis/Core/Server')

    Server.middleware.register([
      async () => {
        return {
          default: app.container.resolveBinding('Adonis/Core/BodyParser'),
        }
      },
    ])

    Route.post('/', async ({ request }) => {
      request.multipart.onFile('package', {}, async (part, reportChunk) => {
        part.pause()
        part.on('data', reportChunk)
        await driver.putStream(fileName, part, { multipart: true, queueSize: 2 })
      })

      await request.multipart.process()
    })

    Server.optimize()

    const server = createServer(Server.handle.bind(Server))
    await supertest(server).post('/').attach('package', join(__dirname, '..', 'package.json'))

    const contents = await driver.get(fileName)
    assert.equal(
      contents.toString(),
      await fs.fsExtra.readFile(join(__dirname, '..', 'package.json'), 'utf-8')
    )

    await driver.delete(fileName)
  })

  test('cleanup stream when validation fails', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const fileName = `${string.generateRandom(10)}.json`
    const driver = new R2Driver(config, logger)

    const app = await setupApplication()
    const Route = app.container.resolveBinding('Adonis/Core/Route')
    const Server = app.container.resolveBinding('Adonis/Core/Server')

    Server.middleware.register([
      async () => {
        return {
          default: app.container.resolveBinding('Adonis/Core/BodyParser'),
        }
      },
    ])

    Route.post('/', async ({ request }) => {
      request.multipart.onFile('package', { extnames: ['png'] }, async (part, reportChunk) => {
        part.pause()
        part.on('data', reportChunk)
        await driver.putStream(fileName, part, { multipart: true, queueSize: 2 })
      })

      await request.multipart.process()
      assert.isTrue(request.file('package')?.hasErrors)
    })

    Server.optimize()

    const server = createServer(Server.handle.bind(Server))
    try {
      await supertest(server).post('/').attach('package', join(__dirname, '..', 'package.json'))
    } catch {}

    await driver.delete(fileName)
  })
})

test.group('R2 driver | exists', (group) => {
  group.each.timeout(6000)

  test('return true when a file exists', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'bar')
    assert.isTrue(await driver.exists(fileName))

    await driver.delete(fileName)
  })

  test("return false when a file doesn't exists", async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    assert.isFalse(await driver.exists(fileName))
  })

  test("return false when a file parent directory doesn't exists", async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,

      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    assert.isFalse(await driver.exists(fileName))
  })

  test('raise exception when credentials are incorrect', async ({ assert }) => {
    assert.plan(1)

    const config: R2DriverConfig = {
      key: 'foo',
      secret: 'bar',
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const driver = new R2Driver(config, logger)
    try {
      await driver.exists('bar/baz/foo.txt')
    } catch (error) {
      assert.equal(error.original.$metadata.httpStatusCode, 400)
    }
  })
})

test.group('R2 driver | delete', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('remove file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'bar')
    await driver.delete(fileName)

    assert.isFalse(await driver.exists(fileName))
  })

  test('do not throw error when trying to remove a non-existing file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.delete(fileName)
    assert.isFalse(await driver.exists(fileName))
  })

  test("do not error when file parent directory doesn't exists", async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `bar/baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.delete(fileName)
    assert.isFalse(await driver.exists(fileName))
  })
})

test.group('R2 driver | copy', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('copy file from within the disk root', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.copy(fileName, fileName1)

    const contents = await driver.get(fileName1)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName)
    await driver.delete(fileName1)
  })

  test('create intermediate directories when copying a file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.copy(fileName, fileName1)

    const contents = await driver.get(fileName1)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName)
    await driver.delete(fileName1)
  })

  test("return error when source doesn't exists", async ({ assert }) => {
    assert.plan(1)

    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const driver = new R2Driver(config, logger)

    try {
      await driver.copy('foo.txt', 'bar.txt')
    } catch (error) {
      assert.equal(
        error.message,
        'E_CANNOT_COPY_FILE: Cannot copy file from "foo.txt" to "bar.txt"'
      )
    }
  })

  test('overwrite destination when already exists', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.put(fileName1, 'hi world')
    await driver.copy(fileName, fileName1)

    const contents = await driver.get(fileName1)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName)
    await driver.delete(fileName1)
  })

  test('retain source content-type during copy', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world', { contentType: 'application/json' })
    await driver.copy(fileName, fileName1)

    const metaData = await driver.adapter.send(
      new HeadObjectCommand({ Key: fileName1, Bucket: R2_PRIVATE_BUCKET })
    )
    assert.equal(metaData.ContentType, 'application/json')

    await driver.delete(fileName)
    await driver.delete(fileName1)
  })
})

test.group('R2 driver | move', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('move file from within the disk root', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.move(fileName, fileName1)

    const contents = await driver.get(fileName1)
    assert.equal(contents.toString(), 'hello world')
    assert.isFalse(await driver.exists(fileName))

    await driver.delete(fileName1)
  })

  test('create intermediate directories when moving a file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,

      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.move(fileName, fileName1)

    const contents = await driver.get(fileName1)
    assert.equal(contents.toString(), 'hello world')
    assert.isFalse(await driver.exists(fileName))

    await driver.delete(fileName1)
  })

  test("return error when source doesn't exists", async ({ assert }) => {
    assert.plan(1)

    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const driver = new R2Driver(config, logger)

    try {
      await driver.move('foo.txt', 'baz/bar.txt')
    } catch (error) {
      assert.equal(
        error.message,
        'E_CANNOT_MOVE_FILE: Cannot move file from "foo.txt" to "baz/bar.txt"'
      )
    }
  })

  test('overwrite destination when already exists', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `baz/${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world')
    await driver.put(fileName1, 'hi world')

    await driver.move(fileName, fileName1)

    const contents = await driver.get(fileName1)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName1)
  })

  test('retain source content-type during move', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`
    const fileName1 = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    await driver.put(fileName, 'hello world', { contentType: 'application/json' })
    await driver.move(fileName, fileName1)

    const metaData = await driver.adapter.send(
      new HeadObjectCommand({ Key: fileName1, Bucket: R2_PRIVATE_BUCKET })
    )
    assert.equal(metaData.ContentType, 'application/json')

    await driver.delete(fileName1)
  })
})

test.group('R2 driver | get', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('get file contents', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const contents = await driver.get(fileName)
    assert.equal(contents.toString(), 'hello world')

    await driver.delete(fileName)
  })

  test('get file contents as a stream', async ({ assert }, done) => {
    assert.plan(2)

    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const stream = await driver.getStream(fileName)
    assert.instanceOf(stream, Readable)

    stream.on('data', (chunk) => {
      assert.equal(chunk, 'hello world')
    })
    stream.on('end', async () => {
      await driver.delete(fileName)
      done()
    })
    stream.on('error', (error) => {
      done(error)
    })
  }).waitForDone()

  test("return error when file doesn't exists", async ({ assert }) => {
    assert.plan(1)
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const driver = new R2Driver(config, logger)

    try {
      await driver.get('foo.txt')
    } catch (error) {
      assert.equal(error.message, 'E_CANNOT_READ_FILE: Cannot read file from location "foo.txt"')
    }
  })
})

test.group('R2 driver | getStats', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('get file stats', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const stats = await driver.getStats(fileName)
    assert.equal(stats.size, 11)
    assert.instanceOf(stats.modified, Date)

    await driver.delete(fileName)
  })

  test('return error when file is missing', async ({ assert }) => {
    assert.plan(1)

    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const driver = new R2Driver(config, logger)
    const fileName = `${string.generateRandom(10)}.txt`

    try {
      await driver.getStats(fileName)
    } catch (error) {
      assert.equal(error.original.$metadata.httpStatusCode, 404)
    }
  })
})

test.group('R2 driver | getVisibility', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('get visibility for private file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const visibility = await driver.getVisibility()
    assert.equal(visibility, 'private')

    await driver.delete(fileName)
  })

  test('get visibility for public file', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'public' as const,
      cdnUrl: R2_PUBLIC_BUCKET_PUBLIC_URL,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const visibility = await driver.getVisibility()
    assert.equal(visibility, 'public')

    await driver.delete(fileName)
  })

  test('return error when file is missing', async ({ assert }) => {
    assert.plan(1)

    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }

    const driver = new R2Driver(config, logger)
    const fileName = `${string.generateRandom(10)}.txt`

    try {
      await driver.getStats(fileName)
    } catch (error) {
      assert.equal(error.original.$metadata.httpStatusCode, 404)
    }
  })
})

test.group('R2 driver | getUrl', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('get url to a given file', async ({ assert, client }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PUBLIC_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'public' as const,
      cdnUrl: R2_PUBLIC_BUCKET_PUBLIC_URL,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const url = await driver.getUrl(fileName)
    const response = await client.get(url)
    assert.equal(response.body(), 'hello world')

    await driver.delete(fileName)
  })

  test('deny access to private files without a signed URL', async ({ client }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const url = await driver.getUrl(fileName)

    const response = await client.get(url)
    response.assertStatus(400)

    await driver.delete(fileName)
  })
})

test.group('R2 driver | getSignedUrl', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  group.each.timeout(6000)

  test('get signed url to a file in private disk', async ({ assert, client }) => {
    assert.plan(1)

    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    try {
      await client.get(await driver.getUrl(fileName))
    } catch (error) {
      assert.equal(error.response.statusCode, 400)
    }

    const response = await client.get(await driver.getSignedUrl(fileName))
    assert.equal(response.body(), 'hello world')

    await driver.delete(fileName)
  })

  test('define custom content headers for the file', async ({ assert, client }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      accountId: R2_ACCOUNT_ID,
      driver: 'r2' as const,
      visibility: 'private' as const,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)
    await driver.put(fileName, 'hello world')

    const signedUrl = await driver.getSignedUrl(fileName, {
      contentDisposition: 'attachment',
    })

    const response = await client.get(signedUrl)

    assert.equal(response.headers()['content-disposition'], 'attachment')
    assert.isTrue(response.body() instanceof Buffer)
    assert.equal(response.body().toString(), 'hello world')
    await driver.delete(fileName)
  })

  test('get signed url with expiration', async ({ assert }) => {
    const config: R2DriverConfig = {
      key: R2_ACCESS_KEY_ID,
      secret: R2_SECRET_ACCESS_KEY,
      bucket: R2_PRIVATE_BUCKET,
      driver: 'r2' as const,
      visibility: 'private' as const,
      accountId: R2_ACCOUNT_ID,
    }
    const fileName = `${string.generateRandom(10)}.txt`

    const driver = new R2Driver(config, logger)

    const signedUrl = await driver.getSignedUrl(fileName, {
      expiresIn: '2min',
    })

    const url = new URL(signedUrl)
    const expiresResult = url.searchParams.get('X-Amz-Expires')

    assert.equal(expiresResult, '120')
  })
})
