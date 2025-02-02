import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { randomUUID } from "crypto";

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;
const EVENT_SOURCE = process.env.EVENT_SOURCE;

const eventbridge = new EventBridgeClient({});

// Generate a unique identifier for this Lambda instance (one per cold start)
const LAMBDA_INSTANCE_ID = randomUUID();

/**
 * Sends a status event to EventBridge.
 * @param {string} status - e.g. "start", "finished"
 * @param {string} message - Descriptive message.
 * @param {object} context - Lambda context (to get the request ID, etc.).
 */
export async function sendEvent(status, message, context) {
    const eventDetail = {
        lambda_instance_id: LAMBDA_INSTANCE_ID, // Unique ID for this Lambda instance
        request_id: context.awsRequestId, // Request ID (unique per invocation)
        status,
        message,
        timestamp: Math.floor(Date.now() / 1000),
    };

    const command = new PutEventsCommand({
        Entries: [
            {
                Source: EVENT_SOURCE,
                DetailType: "status-update",
                Detail: JSON.stringify(eventDetail),
                EventBusName: EVENT_BUS_NAME,
            },
        ],
    });

    await eventbridge.send(command);
}

/**
 * Higher-order function that wraps a Lambda handler
 * to send start and finished events.
 * @param {Function} handler - Your actual Lambda handler.
 * @returns {Function} A wrapped handler that sends events before and after execution.
 */
export function withMonitoring(handler) {
    return async (event, context) => {
        // Send the start event
        await sendEvent("start", "Lambda handler started", context);
        try {
            // Run the actual Lambda handler
            const result = await handler(event, context);
            // Send the finished event
            await sendEvent("finished", "Lambda handler finished", context);
            return result;
        } catch (error) {
            throw error;
        }
    };
}
