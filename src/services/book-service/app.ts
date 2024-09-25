import { createServer } from "http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";

const yoga = createYoga({
  schema,
  graphiql: {
    defaultQuery: `
      query {
        bookById(id: 1) {
          id
          title
        }
      }
    `,
  },
});

const server = createServer(yoga);

server.listen(4001, () =>
  console.log("book-service running at http://localhost:4001/graphql"),
);
