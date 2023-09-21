/**
 * All "Components" that the user can directly navigate to
 */

import * as DateFns from "date-fns/fp";
import * as Db from "./Db";
import {
  ButtonThatIsActuallyALink,
  Comment,
  FormErrors,
  Link,
} from "./Components";
import { url } from "./Routes";
import { marked } from "marked";
import { fromHtml } from "htmx-tsx";

type Form<T> = (T extends undefined ? { values?: T } : { values: T }) & {
  errors?: string[] | undefined;
};

export function ArticleDetail({
  article,
  currentUser,
}: {
  article: Db.ArticleDetail;
  currentUser: Db.User | undefined;
}) {
  const formatDate = DateFns.format("MMMM do");

  const formattedBody = marked(article.body);

  const articleActions = (
    <>
      <button
        class="btn btn-sm btn-outline-secondary"
        hx-post={url(["POST /profile/follow", { id: article.author.id }])}
        hx-target="find .counter"
        style={{
          marginRight: "3px",
        }}
      >
        <i
          class="ion-plus-round"
          style={{
            marginRight: "3px",
          }}
        ></i>
        Follow {article.author.username}(
        <span class="counter">{article.author.followers.length}</span>)
      </button>
      <button
        hx-post={url(["POST /favorite", { id: article.id }])}
        hx-target="find .counter"
        class="btn btn-sm btn-outline-primary"
        style={{
          marginRight: "3px",
        }}
      >
        <i
          class="ion-heart"
          style={{
            marginRight: "3px",
          }}
        ></i>
        Favorite Post (<span class="counter">{article.favoritedBy.length}</span>
        )
      </button>
      {currentUser?.id !== article.author.id ? undefined : (
        <>
          <ButtonThatIsActuallyALink
            hx-get={url(["GET /article/editor", { id: article.id }])}
            class="btn btn-sm btn-outline-secondary"
            style={{
              marginRight: "3px",
            }}
          >
            <i
              class="ion-edit"
              style={{
                marginRight: "3px",
              }}
            ></i>
            Edit Article
          </ButtonThatIsActuallyALink>
          <button
            hx-delete={url(["DELETE /article", { id: article.id }])}
            class="btn btn-sm btn-outline-danger"
          >
            <i
              class="ion-trash-a"
              style={{
                marginRight: "3px",
              }}
            ></i>
            Delete Article
          </button>
        </>
      )}
    </>
  );

  return (
    <div class="article-page">
      <div class="banner">
        <div class="container">
          <h1>{article.title}</h1>

          <div class="article-meta">
            <Link url={["GET /profile", { id: article.author.id }]}>
              <img src="http://i.imgur.com/Qr71crq.jpg" />
            </Link>
            <div class="info">
              <Link
                url={["GET /profile", { id: article.author.id }]}
                class="author"
              >
                {article.author.username}
              </Link>
              <span class="date">
                {formatDate(new Date(article.createdAt))}
              </span>
            </div>
            {articleActions}
          </div>
        </div>
      </div>

      <div class="container page">
        <div class="row article-content">
          <div class="col-md-12">
            <p>{article.description}</p>
            <h2 id="introducing-ionic">{article.title}</h2>
            <p>{fromHtml(formattedBody)}</p>
            <ul class="tag-list">
              {article.tags.map(({ name }) => (
                <li class="tag-default tag-pill tag-outline">{name}</li>
              ))}
            </ul>
          </div>
        </div>

        <hr />

        <div class="article-actions">
          <div class="article-meta">
            <a href="profile.html">
              <img src={article.author.avatar ?? undefined} />
            </a>
            <div class="info">
              <Link
                url={["GET /profile", { id: article.author.id }]}
                class="author"
              >
                {article.author.username}
              </Link>
              <span class="date">
                {formatDate(new Date(article.createdAt))}
              </span>
            </div>
            {articleActions}
          </div>
        </div>

        <div class="row">
          <div class="col-xs-12 col-md-8 offset-md-2">
            {currentUser == null ? (
              <div
                style={{
                  margin: "1rem",
                }}
              >
                <Link url={["GET /login"]}>Sign in</Link> or{" "}
                <Link url={["GET /register"]}>sign up</Link> to add comments to
                this article
              </div>
            ) : (
              <form class="card comment-form">
                <div class="card-block">
                  <textarea
                    class="form-control"
                    placeholder="Write a comment..."
                    rows={3}
                  ></textarea>
                </div>
                <div class="card-footer">
                  <img
                    src={article.author.avatar ?? undefined}
                    class="comment-author-img"
                  />
                  <button class="btn btn-sm btn-primary">Post Comment</button>
                </div>
              </form>
            )}

            {article.comments.map((comment) => (
              <Comment comment={comment} currentUser={currentUser} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Profile({
  profile,
  currentUser,
}: {
  profile: Db.Profile;
  currentUser: Db.User | undefined;
}) {
  return (
    <div class="profile-page">
      <div class="user-info">
        <div class="container">
          <div class="row">
            <div class="col-xs-12 col-md-10 offset-md-1">
              <img src={profile.avatar ?? undefined} class="user-img" />
              <h4>{profile.username}</h4>
              {profile.bio == null ? undefined : <p>{profile.bio}</p>}
              <button
                hx-post={url(["POST /profile/follow", { id: profile.id }])}
                hx-target="find .counter"
                class="btn btn-sm btn-outline-secondary action-btn"
              >
                <i class="ion-plus-round"></i>
                Follow {profile.username} (
                <span class="counter">{profile.followers.length}</span>)
              </button>
              {profile.id !== currentUser?.id ? undefined : (
                <ButtonThatIsActuallyALink
                  hx-get={url(["GET /profile/settings"])}
                  class="btn btn-sm btn-outline-secondary action-btn"
                >
                  <i class="ion-gear-a"></i>
                  Edit Profile Settings
                </ButtonThatIsActuallyALink>
              )}
            </div>
          </div>
        </div>
      </div>

      <div class="container">
        <div class="row">
          <div class="col-xs-12 col-md-10 offset-md-1">
            <div class="articles-toggle">
              <ul class="nav nav-pills outline-active">
                <li class="nav-item">
                  <a
                    hx-get={url([
                      "GET /profile/articles/own",
                      { id: profile.id, page: 0, size: 20 },
                    ])}
                    hx-target="next .feed-container"
                    hx-trigger="click,load"
                    _="on htmx:afterRequest remove .active from <.articles-toggle a.nav-link/> then add .active to me"
                    class="nav-link active"
                    href=""
                  >
                    My Articles
                  </a>
                </li>
                <li class="nav-item">
                  <a
                    hx-get={url([
                      "GET /profile/articles/favorited",
                      { id: profile.id, page: 0, size: 20 },
                    ])}
                    hx-target="next .feed-container"
                    hx-trigger="click"
                    _="on htmx:afterRequest remove .active from <.articles-toggle a.nav-link/> then add .active to me"
                    class="nav-link"
                    href=""
                  >
                    Favorited Articles
                  </a>
                </li>
              </ul>
            </div>

            <div class="feed-container"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Home({
  user,
  popularTags,
}: {
  user: Db.User | undefined;
  popularTags: Db.Tag[];
}) {
  return (
    <div class="home-page">
      <div class="banner">
        <div class="container">
          <h1 class="logo-font">conduit</h1>
          <p>A place to share your knowledge.</p>
        </div>
      </div>

      <div class="container page">
        <div class="row tab-selection">
          <div class="col-md-9">
            <div class="feed-toggle">
              <ul class="nav nav-pills outline-active">
                <li class="nav-item">
                  <a
                    hx-get={url(["GET /feed/personal", { page: 0, size: 20 }])}
                    hx-target="next .feed-container"
                    hx-trigger="click"
                    class="nav-link"
                    href=""
                    _="on htmx:afterRequest remove .active from <.feed-toggle .nav-link/> then add .active to me"
                  >
                    Your Feed
                  </a>
                </li>
                <li class="nav-item">
                  <a
                    hx-get={url(["GET /feed/global", { page: 0, size: 20 }])}
                    hx-target="next .feed-container"
                    hx-trigger="click,load"
                    class="nav-link active"
                    href=""
                    _="on htmx:afterRequest remove .active from <.feed-toggle .nav-link/> then add .active to me"
                  >
                    Global Feed
                  </a>
                </li>
              </ul>
            </div>

            <div class="feed-container"></div>
          </div>

          <div
            class="col-md-3"
            _="
            behavior TaggedFeed
              on htmx:afterRequest 
                set clone to (first <a.nav-link.active/> in closest <.container/>).cloneNode()
                set clone @hx-get to my @hx-get
                set clone @hx-trigger to 'click'
                set clone.textContent to '#' + my.textContent
                remove .active from <.feed-toggle .nav-link/>
                remove <li.nav-item.tag-feed/> 
                make an <li.nav-item.tag-feed/> put clone into it 
                put it at the end of <ul.nav.nav-pills/> in closest <.container/>
                htmx.process(clone)
              end
            end
            "
          >
            <div class="sidebar">
              <p>Popular Tags</p>

              <div class="tag-list">
                {popularTags.map((tag) => (
                  <a
                    hx-get={url([
                      "GET /feed/global",
                      { tag: tag.name, page: 0, size: 20 },
                    ])}
                    hx-target="previous .feed-container"
                    hx-trigger="click"
                    _="install TaggedFeed"
                    class="tag-pill tag-default"
                  >
                    {tag.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Login({
  values,
  errors,
}: Form<{ username: string; password: string } | undefined>) {
  return (
    <div class="auth-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">Sign in</h1>
            <p class="text-xs-center">
              <Link url={["GET /register"]}>Need an account?</Link>
            </p>

            {errors == null ? undefined : <FormErrors errors={errors} />}

            <form
              hx-post={url(["POST /login"])}
              hx-target="closest .auth-page"
              hx-swap="outerHTML"
            >
              <fieldset class="form-group">
                <input
                  name="username"
                  class="form-control form-control-lg"
                  type="text"
                  value={values?.username}
                  placeholder="Username"
                />
              </fieldset>
              <fieldset class="form-group">
                <input
                  name="password"
                  class="form-control form-control-lg"
                  type="password"
                  value={values?.username}
                  placeholder="Password"
                />
              </fieldset>
              <button
                type="submit"
                class="btn btn-lg btn-primary pull-xs-right"
              >
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Register({
  values,
  errors,
}: Form<{ username: string; email: string; password: string } | undefined>) {
  return (
    <div class="auth-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">Sign up</h1>
            <p class="text-xs-center">
              <Link url={["GET /login"]}>Have an account?</Link>
            </p>

            {errors == null ? undefined : <FormErrors errors={errors} />}

            <form
              hx-post={url(["POST /register"])}
              hx-target="closest .auth-page"
              hx-swap="outerHTML"
            >
              <fieldset class="form-group">
                <input
                  name="username"
                  class="form-control form-control-lg"
                  type="text"
                  required
                  value={values?.username}
                  placeholder="Username"
                />
              </fieldset>
              <fieldset class="form-group">
                <input
                  name="email"
                  class="form-control form-control-lg"
                  type="email"
                  required
                  value={values?.email}
                  placeholder="Email"
                />
              </fieldset>
              <fieldset class="form-group">
                <input
                  name="password"
                  class="form-control form-control-lg"
                  type="password"
                  required
                  value={values?.password}
                  placeholder="Password"
                />
              </fieldset>
              <button
                type="submit"
                class="btn btn-lg btn-primary pull-xs-right"
              >
                Sign up
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Settings({ values: user, errors }: Form<Db.User>) {
  return (
    <div class="settings-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">Your Settings</h1>

            {errors == null ? undefined : <FormErrors errors={errors} />}

            <form
              hx-put={url(["PUT /profile/settings", { id: user.id }])}
              hx-swap="outerHTML"
              hx-target="closest .settings-page"
            >
              <fieldset>
                <fieldset class="form-group">
                  <input
                    name="avatar"
                    class="form-control"
                    type="text"
                    placeholder="URL of profile picture"
                    value={user.avatar ?? undefined}
                  />
                </fieldset>
                <fieldset class="form-group">
                  <input
                    name="username"
                    class="form-control form-control-lg"
                    type="text"
                    required
                    placeholder="Your Name"
                    value={user.username}
                  />
                </fieldset>
                <fieldset class="form-group">
                  <textarea
                    name="bio"
                    class="form-control form-control-lg"
                    rows={8}
                    placeholder="Short bio about you"
                  >
                    {user.bio ?? ""}
                  </textarea>
                </fieldset>
                <fieldset class="form-group">
                  <input
                    name="email"
                    class="form-control form-control-lg"
                    type="email"
                    placeholder="Email"
                    value={user.email}
                  />
                </fieldset>
                <fieldset class="form-group">
                  <input
                    name="password"
                    class="form-control form-control-lg"
                    type="password"
                    placeholder="New Password"
                    value={user.password}
                  />
                </fieldset>
                <button
                  type="submit"
                  class="btn btn-lg btn-primary pull-xs-right"
                >
                  Update Settings
                </button>
              </fieldset>
            </form>
            <hr />
            <button
              hx-delete={url(["DELETE /logout"])}
              class="btn btn-outline-danger"
            >
              Or click here to logout.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Editor({
  values: article,
  errors,
}: Form<Partial<Db.Article & { tags: Db.Tag[] }> | undefined>) {
  function TagPill({ tag }: { tag: Pick<Db.Tag, "name"> }) {
    return (
      <span class="tag-default tag-pill">
        <i
          class="ion-close-round"
          _={`on click send removed(tag:'${tag.name}') to closest <fieldset /> then remove closest .tag-pill`}
        ></i>{" "}
        <span class="name">{tag.name}</span>
      </span>
    );
  }

  return (
    <div class="editor-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-10 offset-md-1 col-xs-12">
            {errors == null ? undefined : <FormErrors errors={errors} />}

            <form
              hx-put={url(["PUT /article/editor"])}
              hx-target="closest .editor-page"
              hx-swap="outerHTML"
            >
              <fieldset>
                <fieldset class="form-group">
                  <input
                    type="text"
                    name="title"
                    class="form-control form-control-lg"
                    placeholder="Article Title"
                    value={article?.title}
                  />
                </fieldset>
                <fieldset class="form-group">
                  <input
                    type="text"
                    name="description"
                    class="form-control"
                    placeholder="What's this article about?"
                    value={article?.description}
                  />
                </fieldset>
                <fieldset class="form-group">
                  <textarea
                    class="form-control"
                    rows={8}
                    placeholder="Write your article (in markdown)"
                    name="body"
                  >
                    {article?.body}
                  </textarea>
                </fieldset>
                <fieldset
                  class="form-group"
                  _="
                  on load
                    make a Set called :tags
                    set :tagsInput to first <input[name='tags']/> in me
                    set :tagList to first <.tag-list/> in me
                    set :template to first <template/> in me
                  end
                  on added(tag)
                    put tag into :tags
                    set clonedContent to :template.content.cloneNode(true)
                    set clone to first <.tag-pill/> in clonedContent
                    set {textContent: tag} on (first <.name/> in clone)
                    put clone at the end of :tagList then htmx.process(clone)
                    make an Array from :tags called existing
                    set :tagsInput@value to existing.join(',')
                  end
                  on removed(tag) 
                    remove tag from :tags
                    make an Array from tags called existing
                    set :tagsInput@value to existing.join(',')
                  end
                  "
                >
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Enter tags"
                    _="
                    on keydown[key=='Enter'] 
                    halt the event 
                    repeat for tag in event.target.value.split(',')
                      send added(tag:tag) to closest <fieldset/>
                    end
                    set my value to ''"
                  />
                  <input
                    hidden
                    name="tags"
                    value={article?.tags?.map(({ name }) => name).join(",")}
                  />
                  <template>
                    <TagPill tag={{ name: "" }} />
                  </template>
                  <div class="tag-list">
                    {article?.tags?.map((tag) => <TagPill tag={tag} />)}
                  </div>
                </fieldset>
                <button
                  class="btn btn-lg pull-xs-right btn-primary"
                  type="submit"
                >
                  Publish Article
                </button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
