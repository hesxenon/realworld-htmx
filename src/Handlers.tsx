/**
 * the "business logic" if you will. Here we pull data from the database,
 * set preconditions on incoming requests and choose _what_ to render
 */

import { flow, pipe } from "fp-ts/lib/function";
import {
  createRootContext,
  createSecuredContext,
  sign,
  tryGetUser,
} from "./Middlewares";
import { A } from "andale";
import { toHtml } from "htmx-tsx";
import { z } from "zod";
import * as Db from "./Db";
import { array, either } from "fp-ts";
import {
  ArticleDetail,
  Editor,
  Home,
  Login,
  Profile,
  Register,
  Settings,
} from "./Pages";
import { Feed } from "./Components";
import { eitherFromZodResult, formatZodError, tap } from "./Utils";
import { Url, url } from "./Routes";

//#region UTILS

const {
  Validate: { query, body },
  Context: { withCookies, withCaching },
  context,
  handle,
} = A.HTTP;

const jsx = (jsx: JSX.Element) =>
  new Response(toHtml(jsx), {
    headers: {
      "Content-Type": "text/html",
    },
  });

const text = (text: string | number) => new Response(text.toString());

const json = (text: string) =>
  new Response(text, {
    headers: {
      "Content-Type": "application/json",
    },
  });

const empty = () => new Response(undefined, { status: 204 });

const notFound = ({ children = "not found" }: JSX.Element = {}) =>
  new Response(toHtml(<div>{children}</div>), {
    status: 404,
    headers: {
      "Content-Type": "text/html",
    },
  });

const redirect = (
  location: Url,
  {
    hx = true,
    status = hx ? 200 : 302,
  }: { hx?: boolean; status?: number } = {},
) =>
  new Response(undefined, {
    status,
    headers: hx
      ? {
          "hx-redirect": url(location),
        }
      : {
          Location: url(location),
        },
  });

const pagination = z.object({
  page: z.coerce.number().optional().default(0),
  size: z.coerce.number().optional().default(20),
});

//#endregion

export const getPublicAsset = pipe(
  context(),
  withCaching(),
  handle(({ request, cache }) => {
    const url = new URL(request.url);
    const file = Bun.file(url.pathname.slice(1));
    return cache.etag(
      new Response(file),
      file.lastModified.toString().slice(-5),
    );
  }),
);

export const getArticle = flow(
  createRootContext(),
  query(z.object({ id: z.string() })),
  handle(({ query, withDb, user, Shell, cache }) => {
    const article = withDb(Db.getArticle(query));
    if (article == null) {
      return notFound();
    }
    const cached = cache.etag(
      jsx(
        <Shell>
          <ArticleDetail article={article} currentUser={user} />
        </Shell>,
      ),
      (article.updatedAt ?? article.createdAt).slice(-5),
    );

    cached.headers.set("Vary", "Hx-Request");

    return cached;
  }),
);

export const deleteArticle = flow(
  createSecuredContext(),
  query(z.object({ id: z.string() })),
  handle(({ query, withDb, user }): Response => {
    const article = withDb(Db.getArticle(query));
    if (article == null || user.id !== article.authorId) {
      return notFound();
    }
    withDb(Db.deleteArticle(query));
    return redirect(["GET /"]);
  }),
);

export const getProfile = flow(
  createRootContext(),
  query(z.object({ id: z.string() })),
  handle(({ withDb, query, Shell, user }) => {
    const profile = withDb(Db.getProfile(query));
    if (profile == null) {
      return notFound();
    }
    return jsx(
      <Shell>
        <Profile profile={profile} currentUser={user} />
      </Shell>,
    );
  }),
);

export const getGlobalFeed = flow(
  createRootContext(),
  tryGetUser(),
  query(pagination.extend({ tag: z.string().optional() })),
  handle(({ query, withDb, cache }) => {
    const articles = withDb(Db.getArticlePreviews(query));
    const latestArticle = articles.at(0);

    const res = jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /feed/global",
          { ...query, page: index },
        ]}
      />,
    );

    return latestArticle == null
      ? res
      : cache.etag(
          res,
          (latestArticle.updatedAt ?? latestArticle.createdAt).slice(-5),
        );
  }),
);

