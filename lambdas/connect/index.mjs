import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

export async function handler(event) {
    console.log("Connected:", event.requestContext.connectionId);

    try {
        await db.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: { connection_id: { S: event.requestContext.connectionId } }
        }));

        return { statusCode: 200, body: "Connected" };
    } catch (err) {
        console.error("Error:", err);
        return { statusCode: 500, body: "Connection failed" };
    }
}
