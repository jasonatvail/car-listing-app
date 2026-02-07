#!/usr/bin/env bash
# Get the ALB/frontend URL for a stack (default: car-listing-dev, us-east-2)
set -euo pipefail

STACK_NAME="${1:-car-listing-dev}"
REGION="${2:-us-east-2}"
OPEN="${OPEN:-false}"

# Try CloudFormation Output first
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" --output text 2>/dev/null || echo "")

# Fallback: find load balancer by stack name
if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
  LB_ARN=$(aws elbv2 describe-load-balancers --region "$REGION" \
    --query "LoadBalancers[?contains(LoadBalancerName, \`$STACK_NAME\`)].LoadBalancerArn | [0]" --output text 2>/dev/null || echo "")
  if [ -n "$LB_ARN" ] && [ "$LB_ARN" != "None" ]; then
    ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$LB_ARN" --region "$REGION" --query "LoadBalancers[0].DNSName" --output text)
  fi
fi

if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
  echo "ERROR: Unable to determine ALB DNS for stack '$STACK_NAME' in region '$REGION'"
  exit 1
fi

# Get listeners to determine protocol(s)
LB_ARN=$(aws elbv2 describe-load-balancers --region "$REGION" --query "LoadBalancers[?DNSName=='$ALB_DNS'].LoadBalancerArn | [0]" --output text)
LISTENERS_JSON=$(aws elbv2 describe-listeners --load-balancer-arn "$LB_ARN" --region "$REGION" --query "Listeners[*].{Protocol:Protocol,Port:Port}" --output json || echo "[]")

echo "ALB DNS: $ALB_DNS"
echo "Listeners: $LISTENERS_JSON"

if echo "$LISTENERS_JSON" | grep -q '"Protocol": "HTTPS"'; then
  echo "Frontend URL (https): https://$ALB_DNS"
fi
if echo "$LISTENERS_JSON" | grep -q '"Protocol": "HTTP"'; then
  echo "Frontend URL (http): http://$ALB_DNS"
fi
# If none detected, at least show http
if ! echo "$LISTENERS_JSON" | grep -q '"Protocol": "HTTP"' && ! echo "$LISTENERS_JSON" | grep -q '"Protocol": "HTTPS"'; then
  echo "Frontend (try): http://$ALB_DNS"
fi

if [ "$OPEN" = "true" ]; then
  if echo "$LISTENERS_JSON" | grep -q '"Protocol": "HTTPS"'; then
    open "https://$ALB_DNS"
  else
    open "http://$ALB_DNS"
  fi
fi