export const getPersonalFeed = flow(
  createSecuredContext(),
  query(pagination),
  handle(({ query, withDb, user, cache }) => {
    const articles = withDb(Db.getArticlePreviews({ ...query, forUser: user }));
    const latestArticle = articles.at(0);

    const res = jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /feed/personal",
          { ...query, page: index },
        ]}
      />,
    );

    return latestArticle == null
      ? res
      : cache.etag(
          res,
          (latestArticle.updatedAt ?? latestArticle.createdAt).slice(-5),
        );
  }),
);

export const getHome = flow(
  createRootContext(),
  tryGetUser(),
  handle(({ withDb, Shell, user, cache }) => {
    const popularTags = withDb(Db.getTags());

    const tagsHash = Buffer.from(
      popularTags.map(({ name }) => name).join(","),
    ).toString("base64");

    const res = cache.etag(
      jsx(
        <Shell>
          <Home user={user} popularTags={popularTags} />
        </Shell>,
      ),
      tagsHash,
    );

    res.headers.append("Vary", "Cookie");

    return res;
  }),
);

export const favoriteArticle = flow(
  createSecuredContext(),
  tryGetUser(),
  query(z.object({ id: z.string() })),
  handle(({ withDb, user, query }) => {
    const nextUsers = withDb(
      Db.favoriteArticle({
        userId: user.id,
        articleId: query.id,
      }),
    );
    return text(nextUsers.length);
  }),
);

export const followProfile = flow(
  createSecuredContext(),
  query(z.object({ id: z.string() })),
  handle(({ withDb, user, query }) => {
    const { newFollowerAmount, userFollowsUser } = withDb(
      Db.followUser({
        userId: user.id,
        followsId: query.id,
      }),
    );
    return text(newFollowerAmount);
  }),
);

export const getLogin = flow(
  createRootContext(),
  handle(({ Shell }) => {
    return jsx(
      <Shell>
        <Login />
      </Shell>,
    );
  }),
);

export const login = flow(
  createRootContext(),
  body(z.object({ username: z.string(), password: z.string() })),
  withCookies(),
  handle(({ withDb, body, setCookie }): Response => {
    const user = withDb(Db.getUserByCredentials(body));
    if (user == null) {
      return new Response(
        toHtml(
          <ul class="error-messages">
            <li>invalid username/password</li>
          </ul>,
        ),
        {
          status: 400,
        },
      );
    }
    const jwt = sign({ id: user.id }, {});

    return pipe(redirect(["GET /"]), setCookie("jwt", jwt, { httpOnly: true }));
  }),
);

export const logout = pipe(
  context(),
  withCookies(),
  handle(({ setCookie }): Response => {
    return pipe(
      redirect(["GET /"]),
      setCookie("jwt", "", {
        httpOnly: true,
        maxAge: 0,
      }),
    );
  }),
);

export const getRegister = flow(
  createRootContext(),
  handle(({ Shell }) => {
    return jsx(
      <Shell>
        <Register />
      </Shell>,
    );
  }),
);

export const register = flow(
  createRootContext(),
  body(
    z.object({
      username: z.string(),
      password: z.string(),
      email: z.string(),
    }),
  ),
  handle(({ withDb, body, bodySchema }): Response => {
    return pipe(
      bodySchema
        .extend({
          email: z.string().email(),
        })
        .safeParse(body),
      eitherFromZodResult,
      either.mapLeft(formatZodError),
      either.flatMap(flow(Db.addUser, withDb, either.mapLeft(array.of))),
      either.match(
        (errors) => jsx(<Register values={body} errors={errors} />),
        () => redirect(["GET /login"]),
      ),
    );
  }),
);

export const getSettings = flow(
  createSecuredContext(),
  handle(({ user, Shell }) => {
    return jsx(
      <Shell>
        <Settings values={user} />
      </Shell>,
    );
  }),
);

