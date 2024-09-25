import { createServer } from "http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";

const yoga = createYoga({
  schema,
  graphiql: {
    defaultQuery: `
      query {
        publisherById(id: 1) {
          id
          name
        }
      }
    `,
  },
});

const server = createServer(yoga);

server.listen(4003, () =>
  console.log("publisher-service running at http://localhost:4003/graphql"),
);
