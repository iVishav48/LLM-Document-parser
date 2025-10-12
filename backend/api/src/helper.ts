import { v2 as cloudinary } from "cloudinary";
import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const AMQP_URL = process.env.RABBITMQ_URL || "amqp://localhost";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME!,
  api_key: process.env.API_KEY!,
  api_secret: process.env.API_SECRET!,
});

export async function connectRabbitMQ() {
  const connection = await amqp.connect(AMQP_URL);
  const channel = await connection.createChannel();
  return { connection, channel };
}

export default cloudinary;
