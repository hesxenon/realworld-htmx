/**
 * set up common logic
 */

import { A } from "andale";
import * as JWT from "./NaiveJWT";
import { apply, flow, pipe } from "fp-ts/lib/function";
import { Db, getUserById } from "./Db";
import { either, option, taskEither } from "fp-ts";
import { Shell } from "./Components";
import { z } from "zod";

const createBaseContext = (db: Db) =>
  pipe(
    A.HTTP.context(),
    A.HTTP.Context.withCookies(),
    A.HTTP.Context.withCaching({
      defaultHeaders: {
        Vary: "hx-request",
      },
    }),
    A.Context.add({
      withDb: apply(db),
    }),
  );

type BaseContext = A.Middleware.Output<ReturnType<typeof createBaseContext>>;

const secret = "oh so secret secret";
export const verify = JWT.verify(secret);
export const sign = JWT.sign(secret);

export const tryGetUser = <Current extends BaseContext>() =>
  A.Context.extend(({ withDb, cookies }: Current) => {
    return pipe(
      pipe(option.fromNullable(cookies["jwt"]), option.map(decodeURIComponent)),
      either.fromOption(() => undefined),
      either.flatMap(verify),
      either.flatMap(({ payload }) =>
        either.tryCatch(
          () => z.object({ id: z.string() }).parse(payload),
          () => undefined,
        ),
      ),
      either.map(({ id }) => withDb(getUserById({ id }))),
      either.getOrElseW(() => undefined),
      (maybeUser) => ({
        user: maybeUser,
      }),
    );
  });

export const createRootContext = () =>
  flow(
    createBaseContext,
    tryGetUser(),
    A.Context.extend(({ request, user }) => {
      const url = new URL(request.url);
      const isHxRequest = request.headers.get("HX-Request") != null;
      const currentUrl = request.headers.get("HX-Current-URL") ?? request.url;
      return {
        url,
        isHxRequest,
        currentUrl,
        Shell: ({ children }: JSX.Element) =>
          isHxRequest ? (
            <>{children}</>
          ) : (
            <Shell currentUrl={currentUrl} user={user}>
              {children}
            </Shell>
          ),
      };
    }),
  );

export const createSecuredContext = ({
  redirectToLogin = true,
}: {
  redirectToLogin?: boolean;
} = {}) =>
  flow(
    createRootContext(),
    A.Middleware.mapTaskEither((context) => {
      if (context.user == null) {
        return taskEither.left(
          redirectToLogin
            ? new Response(undefined, {
                status: context.isHxRequest ? 200 : 302,
                headers: {
                  "hx-redirect": "/login",
                  location: "/login",
                },
              })
            : new Response("unauthorized", {
                status: 401,
                headers: {
                  "WWW-Authenticate": "Bearer",
                },
              }),
        );
      }
      return taskEither.right({
        ...context,
        user: context.user,
      });
    }),
  );
