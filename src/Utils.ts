import { either } from "fp-ts";
import { SafeParseReturnType, ZodError, ZodFormattedError } from "zod";

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

export const formatZodError = (error: ZodError) =>
  Object.values(error.format())
    .map((x: string[] | undefined | ZodFormattedError<any>) =>
      x == null ? [] : Array.isArray(x) ? x : x._errors,
    )
    .flat();
