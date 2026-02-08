

# ECS Redeployment - See consolidated guide

This file has been consolidated into `ECS_DEPLOYMENT.md` to avoid duplication.

Please see `/deployment/ECS_DEPLOYMENT.md` for redeployment steps, networking changes, and troubleshooting guidance.

## What Changed

The new CloudFormation template has **proper security group separation**:

### Old Approach ❌
- Used a single security group for both ECS and RDS
- RDS ingress rules weren't properly configured
- Tasks couldn't connect to the database

### New Approach ✅
- **ALBSecurityGroup** - Handles incoming HTTP traffic
- **ECSTaskSecurityGroup** - Isolates container traffic
- **RDSIngressRule** - Explicitly allows ECS→RDS traffic on port 5432
- Cleaner egress rules for outbound traffic

## Architecture

```
Internet → ALB (port 80) → ECS Tasks → RDS (port 5432)
          ↓
      ALBSecurityGroup
                ↓
          ECSTaskSecurityGroup
                ↓
              (Explicit ingress from ALB)
                ↓
          (Explicit ingress to RDS)
```

## Deployment Steps

### 1. Wait for Old Stack Deletion
```bash
# Check status
aws cloudformation describe-stacks \
  --stack-name car-listing-dev \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus' \
  --output text

# Should show DELETE_COMPLETE before proceeding
```

### 2. Deploy New Stack
```bash
cd /Users/jasonvail/Documents/SoftwareEngineering/car-listing-app
export DB_PASSWORD_SECRET_ARN="arn:aws:secretsmanager:us-east-2:585625007298:secret:db-credentials-NLm1Mf"
./deployment/deploy-ecs-dev.sh
```

The script now automatically:
- Finds the RDS security group ID
- Passes it to CloudFormation
- Creates the RDSIngressRule to allow ECS→RDS traffic
- No manual security group configuration needed!

### 3. Monitor Deployment
```bash
# Watch the deployment progress
aws cloudformation describe-stacks \
  --stack-name car-listing-dev \
  --region us-east-2 \
  --query 'Stacks[0].[StackStatus,StackStatusReason]' \
  --output text

# Watch logs once services start
```

```bash
aws logs tail /ecs/car-listing-dev/backend --follow --region us-east-2
```
# 1) Check CloudFormation stack status (shows if stack was deleted)
```bash
aws cloudformation describe-stacks --stack-name car-listing-dev --region us-east-2 --query 'Stacks[0].StackStatus' --output text
```
# 2) See if the ECS cluster still exists
```bash
aws ecs describe-clusters --clusters car-listing-dev --region us-east-2 --query 'clusters[0].status' --output text
```
# 3) If the cluster exists, list services in it
```bash
aws ecs list-services --cluster car-listing-dev --region us-east-2 --output text
```
### 4. Verify Health
```bash
# Check service health
aws ecs describe-services \
  --cluster car-listing-dev \
  --services dev-backend dev-frontend \
  --region us-east-2
```

## Template Improvements

### Parameters
- Added `DBSecurityGroupId` parameter
- Removed `AssignPublicIp` parameter (now always ENABLED)
- Removed unused `BackendContainerPort` and `FrontendContainerPort` parameters

### Resources
- Created separate ALB and ECS security groups
- Added `RDSIngressRule` resource to allow ECS→RDS communication
- Improved health check configuration (timeouts, thresholds)
- Better logging configuration

### Outputs
- Added `ECSSecurityGroupId` for reference
- Added service name outputs
- Added log group outputs
- More informative output keys

## Key Fix: RDS Ingress Rule

```yaml
RDSIngressRule:
  Type: AWS::EC2::SecurityGroupIngress
  Properties:
    GroupId: !Ref DBSecurityGroupId
    IpProtocol: tcp
    FromPort: 5432
    ToPort: 5432
    SourceSecurityGroupId: !Ref ECSTaskSecurityGroup
    Description: PostgreSQL access from ECS tasks
```

This allows:
- **From:** Any resource with ECSTaskSecurityGroup
- **To:** RDS security group
- **Port:** 5432 (PostgreSQL)
- **Result:** ECS tasks can now query the database ✅

## Troubleshooting

If tasks still fail:

