#!/bin/bash
# start-ecs-services.sh - Resume ECS services after stopping

set -e

STACK_NAME="car-listing-dev"
REGION="us-east-2"
CLUSTER_NAME="car-listing-${STACK_NAME}"
DESIRED_COUNT="${1:-1}"  # Default to 1, or use first argument

echo "▶️  Starting ECS Services"
echo "======================="
echo ""
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo "Desired Count: $DESIRED_COUNT"
echo ""

# Check if cluster exists
if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $REGION --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q "$CLUSTER_NAME"; then
    echo "❌ Cluster $CLUSTER_NAME not found"
    exit 1
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
    echo "❌ No services found in cluster"
    exit 1
fi

echo "Found services:"
for service in $SERVICES; do
    SERVICE_NAME=$(basename $service)
    echo "  - $SERVICE_NAME"
done
echo ""

# Start each service
for service in $SERVICES; do
    SERVICE_NAME=$(basename $service)
    
    echo "▶️  Starting service: $SERVICE_NAME"
    
    # Get current desired count
    CURRENT_COUNT=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $REGION \
        --query 'services[0].desiredCount' \
        --output text)
    
    echo "   Current desired count: $CURRENT_COUNT"
    
    if [ "$CURRENT_COUNT" -gt 0 ]; then
        echo "   ✓ Already running with $CURRENT_COUNT tasks"
        continue
    fi
    
    # Re-enable auto scaling if it was configured
    SCALING_TARGETS=$(aws application-autoscaling describe-scalable-targets \
        --service-namespace ecs \
        --resource-ids "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
        --region $REGION \
        --query 'ScalableTargets[*].ResourceId' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$SCALING_TARGETS" ]; then
        echo "   📊 Re-enabling auto scaling..."
        aws application-autoscaling register-scalable-target \
            --service-namespace ecs \
            --resource-id "service/${CLUSTER_NAME}/${SERVICE_NAME}" \
            --scalable-dimension ecs:service:DesiredCount \
            --min-capacity 1 \
            --max-capacity 10 \
            --region $REGION 2>/dev/null || true
        echo "   ✓ Auto scaling re-enabled (min: 1, max: 10)"
    fi
    
    # Set desired count to specified value
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --desired-count $DESIRED_COUNT \
        --region $REGION \
        --query 'service.serviceName' \
        --output text > /dev/null
    
    echo "   ✅ Service started (desired count set to $DESIRED_COUNT)"
    echo ""
done

echo "⏳ Waiting for services to become healthy..."
echo "   This may take 2-3 minutes..."
echo ""

# Wait for services to stabilize
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $(echo $SERVICES | xargs -n 1 basename) \
    --region $REGION 2>/dev/null || echo "⚠️  Timeout waiting for stability (services are starting but may need more time)"

echo ""
echo "✅ Services started!"
echo ""

# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$ALB_DNS" ] && [ "$ALB_DNS" != "None" ]; then
    echo "🔗 Application URLs:"
    echo "   Frontend: http://$ALB_DNS"
    echo "   Backend:  http://$ALB_DNS/api"
    echo ""
fi

echo "📊 To check service status:"
echo "   aws ecs describe-services --cluster $CLUSTER_NAME --services $(echo $SERVICES | xargs -n 1 basename | head -1) --region $REGION"
echo ""
echo "📝 To check logs:"
echo "   aws logs tail /ecs/$STACK_NAME/backend --follow --region $REGION"
echo ""
echo "🛑 To stop services again:"
echo "   ./stop-ecs-services.sh"
echo ""
