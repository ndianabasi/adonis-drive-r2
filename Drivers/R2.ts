/*
 * adonis-drive-r2
 *
 * (c) Ndianabasi Udonkang <ndianabasi@gotedo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Readable } from 'stream'
import getStream from 'get-stream'
import { Upload } from '@aws-sdk/lib-storage'
import { string } from '@poppinss/utils/build/helpers.js'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import {
  CannotCopyFileException,
  CannotMoveFileException,
  CannotReadFileException,
  CannotWriteFileException,
  CannotDeleteFileException,
  CannotGetMetaDataException,
} from '@adonisjs/core/build/standalone'

import {
  Visibility,
  WriteOptions,
  ContentHeaders,
  R2DriverConfig,
  R2DriverContract,
  DriveFileStats,
} from '@ioc:Adonis/Core/Drive'

import {
  Tag,
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommandInput,
} from '@aws-sdk/client-s3'

/**
 * An implementation of the s3 driver for AdonisJS drive
 */
export class R2Driver implements R2DriverContract {
  /**
   * Reference to the s3 client
   */
  public adapter: S3Client

  /**
   * Name of the driver
   */
  public name: 'r2' = 'r2'

  constructor(private config: R2DriverConfig, private logger: LoggerContract) {
    if (this.config.visibility === 'public' && !this.config.cdnUrl) {
      throw new Error("The bucket's public URL is required when the bucket is public")
    }

    /**
     * Use the top level key and secret to define AWS credentials
     */
    if (this.config.key && this.config.secret) {
      this.config.credentials = {
        accessKeyId: this.config.key,
        secretAccessKey: this.config.secret,
      }
    }

    this.config.endpoint = `https://${this.config.accountId}.r2.cloudflarestorage.com`
    this.config.region = 'auto'

    this.adapter = new S3Client(this.config)
  }

  /**
   * Transforms the write options to S3 properties
   */
  private transformWriteOptions(options?: WriteOptions) {
    const {
      visibility,
      contentType,
      contentDisposition,
      contentEncoding,
      contentLanguage,
      contentLength,
      cacheControl,
      ...adapterOptions
    } = Object.assign({ visibility: this.config.visibility }, options)

    if (contentLength) {
      adapterOptions['ContentLength'] = contentLength
    }

    if (contentType) {
      adapterOptions['ContentType'] = contentType
    }

    if (contentDisposition) {
      adapterOptions['ContentDisposition'] = contentDisposition
    }

    if (contentEncoding) {
      adapterOptions['ContentEncoding'] = contentEncoding
    }

    if (contentLanguage) {
      adapterOptions['ContentLanguage'] = contentLanguage
    }

    if (cacheControl) {
      adapterOptions['CacheControl'] = cacheControl
    }

    if (visibility === 'public') {
      adapterOptions.ACL = 'public-read'
    } else if (visibility === 'private') {
      adapterOptions.ACL = 'private'
    }

    this.logger.trace(adapterOptions, '@drive/s3 write options')
    return adapterOptions
  }

  /**
   * Transform content headers to S3 response content type
   */
  private transformContentHeaders(options?: ContentHeaders) {
    const contentHeaders: Omit<GetObjectCommandInput, 'Key' | 'Bucket'> = {}
    const { contentType, contentDisposition, contentEncoding, contentLanguage, cacheControl } =
      options || {}

    if (contentType) {
      contentHeaders['ResponseContentType'] = contentType
    }

    if (contentDisposition) {
      contentHeaders['ResponseContentDisposition'] = contentDisposition
    }

    if (contentEncoding) {
      contentHeaders['ResponseContentEncoding'] = contentEncoding
    }

    if (contentLanguage) {
      contentHeaders['ResponseContentLanguage'] = contentLanguage
    }

    if (cacheControl) {
      contentHeaders['ResponseCacheControl'] = cacheControl
    }

    this.logger.trace(contentHeaders, '@drive/s3 content headers')
    return contentHeaders
  }

  /**
   * Set a new bucket at runtime and return a new driver instance
   */
  public bucket(bucket: string): R2Driver {
    return new R2Driver(Object.assign({}, this.config, { bucket }), this.logger)
  }

  /**
   * Set a new public url at runtime and return a new driver instance
   */
  public publicUrl(url: string): R2Driver {
    return new R2Driver(
      Object.assign({}, this.config, { cdnUrl: url } as R2DriverConfig),
      this.logger
    )
  }

  /**
   * Returns the file contents as a buffer. The buffer return
   * value allows you to self choose the encoding when
   * converting the buffer to a string.
   */
  public async get(location: string): Promise<Buffer> {
    return getStream.buffer(await this.getStream(location))
  }

  /**
   * Returns the file contents as a stream
   */
  public async getStream(location: string): Promise<Readable> {
    try {
      const response = await this.adapter.send(
        new GetObjectCommand({ Key: location, Bucket: this.config.bucket })
      )

      /**
       * The value as per the SDK can be a blob, NodeJS.ReadableStream or Readable stream.
       * However, at runtime it is always a readable stream.
       *
       * There is an open issue on the same https://github.com/aws/aws-sdk-js-v3/issues/3064
       */
      return response.Body as unknown as Promise<Readable>
    } catch (error) {
      throw CannotReadFileException.invoke(location, error)
    }
  }

