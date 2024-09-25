import { createServer } from "http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";

const yoga = createYoga({
  schema,
  graphiql: {
    defaultQuery: `
      query {
        authorById(id: 1) {
          id
          fullName
        }
      }
    `,
  },
});

const server = createServer(yoga);

server.listen(4002, () =>
  console.log("author-service running at http://localhost:4002/graphql"),
);
