# AWS Cost Management - Save Money on ECS

## Quick Commands

```bash
# Stop services when not using (saves ~$0.03-0.05/hour)
./stop-ecs-services.sh

# Start services when ready to develop
./start-ecs-services.sh

# Start with multiple tasks
./start-ecs-services.sh 2
```

## Cost Management Scripts

### stop-ecs-services.sh

**Purpose:** Stop ECS services to avoid charges while keeping infrastructure

**What it does:**
- Sets all ECS service desired counts to 0
- Suspends auto scaling (if configured)
- Waits for tasks to drain
- Shows detailed cost savings breakdown

**Usage:**
```bash
cd /Users/jasonvail/Documents/SoftwareEngineering/car-listing-app
./stop-ecs-services.sh
```

**Output Example:**
```
🛑 Stopping ECS Services to Avoid Charges
========================================

Stack: car-listing-dev
Region: us-east-2

✅ Found cluster: car-listing-car-listing-dev

🔍 Finding services...
Found services:
  - car-listing-dev-backend
  - car-listing-dev-frontend

🛑 Stopping service: car-listing-dev-backend
   Current desired count: 1
   ✅ Service stopped (desired count set to 0)

🛑 Stopping service: car-listing-dev-frontend
   Current desired count: 1
   ✅ Service stopped (desired count set to 0)

✅ All services stopped!

💰 Cost Savings:
   - ECS tasks: $0/hour (was ~$0.03-0.05/hour)
```

### start-ecs-services.sh

**Purpose:** Resume ECS services after stopping

**What it does:**
- Sets desired count back to specified value (default: 1)
- Re-enables auto scaling configuration
- Waits for services to become healthy
- Shows application URLs when ready

**Usage:**
```bash
# Start with 1 task per service (default)
./start-ecs-services.sh

# Start with 2 tasks per service
./start-ecs-services.sh 2

# Start with 5 tasks per service
./start-ecs-services.sh 5
```

**Output Example:**
```
▶️  Starting ECS Services
=======================

Stack: car-listing-dev
Region: us-east-2
Desired Count: 1

✅ Found cluster: car-listing-car-listing-dev

▶️  Starting service: car-listing-dev-backend
   Current desired count: 0
   ✅ Service started (desired count set to 1)

✅ Services started!

🔗 Application URLs:
   Frontend: http://car-li-Appli-N93AGTD2xoPE-5427597.us-east-2.elb.amazonaws.com
   Backend:  http://car-li-Appli-N93AGTD2xoPE-5427597.us-east-2.elb.amazonaws.com/api
```

## AWS Cost Breakdown

### When Services Are Running (Full Operation)

| Resource | Cost per Hour | Cost per Month | Notes |
|----------|--------------|----------------|-------|
| ECS Fargate (2 tasks) | ~$0.03-0.05 | ~$22-36 | Backend + Frontend |
| Application Load Balancer | ~$0.0225 | ~$16 | Always runs when stack exists |
| RDS db.t3.micro | ~$0.017 | ~$12 | Database instance |
| CloudWatch Logs | ~$0.001 | ~$1 | Log storage and ingestion |
| ECR Storage | ~$0.10/month | ~$0.10 | Container images |
| **TOTAL** | **~$0.07-0.09/hr** | **~$50-65/month** | If running 24/7 |

### When Services Are Stopped (Infrastructure Only)

| Resource | Cost per Hour | Cost per Month | Notes |
|----------|--------------|----------------|-------|
| ECS Fargate | **$0** | **$0** | ✅ STOPPED |
| Application Load Balancer | ~$0.0225 | ~$16 | Still running |
| RDS db.t3.micro | ~$0.017 | ~$12 | Still running |
| CloudWatch Logs | ~$0.001 | ~$1 | Minimal storage |
| **TOTAL** | **~$0.04/hr** | **~$29/month** | 40% savings |

### Cost Savings Strategies

#### Strategy 1: Stop Services When Not Using (Recommended)
```bash
# Stop when you're done working
./stop-ecs-services.sh

# Start when you need it
./start-ecs-services.sh
```

**Savings:** ~$0.03-0.05/hour (~$22-36/month if you use it 8 hours/day)
**Keeps:** Infrastructure ready, fast restart

#### Strategy 2: Stop RDS When Not Using
```bash
# Stop RDS database (can't stop for more than 7 days)
aws rds stop-db-instance \
  --db-instance-identifier database-1 \
  --region us-east-2

# Start RDS when needed
aws rds start-db-instance \
  --db-instance-identifier database-1 \
  --region us-east-2
```

**Savings:** Additional ~$0.017/hour (~$12/month)
**Note:** RDS auto-starts after 7 days stopped

#### Strategy 3: Delete Entire Stack (Complete Shutdown)
```bash
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name car-listing-dev \
  --region us-east-2

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name car-listing-dev \
  --region us-east-2
```

**Savings:** ~$0.06/hour (~$45/month)
**Keeps:** ECR images, RDS database (separate)
**Time to Redeploy:** ~10 minutes with `./deploy-ecs-dev.sh`

