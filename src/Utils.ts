import { either } from "fp-ts";
import { SafeParseReturnType } from "zod";

export const notNullish = <T>(value: T): value is NonNullable<T> =>
  value != null;

export const tap =
  <T>(fn: (value: T) => void) =>
  (value: T) => {
    fn(value);
    return value;
  };

export const eitherFromZodResult = <A, B>(result: SafeParseReturnType<A, B>) =>
  result.success ? either.right(result.data) : either.left(result.error);

