# ECS Deployment Guide

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

## Deployment Workflow

```
Local Development → Push to GitHub → GitHub Actions → ECR → ECS
     ↓                    ↓              ↓           ↓     ↓
  docker-compose    git push main   Build Images  Store  Run
```

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