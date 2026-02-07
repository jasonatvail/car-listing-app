#!/usr/bin/env bash
# ...existing code...
set -euo pipefail
STACK="${1:-car-listing-dev}"
REGION="${2:-us-east-2}"
MY_IP="${3:-172.99.221.5/32}"

echo "Checking stack: $STACK ($REGION)"
ALB_DNS=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" --output text 2>/dev/null || echo "")
if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
  echo "No ALBDNSName output found; searching load balancers..."
  ALB_JSON=$(aws elbv2 describe-load-balancers --region "$REGION" --query "LoadBalancers[?contains(LoadBalancerName,\`$STACK\`)]" --output json)
  ALB_DNS=$(echo "$ALB_JSON" | jq -r '.[0].DNSName // empty')
fi
if [ -z "$ALB_DNS" ]; then
  echo "ERROR: Could not find ALB for stack $STACK"
  exit 1
fi
echo "ALB DNS: $ALB_DNS"

LB_ARN=$(aws elbv2 describe-load-balancers --region "$REGION" --query "LoadBalancers[?DNSName=='$ALB_DNS'].LoadBalancerArn | [0]" --output text)
aws elbv2 describe-load-balancers --load-balancer-arns "$LB_ARN" --region "$REGION" --query "LoadBalancers[0].{Scheme:Scheme,DNSName:DNSName,State:State,Subnets:AvailabilityZones[].SubnetId,SecurityGroups:SecurityGroups}" --output json

echo; echo "Listeners:"
aws elbv2 describe-listeners --load-balancer-arn "$LB_ARN" --region "$REGION" --query "Listeners[*].{Protocol:Protocol,Port:Port,DefaultActions:DefaultActions}" --output json

echo; echo "Security groups (and inbound rules):"
for SG in $(aws elbv2 describe-load-balancers --load-balancer-arns "$LB_ARN" --region "$REGION" --query "LoadBalancers[0].SecurityGroups[]" --output text); do
  echo "SG: $SG"
  aws ec2 describe-security-groups --group-ids "$SG" --region "$REGION" --query 'SecurityGroups[0].IpPermissions' --output json
  echo
done

echo "Checking subnets' route tables for IGW:"
for SUB in $(aws elbv2 describe-load-balancers --load-balancer-arns "$LB_ARN" --region "$REGION" --query "LoadBalancers[0].AvailabilityZones[].SubnetId" --output text); do
  echo "Subnet: $SUB"
  aws ec2 describe-route-tables --filters Name=association.subnet-id,Values="$SUB" --region "$REGION" --query 'RouteTables[].Routes' --output json
done

echo; echo "Target groups & health:"
TGS=$(aws elbv2 describe-listeners --load-balancer-arn "$LB_ARN" --region "$REGION" --query "Listeners[].DefaultActions[].TargetGroupArn" --output text | sort -u)
for TG in $TGS; do
  echo "Target group: $TG"
  aws elbv2 describe-target-groups --target-group-arns "$TG" --region "$REGION" --query 'TargetGroups[0].{Port:Port,Protocol:Protocol,TargetType:TargetType}' --output json
  echo "Health:"
  aws elbv2 describe-target-health --target-group-arn "$TG" --region "$REGION" --output json
done

echo; echo "Check ECS service tasks & task health:"
aws ecs list-services --cluster "$STACK" --region "$REGION" --query 'serviceArns' --output text
aws ecs list-tasks --cluster "$STACK" --region "$REGION" --query 'taskArns' --output text
aws ecs describe-services --cluster "$STACK" --services "$STACK-frontend" "$STACK-backend" --region "$REGION" --output json

echo; echo "Quick reachability test from this machine (tcp connect):"
echo "Attempting TCP connect to $ALB_DNS:80 and :443 (may time out if blocked)"
nc -vz -w 5 "$ALB_DNS" 80 || true
nc -vz -w 5 "$ALB_DNS" 443 || true

echo; echo "Recommendation summary:"
echo "- ALB Scheme must be 'internet-facing' to be reachable from your browser"
echo "- ALB SG must allow inbound 80/443 (or allowed by CIDR $MY_IP / 0.0.0.0/0)"
echo "- Subnets used by ALB must have route to an Internet Gateway"
echo "- Target groups must have healthy targets (check tasks' logs if unhealthy)"