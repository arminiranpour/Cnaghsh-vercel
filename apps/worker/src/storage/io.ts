import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

import * as S3 from "@aws-sdk/client-s3";

import { s3 } from "./client";

const DeleteObjectCommandCtor = (
  S3 as unknown as {
    DeleteObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  }
).DeleteObjectCommand;

type UploadOptions = {
  bucket: string;
  key: string;
  contentType: string;
  cacheControl?: string;
};

const toReadable = (body: unknown) => {
  if (!body) {
    throw new Error("S3 object body is empty");
  }
  if (body instanceof Readable) {
    return body;
  }
  if (typeof (body as { getReader?: () => unknown }).getReader === "function") {
    const reader = (body as WebReadableStream<Uint8Array>).getReader();
    const iterator = {
      async *[Symbol.asyncIterator]() {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            reader.releaseLock();
            return;
          }
          yield value;
        }
      },
    };
    return Readable.from(iterator as AsyncIterable<Uint8Array>);
  }
  if (body instanceof Uint8Array || Array.isArray(body)) {
    return Readable.from(body as Iterable<unknown>);
  }
  if (typeof body === "string") {
    return Readable.from([body]);
  }
  if (typeof (body as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function") {
    return Readable.from(body as AsyncIterable<unknown>);
  }
  throw new Error("Unsupported S3 object body type");
};

const downloadToFile = async (bucket: string, key: string, localPath: string) => {
  const response = (await s3.send(
    new S3.GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )) as { Body?: unknown };
  const stream = toReadable(response.Body);
  const writer = createWriteStream(localPath);
  await pipeline(stream, writer);
};

const uploadFile = async ({ bucket, key, contentType, cacheControl }: UploadOptions, localPath: string) => {
  const body = createReadStream(localPath);
  await s3.send(
    new S3.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
};

const uploadBuffer = async ({ bucket, key, contentType, cacheControl }: UploadOptions, buffer: Buffer) => {
  await s3.send(
    new S3.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
};

const deleteObject = async (bucket: string, key: string) => {
  await s3.send(
    new DeleteObjectCommandCtor({
      Bucket: bucket,
      Key: key,
    }) as never,
  );
};

export { deleteObject, downloadToFile, uploadBuffer, uploadFile };
