The package has been configured successfully!

> See full instructions [here](https://www.npmjs.com/package/adonis-drive-r2).

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
