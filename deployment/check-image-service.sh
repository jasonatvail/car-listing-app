CLUSTER=${1:-car-listing-dev}
REGION=${2:-us-east-2}

echo "Caller:"
aws sts get-caller-identity || true
echo

echo "Clusters in $REGION:"
aws ecs list-clusters --region "$REGION" --output text || true
echo

SERVICE_ARNS=$(aws ecs list-services --cluster "$CLUSTER" --region "$REGION" --query 'serviceArns[]' --output text || true)
if [ -z "$SERVICE_ARNS" ]; then
  echo "No services found in cluster '$CLUSTER' (region $REGION)."
  echo "Try: aws ecs list-services --region $REGION --cluster <cluster-name>"
  exit 1
fi

for svc in backend frontend; do
  NAME="dev-$svc"
  echo "=== $NAME ==="
  # try exact match, fallback to grep in ARNs
  SERVICE=$(echo "$SERVICE_ARNS" | tr ' ' '\n' | grep -i -m1 "/$NAME$" || true)
  if [ -z "$SERVICE" ]; then
    echo "Service '$NAME' not found. Available services:"
    echo "$SERVICE_ARNS" | tr ' ' '\n'
    echo
    continue
  fi

  TASKDEF=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION" --query 'services[0].taskDefinition' --output text)
  echo "TaskDef: $TASKDEF"
  echo "Image in taskdef:" $(aws ecs describe-task-definition --task-definition "$TASKDEF" --region "$REGION" --query "taskDefinition.containerDefinitions[0].image" --output text)

  TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --region "$REGION" --desired-status RUNNING --query 'taskArns[0]' --output text || true)
  if [ -n "$TASK_ARN" ]; then
    echo "Running task image:" $(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION" --query 'tasks[0].containers[0].image' --output text)
  else
    echo "No running task found for $NAME"
  fi
  echo
done