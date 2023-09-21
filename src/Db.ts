/**
 * Persistence operations
 */

import Database from "bun:sqlite";
import {
  SQL,
  Table,
  and,
  desc,
  eq,
  inArray,
  relations,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  BaseSQLiteDatabase,
  ForeignKey,
  Index,
  PrimaryKey,
  SQLiteColumn,
  SQLiteSyncDialect,
  SQLiteTableWithColumns,
  getTableConfig,
  index,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { notNullish } from "./Utils";
import { flow, pipe } from "fp-ts/lib/function";
import { array, either, reader, string } from "fp-ts";
import { ulid } from "ulid";

const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
});
export type User = typeof users.$inferSelect;

const follows = sqliteTable(
  "follows",
  {
    userId: text("userId").notNull(),
    followsId: text("followsId").notNull(),
  },
  (follows) => ({
    pk: primaryKey(follows.userId, follows.followsId),
  }),
);
export type Follows = typeof follows.$inferSelect;

const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  body: text("body").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt"),
  authorId: text("authorId")
    .notNull()
    .references(() => users.id),
});
export type Article = typeof articles.$inferSelect;

const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  articleId: text("articleId")
    .notNull()
    .references(() => articles.id),
  authorId: text("authorId")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: text("createdAt").notNull(),
});
export type Comment = typeof comments.$inferSelect;

const favorites = sqliteTable(
  "favorites",
  {
    userId: text("userId").notNull(),
    articleId: text("articleId").notNull(),
  },
  (favorites) => ({
    pk: primaryKey(favorites.userId, favorites.articleId),
    favoriteUserId: index("favoriteUserId").on(favorites.userId),
    favoriteArticleId: index("favoriteArticleId").on(favorites.articleId),
  }),
);
export type Favorites = typeof favorites.$inferSelect;

const tags = sqliteTable("tags", {
  name: text("name").notNull().primaryKey(),
});
export type Tag = typeof tags.$inferSelect;

const tagged = sqliteTable(
  "tagged",
  {
    articleId: text("articleId").notNull(),
    tag: text("tag").notNull(),
  },
  (tagged) => ({
    pk: primaryKey(tagged.articleId, tagged.tag),
  }),
);
export type Tagged = typeof tagged.$inferSelect;

const userRelations = relations(users, ({ many }) => ({
  follows: many(follows, { relationName: "follows" }),
  followers: many(follows, { relationName: "followers" }),
  favorites: many(favorites),
}));

