/**
 * standalone components that can be used from wherever
 */

import * as DateFns from "date-fns/fp";
import { ArticlePreview, Comment, User } from "./Db";
import { Url, url } from "./Routes";

const formatDate = DateFns.format("MMMM do");

export function FormErrors({ errors }: { errors: string[] }) {
  return (
    <ul class="error-messages">
      {errors.map((error) => (
        <li>{error}</li>
      ))}
    </ul>
  );
}

export function Avatar({ user }: { user: User }) {
  return (
    <Link url={["GET /profile", { id: user.id }]}>
      <img src={user.avatar ?? undefined} class="comment-author-img" />
    </Link>
  );
}

export function Link(props: JSX.Element & { url: Url }) {
  return (
    <a href={url(props.url)} hx-target="main#app-root">
      {props.children}
    </a>
  );
}

export function ButtonThatIsActuallyALink({ children }: JSX.Element) {
  return (
    <button hx-target="main#app-root" hx-push-url="true">
      {children}
    </button>
  );
}

export function Shell({
  children,
  user,
  currentUrl,
}: JSX.Element & { user: User | undefined; currentUrl: string }) {
  const htmxVersion = "1.9.4";

  const NavLink = (props: JSX.Element & { url: Url }) => (
    <Link
      class={`nav-link ${currentUrl !== url(props.url) ? "" : "active"}`}
      url={props.url}
    >
      {props.children}
    </Link>
  );

  return (
    <html _="on load set global page to location.pathname + location.search then send navigation to <a[hx-target='main#app-root']/>">
      <head>
        <base href="/" />

        <title>Conduit</title>
        <link
          href="//code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css"
          rel="stylesheet"
          type="text/css"
        />
        <link
          href="//fonts.googleapis.com/css?family=Titillium+Web:700|Source+Serif+Pro:400,700|Merriweather+Sans:400,700|Source+Sans+Pro:400,300,600,700,300italic,400italic,600italic,700italic"
          rel="stylesheet"
          type="text/css"
        />
        <link rel="stylesheet" href="//demo.productionready.io/main.css" />

        <script
          src={`https://unpkg.com/htmx.org@${htmxVersion}`}
          integrity="sha384-zUfuhFKKZCbHTY6aRR46gxiqszMk5tcHjsVFxnUo8VMus4kHGVdIYVbOYYNlKmHV"
          crossOrigin="anonymous"
          defer
        ></script>
        <script src="https://unpkg.com/hyperscript.org@0.9.11" defer></script>
      </head>
      <body
        hx-boost="true"
        class="hx-indicator"
        _="
        on htmx:beforeRequest add .htmx-request to <.htmx-indicator/> in me end
        on htmx:afterRequest remove .htmx-request from <.htmx-indicator/> in me end"
      >
        <div
          class="htmx-indicator"
          style={{
            position: "fixed",
            zIndex: "999",
            top: "0",
            left: "0",
            height: "100vh",
            width: "100vw",
            pointerEvents: "none",
            backdropFilter: "blur(2px)",
            background: "rgba(255, 255, 255, 0.5)",
          }}
        ></div>
        <nav class="navbar navbar-light">
          <div class="container">
            <Link class="navbar-brand" url={["GET /"]}>
              conduit
            </Link>
            <ul class="nav navbar-nav pull-xs-right">
              <li class="nav-item">
                <NavLink url={["GET /"]}>Home</NavLink>
              </li>
              {user == null ? (
                <>
                  <li class="nav-item">
                    <NavLink url={["GET /login"]}>Sign in</NavLink>
                  </li>
                  <li class="nav-item">
                    <NavLink url={["GET /register"]}>Sign up</NavLink>
                  </li>
                </>
              ) : (
                <>
                  <li class="nav-item">
                    <NavLink url={["GET /article/editor", {}]}>
                      New Article
                    </NavLink>
                  </li>
                  <li class="nav-item">
                    <NavLink url={["GET /profile/settings"]}>Settings</NavLink>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>

        <main
          id="app-root"
          style={{
            ...({
              "view-transition-name": "card",
            } as unknown as CSSStyleDeclaration),
          }}
        >
          {children}
        </main>

        <footer>
          <div class="container">
            <Link url={["GET /"]} class="logo-font">
              conduit
            </Link>
            <span class="attribution">
              An interactive learning project from{" "}
              <a href="https://thinkster.io">Thinkster</a>. Code &amp; design
              licensed under MIT.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

export function ArticlePreview({ article }: { article: ArticlePreview }) {
  return (
    <div class="article-preview">
      <div class="article-meta">
        <Avatar user={article.author} />
        <div class="info">
          <Link
            url={["GET /profile", { id: article.author.id }]}
            class="author"
          >
            {article.author.username}
          </Link>
          <span class="date">{formatDate(new Date(article.createdAt))}</span>
        </div>
        <button
          hx-post={url(["POST /favorite", { id: article.id }])}
          hx-target="find .counter"
          class="btn btn-outline-primary btn-sm pull-xs-right"
        >
          <i class="ion-heart"></i>{" "}
          <span class="counter">{article.favoritedBy.length}</span>
        </button>
      </div>
      <Link url={["GET /article", { id: article.id }]} class="preview-link">
        <h1>{article.title}</h1>
        <p>{article.description}</p>
        <span>Read more...</span>
        <ul class="tag-list">
          {article.tags.map((tag) => (
            <li class="tag-default tag-pill tag-outline">{tag.name}</li>
          ))}
        </ul>
      </Link>
    </div>
  );
}

export function Comment({
  comment,
  currentUser,
}: {
  comment: Comment & { author: User };
  currentUser: User | undefined;
}) {
  return (
    <div class="card">
      <div class="card-block">
        <p class="card-text">{comment.content}</p>
      </div>
      <div class="card-footer">
        <Avatar user={comment.author} />
        &nbsp;
        <Link
          url={["GET /profile", { id: comment.author.id }]}
          class="comment-author"
        >
          {comment.author.username}
        </Link>
        <span class="date-posted">
          {formatDate(new Date(comment.createdAt))}
        </span>
        {currentUser?.id !== comment.author.id ? undefined : (
          <span class="mod-options">
            <i class="ion-trash-a"></i>
          </span>
        )}
      </div>
    </div>
  );
}

export function Feed({
  articles,
  pagination: { page, size },
  getPaginationUrl,
}: {
  articles: ArticlePreview[];
  pagination: { page: number; size: number };
  getPaginationUrl: (index: number) => Url;
}) {
  return (
    <article>
      {articles.map((article) => (
        <ArticlePreview article={article} />
      ))}
      <ul class="pagination">
        {Array.from({
          length: Math.ceil(articles.length / size),
        }).map((_, index) => (
          <li class={`page-item ${index === page ? "active" : ""}`}>
            <a
              hx-get={url(getPaginationUrl(index))}
              hx-target="closest article"
              hx-swap="outerHTML"
              class={`page-link ${index !== page ? "" : "active"}`}
            >
              {index + 1}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
