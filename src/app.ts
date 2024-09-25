import { createYoga } from "graphql-yoga";
import { createServer } from "http";
import { makeGatewaySchema } from "./make-gateway-schema";

const gatewayApp = createYoga({
  schema: makeGatewaySchema(),
  graphiql: {
    defaultQuery: `
      query bookById {
        bookById(id: 1) {
          id
          title
        }
      }
    `,
  },
});

const server = createServer(gatewayApp);

server.listen(4000, () => {
  console.log("gateway running at http://localhost:4000/graphql");
});