const articleRelations = relations(articles, ({ one, many }) => ({
  favoritedBy: many(favorites),
  tags: many(tagged),
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

const commentRelations = relations(comments, ({ one }) => ({
  article: one(articles, {
    fields: [comments.articleId],
    references: [articles.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

const tagRelations = relations(tags, ({ many }) => ({
  tagged: many(tagged),
}));

const taggedRelations = relations(tagged, ({ one }) => ({
  tag: one(tags, {
    fields: [tagged.tag],
    references: [tags.name],
  }),
  article: one(articles, {
    fields: [tagged.articleId],
    references: [articles.id],
  }),
}));

const followsRelations = relations(follows, ({ one }) => ({
  user: one(users, {
    fields: [follows.userId],
    references: [users.id],
  }),
  follows: one(users, {
    fields: [follows.followsId],
    references: [users.id],
  }),
}));

const favoritesRelations = relations(favorites, ({ one }) => ({
  article: one(articles, {
    fields: [favorites.articleId],
    references: [articles.id],
  }),
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
}));

/**
 * creates a new database table from its drizzle config
 *
 * Why isn't this part of drizzle...
 */
const createTableDDL =
  (db: BaseSQLiteDatabase<any, any, any, any>) =>
  (table: SQLiteTableWithColumns<any>) => {
    const dialect = new SQLiteSyncDialect();
    const toString = (x: { getSQL: () => SQL }) =>
      dialect.sqlToQuery(x.getSQL()).sql;
    const removeQualifier = (identifier: string) =>
      identifier.replace(/.*\./, "");

    const { name, columns, indexes, primaryKeys, foreignKeys } =
      getTableConfig(table);

    const createColumn = (column: SQLiteColumn) => {
      const fragments = [
        column.name,
        column.dataType,
        !column.primary ? undefined : "PRIMARY KEY",
        !column.notNull ? undefined : "NOT NULL",
      ];
      return fragments.filter(notNullish).join(" ");
    };
    const createPrimaryKey = (key: PrimaryKey) => {
      const fragments = [
        "PRIMARY KEY",
        `(${key.columns.map((col) => col.name).join(",")})`,
      ];
      return fragments.filter(notNullish).join(" ");
    };
    const createForeignKey = (key: ForeignKey) => {
      const { foreignTable, foreignColumns, columns } = key.reference();
      const fragments = [
        "FOREIGN KEY",
        `(${columns.map(flow(toString, removeQualifier))})`,
        "REFERENCES",
        toString(foreignTable),
        `(${foreignColumns.map(flow(toString, removeQualifier))})`,
        key.onUpdate == null ? undefined : `ON UPDATE ${key.onUpdate}`,
        key.onDelete == null ? undefined : `ON DELETE ${key.onDelete}`,
      ];

      return fragments.filter(notNullish).join(" ");
    };
    const createIndex = ({ config }: Index) => {
      const fragments = [
        "CREATE",
        !config.unique ? undefined : "UNIQUE",
        "INDEX",
        "IF NOT EXISTS",
        config.name,
        "ON",
        toString(config.table),
        `(${config.columns.map(flow(toString, removeQualifier))})`,
      ];
      return fragments.filter(notNullish).join(" ");
    };
    const query = `
    CREATE TABLE IF NOT EXISTS ${name} (\n\t${[
      ...columns.map(createColumn),
      ...primaryKeys.map(createPrimaryKey),
      ...foreignKeys.map(createForeignKey),
    ].join(",\n\t")}
    )`;

    const indices = indexes.map(createIndex);

    db.run(sql.raw(query));
    indices.forEach((index) => db.run(sql.raw(index)));
  };

const withDb = <T>(fn: (db: Db) => T) => reader.asks(fn);

export const create = (
  handle = ":memory:",
  seed?: {
    users: User[];
    articles: Article[];
    comments: Comment[];
    tags: Tag[];
    follows: Follows[];
    favorites: Favorites[];
    tagged: Tagged[];
  },
) => {
  const raw = new Database(handle);
  const db = drizzle(raw, {
    schema: {
      users,
      userRelations,

      articles,
      articleRelations,

      comments,
      commentRelations,

      tags,
      tagRelations,

      follows,
      followsRelations,

      favorites,
      favoritesRelations,

      tagged,
      taggedRelations,
    },
  });

  const defineTable = createTableDDL(db);

  defineTable(users);
  defineTable(articles);
  defineTable(comments);
  defineTable(follows);
  defineTable(favorites);
  defineTable(tags);
  defineTable(tagged);

  if (seed != null) {
    db.transaction((db) => {
      const setupTable = <T>(table: Table, values: T[]) => {
        db.delete(table).run();

        pipe(values, array.chunksOf(10_000)).forEach((chunk) =>
          db.insert(table).values(chunk).onConflictDoNothing().run(),
        );
      };

      setupTable(users, seed.users);
      setupTable(tags, seed.tags);
      setupTable(articles, seed.articles);
      setupTable(comments, seed.comments);
      setupTable(follows, seed.follows);
      setupTable(tagged, seed.tagged);
      setupTable(favorites, seed.favorites);
    });
  }

  return db;
};
export type Db = ReturnType<typeof create>;
export type Seed = Parameters<typeof create>[1];

export const getArticlePreviews = ({
  page,
  size,
  tag,
  fromAuthor,
  forUser,
  favoritedBy,
}: {
  page: number;
  size: number;
  tag?: string;
  fromAuthor?: Pick<User, "id">;
  forUser?: Pick<User, "id">;
  favoritedBy?: Pick<User, "id">;
}) =>
  withDb((db) =>
    db.transaction((db) => {
      const userFollows =
        forUser == null
          ? undefined
          : inArray(
              articles.authorId,
              pipe(db, getFollowers(forUser)).map(({ id }) => id),
            );

      const tagEquals = tag == null ? undefined : eq(tagged.tag, tag);

      const authorEquals =
        fromAuthor == null ? undefined : eq(articles.authorId, fromAuthor.id);

      const limitToFavorites =
        favoritedBy == null ? undefined : eq(favorites.userId, favoritedBy.id);

      const statement = db.query.articles.findMany({
        with: {
          author: true,
          tags: {
            where: tagEquals,
            with: {
              tag: true,
            },
          },
          favoritedBy: {
            where: limitToFavorites,
            with: {
              user: true,
            },
          },
        },
        where: and(
          authorEquals,
          userFollows,
          tagEquals == null ? undefined : sql`json_array_length(tags) > 0`,
          limitToFavorites == null
            ? undefined
            : sql`json_array_length(favoritedBy) > 0`,
        ),
        orderBy: desc(articles.id),
        limit: size,
        offset: page * size,
      });

      const totalHits = (() => {
        const query = statement.toSQL();
        let index = 0;
        const raw = query.sql
          .replaceAll("?", () => {
            const param = query.params.at(index++)!;
            return typeof param === "string" ? `'${param}'` : (param as string);
          })
          .replace(/select/i, "select count(*) count,")
          .replace(/(.*)limit \d+/i, "$1")
          .replace(/(.)offset \d+/i, "$1");
        const result = db.all(sql.raw(raw)).at(0) as { count: number };
        return result.count;
      })();

      const result = statement.sync();

      return Object.assign(
        result.map((entry) => ({
          ...entry,
          tags: entry.tags.map(({ tag }) => tag),
          favoritedBy: entry.favoritedBy.map(({ user }) => user),
        })),
        { length: totalHits },
      );
    }),
  );
export type ArticlePreview = ReturnType<
  ReturnType<typeof getArticlePreviews>
>[number];

export const getProfile = (user: Pick<User, "id">) =>
  withDb((db) =>
    db.transaction((db) => {
      const found = db.query.users
        .findMany({
          where: eq(users.id, user.id),
          limit: 1,
        })
        .sync()
        .at(0);

      if (found == null) {
        return undefined;
      }

      const followers = pipe(db, getFollowers(user));

      return Object.assign(found, { followers });
    }),
  );
export type Profile = NonNullable<ReturnType<ReturnType<typeof getProfile>>>;

export const getFollowers = (user: Pick<User, "id">) =>
  withDb((db) =>
    db.query.follows
      .findMany({
        with: {
          user: true,
        },
        where: eq(follows.followsId, user.id),
      })
      .sync()
      .map(({ user }) => user),
  );

export const getTags = () => withDb((db) => db.select().from(tags).all());

export const favoriteArticle = (favorite: Favorites) =>
  withDb((db) =>
    db.transaction((db) => {
      const userLikesArticleAlready =
        db
          .select()
          .from(favorites)
          .where(eq(favorites.userId, favorite.userId))
          .all().length > 0;

      if (userLikesArticleAlready) {
        db.delete(favorites).where(eq(favorites.userId, favorite.userId)).run();
      } else {
        db.insert(favorites).values(favorite).run();
      }

      return db.query.favorites
        .findMany({
          where: eq(favorites.articleId, favorite.articleId),
          columns: {},
          with: {
            user: true,
          },
        })
        .sync()
        .map(({ user }) => user);
    }),
  );

export const getArticle = (article: Pick<Article, "id">) =>
  withDb((db) =>
    db.transaction((db) => {
      const found = db.query.articles
        .findMany({
          where: eq(articles.id, article.id),
          with: {
            author: true,
            favoritedBy: true,
            tags: {
              with: {
                tag: true,
              },
            },
            comments: {
              with: {
                author: true,
              },
            },
          },
        })
        .sync()
        .at(0);

      if (found == null) {
        return undefined;
      }

      const authorFollowers = db.query.follows
        .findMany({
          where: eq(follows.followsId, found.author.id),
          with: {
            user: true,
          },
        })
        .sync()
        .map(({ user }) => user);

      return {
        ...found,
        author: {
          ...found.author,
          followers: authorFollowers,
        },
        tags: found.tags.map(({ tag }) => tag),
      };
    }),
  );
export type ArticleDetail = NonNullable<
  ReturnType<ReturnType<typeof getArticle>>
>;

export const followUser = (follower: Follows) =>
  withDb((db) =>
    db.transaction((db) => {
      const userFollowsUser = and(
        eq(follows.userId, follower.userId),
        eq(follows.followsId, follower.followsId),
      );

      const userFollowsAlready =
        db.select().from(follows).where(userFollowsUser).all().length > 0;

      if (userFollowsAlready) {
        db.delete(follows).where(userFollowsUser).run();
      } else {
        db.insert(follows).values(follower).run();
      }

      return {
        newFollowerAmount: db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(follows)
          .where(eq(follows.followsId, follower.followsId))
          .all()
          .at(0)!.count,
        /**
         * whether or not the given user now follows the given other user
         */
        userFollowsUser: !userFollowsAlready,
      };
    }),
  );

export const getUserByCredentials = (
  credentials: Pick<User, "username" | "password">,
) =>
  withDb((db) =>
    db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, credentials.username),
          eq(users.password, credentials.password),
        ),
      )
      .all()
      .at(0),
  );

export const addUser = (
  addUserRequest: Pick<User, "username" | "password" | "email">,
) =>
  withDb((db) =>
    either.tryCatch(
      () =>
        db
          .insert(users)
          .values({
            ...addUserRequest,
            id: ulid(),
          })
          .returning()
          .all()
          .at(0)!,
      () => "email already taken",
    ),
  );

export const getUserById = (user: Pick<User, "id">) =>
  withDb((db) =>
    db.select().from(users).where(eq(users.id, user.id)).all().at(0),
  );

export const updateUser = (user: Partial<User> & Pick<User, "id">) =>
  withDb((db) => db.update(users).set(user).where(eq(users.id, user.id)).run());

export const upsertArticle = ({
  article,
  author,
  tags,
}: {
  article:
    | (Partial<Article> & Pick<Article, "id">)
    | Omit<Article, "id" | "createdAt" | "updatedAt" | "slug" | "authorId">;
  author: Pick<User, "id">;
  tags: Tag[];
}) =>
  withDb((db) =>
    db.transaction((db) => {
      const upserted = (() => {
        if ("id" in article) {
          return db
            .update(articles)
            .set(article)
            .where(eq(articles.id, article.id))
            .returning()
            .all()
            .at(0);
        } else {
          const createdAt = new Date();
          return db
            .insert(articles)
            .values({
              ...article,
              slug: article.title.toLowerCase().replaceAll(" ", "-"),
              createdAt: createdAt.toISOString(),
              updatedAt: null,
              authorId: author.id,
              id: ulid(createdAt.valueOf()),
            })
            .returning()
            .all()
            .at(0)!;
        }
      })();

      if (upserted == null) {
        return undefined;
      }

      const existingTags = db.query.tagged
        .findMany({
          where:
            tags.length === 0
              ? undefined
              : inArray(
                  tagged.tag,
                  tags.map(({ name }) => name),
                ),
        })
        .sync()
        .map(({ tag }) => tag);
      const nextTags = tags.map(({ name }) => name);

      const stringDiff = array.difference(string.Eq);

      const toAdd = stringDiff(nextTags, existingTags);
      const toRemove = stringDiff(existingTags, nextTags);

      if (toRemove.length > 0) {
        db.delete(tagged).where(inArray(tagged.tag, toRemove)).run();
      }
      if (toAdd.length > 0) {
        db.insert(tagged)
          .values(toAdd.map((name) => ({ articleId: upserted.id, tag: name })))
          .onConflictDoNothing()
          .run();
      }

      return pipe(db, getArticle(upserted));
    }),
  );

export const deleteArticle = (article: Pick<Article, "id">) =>
  withDb((db) => db.delete(articles).where(eq(articles.id, article.id)).run());
