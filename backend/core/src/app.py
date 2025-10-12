import pika
from config import RABBITMQ_URL
from langchain_openai import OpenAIEmbeddings
from langchain_core.vectorstores import InMemoryVectorStore
from lib.process_job import process_job

connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
channel = connection.channel()
channel.queue_declare(queue="parse-files", durable=True)

print("[*] Connected to RabbitMQ ")

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vector_store = InMemoryVectorStore(embeddings)


def callback(ch, method, properties, body):
    try:
        res = process_job(body, vector_store)
        ch.basic_ack(delivery_tag=method.delivery_tag)
        ch.basic_publish(
            exchange="",
            routing_key=properties.reply_to,
            body=str(res).encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=2, 
            ),
        )
    except Exception as e:
        print(f"[*] Error processing: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


channel.basic_qos(prefetch_count=1)
channel.basic_consume(queue="parse-files", on_message_callback=callback)

try:
    channel.start_consuming()
    print("[*] Consumer stopped. Closing connection.")
except KeyboardInterrupt:
    print("[*] Interrupted by user, closing connection...")
    channel.stop_consuming()
    connection.close()