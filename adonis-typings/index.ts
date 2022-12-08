/*
 * adonis-drive-r2
 *
 * (c) Ndianabasi Udonkang <ndianabasi@gotedo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

declare module '@ioc:Adonis/Core/Drive' {
  import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'

  /**
   * Configuration accepted by the R2 driver
   */
  export type R2DriverConfig = S3ClientConfig & {
    driver: 'r2'
    visibility: 'public' | 'private'
    bucket: string
    cdnUrl?: string
    key?: string
    secret?: string
    accountId: string
  }

  /**
   * The R2 driver implementation interface
   */
  export interface R2DriverContract extends DriverContract {
    name: 'r2'
    adapter: S3Client

    /**
     * Returns a new instance of the R2 driver with a custom runtime
     * bucket
     */
    bucket(bucket: string): R2DriverContract
  }

  interface DriversList {
    r2: {
      implementation: R2DriverContract
      config: R2DriverConfig
    }
  }
}
