#!/bin/bash
# deploy-ecs-staging.sh - Deploy ECS infrastructure for staging environment with proper networking

set -e

STACK_NAME="car-listing-staging"
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

# ECR Image URIs (use staging tags for staging environment)
BACKEND_IMAGE="public.ecr.aws/c9g5y1u8/carswebapppublic:backend-staging"
FRONTEND_IMAGE="public.ecr.aws/c9g5y1u8/carswebapppublic:frontend-staging"

echo ""
echo "🚀 Deploying ECS Infrastructure for Staging Environment"
echo "======================================================="
echo ""
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo "VPC: $VPC_ID"
echo "RDS Security Group: $RDS_SG"
echo "Allowed Client IP: $ALLOWED_IP"
echo "Backend Image: $BACKEND_IMAGE"
echo "Frontend Image: $FRONTEND_IMAGE"
echo ""

# Prompt for database password only if no Secrets Manager ARN provided
DB_PASSWORD_SECRET_ARN="${DB_PASSWORD_SECRET_ARN:-}"
EXTRA_PARAMS=""
if [ -n "$DB_PASSWORD_SECRET_ARN" ]; then
    echo "🔐 Using DB password from Secrets Manager ARN (DB_PASSWORD_SECRET_ARN)"
    # CloudFormation still requires DBPasswordParameter; provide a placeholder when secret is used
    DB_PASSWORD="__unused__"
    EXTRA_PARAMS="DBPasswordSecretArn=$DB_PASSWORD_SECRET_ARN"
else
    echo "🔐 Enter RDS database password:"
    read -s DB_PASSWORD

    if [ -z "$DB_PASSWORD" ]; then
        echo ""
        echo "❌ Database password is required"
        exit 1
    fi
    echo ""
fi
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
        DesiredCount=1 \
        $EXTRA_PARAMS

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
echo "4. Push a staging tag to GitHub to trigger deployments"
echo ""
echo "🔐 Security Note:"
echo "   Only your IP ($CURRENT_IP) can access the ALB"
echo "   To allow another IP, update the CloudFormation parameter:"
echo "   aws cloudformation update-stack \\\n     --stack-name $STACK_NAME \\\n     --use-previous-template \\\n     --parameters ParameterKey=AllowedClientIP,ParameterValue=<NEW_IP>/32 \\\n     --capabilities CAPABILITY_IAM \\\n     --region $REGION"
echo ""
