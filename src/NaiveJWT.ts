/**
 * just a fill-in implementation until bun supports `jsonwebtoken`
 *
 * As the name implies, this should _NOT_ be used in production
 */

import * as Crypto from "node:crypto";
import * as Either from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

type Headers = Record<string, string>;

const toBase64 = (string: string) =>
  Buffer.from(string, "latin1").toString("base64");

const fromBase64 = (string: string) =>
  Buffer.from(string, "base64").toString("latin1");

const createSignature = (secret: string, payload: string) =>
  Crypto.createHash("sha256").update(secret).update(payload).digest("base64");

export const sign = (secret: string) => (payload: any, headers: Headers) => {
  const stringifiedHeaders = JSON.stringify(headers);
  const stringifiedPayload = JSON.stringify(payload);
  const signature = createSignature(
    secret,
    stringifiedHeaders + stringifiedPayload,
  );
  return `${toBase64(stringifiedHeaders)}.${toBase64(
    stringifiedPayload,
  )}.${signature}`;
};

export const verify =
  (secret: string) =>
  (
    encoded: string,
  ): Either.Either<string, { headers: Headers; payload: any }> => {
    const [stringifiedHeaders, stringifiedPayload, signature] =
      encoded.split(".");

    const tryDecode = (encoded: string) =>
      Either.tryCatch(
        () => fromBase64(encoded),
        () => "could not decode",
      );

    const tryParse = (stringified: string) =>
      Either.tryCatch(
        () => JSON.parse(stringified),
        () => `could not parse '${stringified}'`,
      );

    return pipe(
      Either.Do,
      Either.apS(
        "headers",
        pipe(
          stringifiedHeaders,
          Either.fromNullable("headers are null"),
          Either.chain(tryDecode),
        ),
      ),
      Either.apS(
        "payload",
        pipe(
          stringifiedPayload,
          Either.fromNullable("payload is null"),
          Either.chain(tryDecode),
        ),
      ),
      Either.chain(
        Either.fromPredicate(
          ({ headers, payload }) =>
            createSignature(secret, headers + payload) === signature,
          () => `signature does not match`,
        ),
      ),
      Either.chain(({ headers, payload }) =>
        pipe(
          Either.Do,
          Either.apS("headers", tryParse(headers)),
          Either.apS("payload", tryParse(payload)),
        ),
      ),
    );
  };
