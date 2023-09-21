import { describe, expect, it } from "bun:test";
import * as JWT from "./NaiveJWT";
import { pipe } from "fp-ts/lib/function";
import * as Either from "fp-ts/Either";

const secret = "foo";
const sign = JWT.sign(secret);
const verify = JWT.verify(secret);

describe("sign", () => {
  it("should return a string", () => {
    expect(typeof sign("bar", {}) === "string").toBe(true);
  });

  it("should have three parts denoted by a .", () => {
    const parts = sign("bar", {}).split(".");
    expect(parts.length === 3).toBe(true);
  });
});

it("should be possible to retrieve the payload", () => {
  const payload = { email: "foo@bar.com" };
  const jwt = sign(payload, {});
  const decoded = pipe(
    verify(jwt),
    Either.getOrElseW((error) => {
      throw error;
    }),
  );
  expect(decoded.payload).toEqual(payload);
});
