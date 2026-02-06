#!/bin/bash
# stop-ecs-services.sh - Stop ECS services to avoid charges

set -e

REGION="us-east-2"
ENVIRONMENT="${1:-dev}"

if [ "$ENVIRONMENT" = "all" ]; then
  ENVIRONMENTS=(dev staging prod)
else
  ENVIRONMENTS=($ENVIRONMENT)
fi

stop_cluster() {
  local env_name="$1"
  local stack_name="car-listing-${env_name}"
  local cluster_name="car-listing-${stack_name}"

  echo "🛑 Stopping ECS Services to Avoid Charges ($env_name)"
  echo "=================================================="
  echo ""
  echo "Stack: $stack_name"
  echo "Region: $REGION"
  echo ""

  if ! aws ecs describe-clusters --clusters "$cluster_name" --region "$REGION" --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q "$cluster_name"; then
      echo "⚠️  Cluster $cluster_name not found. Nothing to stop."
      echo ""
      return 0
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
      echo "⚠️  No services found in cluster"
      echo ""
      return 0
  fi

  echo "Found services:"
  for service in $SERVICES; do
      SERVICE_NAME=$(basename "$service")
      echo "  - $SERVICE_NAME"
  done
  echo ""

  for service in $SERVICES; do
      SERVICE_NAME=$(basename "$service")

      echo "🛑 Stopping service: $SERVICE_NAME"

      CURRENT_COUNT=$(aws ecs describe-services \
          --cluster "$cluster_name" \
          --services "$SERVICE_NAME" \
          --region "$REGION" \
          --query 'services[0].desiredCount' \
          --output text)

      echo "   Current desired count: $CURRENT_COUNT"

      if [ "$CURRENT_COUNT" -eq 0 ]; then
          echo "   ✓ Already stopped"
          continue
      fi

      SCALING_TARGETS=$(aws application-autoscaling describe-scalable-targets \
          --service-namespace ecs \
          --resource-ids "service/${cluster_name}/${SERVICE_NAME}" \
          --region "$REGION" \
          --query 'ScalableTargets[*].ResourceId' \
          --output text 2>/dev/null || echo "")

      if [ -n "$SCALING_TARGETS" ]; then
          echo "   📊 Suspending auto scaling..."
          aws application-autoscaling register-scalable-target \
              --service-namespace ecs \
              --resource-id "service/${cluster_name}/${SERVICE_NAME}" \
              --scalable-dimension ecs:service:DesiredCount \
              --min-capacity 0 \
              --max-capacity 0 \
              --region "$REGION" 2>/dev/null || true
          echo "   ✓ Auto scaling suspended"
      fi

      aws ecs update-service \
          --cluster "$cluster_name" \
          --service "$SERVICE_NAME" \
          --desired-count 0 \
          --region "$REGION" \
          --query 'service.serviceName' \
          --output text > /dev/null

      echo "   ✅ Service stopped (desired count set to 0)"
      echo ""
  done

  echo "⏳ Waiting for tasks to stop..."
  sleep 5

  RUNNING_TASKS=$(aws ecs list-tasks \
      --cluster "$cluster_name" \
      --region "$REGION" \
      --desired-status RUNNING \
      --query 'taskArns[*]' \
      --output text | wc -w)

  echo "   Running tasks: $RUNNING_TASKS"

  if [ "$RUNNING_TASKS" -gt 0 ]; then
      echo "   Tasks are draining... this may take up to 2 minutes"
  fi

  echo ""
  echo "✅ All services stopped for $env_name!"
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
    echo "   ./deployment/start-ecs-services.sh [dev|staging|prod|all]"
  echo ""
    echo "💡 To completely shut down (delete stack):"
    echo "   aws cloudformation delete-stack --stack-name $stack_name --region $REGION"
  echo ""
}

for env_name in "${ENVIRONMENTS[@]}"; do
  stop_cluster "$env_name"
done
