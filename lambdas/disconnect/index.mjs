import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({});
const TABLE_NAME = "lambda-monitor-connections";

export async function handler(event) {
    console.log("Disconnected:", event.requestContext.connectionId);

    try {
        await db.send(new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: { connection_id: { S: event.requestContext.connectionId } }
        }));

        return { statusCode: 200, body: "Disconnected" };
    } catch (err) {
        console.error("Error:", err);
        return { statusCode: 500, body: "Disconnection failed" };
    }
}
