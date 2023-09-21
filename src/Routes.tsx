/**
 * only the "mountpoints" - i.e. which logic should be available under which url
 */

import { A } from "andale";
import {
  favoriteArticle,
  followProfile,
  getArticle,
  getGlobalFeed,
  getHome,
  getPersonalFeed,
  getProfile,
  getRegister,
  getLogin,
  register,
  login,
  getSettings,
  updateSettings,
  getPublicAsset,
  getOwnArticles,
  getFavoritedArticles,
  getEditor,
  upsertArticle,
  logout,
  deleteArticle,
} from "./Handlers";
import { Db } from "./Db";

export const create = (db: Db) =>
  A.routes({
    "": {
      get: getHome(db),
    },
    feed: {
      global: {
        get: getGlobalFeed(db),
      },
      personal: {
        get: getPersonalFeed(db),
      },
    },
    login: {
      get: getLogin(db),
      post: login(db),
    },
    logout: {
      delete: logout,
    },
    register: {
      get: getRegister(db),
      post: register(db),
    },
    article: {
      "": {
        get: getArticle(db),
        delete: deleteArticle(db),
      },
      editor: {
        get: getEditor(db),
        put: upsertArticle(db),
      },
    },
    profile: {
      "": {
        get: getProfile(db),
      },
      follow: {
        post: followProfile(db),
      },
      settings: {
        get: getSettings(db),
        put: updateSettings(db),
      },
      articles: {
        own: {
          get: getOwnArticles(db),
        },
        favorited: {
          get: getFavoritedArticles(db),
        },
      },
    },
    favorite: {
      post: favoriteArticle(db),
    },
    public: {
      [A.wildcard]: getPublicAsset,
    },
  });
export type Routes = ReturnType<typeof create>;

export type Url = A.Url<Routes>;
export const url = A.url<Routes>;
