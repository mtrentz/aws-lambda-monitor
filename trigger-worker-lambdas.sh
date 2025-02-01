#!/bin/bash

CONCURRENT_CALLS=30
LAMBDA_FUNCTION="lambda-monitor-worker"
PAYLOAD='{}'

for i in $(seq 1 $CONCURRENT_CALLS); do
  aws lambda invoke --function-name "$LAMBDA_FUNCTION" --payload "$PAYLOAD" --invocation-type Event /dev/null &
done

echo "All Lambda invocations triggered asynchronously!"
