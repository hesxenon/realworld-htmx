/**
 * program entry point
 */

import { A } from "andale";
import * as Fs from "node:fs";
import * as Routes from "./Routes";
import * as Db from "./Db";
import { ulid } from "ulid";
import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";

const dbHandle = "conduit.sqlite";

const dbSeed = Fs.existsSync(dbHandle)
  ? undefined
  : ((): Db.Seed => {
      const now = Date.now();

      const users = Array.from(
        { length: 100 },
        (): Db.User => ({
          id: ulid(),
          username: faker.internet.userName(),
          password: faker.internet.password(),
          email: faker.internet.email(),
          bio: faker.helpers.maybe(() => faker.lorem.sentence()) ?? null,
          avatar: faker.internet.avatar(),
        }),
      );

      const tags = Array.from(
        { length: 50 },
        (): Db.Tag => ({
          name: faker.lorem.word(),
        }),
      );

      const articles = faker.helpers
        .arrayElements(users, { min: 100, max: Infinity })
        .map((user) =>
          faker.helpers.multiple(
            (): Db.Article => {
              const date = faker.date.past({ years: 5 });
              const title = faker.lorem.words();
              return {
                id: ulid(),
                slug: title.replaceAll(" ", "-"),
                title,
                description: faker.lorem.sentence(),
                body: faker.lorem.paragraphs(),
                authorId: user.id,
                createdAt: date.toISOString(),
                updatedAt:
                  faker.helpers
                    .maybe(() => faker.date.between({ from: date, to: now }))
                    ?.toISOString() ?? null,
              };
            },
            {
              count: { min: 1, max: 10 },
            },
          ),
        )
        .flat();

      const comments = articles
        .map((article) =>
          faker.helpers.arrayElements(users).map((user): Db.Comment => {
            const date = faker.date.between({
              from: article.createdAt,
              to: Infinity,
            });
            return {
              id: ulid(),
              createdAt: date.toISOString(),
              authorId: user.id,
              articleId: article.id,
              content: faker.lorem.sentence(),
            };
          }),
        )
        .flat();

      const follows = users
        .map((user) =>
          faker.helpers
            .arrayElements(users, { min: 3, max: 10 })
            .filter((follows) => follows !== user)
            .map(
              (follows): Db.Follows => ({
                followsId: follows.id,
                userId: user.id,
              }),
            ),
        )
        .flat();

      const favorites = users
        .map((user) =>
          faker.helpers.arrayElements(articles).map(
            (article): Db.Favorites => ({
              articleId: article.id,
              userId: user.id,
            }),
          ),
        )
        .flat();

      const tagged = articles
        .map((article) =>
          faker.helpers.arrayElements(tags, { min: 1, max: 4 }).map(
            (tag): Db.Tagged => ({
              articleId: article.id,
              tag: tag.name,
            }),
          ),
        )
        .flat();

      return { users, articles, comments, tags, follows, favorites, tagged };
    })();

const db = Db.create(dbHandle, dbSeed);

const result = db.get<Db.User>(sql`SELECT * FROM users LIMIT 1`);
console.log(`example user credentials: ${result.username}\t${result.password}`);

const app = A.create(Routes.create(db));

const server = app.listen({ port: 3000 });

console.log(`Andale! I'm at ${server.hostname}:${server.port}`);
