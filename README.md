<div align="center">
  <img src="https://res.cloudinary.com/adonisjs/image/upload/q_100/v1558612869/adonis-readme_zscycu.jpg" width="600px">
</div>

<br />

<div align="center">
  <h3>AdonisJS Driver for Cloudflare R2</h3>
  <p>
    Enjoy the freedom of Cloudflare R2 from your Adonisjs Application.
  </p>
</div>

<br />

<div align="center">

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url] [![synk-image]][synk-url]

</div>

<div align="center">
  <h3>
    <a href="https://adonisjs.com">
      Website
    </a>
    <span> | </span>
    <a href="https://docs.adonisjs.com/guides/drive">
      Guides
    </a>
    <span> | </span>
    <a href="CONTRIBUTING.md">
      Contributing
    </a>
    <span> | </span>
    <a href="benchmarks.md">
      Benchmarks
    </a>
  </h3>
</div>

<div align="center">
  <sub>Built with ❤︎ by <a href="https://twitter.com/_ndianabasi">Ndianabasi Udonkang</a>
</div>

## Background

The Cloudflare R2 API implements the S3 API in order to enable users have a seamless migration/transition from Amazon S3 to Cloudflare R2. Because of this, this driver utilises the [Amazon S3 Rest API](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html) by working within the [Cloudflare S3 API compatibility instructions](https://developers.cloudflare.com/r2/data-access/s3-api/api), which ensures S3 APIs not supported are not included in this driver.

This driver works by pointing the endpoint property required in the S3 API config to Cloudflare's R2 endpoint. See [here](https://developers.cloudflare.com/r2/examples/aws-sdk-js-v3). The Cloudflare R2 endpoint is generated within the driver by injecting the required `R2 Account ID` and the name of the bucket for the active driver instance.

A major difference between this R2 driver and S3 driver is that this driver only supports bucket-level visibility. This is because Cloudflare R2 only provides bucket-level ACL and Cloudflare R2 does not support for the S3 [GetObjectAcl](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObjectAcl.html) command.

## Installation

```bash
yarn add adonis-drive-r2
```

```bash
node ace invoke adonis-drive-r2
```

## Validating Environment Variables

The configuration for R2 driver relies on certain environment variables and it is usually a good practice to validate the presence of those environment variables.

Open `env.ts` file and paste the following code inside it.

```ts
R2_ACCESS_KEY_ID: Env.schema.string(),
R2_SECRET_ACCESS_KEY: Env.schema.string(),
R2_BUCKET: Env.schema.string(),
R2_ACCOUNT_ID: Env.schema.string(),
R2_PUBLIC_URL: Env.schema.string.optional(),
```
Update DRIVE_DISK
```diff
- DRIVE_DISK: Env.schema.enum(['local', 's3'] as const),
+ DRIVE_DISK: Env.schema.enum(['local', 's3', 'r2'] as const),
```


## Define a New Disk for R2 Driver
Open the `config/drive.ts` and paste the following code snippet inside it.

```ts
{
  disks: {
    // ... other disk

    r2: {
      driver: 'r2',
      visibility: 'private',
      key: Env.get('R2_ACCESS_KEY_ID'),
      secret: Env.get('R2_SECRET_ACCESS_KEY'),
      bucket: Env.get('R2_BUCKET'),
      accountId: Env.get('R2_ACCOUNT_ID'),
      cdnUrl: Env.get('R2_PUBLIC_URL')
    }
  }
}
```

> Note that the `cdnUrl` property of this R2 config (which maps to the public URl of your bucket) is required when the `visibility` of the disk is `public`.

## Improve your Drive Contract

Open the `contracts/drive.ts` file. Add the name of the new disk to the `DisksList` interface

```typescript
declare module '@ioc:Adonis/Core/Drive' {
  interface DisksList {
    // ... other disks
    r2: {
      config: R2DriverConfig // <-- Make sure to use the `R2DriverConfig` interface
      implementation: R2DriverContract // <-- Make sure to use the `R2DriverContract` interface
    }
  }
}
```

## How to Obtain Public URL for Cloudflare R2 Bucket

1. Login to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Click `R2` on the sidebar and open a bucket (or create one and open it).
1. Switch to the `Settings` tab.
1. Under `Bucket Access`, click `View Public Bucket URL` and copy the URL.

## Making your R2 Bucket Public

By default, Cloudflare's bucket-level ACL, only provides read access to individual files via the public URL. The public won't be able to list your bucket items via the public URL. 

To make your bucket public, click on `Allow Access` within the `Bucket Access` section of the `Settings` tab of your bucket.

> Public URLs are only useful when your bucket is public. The driver can generate signed URLs for private buckets.

## Credits

A big thank you to Harminder Virk for his work of love on the AdonisJS framework and for the amazing S3 Driver for Adonisjs Drive which inspired this Driver for Cloudflare R2.

[gh-workflow-image]: https://img.shields.io/github/workflow/status/ndianabasi/adonis-drive-r2/test?style=for-the-badge
[gh-workflow-url]: https://github.com/ndianabasi/adonis-drive-r2/actions/workflows/test.yml "Github action"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]:  "typescript"

[npm-image]: https://img.shields.io/npm/v/adonis-drive-r2.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/adonis-drive-r2 "npm"

[license-image]: https://img.shields.io/npm/l/adonis-drive-r2?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"

[synk-image]: https://img.shields.io/snyk/vulnerabilities/github/ndianabasi/adonis-drive-r2?label=Synk%20Vulnerabilities&style=for-the-badge
[synk-url]: https://snyk.io/test/github/ndianabasi/adonis-drive-r2?targetFile=package.json "synk"
