import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as eventbridge from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class LambdaMonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB
    const tableName = 'lambda-monitor-connections';
    const connectionsTable = new dynamodb.Table(this, 'LambdaMonitorConnectionsTable', {
      tableName: tableName,
      partitionKey: { name: 'connection_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Creator Helper
    const createLambda = (name: string, file: string, environment: { [key: string]: string } = {}) =>
      new lambda.Function(this, name, {
        functionName: `lambda-monitor-${name}`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, `../lambdas/${file}`)),
        timeout: cdk.Duration.minutes(2),
        environment: environment,
      });

    // WebSocket API + Route Lambdas
    const connectLambda = createLambda('connect', 'connect', {
      TABLE_NAME: tableName,
    });
    const disconnectLambda = createLambda('disconnect', 'disconnect', {
      TABLE_NAME: tableName,
    });

    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'LambdaMonitorWebSocketAPI', {
      apiName: 'lambda-monitor-websocket',
      connectRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectIntegration', connectLambda) },
      disconnectRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectIntegration', disconnectLambda) },
    });

    const webSocketStage = new apigatewayv2.WebSocketStage(this, 'LambdaMonitorWebSocketStage', {
      webSocketApi,
      stageName: 'production',
      autoDeploy: true,
    });

    // Construct the WebSocket URL dynamically as it needs to be HTTP (for broadcaster Lambda)
    const webSocketApiUrl = `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`;

    const broadcasterLambda = createLambda('broadcaster', 'broadcaster', {
      TABLE_NAME: tableName,
      APIGW_ENDPOINT: webSocketApiUrl,
    });

    // Grant Permissions to Lambdas Individually
    connectionsTable.grantReadWriteData(connectLambda);
    connectionsTable.grantReadWriteData(disconnectLambda);
    connectionsTable.grantReadWriteData(broadcasterLambda);

    // Construct the resource ARN for the ManageConnections permission
    // otherwise the Broadcaster fails
    const manageConnectionsArn = cdk.Fn.sub(
      'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${apiId}/production/POST/@connections/*',
      { apiId: webSocketApi.apiId }
    );

    const manageConnectionsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [manageConnectionsArn],
    });

    broadcasterLambda.addToRolePolicy(manageConnectionsPolicy);

    // EventBridge + Rule
    const EVENT_BUS_NAME = 'lambda-monitor-events';
    const EVENT_SOURCE = 'lambda-monitor-lambda';

    const eventBus = new eventbridge.EventBus(this, 'LambdaMonitorEventBus', {
      eventBusName: EVENT_BUS_NAME,
    });

    new eventbridge.Rule(this, 'LambdaMonitorEventRule', {
      eventBus: eventBus,
      eventPattern: {
        source: [EVENT_SOURCE],
        detailType: ['status-update'],
      },
      targets: [new targets.LambdaFunction(broadcasterLambda)],
    });

    // Worker Lambda (Event Producer)
    const workerLambda = createLambda('worker', 'worker', {
      EVENT_BUS_NAME: EVENT_BUS_NAME,
      EVENT_SOURCE: EVENT_SOURCE,
    });

    // Grant Permissions to Worker Lambda
    eventBus.grantPutEventsTo(workerLambda);

    // Create the S3 bucket for website hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      // Allow public access by disabling the block settings:
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
        ignorePublicAcls: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Output the website URL, WebSocket URL, and bucket for the post-deployment script.
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: websiteBucket.bucketWebsiteUrl,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: cdk.Fn.sub(
        'wss://${apiId}.execute-api.${AWS::Region}.amazonaws.com/${stage}/',
        { apiId: webSocketApi.apiId, stage: webSocketStage.stageName }
      ),
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
    });
  }
}
