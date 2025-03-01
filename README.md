# AWS Lambda Visualizer

A real-time, event-based learning project to visualize AWS Lambda invocations. The provided CDK code provisions Lambdas, a public API Gateway, DynamoDB, EventBridge, and an S3-hosted static website.

Learn more on this [Medium Blog Post](https://blog.det.life/real-time-lambda-monitoring-on-aws-9f518a023963).

<img src="assets/visualizer.gif" alt="Visualizer GIF" width="800" height="800">

## Architecture Diagram

![AWS Architecture Diagram](assets/diagram.png)  


## How to Run

1. **Deploy the Stack:** Ensure AWS CLI, Node.js, CDK, and jq are installed and configured, then run:
   
```bash
cdk deploy
```

2. **Update the Website:** After deployment, update the static website with the resolved WebSocket URL:

```bash
./update-website-post-deploy.sh
```

3. **Trigger Activity:** Simulate Lambda work by invoking the worker:

```bash
./trigger-worker-lambdas.sh
```

Open the website URL (from the deployment outputs) in your browser and connect to the WebSocket. You should see the invocations in real-time.

## Monitoring Your Own Lambda Functions

Before you go into it, be aware of the following:

- This is a learning project, and although I think it would be fine to deploy this into your own account, please be sure to analyze the CDK code yourself before you do.
- Sending events in your lambdas could increase the time it takes to run and also increase costs.
- The API Gateway URL is public, so anyone can connect to the WebSocket and see the invocation status. Some ideas to secure this are the following:
    - Add an Authentication lambda to the API Gateway, so that you can authenticate with a query string parameter.
    - Deploy the frontend with a backend. This way you can both protect the frontend access but also authenticate via the header, which is available as an API Gateway authentication method, but it's not supported by the browser's WebSocket API.

With all that said, adapting this to your own lambdas is pretty straightforward:

- Copy over the `monitoring.mjs` file into your lambda function.
- Similarly to how is done in the `index.mjs` for the **Worker** lambda, you can just wrap your handler with the `withMonitoring` higher-order function.
- Add the following environment variables to your lambda function:
    - `EVENT_BUS_NAME`: 'lambda-monitor-events'
    - `EVENT_SOURCE`: 'lambda-monitor-lambda'




