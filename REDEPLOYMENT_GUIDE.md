# ECS Redeployment - Cleaner Networking Approach

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
aws logs tail /ecs/car-listing-dev/backend --follow --region us-east-2
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
  --region us-east-2