#### Strategy 4: Complete Teardown (Zero Cost)
```bash
# Delete stack
aws cloudformation delete-stack --stack-name car-listing-dev --region us-east-2

# Delete RDS (WARNING: Deletes all data!)
aws rds delete-db-instance \
  --db-instance-identifier database-1 \
  --skip-final-snapshot \
  --region us-east-2

# Delete ECR images
aws ecr-public batch-delete-image \
  --repository-name carswebapppublic \
  --image-ids imageTag=backend-dev imageTag=frontend-dev \
  --region us-east-1
```

**Savings:** ~$0.07-0.09/hour (~$50-65/month)
**Cost:** $0/month
**Downside:** Must rebuild everything from scratch

## Daily Development Workflow

### Morning - Start Development
```bash
cd ~/Documents/SoftwareEngineering/car-listing-app

# Check if services are stopped
aws ecs describe-services \
  --cluster car-listing-car-listing-dev \
  --services car-listing-dev-backend \
  --region us-east-2 \
  --query 'services[0].desiredCount'

# Start if needed
./start-ecs-services.sh

# Wait 2-3 minutes for health checks
# Open app: http://car-li-Appli-N93AGTD2xoPE-5427597.us-east-2.elb.amazonaws.com
```

### Evening - Stop to Save Money
```bash
# Stop services
./stop-ecs-services.sh

# Optionally stop RDS too
aws rds stop-db-instance \
  --db-instance-identifier database-1 \
  --region us-east-2
```

**Daily Savings:** ~$0.40-0.80/day (~$12-24/month)

## Monitoring Costs

### Check Current Month Costs
```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-02-06 \
  --granularity DAILY \
  --metrics BlendedCost \
  --region us-east-1

# Get costs by service
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-02-06 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE \
  --region us-east-1
```

### Check Running Resources
```bash
# List running ECS tasks
aws ecs list-tasks \
  --cluster car-listing-car-listing-dev \
  --desired-status RUNNING \
  --region us-east-2

# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier database-1 \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region us-east-2 \
  --output text

# List CloudFormation stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --region us-east-2
```

### Set Up Billing Alerts
```bash
# Create SNS topic for alerts
aws sns create-topic \
  --name billing-alerts \
  --region us-east-1

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-1

# Create budget alert (via AWS Console or CLI)
# Set threshold: $10, $25, $50
```

## Troubleshooting

### Services Won't Stop
```bash
# Force update with desired count 0
aws ecs update-service \
  --cluster car-listing-car-listing-dev \
  --service car-listing-dev-backend \
  --desired-count 0 \
  --force-new-deployment \
  --region us-east-2
```

### Services Won't Start
```bash
# Check service events
aws ecs describe-services \
  --cluster car-listing-car-listing-dev \
  --services car-listing-dev-backend \
  --region us-east-2 \
  --query 'services[0].events[0:5]'

# Check task failures
aws ecs describe-tasks \
  --cluster car-listing-car-listing-dev \
  --tasks $(aws ecs list-tasks --cluster car-listing-car-listing-dev --region us-east-2 --query 'taskArns[0]' --output text) \
  --region us-east-2
```

### RDS Won't Stop
```bash
# RDS in a cluster can't be stopped individually
# Check if it's part of a cluster
aws rds describe-db-instances \
  --db-instance-identifier database-1 \
  --region us-east-2 \
  --query 'DBInstances[0].DBClusterIdentifier'

# If in cluster, stop the cluster instead
aws rds stop-db-cluster \
  --db-cluster-identifier your-cluster \
  --region us-east-2
```

## Cost Optimization Tips

### 1. Use Spot Instances (Future Improvement)
- Save up to 70% on compute costs
- Good for non-critical workloads
- Requires Fargate Spot capacity provider

### 2. Right-Size Your Resources
```yaml
# Current: 512 CPU, 1024 MB memory
# Test with smaller sizes:
Cpu: '256'
Memory: '512'
```

### 3. Use CloudWatch Logs Retention
```yaml
# Reduce log retention from 7 days to 1 day
RetentionInDays: 1
```

### 4. Delete Old ECR Images
```bash
# List old images
aws ecr-public describe-images \
  --repository-name carswebapppublic \
  --region us-east-1

# Delete specific tags
aws ecr-public batch-delete-image \
  --repository-name carswebapppublic \
  --image-ids imageTag=backend-dev-OLD_SHA \
  --region us-east-1
```

### 5. Use Local Development
```bash
# Develop locally with Docker Compose (FREE)
cd ~/Documents/SoftwareEngineering/car-listing-app
docker-compose up

# Only deploy to AWS when testing production environment
```

## Summary

**Best Practices:**
1. ✅ Run `./stop-ecs-services.sh` when not actively using
2. ✅ Use local Docker Compose for daily development
3. ✅ Only run ECS when testing cloud features
4. ✅ Set up billing alerts at $10 and $25 thresholds
5. ✅ Delete old ECR images monthly
6. ✅ Use minimal log retention (1-3 days)

**Expected Monthly Costs:**
- Development (8 hours/day): ~$20-30/month
- Always-on production: ~$50-65/month
- Infrastructure only: ~$29/month
- Zero usage: $0/month (delete everything)

**Time to Start/Stop:**
- Stop services: ~30 seconds
- Start services: ~2-3 minutes
- Delete/recreate stack: ~10-15 minutes
