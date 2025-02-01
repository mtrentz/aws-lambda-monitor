#!/bin/bash
# This script retrieves CloudFormation outputs from the deployed stack,
# substitutes the placeholder in website/index.html with the actual WebSocket URL,
# and uploads the updated file to the S3 website bucket.
#
# Requirements:
# - AWS CLI (configured with appropriate credentials)
# - jq

set -euo pipefail

# Modify this if your stack name is different
STACK_NAME="LambdaMonitorStack"

echo "Retrieving outputs from CloudFormation stack: ${STACK_NAME}..."
# Retrieve the outputs as JSON
OUTPUTS=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs" --output json)

# Extract necessary outputs using jq.
# Make sure your CDK stack outputs are named exactly as below.
WEBSITE_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebsiteURL") | .OutputValue')
WEBSOCKET_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebSocketUrl") | .OutputValue')
BUCKET_NAME=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebsiteBucketName") | .OutputValue')

echo "Website URL: ${WEBSITE_URL}"
echo "WebSocket URL: ${WEBSOCKET_URL}"
echo "Bucket Name: ${BUCKET_NAME}"

# Define the local path to your index.html file (adjust if your file tree is different)
LOCAL_INDEX="website/index.html"

if [ ! -f "${LOCAL_INDEX}" ]; then
  echo "Error: File '${LOCAL_INDEX}' does not exist."
  exit 1
fi

# Create a temporary file for the updated index.html in the same folder
TEMP_INDEX="website/index.temp.html"

echo "Replacing placeholder in ${LOCAL_INDEX} with actual WebSocket URL..."
# Replace the placeholder {{WEBSOCKET_URL}} with the real WebSocket URL.
# Adjust the delimiter in sed (here we use |) so that any slashes in the URL won’t conflict.
sed "s|{{WEBSOCKET_URL}}|${WEBSOCKET_URL}|g" "${LOCAL_INDEX}" > "${TEMP_INDEX}"

echo "Updated index file created at ${TEMP_INDEX}"

# Upload the updated index.html to the S3 bucket
echo "Uploading updated index.html to s3://${BUCKET_NAME}/index.html..."
aws s3 cp "${TEMP_INDEX}" "s3://${BUCKET_NAME}/index.html"

echo "Upload complete."

# Remove the temporary file
rm "${TEMP_INDEX}"

echo "Website index.html updated successfully."
