#!/bin/bash
# start-ecs-services.sh - Resume ECS services after stopping

set -e

REGION="us-east-2"
ENVIRONMENT="${1:-dev}"
DESIRED_COUNT="${2:-1}"

if [ "$ENVIRONMENT" = "all" ]; then
  ENVIRONMENTS=(dev staging prod)
else
  ENVIRONMENTS=($ENVIRONMENT)
fi

start_cluster() {
  local env_name="$1"
  local stack_name="car-listing-${env_name}"
  local cluster_name="car-listing-${stack_name}"

  echo "▶️  Starting ECS Services ($env_name)"
  echo "==============================="
  echo ""
  echo "Stack: $stack_name"
  echo "Region: $REGION"
  echo "Desired Count: $DESIRED_COUNT"
  echo ""

  if ! aws ecs describe-clusters --clusters "$cluster_name" --region "$REGION" --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q "$cluster_name"; then
      echo "❌ Cluster $cluster_name not found"
      echo ""
      return 1
  fi

  echo "✅ Found cluster: $cluster_name"
  echo ""

  echo "🔍 Finding services..."
  SERVICES=$(aws ecs list-services \
      --cluster "$cluster_name" \
      --region "$REGION" \
      --query 'serviceArns[*]' \
      --output text)

  if [ -z "$SERVICES" ]; then
      echo "❌ No services found in cluster"
      echo ""
      return 1
  fi

  echo "Found services:"
  for service in $SERVICES; do
      SERVICE_NAME=$(basename "$service")
      echo "  - $SERVICE_NAME"
  done
  echo ""

  for service in $SERVICES; do
      SERVICE_NAME=$(basename "$service")

      echo "▶️  Starting service: $SERVICE_NAME"

      CURRENT_COUNT=$(aws ecs describe-services \
          --cluster "$cluster_name" \
          --services "$SERVICE_NAME" \
          --region "$REGION" \
          --query 'services[0].desiredCount' \
          --output text)

      echo "   Current desired count: $CURRENT_COUNT"

      if [ "$CURRENT_COUNT" -gt 0 ]; then
          echo "   ✓ Already running with $CURRENT_COUNT tasks"
          continue
      fi

      SCALING_TARGETS=$(aws application-autoscaling describe-scalable-targets \
          --service-namespace ecs \
          --resource-ids "service/${cluster_name}/${SERVICE_NAME}" \
          --region "$REGION" \
          --query 'ScalableTargets[*].ResourceId' \
          --output text 2>/dev/null || echo "")

      if [ -n "$SCALING_TARGETS" ]; then
          echo "   📊 Re-enabling auto scaling..."
          aws application-autoscaling register-scalable-target \
              --service-namespace ecs \
              --resource-id "service/${cluster_name}/${SERVICE_NAME}" \
              --scalable-dimension ecs:service:DesiredCount \
              --min-capacity 1 \
              --max-capacity 10 \
              --region "$REGION" 2>/dev/null || true
          echo "   ✓ Auto scaling re-enabled (min: 1, max: 10)"
      fi

      aws ecs update-service \
          --cluster "$cluster_name" \
          --service "$SERVICE_NAME" \
          --desired-count "$DESIRED_COUNT" \
          --region "$REGION" \
          --query 'service.serviceName' \
          --output text > /dev/null

      echo "   ✅ Service started (desired count set to $DESIRED_COUNT)"
      echo ""
  done

  echo "⏳ Waiting for services to become healthy..."
  echo "   This may take 2-3 minutes..."
  echo ""

  aws ecs wait services-stable \
      --cluster "$cluster_name" \
      --services $(echo "$SERVICES" | xargs -n 1 basename) \
      --region "$REGION" 2>/dev/null || echo "⚠️  Timeout waiting for stability (services are starting but may need more time)"

  echo ""
  echo "✅ Services started for $env_name!"
  echo ""

  ALB_DNS=$(aws cloudformation describe-stacks \
      --stack-name "$stack_name" \
      --region "$REGION" \
      --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
      --output text 2>/dev/null || echo "")

  if [ -n "$ALB_DNS" ] && [ "$ALB_DNS" != "None" ]; then
      echo "🔗 Application URLs:"
      echo "   Frontend: http://$ALB_DNS"
      echo "   Backend:  http://$ALB_DNS/api"
      echo ""
  fi

  echo "📊 To check service status:"
  echo "   aws ecs describe-services --cluster $cluster_name --services $(echo "$SERVICES" | xargs -n 1 basename | head -1) --region $REGION"
  echo ""
  echo "📝 To check logs:"
  echo "   aws logs tail /ecs/$stack_name/backend --follow --region $REGION"
  echo ""
}

for env_name in "${ENVIRONMENTS[@]}"; do
  start_cluster "$env_name"
done

echo "🛑 To stop services again:"
echo "   ./deployment/stop-ecs-services.sh [dev|staging|prod|all]"
echo ""
