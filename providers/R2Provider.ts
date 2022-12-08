/*
 * adonis-drive-r2
 *
 * (c) Ndianabasi Udonkang <ndianabasi@gotedo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { R2Driver } from '../src/Drivers/R2'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class S3Provider {
  constructor(protected app: ApplicationContract) {}

  public boot() {
    this.app.container.withBindings(
      ['Adonis/Core/Drive', 'Adonis/Core/Logger'],
      (Drive, Logger) => {
        Drive.extend('s3', (_, __, config) => {
          return new R2Driver(config, Logger)
        })
      }
    )
  }
}
