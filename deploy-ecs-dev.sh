#!/bin/bash
# deploy-ecs-dev.sh - Deploy ECS infrastructure for dev environment with proper networking

set -e

STACK_NAME="car-listing-dev"
REGION="us-east-2"
TEMPLATE_FILE="template.yaml"

# VPC and Subnet Configuration
VPC_ID="vpc-064dfae6a5cbd9cfb"
PUBLIC_SUBNETS="subnet-0f3f6cc263463b170,subnet-046f23f7fc0a72d7e,subnet-0ae70a60ce686327b"
TASK_SUBNETS="subnet-0f3f6cc263463b170,subnet-046f23f7fc0a72d7e,subnet-0ae70a60ce686327b"

# Database Configuration
DB_HOST="database-1.cvcw48iocwex.us-east-2.rds.amazonaws.com"
DB_NAME="database-1"
DB_USER="postgres"

# Get current public IP
echo "🌐 Detecting your public IP address..."
CURRENT_IP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')
ALLOWED_IP="${CURRENT_IP}/32"

echo "✅ Your public IP: $CURRENT_IP"
echo "🔒 Will restrict ALB access to: $ALLOWED_IP"
echo ""

# Get RDS Security Group ID
echo "🔍 Finding RDS security group..."
RDS_SG=$(aws rds describe-db-instances \
  --db-instance-identifier database-1 \
  --region $REGION \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

if [ -z "$RDS_SG" ] || [ "$RDS_SG" == "None" ]; then
  echo "❌ Could not find RDS security group"
  exit 1
fi

echo "✅ Found RDS security group: $RDS_SG"

# ECR Image URIs (use -dev tags for dev environment)
BACKEND_IMAGE="public.ecr.aws/c9g5y1u8/carswebapppublic:backend-dev"
FRONTEND_IMAGE="public.ecr.aws/c9g5y1u8/carswebapppublic:frontend-dev"

echo ""
echo "🚀 Deploying ECS Infrastructure for Dev Environment"
echo "=================================================="
echo ""
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo "VPC: $VPC_ID"
echo "RDS Security Group: $RDS_SG"
echo "Allowed Client IP: $ALLOWED_IP"
echo "Backend Image: $BACKEND_IMAGE"
echo "Frontend Image: $FRONTEND_IMAGE"
echo ""

# Prompt for database password (don't show it)
echo "🔐 Enter RDS database password:"
read -s DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
    echo ""
    echo "❌ Database password is required"
    exit 1
fi

echo ""
echo "📦 Validating CloudFormation template..."
aws cloudformation validate-template \
    --template-body file://$TEMPLATE_FILE \
    --region $REGION > /dev/null

echo "✅ Template is valid"
echo ""

echo "🚀 Deploying CloudFormation stack..."
echo "This will take 5-10 minutes..."
echo ""

aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        DBHostParameter=$DB_HOST \
        DBNameParameter=$DB_NAME \
        DBUserParameter=$DB_USER \
        DBPasswordParameter=$DB_PASSWORD \
        DBSecurityGroupId=$RDS_SG \
        BackendImageUri=$BACKEND_IMAGE \
        FrontendImageUri=$FRONTEND_IMAGE \
        VpcId=$VPC_ID \
        PublicSubnets=$PUBLIC_SUBNETS \
        TaskSubnets=$TASK_SUBNETS \
        AllowedClientIP=$ALLOWED_IP \
        DesiredCount=1

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the outputs
echo "📊 Stack Outputs:"
echo "================"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo "🔗 Application URLs:"
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

if [ -n "$ALB_DNS" ] && [ "$ALB_DNS" != "None" ]; then
    echo "Frontend: http://$ALB_DNS"
    echo "Backend:  http://$ALB_DNS/api"
    echo ""
    echo "⏳ Note: Services may take 2-3 minutes to become healthy"
    echo "💻 Your IP ($CURRENT_IP) has been whitelisted in the security group"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Wait for ECS tasks to start (check AWS ECS console)"
echo "2. Check logs if tasks are unhealthy:"
echo "   aws logs tail /ecs/$STACK_NAME/backend --follow --region $REGION"
echo "3. Once healthy, visit the application URL above"
echo "4. Push code to GitHub main branch to trigger auto-deployments"
echo ""
echo "🔐 Security Note:"
echo "   Only your IP ($CURRENT_IP) can access the ALB"
echo "   To allow another IP, update the CloudFormation parameter:"
echo "   aws cloudformation update-stack \\"
echo "     --stack-name $STACK_NAME \\"
echo "     --use-previous-template \\"
echo "     --parameters ParameterKey=AllowedClientIP,ParameterValue=<NEW_IP>/32 \\"
echo "     --capabilities CAPABILITY_IAM \\"
echo "     --region $REGION"
echo ""

