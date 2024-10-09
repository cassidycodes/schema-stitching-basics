import { buildHTTPExecutor } from "@graphql-tools/executor-http";
import { stitchSchemas } from "@graphql-tools/stitch";
import { schema as bookSchema } from "../src/services/book-service/schema";
import { schema as authorSchema } from "../src/services/author-service/schema";
// import { schema as publisherSchema } from "../src/services/publisher-service/schema";
import { documentSourceService } from "./document-source-service";
import { print } from "graphql";
import { ExecutionRequest } from "@graphql-tools/utils";

const buildExec = (port: number, serviceName: string) => {
  const executor = buildHTTPExecutor({
    endpoint: `http://localhost:${port}/graphql`,
  });
  return async (request: ExecutionRequest) => {
    console.info(`${serviceName} executor sending:`, {
      query: print(request.document),
      variables: request.variables,
    });
    return executor(request);
  };
};

export async function makeGatewaySchema() {
  const bookExec = buildExec(4001, "book-service");
  const authorExec = buildExec(4002, "author-service");
  // const publisherExec = buildExec(4003, "publisher-service");

  const schema = stitchSchemas({
    subschemas: [
      {
        schema: bookSchema,
        executor: bookExec,
        transforms: [documentSourceService({ serviceName: "book-service" })],
      },
      {
        schema: authorSchema,
        executor: authorExec,
        transforms: [documentSourceService({ serviceName: "author-service" })],
      },
    ],
    mergeTypes: true,
  });

  return schema;
}
