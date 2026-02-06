# Security Best Practices

## Credential Management

### 1. Docker Credentials (Local Development)

**For AWS ECR Public (one-time setup):**

```bash
# Install AWS ECR credential helper
brew install docker-credential-helper-ecr

# Or on Linux:
# sudo apt-get install amazon-ecr-credential-helper
```

**Configure Docker to use credential helper:**

Create or edit `~/.docker/config.json`:

```json
{
  "credHelpers": {
    "public.ecr.aws": "ecr-login"
  }
}
```

Now you can login without storing plain text credentials:

```bash
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

The credentials will be stored securely via the OS keychain.

### 2. Database Credentials

**Never commit `.env` files with real credentials!**

**Setup:**

1. Copy the example file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` with your actual credentials

3. Verify `.env` is in `.gitignore`

**For production deployments:**

Use AWS Secrets Manager or Parameter Store:

```bash
# Store database password
aws secretsmanager create-secret \
  --name /car-listing-app/prod/db-password \
  --secret-string "your-password" \
  --region us-east-2

# Update CloudFormation to reference secrets
```

### 3. AWS Credentials (Local Development)

**Use AWS CLI credential profiles:**

```bash
aws configure --profile car-listing
```

Edit `~/.aws/credentials`:

```ini
[car-listing]
aws_access_key_id = YOUR_KEY
aws_secret_access_key = YOUR_SECRET
region = us-east-2
```

Then use the profile:

```bash
export AWS_PROFILE=car-listing
aws ecs list-clusters
```

### 4. GitHub Actions Secrets

Store sensitive values in GitHub Secrets (never in code):

1. Go to: https://github.com/jasonatvail/car-listing-app/settings/secrets/actions
2. Add secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `DB_PASSWORD` (for future use)

### 5. Environment-Specific Configurations

Create different `.env` files for each environment:

```
backend/.env.example          # Template (commit this)
backend/.env                  # Local dev (gitignored)
backend/.env.production       # Production (use Secrets Manager)
backend/.env.staging          # Staging (use Secrets Manager)
```

## What NOT to Commit

❌ `.env` files with real credentials
❌ `~/.aws/credentials`
❌ `~/.docker/config.json`
❌ Database passwords
❌ API keys
❌ Private keys

## What TO Commit

✅ `.env.example` with placeholder values
✅ Documentation about credential setup
✅ `.gitignore` entries for sensitive files
✅ CloudFormation templates referencing Secrets Manager
✅ GitHub Actions workflows using `${{ secrets.* }}`

## Audit Checklist

- [ ] All `.env` files are in `.gitignore`
- [ ] GitHub Secrets are configured
- [ ] Docker credential helper is installed
- [ ] AWS credentials use named profiles
- [ ] No passwords in git history
- [ ] Production uses AWS Secrets Manager
- [ ] Database password has been rotated since exposure

## Rotating Compromised Credentials

If credentials are accidentally committed:

1. **Immediately rotate them:**
   - AWS: Create new access keys, delete old ones
   - RDS: Change master password
   - GitHub: Revoke and recreate secrets

2. **Remove from git history:**
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch backend/.env' \
     --prune-empty --tag-name-filter cat -- --all
   
   git push origin --force --all
   ```

3. **Update all deployments with new credentials**

## Additional Resources

- [Docker Credential Helpers](https://docs.docker.com/engine/reference/commandline/login/#credential-helpers)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
