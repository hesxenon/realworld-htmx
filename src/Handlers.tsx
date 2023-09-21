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
import { either } from "fp-ts";
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
import { eitherFromZodResult, tap } from "./Utils";

const {
  Validate: { query, body },
  Middleware: { bodyParser },
  Context: { withCookies },
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

const pagination = z.object({
  page: z.coerce.number().optional().default(0),
  size: z.coerce.number().optional().default(20),
});

export const getPublicAsset = pipe(
  A.HTTP.context(),
  A.HTTP.Context.withCaching(),
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
  handle(({ query, withDb, user, Shell }) => {
    const article = withDb(Db.getArticle(query));
    if (article == null) {
      return notFound();
    }
    return jsx(
      <Shell>
        <ArticleDetail article={article} currentUser={user} />
      </Shell>,
    );
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

export const getGlobalFeedPage = flow(
  createRootContext(),
  tryGetUser(),
  query(pagination.extend({ tag: z.string().optional() })),
  handle(({ query, withDb }) => {
    const articles = withDb(Db.getArticlePreviews(query));
    return jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /feed/global",
          { ...query, page: index },
        ]}
      />,
    );
  }),
);

export const getPersonalFeedPage = flow(
  createSecuredContext(),
  query(pagination),
  handle(({ query, withDb, user }) => {
    const articles = withDb(Db.getArticlePreviews({ ...query, forUser: user }));
    return jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /feed/personal",
          { ...query, page: index },
        ]}
      />,
    );
  }),
);

export const getHome = flow(
  createRootContext(),
  tryGetUser(),
  handle(({ withDb, Shell, user }) => {
    const popularTags = withDb(Db.getTags());
    return jsx(
      <Shell>
        <Home user={user} popularTags={popularTags} />
      </Shell>,
    );
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
  handle(({ withDb, body, setCookie }) => {
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

    return pipe(
      new Response(undefined, {
        headers: {
          "hx-redirect": "/",
        },
      }),
      setCookie("jwt", jwt, { httpOnly: true }),
    );
  }),
);

export const getRegister = flow(
  createRootContext(),
  handle(() => {
    return jsx(<Register />);
  }),
);

export const register = flow(
  createRootContext(),
  body(
    z.object({
      username: z.string(),
      password: z.string(),
      email: z.string().email(),
    }),
  ),
  handle(({ withDb, body }) => {
    const createNewUserResult = withDb(Db.addUser(body));
    return pipe(
      createNewUserResult,
      either.match(
        (error) =>
          new Response(
            toHtml(
              <ul>
                <li>{error}</li>
              </ul>,
            ),
          ),
        () =>
          new Response(undefined, {
            headers: {
              "hx-location": "/login",
            },
          }),
      ),
    );
  }),
);

export const getSettings = flow(
  createSecuredContext(),
  handle(({ user, Shell }) => {
    return jsx(
      <Shell>
        <Settings user={user} />
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
  handle(({ withDb, body, query, user }) => {
    const validationResult = z
      .object({
        username: z.string().min(1, "username is required"),
        password: z.string().min(1, "password is required"),
        email: z.string().email(),
        bio: z.string(),
        avatar: z.string().url(),
      })
      .safeParse(body);

    if (validationResult.success) {
      withDb(Db.updateUser({ id: query.id, ...body }));
    }

    return jsx(
      <Settings
        user={{ id: user.id, ...body }}
        validationError={
          validationResult.success ? undefined : validationResult.error
        }
      />,
    );
  }),
);

export const getOwnArticles = flow(
  createRootContext(),
  query(pagination.extend({ id: z.string() })),
  handle(({ query, withDb }) => {
    const articles = withDb(
      Db.getArticlePreviews({
        ...query,
        fromAuthor: query,
      }),
    );

    return jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /profile/articles/own",
          { ...query, page: index },
        ]}
      />,
    );
  }),
);

export const getFavoritedArticles = flow(
  createRootContext(),
  query(pagination.extend({ id: z.string() })),
  handle(({ query, withDb }) => {
    const articles = withDb(
      Db.getArticlePreviews({ ...query, favoritedBy: query }),
    );

    return jsx(
      <Feed
        articles={articles}
        pagination={query}
        getPaginationUrl={(index) => [
          "GET /profile/articles/favorited",
          { ...query, page: index },
        ]}
      />,
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
        <Editor article={article} />
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
  handle(({ body, withDb, user }) =>
    pipe(
      z
        .union([
          z.object({
            id: z.string({
              required_error: "id is required",
            }),
          }),
          z.object({
            body: z.string().min(1, "body cannot be empty"),
            description: z.string().min(1, "description cannot be empty"),
            title: z.string().min(1, "title cannot be empty"),
            tags: z.array(z.object({ name: z.string() })),
          }),
        ])
        .safeParse(body),
      eitherFromZodResult,
      either.mapLeft((error) => {
        const { unionErrors } =
          error.errors.find(
            (error): error is Extract<z.ZodIssue, { code: "invalid_union" }> =>
              error.code === "invalid_union",
          ) ?? {};
        if (unionErrors == null) {
          return error;
        }
        return "id" in body ? unionErrors.at(0) : unionErrors.at(1);
      }),
      either.map((data) => ("id" in data ? { ...body, ...data } : data)),
      either.match(
        (error) => jsx(<Editor article={body} validationError={error} />),
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
          return jsx(<Editor article={upserted} />);
        },
      ),
    ),
  ),
);
