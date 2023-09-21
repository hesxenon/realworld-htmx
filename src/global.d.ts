import * as HTMX from "htmx-tsx";

declare global {
  namespace JSX {
    interface HypescriptAttributes {
      _?: string;
    }
    interface IntrinsicAttributes
      extends HTMXAttributes,
        HypescriptAttributes {}

    interface Element extends HypescriptAttributes {}
  }
}

