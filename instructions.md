The package has been configured successfully!

## Validating environment variables

The configuration for R2 relies on certain environment variables and it is usually a good practice to validate the presence of those environment variables.

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


## Define config
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
