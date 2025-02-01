import { DynamoDBClient, ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";


const APIGW_ENDPOINT = process.env.APIGW_ENDPOINT;
const TABLE_NAME = process.env.TABLE_NAME;

const dynamoClient = new DynamoDBClient({});
const apigwClient = new ApiGatewayManagementApiClient({
    endpoint: APIGW_ENDPOINT
});

export async function handler(event) {
    console.log("BROADCAST EVENT:", JSON.stringify(event, null, 2));

    // Extracting the message from the EventBridge event
    const detail = event.detail || {};
    let message;

    // Handle cases where event.detail might be a string
    if (typeof detail === "string") {
        try {
            message = JSON.parse(detail);
        } catch (e) {
            message = detail;
        }
    } else {
        message = detail;
    }

    // Retrieve all active WebSocket connections
    let connectionData;
    try {
        connectionData = await dynamoClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    } catch (err) {
        console.error("Error scanning connections table:", err);
        return { statusCode: 500, body: "Error fetching connections." };
    }

    const dataToSend = JSON.stringify({
        timestamp: new Date().toISOString(),
        eventDetail: message
    });

    // Post the message to all active connections
    const postCalls = (connectionData.Items || []).map(async (item) => {
        const connectionId = item.connection_id.S;

        try {
            await apigwClient.send(
                new PostToConnectionCommand({
                    ConnectionId: connectionId,
                    Data: dataToSend,
                })
            );
        } catch (err) {
            // If the client is disconnected, remove it from the table
            if (err.$metadata.httpStatusCode === 410) {
                console.log(`Stale connection, removing ${connectionId}`);
                await dynamoClient.send(
                    new DeleteItemCommand({
                        TableName: TABLE_NAME,
                        Key: { connection_id: { S: connectionId } },
                    })
                );
            } else {
                console.error("Failed to post to connection:", connectionId, err);
            }
        }
    });

    await Promise.all(postCalls);

    return { statusCode: 200, body: "Broadcast completed." };
}
