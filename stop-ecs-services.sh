#!/bin/bash
# stop-ecs-services.sh - Stop ECS services to avoid charges

set -e

STACK_NAME="car-listing-dev"
REGION="us-east-2"
CLUSTER_NAME="car-listing-${STACK_NAME}"

echo "🛑 Stopping ECS Services to Avoid Charges"
echo "========================================"
echo ""
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo ""

# Check if cluster exists
if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $REGION --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q "$CLUSTER_NAME"; then
    echo "⚠️  Cluster $CLUSTER_NAME not found. Nothing to stop."
    exit 0
fi

echo "✅ Found cluster: $CLUSTER_NAME"
echo ""

# Get all services in the cluster
echo "🔍 Finding services..."
SERVICES=$(aws ecs list-services \
    --cluster $CLUSTER_NAME \
    --region $REGION \
    --query 'serviceArns[*]' \
    --output text)

if [ -z "$SERVICES" ]; then
    echo "⚠️  No services found in cluster"
    exit 0
fi

echo "Found services:"
for service in $SERVICES; do
    SERVICE_NAME=$(basename $service)
    echo "  - $SERVICE_NAME"
done
echo ""

# Stop each service
for service in $SERVICES; do
    SERVICE_NAME=$(basename $service)
    
    echo "🛑 Stopping service: $SERVICE_NAME"
    
    # Get current desired count
    CURRENT_COUNT=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $REGION \
        --query 'services[0].desiredCount' \
        --output text)
    
    echo "   Current desired count: $CURRENT_COUNT"
    
    if [ "$CURRENT_COUNT" -eq 0 ]; then
        echo "   ✓ Already stopped"
        continue
    fi
    
    # Disable auto scaling if configured
    SCALING_TARGETS=$(aws application-autoscaling describe-scalable-targets \
        --service-namespace ecs \
        --resource-ids "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
        --region $REGION \
        --query 'ScalableTargets[*].ResourceId' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$SCALING_TARGETS" ]; then
        echo "   📊 Suspending auto scaling..."
        aws application-autoscaling register-scalable-target \
            --service-namespace ecs \
            --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
            --scalable-dimension ecs:service:DesiredCount \
            --min-capacity 0 \
            --max-capacity 0 \
            --region $REGION 2>/dev/null || true
        echo "   ✓ Auto scaling suspended"
    fi
    
    # Set desired count to 0
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --desired-count 0 \
        --region $REGION \
        --query 'service.serviceName' \
        --output text > /dev/null
    
    echo "   ✅ Service stopped (desired count set to 0)"
    echo ""
done

# Wait for tasks to drain
echo "⏳ Waiting for tasks to stop..."
sleep 5

RUNNING_TASKS=$(aws ecs list-tasks \
    --cluster $CLUSTER_NAME \
    --region $REGION \
    --desired-status RUNNING \
    --query 'taskArns[*]' \
    --output text | wc -w)

echo "   Running tasks: $RUNNING_TASKS"

if [ "$RUNNING_TASKS" -gt 0 ]; then
    echo "   Tasks are draining... this may take up to 2 minutes"
fi

echo ""
echo "✅ All services stopped!"
echo ""
echo "💰 Cost Savings:"
echo "   - ECS tasks: $0/hour (was ~$0.03-0.05/hour)"
echo "   - You're still charged for:"
echo "     • RDS database (if running)"
echo "     • Application Load Balancer (~$0.0225/hour)"
echo "     • CloudWatch Logs (minimal)"
echo "     • ECR storage (minimal)"
echo ""
echo "📝 To resume services, run:"
echo "   ./start-ecs-services.sh"
echo ""
echo "💡 To completely shut down (delete stack):"
echo "   aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
echo ""
