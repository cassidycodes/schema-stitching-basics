import { createServer, Server } from "http";
import { setupServer } from "msw/node";
import { http, passthrough } from "msw";
import { GraphQLVariables, HttpResponse, graphql } from "msw";
import supertest from "supertest";
import TestAgent from "supertest/lib/agent";
import Test from "supertest/lib/test";
import { createYoga } from "graphql-yoga";
import { makeGatewaySchema } from "../../make-gateway-schema";

// Using port 4005 here in case you have `yarn start` running
const GATEWAY_SERVER_PORT = 4005;

// Set up a mock service worker to intercept HTTP requests
const getHttpInterceptor = () => {
  const mswServer = setupServer();
  // generic handler that passes requests through to the gatewayServer
  const localGqlHandler = http.post(
    `http://127.0.0.1:${GATEWAY_SERVER_PORT}/graphql`,
    async () => {
      return passthrough();
    },
  );
  // Add the handler to the server
  mswServer.use(localGqlHandler);
  // Start the MSW interceptor
  mswServer.listen();
  return mswServer;
};

const httpInterceptor = getHttpInterceptor();
let gatewayServer: Server;
let gatewayRequest: TestAgent<Test>;

describe("bookById", () => {
  beforeAll(async () => {
    // Create the server application and liten on a port
    const gatewayApp = createYoga({ schema: makeGatewaySchema() });
    gatewayServer = createServer(gatewayApp);
    await new Promise<void>((resolve) => {
      gatewayServer.listen(GATEWAY_SERVER_PORT, resolve);
    });

    // Initialize supertest so that it can make requests to the gatewayServer
    gatewayRequest = supertest(gatewayServer);

    // Start the mock service worker to intercept requests
    httpInterceptor.listen();
  });

  afterAll(async () => {
    // Close the mock service worker / interceptor
    httpInterceptor.close();

    // Close the server, ensure it is fully shut down before exiting
    await new Promise<void>((resolve, reject) =>
      gatewayServer.close((err) => (err ? reject(err) : resolve())),
    );
  });

  afterEach(() => {
    // Reset the handlers between tests
    httpInterceptor.resetHandlers();
  });

  const QUERY = `
    query bookById($id: ID!) {
      bookById(id: $id) {
        id
        title
      }
    }
  `;

  const expectedVariables = {
    id: "1",
  };

  let actualVariables: GraphQLVariables;

  // Listen to graphql requests to book service
  const bookByIdMock = graphql.link("http://localhost:4001/graphql");

  // mock the bookById query
  const getBookByIdHandler = bookByIdMock.query("bookById", (info) => {
    // NOTE: Best practice is to use Jest to validate expectations. Don't throw errors in the handler.
    // Store the variables to compare later
    actualVariables = info.variables;
    return HttpResponse.json({
      data: {
        bookById: {
          id: "1",
          title: "Book 1",
        },
      },
    });
  });

  it("responds correctly", async () => {
    httpInterceptor.use(getBookByIdHandler);

    const gatewayResponse = await gatewayRequest
      .post("/graphql")
      .set("Content-type", "application/json")
      .send({
        query: QUERY,
        variables: expectedVariables,
        operationName: "bookById",
      });

    expect(gatewayResponse.body).toEqual({
      data: { bookById: { id: "1", title: "Book 1" } },
    });
    expect(actualVariables).toEqual(expectedVariables);
  });
});
