# realworld-htmx

# Grok it

This realworld implementation uses the BASH Stack (Bun + Andale + Sqlite + Htmx).

Subsequently it's a server side rendered app with a rather flat structure that _does_ make use of `fp-ts` (scary monads ahead) and `zod`.

If you want to get started I'd suggest starting with `Routes` - the public asset route in particular.

The high level concept is always the same:

> incoming request -> wrap it into a context object -> extend the context as needed -> transform the context into a response -> return the response

# Run it

To install dependencies:

```bash
bun install
```

To run:

```bash
bun start
```

This project was created using `bun init` in bun v1.0.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