1. **Check task logs:**
   ```bash
   aws logs tail /ecs/car-listing-dev/backend --since 1h --region us-east-2
   ```

2. **Check service events:**
   ```bash
   aws ecs describe-services \
     --cluster car-listing-dev \
     --services dev-backend \
     --region us-east-2 \
     --query 'services[0].events[:5]'
   ```

3. **Verify security group rules:**
   ```bash
   # Get ECS security group
   aws cloudformation describe-stack-resource \
     --stack-name car-listing-dev \
     --logical-resource-id ECSTaskSecurityGroup \
     --region us-east-2
   ```

4. **Check RDS connectivity:**
   ```bash
   # Try connecting from EC2 instance in the same VPC
   psql -h database-1.cvcw48iocwex.us-east-2.rds.amazonaws.com -U postgres
   ```

## Timeline

- **~5 minutes:** Stack deletion completes
- **~5-7 minutes:** New stack creation and service startup
- **~2-3 minutes:** ECS health checks pass
- **Total:** ~15-20 minutes from deployment start to running app

## What Stays the Same

- ECR images (already pushed and working)
- GitHub Actions workflows (auto-deploy still works)
- Docker compose local development (unchanged)
- Application code and configuration

If Your IP Changes:
Update the security group without redeploying:
```bash
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 80 \
  --cidr <OLD_IP>/32 \
  --region us-east-2# ECS Deployment Guide

## Problem: Images Push to ECR but Don't Run in ECS

**Root Cause:** ECS infrastructure (cluster, services, task definitions) hasn't been deployed yet.

## Solution: Deploy ECS Infrastructure First

### Step 1: Deploy the ECS Stack

```bash
cd /Users/jasonvail/Documents/SoftwareEngineering/car-listing-app
./deployment/deploy-ecs-dev.sh
```

```bash
cd /Users/jasonvail/Documents/SoftwareEngineering/car-listing-app
./deployment/deploy-ecs-staging.sh
```

```bash
cd /Users/jasonvail/Documents/SoftwareEngineering/car-listing-app
./deployment/deploy-ecs-prod.sh
```

This will:
- Create ECS cluster: `car-listing-dev`
- Create backend and frontend services
- Create Application Load Balancer
- Set up CloudWatch log groups
- Configure networking and security groups

**Deployment time:** 5-10 minutes

### Step 2: Configure RDS Security Group

After deployment, allow ECS tasks to access your RDS database:

```bash
# Get the ECS security group ID
ECS_SG=$(aws cloudformation describe-stacks \
  --stack-name car-listing-dev \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' \
  --output text)

# Get RDS security group ID
RDS_SG=$(aws rds describe-db-instances \
  --db-instance-identifier database-1 \
  --region us-east-2 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

# Allow ECS to connect to RDS
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG \
  --region us-east-2
```

### Step 3: Verify Deployment

```bash
# Check cluster status
aws ecs describe-clusters \
  --clusters car-listing-dev \
  --region us-east-2

# Check services
aws ecs list-services \
  --cluster car-listing-dev \
  --region us-east-2

# Get ALB URL
aws cloudformation describe-stacks \
  --stack-name car-listing-dev \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
  --output text
```

Visit the ALB URL in your browser to access the application.

### Step 4: Check Logs

```bash
# Backend logs
aws logs tail /ecs/car-listing-dev/backend \
  --follow \
  --region us-east-2

# Frontend logs
aws logs tail /ecs/car-listing-dev/frontend \
  --follow \
  --region us-east-2
```

## GitHub Actions Integration

Once ECS is deployed, GitHub Actions will automatically:

1. **On push to `main`:**
   - Build dev images
   - Push to ECR
   - Update ECS services (force new deployment)

2. **On tag `staging-*`:**
   - Build staging images
   - Deploy to staging environment

3. **On tag `v*`:**
   - Build production images
   - Deploy to production environment

### Enable HTTPS (ACM)

To enable HTTPS on the ALB and make features like geolocation work reliably in browsers, add an ACM certificate and provide its ARN to the workflows:

1. Request or import a certificate in AWS Certificate Manager (ACM) for your domain and validate it (DNS or email).
3. In your GitHub repository, add a secret named `ACM_CERTIFICATE_ARN` with the certificate ARN (e.g., `arn:aws:acm:us-east-2:...:certificate/...`).
4. The GitHub Actions deploy workflows (`deploy-dev.yml`, `deploy-staging.yml`, `deploy-prod.yml`) will pass the `ACMCertificateArn` parameter to CloudFormation — when present, the stack creates an HTTPS listener and HTTP→HTTPS redirect.

Note: The ACM certificate **must be in the same AWS region** as the ALB (the template deploys the ALB into the stack's region).

- **For ALB:** request the ACM certificate in the ALB region (e.g., `us-east-2`) and add the certificate ARN to the GitHub secret `ACM_CERTIFICATE_ARN` to enable ALB HTTPS and automatic HTTP→HTTPS redirects.
- **For CloudFront:** request or import your ACM certificate in **`us-east-1`** (CloudFront requires certificates in us-east-1) and provide that ARN when deploying the CloudFront stack.

Server-side Google geocoding (optional):
- To enable server-side geocoding with Google (recommended so you can keep the API key secret), create a Google Geocoding API key and add it to your repository secrets as `GOOGLE_GEOCODER_KEY`.
- The deploy workflows will pass `GoogleGeocoderKey` to the CloudFormation stack and it will be injected as `GOOGLE_GEOCODER_KEY` into the backend task definition (NoEcho / secret-safe). If the key is not present, the frontend will fall back to the public OSM Nominatim geocoder.

Database password via Secrets Manager (recommended):
- Create a secret in AWS Secrets Manager that contains your database password (either a plaintext secret or JSON with a `password` key). Note the secret ARN.
- Add a GitHub secret named `DB_PASSWORD_SECRET_ARN` with the secret ARN (e.g., `arn:aws:secretsmanager:us-east-2:...:secret:my-db-pass`).
- The deploy workflows will pass `DBPasswordSecretArn` to CloudFormation and the backend task will be configured to inject the secret as `PGPASSWORD` at runtime (if provided). If you do not set this, the template still supports `DBPasswordParameter` as before.
- This removes the need to store the DB password in local `.env` files and keeps the secret managed and auditable.


If the secret is not set (or empty), the stack remains HTTP only and no HTTPS listener is created.
## Deployment Workflow

```
Local Development → Push to GitHub → GitHub Actions → ECR → ECS
     ↓                    ↓              ↓           ↓     ↓
  docker-compose    git push main   Build Images  Store  Run
```

## Re-deployment & Networking Changes (redeployment guide)

### What changed
The CloudFormation template was updated to improve networking and security group separation:
- **ALBSecurityGroup** - handles incoming HTTP(S) traffic
- **ECSTaskSecurityGroup** - isolates container traffic from other resources
- **RDSIngressRule** - explicit rule allowing ECS tasks to reach the RDS instance on port 5432

This replaces the old single-security-group approach which could prevent ECS tasks from connecting to RDS correctly.

### Architecture (simplified)

```
Internet → ALB (port 80/443) → ECS Tasks → RDS (port 5432)
          ↓
      ALBSecurityGroup
                ↓
          ECSTaskSecurityGroup
                ↓
          RDS Ingress (explicit from ECSTaskSecurityGroup)
```

### Redeployment steps (if replacing an older stack)
1. Wait for existing stack deletion to complete:
```bash
aws cloudformation describe-stacks --stack-name car-listing-dev --region us-east-2 --query 'Stacks[0].StackStatus' --output text
# Expect: DELETE_COMPLETE
```
2. Deploy the new stack (deploy script automates SG wiring):
```bash
cd /path/to/car-listing-app
./deployment/deploy-ecs-dev.sh
```
3. Monitor deployment and logs:
```bash
aws cloudformation describe-stacks --stack-name car-listing-dev --region us-east-2 --query 'Stacks[0].[StackStatus,StackStatusReason]' --output text
aws logs tail /ecs/car-listing-dev/backend --follow --region us-east-2
```
4. Verify health:
```bash
aws ecs describe-services --cluster car-listing-dev --services dev-backend dev-frontend --region us-east-2
```

### Template improvements included
- Added `DBSecurityGroupId` parameter and `RDSIngressRule` resource
- Created separate ALB and ECS security groups
- Improved health check timing and thresholds
- Added useful outputs (ECSSecurityGroupId, log group names, service names)

### Key fix: RDS ingress rule
```yaml
RDSIngressRule:
  Type: AWS::EC2::SecurityGroupIngress
  Properties:
    GroupId: !Ref DBSecurityGroupId
    IpProtocol: tcp
    FromPort: 5432
    ToPort: 5432
    SourceSecurityGroupId: !Ref ECSTaskSecurityGroup
    Description: PostgreSQL access from ECS tasks
```
This ensures ECS tasks can reach the RDS instance on port 5432 from the ECSTaskSecurityGroup.

### Troubleshooting redeploys
- If a previous stack is being deleted/updated, wait until status is stable (or cancel the update when appropriate):
```bash
aws cloudformation describe-stack-events --stack-name car-listing-dev --region us-east-2 --max-items 50
aws cloudformation cancel-update-stack --stack-name car-listing-dev --region us-east-2
```

### Expected timeline
- Stack deletion: ~5 minutes
- Stack creation + service startup: ~5–7 minutes
- Service health stabilization: ~2–3 minutes
- Total: ~15–20 minutes

---

## Infrastructure Stack Contents

The CloudFormation template creates:

- **ECS Cluster** - Container orchestration
- **ECS Services** - Backend (port 5001) & Frontend (port 80)
- **Task Definitions** - Container specs and environment variables
- **Application Load Balancer** - Public endpoint
- **Target Groups** - Health checks and routing
- **Security Groups** - Network access control
- **IAM Roles** - Task execution and permissions
- **CloudWatch Log Groups** - Application logs

## Environment Variables in ECS

Stored in task definitions (injected at runtime):

**Backend:**
- `PGHOST` - RDS endpoint
- `PGPORT` - 5432
- `PGDATABASE` - database-1
- `PGUSER` - postgres
- `PGPASSWORD` - From parameter (encrypted)
- `PORT` - 5001

**Frontend:**
- `VITE_API_URL` - Backend service URL

## Updating the Stack

To update infrastructure:

```bash
# Edit template.yaml, then:
./deployment/deploy-ecs-dev.sh
```

To update application code only:

```bash
git add .
git commit -m "Update application"
git push origin main
# GitHub Actions handles the rest
```

## Troubleshooting

### Services not starting?
```bash
# Check service events
aws ecs describe-services \
  --cluster car-listing-dev \
  --services dev-backend dev-frontend \
  --region us-east-2
```

### Tasks failing health checks?
```bash
# Check task logs
aws logs tail /ecs/car-listing-dev/backend --since 30m --region us-east-2
```

### Database connection errors?
- Verify RDS security group allows ECS security group
- Check database credentials in task definition
- Confirm RDS endpoint is correct

### Images not updating?
```bash
# Force new deployment
aws ecs update-service \
  --cluster car-listing-dev \
  --service dev-backend \
  --force-new-deployment \
  --region us-east-2
```

## Cleanup

To delete the entire stack:

```bash
aws cloudformation delete-stack \
  --stack-name car-listing-dev \
  --region us-east-2
```
```bash
aws cloudformation delete-stack \
  --stack-name car-listing-staging \
  --region us-east-2
```

```bash
aws cloudformation delete-stack \
  --stack-name car-listing-prod \
  --region us-east-2
```

**Note:** This will delete all resources but keep ECR images.

Get dev frontend URL
```bash
# Make executable once:
chmod +x ./deployment/get-frontend-url.sh

# Print frontend URL for dev (default stack/car-listing-dev):
./deployment/get-frontend-url.sh

# Open the frontend in your browser:
OPEN=true ./deployment/get-frontend-url.sh
```

## Using the RDS CA locally
If your RDS instance uses a certificate chain that requires pinning (or you see SSL verification failures locally), you can pin the RDS CA bundle for local development.

1. Download the RDS CA bundle (example):

```bash
curl -O https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

2. The `docker-compose.yml` mounts `global-bundle.pem` into the backend container at `/app/certs/rds-global-bundle.pem` and sets `PGSSLROOTCERT=/app/certs/rds-global-bundle.pem` for you.

3. Restart the backend:

```bash
docker compose up -d --build backend
# View backend logs
docker compose logs -f backend
```

If you'd rather bypass verification for local testing, set `PGSSLVERIFY=false` in `backend/.env` (insecure; do not use in production).