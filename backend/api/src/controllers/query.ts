import { type Request, type Response } from "express";
import cloudinary from "../helper";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import type { UploadApiResponse } from "cloudinary";
import { connectRabbitMQ } from "../helper";
import { QuerySchema } from "../schema/querySchema";

export async function query(req: Request, res: Response) {
  if (!req.file?.path) {
    return res.status(400).json({ success: false, message: "file not exist" });
  }

  const validation = QuerySchema.safeParse(req.body);

  if (!validation.success) {
    return res
      .status(400)
      .json({ success: false, message: validation.error });
  }

  const { query: validatedQuery } = validation.data;

  const filePath = req.file.path;

  try {
    const result: UploadApiResponse = await cloudinary.uploader.upload(
      filePath,
      { resource_type: "auto", folder: "claims", type: "upload" },
    );

    const jobId = uuidv4();
    const payload = {
      jobId,
      files: [
        {
          url: result.secure_url,
          public_id: result.public_id,
          bytes: result.bytes,
          format: result.format,
        },
      ],
      query: validatedQuery,
    };

    const { connection, channel } = await connectRabbitMQ();
    const queue = "parse-files";
    const replyQueue = `results-${jobId}`;

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: "application/json",
      messageId: jobId,
      type: "parse-files",
      replyTo: replyQueue,
    });

    await channel.assertQueue(replyQueue, { exclusive: true });
    const resultMessage = await new Promise<string>((resolve, reject) => {
      channel.consume(
        replyQueue,
        (msg) => {
          if (msg) {
            const content = msg.content.toString();
            resolve(content);
          } else {
            reject(new Error("No message received from results queue"));
          }
        },
        { noAck: true },
      );
    });

    await channel.close();
    await connection.close();

    return res.status(200).json({
      success: true,
      message: "success",
      jobId,
      result: resultMessage,
    });
  } catch (err: any) {
    console.error("query() failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed",
      error: err?.message ?? "unknown_error",
    });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch { }
  }
}