export const updateSettings = flow(
  createSecuredContext(),
  query(z.object({ id: z.string() })),
  body(
    z.object({
      username: z.string(),
      password: z.string(),
      email: z.string(),
      bio: z.string(),
      avatar: z.string(),
    }),
  ),
  handle(({ withDb, body, bodySchema, user }) => {
    return pipe(
      bodySchema
        .extend({
          username: z.string().min(1, "username is required"),
          password: z.string().min(1, "password is required"),
          email: z.string().email(),
          avatar: z.string().url(),
        })
        .safeParse(body),
      eitherFromZodResult,
      either.mapLeft(formatZodError),
      either.match(
        (errors) =>
          jsx(<Settings values={{ id: user.id, ...body }} errors={errors} />),
        (parsed) => {
          const updated = { id: user.id, ...parsed };
          withDb(Db.updateUser(updated));
          return jsx(<Settings values={updated} />);
        },
      ),
    );
  }),
);

export const getOwnArticles = flow(
  createRootContext(),
  query(pagination.extend({ id: z.string() })),
  handle(({ query, withDb, cache }) => {
    const articles = withDb(
      Db.getArticlePreviews({
        ...query,
        fromAuthor: query,
      }),
    );
    const latestArticle = articles.at(0);

    const res = jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /profile/articles/own",
          { ...query, page: index },
        ]}
      />,
    );

    return latestArticle == null
      ? res
      : cache.etag(
          res,
          (latestArticle.updatedAt ?? latestArticle.createdAt).slice(-5),
        );
  }),
);

export const getFavoritedArticles = flow(
  createRootContext(),
  query(pagination.extend({ id: z.string() })),
  handle(({ query, withDb, cache }) => {
    const articles = withDb(
      Db.getArticlePreviews({ ...query, favoritedBy: query }),
    );

    const latestArticle = articles.at(0);

    const res = jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /profile/articles/favorited",
          { ...query, page: index },
        ]}
      />,
    );

    return latestArticle == null
      ? res
      : cache.etag(
          res,
          (latestArticle.updatedAt ?? latestArticle.createdAt).slice(-5),
        );
  }),
);

export const getEditor = flow(
  createSecuredContext(),
  query(z.object({ id: z.string().optional() })),
  handle(({ query, withDb, user, Shell }) => {
    const article =
      query.id == null ? undefined : withDb(Db.getArticle({ id: query.id }));
    if (article != null && article?.authorId !== user.id) {
      return notFound();
    }
    return jsx(
      <Shell>
        <Editor values={article} />
      </Shell>,
    );
  }),
);

export const upsertArticle = flow(
  createSecuredContext(),
  body(
    z
      .object({
        id: z.string(),
        body: z.string({
          invalid_type_error: "body must be a string",
        }),
        description: z.string(),
        title: z.string(),
        tags: z
          .string()
          .default("")
          .transform((value) => value.trim())
          .transform((value) =>
            value == "" ? [] : value.split(",").map((name) => ({ name })),
          ),
      })
      .partial(),
  ),
  handle(
    ({ body, withDb, user }): Response =>
      pipe(
        z
          .union([
            z.object({
              id: z.string({
                required_error: "id is required",
              }),
            }),
            z.object({
              title: z.string().min(1, "title cannot be empty"),
              description: z.string().min(1, "description cannot be empty"),
              body: z.string().min(1, "body cannot be empty"),
              tags: z.array(z.object({ name: z.string() })),
            }),
          ])
          .safeParse(body),
        eitherFromZodResult,
        either.mapLeft((error) => {
          const { unionErrors } =
            error.errors.find(
              (
                error,
              ): error is Extract<z.ZodIssue, { code: "invalid_union" }> =>
                error.code === "invalid_union",
            ) ?? {};
          if (unionErrors == null) {
            return error;
          }
          return "id" in body ? unionErrors.at(0)! : unionErrors.at(1)!;
        }),
        either.mapLeft(formatZodError),
        either.map((data) => ("id" in data ? { ...body, ...data } : data)),
        either.match(
          (errors) => jsx(<Editor values={body} errors={errors} />),
          (parsed) => {
            const upserted = withDb(
              Db.upsertArticle({
                article: parsed,
                author: user,
                tags: parsed.tags ?? [],
              }),
            );
            if (upserted == null) {
              return notFound({ children: `could not find article` });
            }
            return redirect(["GET /article", { id: upserted.id }]);
          },
        ),
      ),
  ),
);