  /**
   * A boolean to find if the location path exists or not
   */
  public async exists(location: string): Promise<boolean> {
    try {
      await this.adapter.send(
        new HeadObjectCommand({
          Key: location,
          Bucket: this.config.bucket,
        })
      )

      return true
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 404) {
        return false
      }

      throw CannotGetMetaDataException.invoke(location, 'exists', error)
    }
  }

  /**
   * Get the visibility for the bucket.
   * For R2, visibility is set at the bucket level alone.
   */
  public async getVisibility(): Promise<Visibility> {
    return this.config.visibility
  }

  /**
   * Returns the file stats
   */
  public async getStats(location: string): Promise<DriveFileStats> {
    try {
      const stats = await this.adapter.send(
        new HeadObjectCommand({
          Key: location,
          Bucket: this.config.bucket,
        })
      )

      return {
        modified: stats.LastModified!,
        size: stats.ContentLength!,
        isFile: true,
        etag: stats.ETag,
      }
    } catch (error) {
      throw CannotGetMetaDataException.invoke(location, 'stats', error)
    }
  }

  /**
   * Returns the signed url for a given path
   */
  public async getSignedUrl(
    location: string,
    options?: ContentHeaders & { expiresIn?: string | number }
  ): Promise<string> {
    try {
      return await getSignedUrl(
        this.adapter,
        new GetObjectCommand({
          Key: location,
          Bucket: this.config.bucket,
          ...this.transformContentHeaders(options),
        }),
        {
          expiresIn: string.toMs(options?.expiresIn || '15min') / 1000,
        }
      )
    } catch (error) {
      throw CannotGetMetaDataException.invoke(location, 'signedUrl', error)
    }
  }

  /**
   * Returns URL to a given path
   */
  public async getUrl(location: string) {
    /**
     * Use the CDN URL if defined
     */
    if (this.config.cdnUrl) {
      return Promise.resolve(`${this.config.cdnUrl}/${location}`)
    }

    return Promise.resolve(
      `https://${this.config.bucket}.${this.config.accountId}.r2.cloudflarestorage.com/${location}`
    )
  }

  /**
   * Write string|buffer contents to a destination. The missing
   * intermediate directories will be created (if required).
   */
  public async put(
    location: string,
    contents: Buffer | string,
    options?: WriteOptions
  ): Promise<void> {
    try {
      await this.adapter.send(
        new PutObjectCommand({
          Key: location,
          Body: contents,
          Bucket: this.config.bucket,
          ...this.transformWriteOptions(options),
        })
      )
    } catch (error) {
      throw CannotWriteFileException.invoke(location, error)
    }
  }

  /**
   * Write a stream to a destination. The missing intermediate
   * directories will be created (if required).
   */
  public async putStream(
    location: string,
    contents: NodeJS.ReadableStream,
    options?: WriteOptions & {
      multipart?: boolean
      queueSize?: number
      partSize?: number
      leavePartsOnError?: boolean
      tags?: Tag[]
      tap?: (stream: Upload) => void
    }
  ): Promise<void> {
    try {
      options = Object.assign({}, options)

      /**
       * Upload as multipart stream
       */
      if (options.multipart) {
        const { tap, queueSize, partSize, leavePartsOnError, tags, ...others } = options
        const upload = new Upload({
          params: {
            Key: location,
            Body: contents as unknown as Readable,
            Bucket: this.config.bucket,
            ...this.transformWriteOptions(others),
          },
          queueSize,
          partSize,
          leavePartsOnError,
          tags,
          client: this.adapter,
        })

        if (typeof tap === 'function') {
          tap(upload)
        }

        await upload.done()
        return
      }

      await this.adapter.send(
        new PutObjectCommand({
          Key: location,
          Body: contents as unknown as Readable,
          Bucket: this.config.bucket,
          ...this.transformWriteOptions(options),
        })
      )
    } catch (error) {
      throw CannotWriteFileException.invoke(location, error)
    }
  }

  /**
   * Not supported
   */
  public async setVisibility(): Promise<void> {
    this.logger.warn('adonis-drive-r2: This driver does not support `setVisibility`')
    return Promise.resolve()
  }

  /**
   * Remove a given location path
   */
  public async delete(location: string): Promise<void> {
    try {
      await this.adapter.send(
        new DeleteObjectCommand({
          Key: location,
          Bucket: this.config.bucket,
        })
      )
    } catch (error) {
      throw CannotDeleteFileException.invoke(location, error)
    }
  }

  /**
   * Copy a given location path from the source to the destination.
   * The missing intermediate directories will be created (if required)
   */
  public async copy(source: string, destination: string, options?: WriteOptions): Promise<void> {
    options = options || {}

    try {
      await this.adapter.send(
        new CopyObjectCommand({
          Key: destination,
          CopySource: `/${this.config.bucket}/${source}`,
          Bucket: this.config.bucket,
          ...this.transformWriteOptions(options),
        })
      )
    } catch (error) {
      throw CannotCopyFileException.invoke(source, destination, error.original || error)
    }
  }

  /**
   * Move a given location path from the source to the destination.
   * The missing intermediate directories will be created (if required)
   */
  public async move(source: string, destination: string, options?: WriteOptions): Promise<void> {
    try {
      await this.copy(source, destination, options)
      await this.delete(source)
    } catch (error) {
      throw CannotMoveFileException.invoke(source, destination, error.original || error)
    }
  }
}
